import { after, NextResponse, type NextRequest } from "next/server";
import { createServiceSupabase } from "@/lib/supabase/service";
import { CONSENT_COOKIE, SESSION_COOKIE, parseConsent } from "@/lib/domain/consent";
import { MARKET_COOKIE, resolveMarket } from "@/lib/domain/markets";
import { DEFAULT_LOCALE, LOCALE_PREFIX, LOCALES, type Locale } from "@/i18n/routing";
import { getAvailableMarkets } from "@/lib/data/taxonomy";
import { rateLimit } from "@/lib/security/rate-limit";
import { referrerPath } from "@/lib/tracking/events";
import { resolveGo, type GoOffer, type GoRepo } from "@/lib/tracking/go";

function serviceRepo(): GoRepo {
  const sb = createServiceSupabase();
  return {
    async getProduct(id) {
      const { data: p } = await sb.from("products").select("id, slug, status, sale_mode").eq("id", id).maybeSingle();
      if (!p) return null;
      const saleMode = p.sale_mode === "own" ? "own" : "affiliate";
      const { data: enabled } = await sb.rpc("business_model_enabled", { p_mode: saleMode });
      const { data: links } = await sb
        .from("affiliate_links")
        .select("id, store_id, network_id, market, currency, active, price_minor, price_updated_at, price_source, previous_price_minor, previous_verified, affiliate_url, original_url, stores!inner(active, price_display_policy, network_id, affiliate_networks(adapter, price_display_policy))")
        .eq("product_id", id)
        .eq("active", true);
      const offers: GoOffer[] = (links ?? [])
        .filter((l) => l.stores?.active)
        .map((l) => {
          const net = l.stores?.affiliate_networks;
          return {
            id: l.id,
            storeId: l.store_id,
            networkId: l.network_id ?? l.stores?.network_id ?? null,
            market: l.market,
            currency: l.currency,
            active: l.active,
            policy: (l.stores?.price_display_policy ?? net?.price_display_policy ?? "show") === "link_only" ? "link_only" : "show",
            priceMinor: l.price_minor,
            priceUpdatedAt: l.price_updated_at,
            previousPriceMinor: l.previous_price_minor,
            previousVerified: l.previous_verified,
            priceSource: l.price_source,
            requiresFreshIntegration: net?.adapter === "amazon" || net?.adapter === "amazon_paapi",
            history: [],
            affiliateUrl: l.affiliate_url,
            originalUrl: l.original_url,
          };
        });
      return { id: p.id, slug: p.slug, published: p.status === "published", saleMode, modeEnabled: enabled === true, offers };
    },
    async getStoreDomains(storeId) {
      const { data } = await sb.from("store_domains").select("domain").eq("store_id", storeId);
      return (data ?? []).map((d) => d.domain);
    },
    async getNetwork(id) {
      const { data } = await sb.from("affiliate_networks").select("subid_param").eq("id", id).maybeSingle();
      return data ? { subidParam: data.subid_param } : null;
    },
    async getCampaignId(slug) {
      const { data } = await sb.from("campaigns").select("id").eq("slug", slug).maybeSingle();
      return data?.id ?? null;
    },
  };
}

function localeFrom(req: NextRequest): Locale {
  const ref = req.headers.get("referer");
  if (ref) {
    try {
      const first = `/${new URL(ref).pathname.split("/")[1] ?? ""}`;
      const found = LOCALES.find((l) => LOCALE_PREFIX[l] === first);
      if (found) return found;
    } catch {
      /* ignore */
    }
  }
  const cookie = req.cookies.get("NEXT_LOCALE")?.value;
  return LOCALES.find((l) => l === cookie) ?? DEFAULT_LOCALE;
}

function notFound() {
  return new NextResponse("Not found", { status: 404, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  const locale = localeFrom(req);
  const available = (await getAvailableMarkets()).map((m) => m.code);
  const market = resolveMarket(req.cookies.get(MARKET_COOKIE)?.value, locale, available);
  const consent = parseConsent(req.cookies.get(CONSENT_COOKIE)?.value);
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

  const result = await resolveGo(
    {
      productId,
      offerId: req.nextUrl.searchParams.get("offer"),
      campaign: req.nextUrl.searchParams.get("c"),
      market,
      locale,
      ua: req.headers.get("user-agent"),
      consent,
      referrerPath: referrerPath(req.headers.get("referer"), req.headers.get("host")),
      sessionId: req.cookies.get(SESSION_COOKIE)?.value ?? null,
    },
    serviceRepo(),
  );

  if (result.status === 404) {
    if (result.reason === "own_product" && result.slug) {
      return NextResponse.redirect(new URL(`${LOCALE_PREFIX["pt-BR"]}/produto/${result.slug}`, req.nextUrl.origin), { status: 302, headers: { "Cache-Control": "no-store" } });
    }
    if (result.reason.startsWith("blocked_")) {
      after(async () => {
        await createServiceSupabase()
          .from("admin_audit_log")
          .insert({ actor_id: null, action: "go.blocked", entity: "products", entity_id: productId, summary: { reason: result.reason, host: result.blockedHost ?? null } });
      });
    }
    return notFound();
  }

  const allowed = await rateLimit("go", ip);
  if (allowed) {
    const click = result.click;
    after(async () => {
      const { error } = await createServiceSupabase().from("affiliate_clicks").insert(click);
      if (error) console.error(JSON.stringify({ level: "error", event: "go.click_insert_failed", message: error.message }));
    });
  }
  return NextResponse.redirect(result.location, {
    status: 302,
    headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "no-referrer-when-downgrade" },
  });
}
