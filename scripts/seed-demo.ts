/**
 * LOCAL-ONLY demo data so the store can be seen "full". Every product is clearly labelled
 * "Produto de demonstração" and links to example.com. Refuses to run against a non-local Supabase.
 *   npm run db:seed:demo
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { assertLocalSupabase } from "./lib/local-guard";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
assertLocalSupabase(url);
const svc = createClient(url, key, { auth: { persistSession: false } });

const ADMIN_EMAIL = "admin@nextech.local";
const ADMIN_PASSWORD = "admin-nextech-123";

/** Throws on a Supabase error. Writes without .select() legitimately return null data. */
function must<T>(r: { data: T; error: unknown }, what: string): NonNullable<T> {
  if (r.error) throw new Error(`${what}: ${JSON.stringify(r.error)}`);
  return r.data as NonNullable<T>;
}

function svgFor(n: number): string {
  const shapes = [
    `<rect x="150" y="170" width="300" height="260" rx="24" fill="#222222"/>`,
    `<circle cx="300" cy="300" r="150" fill="#222222"/>`,
    `<rect x="210" y="120" width="180" height="360" rx="36" fill="#222222"/>`,
    `<path d="M150 420 L300 150 L450 420 Z" fill="#222222"/>`,
  ];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600"><rect width="600" height="600" fill="#F7F7F7"/>${shapes[n % shapes.length]}<text x="300" y="540" font-family="Arial, sans-serif" font-size="28" text-anchor="middle" fill="#777777">DEMO ${n}</text></svg>`;
}

async function main() {
  // admin --------------------------------------------------------------------------------------
  const list = await svc.auth.admin.listUsers({ perPage: 1000 });
  if (list.error) throw list.error;
  let adminId = list.data.users.find((u) => u.email === ADMIN_EMAIL)?.id;
  if (!adminId) {
    const created = await svc.auth.admin.createUser({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD, email_confirm: true, user_metadata: { full_name: "Admin NEXTECH" } });
    if (created.error || !created.data.user) throw created.error ?? new Error("createUser failed");
    adminId = created.data.user.id;
  }
  const superRole = must(await svc.from("admin_roles").select("id").eq("key", "superadmin").single(), "role");
  must(await svc.from("admin_users").upsert({ user_id: adminId, role_id: superRole.id, active: true }, { onConflict: "user_id" }).select("user_id"), "admin_users");

  // brand + store --------------------------------------------------------------------------------
  const brand = must(await svc.from("brands").upsert({ slug: "marca-demo", name: "Marca Demo" }, { onConflict: "slug" }).select("id").single(), "brand");
  const network = must(await svc.from("affiliate_networks").upsert({ key: "demo", adapter: "generic", name: "Rede Demonstração", subid_param: "sub", active: true }, { onConflict: "key" }).select("id").single(), "network");
  const store = must(
    await svc.from("stores").upsert({ slug: "loja-demonstracao", name: "Loja Demonstração", official_url: "https://example.com", network_id: network.id, markets: ["BR", "PT"], active: true, description: "Loja fictícia usada apenas em desenvolvimento local." }, { onConflict: "slug" }).select("id").single(),
    "store",
  );
  await svc.from("store_domains").upsert({ store_id: store.id, domain: "example.com" }, { onConflict: "store_id,domain" });

  const categories = must(await svc.from("categories").select("id, slug").order("sort_order"), "categories");

  // products -------------------------------------------------------------------------------------
  for (let n = 1; n <= 24; n++) {
    const slug = `produto-de-demonstracao-${n}`;
    const cat = categories[n % categories.length];
    const product = must(
      await svc.from("products").upsert({
        slug, category_id: cat.id, brand_id: brand.id, status: "published", featured: n <= 8,
        published_at: new Date(Date.now() - n * 86400_000).toISOString(), sku: `DEMO-${n}`,
        specs: [{ label: "Tipo", value: "Demonstração" }],
      }, { onConflict: "slug" }).select("id").single(),
      "product",
    );
    const names = { "pt-BR": `Produto de demonstração ${n}`, "pt-PT": `Produto de demonstração ${n}`, en: `Demo product ${n}`, es: `Producto de demostración ${n}` };
    for (const [locale, name] of Object.entries(names)) {
      must(await svc.from("product_translations").upsert({
        product_id: product.id, locale, name,
        short_description: locale === "en" ? "Fictional product for local development." : locale === "es" ? "Producto ficticio para desarrollo local." : "Produto fictício para desenvolvimento local.",
        description_md: locale === "en" ? "This is **demo data**. It only exists in the local database." : locale === "es" ? "Estos son **datos de demostración**. Solo existen en la base de datos local." : "Estes são **dados de demonstração**. Existem apenas no banco local.",
      }, { onConflict: "product_id,locale" }), "translation");
    }

    const path = `demo/${slug}.svg`;
    await svc.storage.from("products").upload(path, new Blob([svgFor(n)], { type: "image/svg+xml" }), { upsert: true, contentType: "image/svg+xml" });
    await svc.from("product_images").delete().eq("product_id", product.id);
    must(await svc.from("product_images").insert({ product_id: product.id, path, alt: names["pt-BR"], is_main: true, sort_order: 0 }), "image");

    await svc.from("affiliate_links").delete().eq("product_id", product.id);
    const priceBR = 9990 + n * 1500;
    const linkBR = must(await svc.from("affiliate_links").insert({
      product_id: product.id, store_id: store.id, network_id: network.id, market: "BR", currency: "BRL",
      original_url: `https://example.com/produto/${n}`, affiliate_url: `https://example.com/produto/${n}?aff=demo`,
      price_minor: priceBR, price_updated_at: new Date(Date.now() - 3600_000).toISOString(), price_source: "manual", active: true,
    }).select("id").single(), "link BR");
    // every third product had a higher observed price 10 days ago → proven discount
    if (n % 3 === 0) {
      must(await svc.from("product_prices").insert({ link_id: linkBR.id, price_minor: Math.round(priceBR * 1.25), currency: "BRL", observed_at: new Date(Date.now() - 10 * 86400_000).toISOString(), source: "manual", source_ref: "demo" }), "history");
    }
    must(await svc.from("product_prices").insert({ link_id: linkBR.id, price_minor: priceBR, currency: "BRL", source: "manual", source_ref: "demo" }), "history now");
    if (n % 2 === 0) {
      must(await svc.from("affiliate_links").insert({
        product_id: product.id, store_id: store.id, network_id: network.id, market: "PT", currency: "EUR",
        original_url: `https://example.com/pt/produto/${n}`, price_minor: 1990 + n * 300, price_updated_at: new Date().toISOString(), price_source: "manual", active: true,
      }), "link PT");
    }
  }
  console.log(`Demo data ready. Admin: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
