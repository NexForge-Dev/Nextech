import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/auth/session";
import { createServerSupabase } from "@/lib/supabase/server";
import { toProductsCsv, type CsvProduct } from "@/lib/domain/csv";
import { storagePublicUrl } from "@/lib/supabase/env";
import { writeAudit } from "@/lib/admin/action";

export async function GET() {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.permissions.has("products.import")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const sb = await createServerSupabase();
  const { data } = await sb
    .from("products")
    .select("slug, status, sku, categories(slug), brands(slug), product_tags(tags(slug)), product_translations(locale, name, short_description, description_md), product_images(path, sort_order, is_main), affiliate_links(market, currency, original_url, affiliate_url, price_minor, previous_price_minor, previous_verified, previous_evidence, stores(slug))")
    .order("slug")
    .limit(10000);
  const products: CsvProduct[] = (data ?? []).map((p) => {
    const t = (l: string) => p.product_translations.find((x) => x.locale === l);
    return {
      slug: p.slug,
      status: p.status as CsvProduct["status"],
      categorySlug: p.categories?.slug ?? "",
      brandSlug: p.brands?.slug ?? null,
      tags: p.product_tags.map((x) => x.tags?.slug).filter((x): x is string => !!x),
      sku: p.sku,
      names: { "pt-BR": t("pt-BR")?.name ?? p.slug, ...(t("pt-PT") && { "pt-PT": t("pt-PT")!.name }), ...(t("en") && { en: t("en")!.name }), ...(t("es") && { es: t("es")!.name }) },
      shortPtBr: t("pt-BR")?.short_description ?? null,
      descriptionPtBr: t("pt-BR")?.description_md ?? null,
      imageUrls: [...p.product_images].sort((a, b) => Number(b.is_main) - Number(a.is_main) || a.sort_order - b.sort_order).map((i) => storagePublicUrl("products", i.path)!),
      offers: p.affiliate_links.map((l) => ({
        storeSlug: l.stores?.slug ?? "",
        market: l.market,
        currency: l.currency,
        originalUrl: l.original_url,
        affiliateUrl: l.affiliate_url,
        priceMinor: l.price_minor,
        previousPriceMinor: l.previous_price_minor,
        previousVerified: l.previous_verified,
        previousEvidence: l.previous_evidence,
      })),
    };
  });
  await writeAudit({ actorId: ctx.userId, action: "export_csv", entity: "products", summary: { count: products.length } });
  return new NextResponse(`﻿${toProductsCsv(products)}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="nextech-produtos-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
