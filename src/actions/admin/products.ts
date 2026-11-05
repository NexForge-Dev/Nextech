"use server";
import { updateTag } from "next/cache";
import { z } from "zod";
import { adminAction, ActionFailure } from "@/lib/admin/action";
import { createServerSupabase } from "@/lib/supabase/server";
import { createServiceSupabase } from "@/lib/supabase/service";
import { productInputSchema, validateOfferUrls, type ProductParsed } from "@/lib/admin/schemas/product";
import { parseProductsCsv, type CsvProduct } from "@/lib/domain/csv";
import { parseProductsJson } from "@/lib/domain/product-json";
import { formatMoney } from "@/lib/domain/money";
import { getProductJsonCatalog } from "@/lib/data/admin/products";
import { fetchPublicHttps } from "@/lib/security/safe-fetch";

async function storeDomains(storeIds: string[]) {
  const sb = await createServerSupabase();
  const { data } = await sb.from("stores").select("id, name, store_domains(domain)").in("id", storeIds.length ? storeIds : ["00000000-0000-0000-0000-000000000000"]);
  return new Map((data ?? []).map((s) => [s.id, { name: s.name, domains: s.store_domains.map((d) => d.domain) }]));
}

function rpcPayload(p: ProductParsed, extra: { priceSource?: "manual" | "import"; sourceRef?: string; replaceOffers?: boolean } = {}) {
  return {
    id: p.id,
    slug: p.slug,
    brandId: p.brandId,
    categoryId: p.categoryId,
    status: p.status,
    featured: p.featured,
    sku: p.sku,
    externalId: p.externalId,
    warranty: p.warranty,
    rating: p.rating,
    ratingCount: p.ratingCount,
    ratingSource: p.ratingSource,
    specs: p.specs,
    tags: p.tags,
    translations: p.translations,
    images: p.images,
    replaceOffers: extra.replaceOffers ?? true,
    saleMode: p.saleMode,
    sale: p.sale,
    suppliers: p.suppliers,
    offers: p.offers.map((o) => ({ ...o, priceSource: extra.priceSource ?? "manual", sourceRef: extra.sourceRef ?? null })),
  };
}

/**
 * "Destaque" means one thing to the admin: removing it from a product also takes that product off the
 * top of the home. Service client because site_settings is writable with settings.write only.
 */
async function releaseFlagship(productId: string) {
  const svc = createServiceSupabase();
  const { data } = await svc.from("site_settings").select("value").eq("key", "public.flagship_product").maybeSingle();
  if (data?.value !== productId) return;
  const { error } = await svc.from("site_settings").update({ value: "" }).eq("key", "public.flagship_product");
  if (error) throw error;
}

const saveProductImpl = adminAction({ permission: "products.write", schema: productInputSchema, audit: { action: "save", entity: "products" } }, async (p) => {
  const errors = validateOfferUrls(p.offers, await storeDomains([...new Set(p.offers.map((o) => o.storeId))]));
  if (Object.keys(errors).length) throw new ActionFailure("invalid", "Há links de oferta com domínio não autorizado.", errors);
  const sb = await createServerSupabase();
  const { data: id, error } = await sb.rpc("admin_save_product_full", { p: rpcPayload(p) as never });
  if (error?.message === "stock_changed") throw new ActionFailure("invalid", "O estoque mudou enquanto você editava (houve venda). Recarregue a página e ajuste a quantidade de novo.", { "sale.stock": ["O estoque mudou. Recarregue a página."] });
  if (error) throw error;
  if (!p.featured) await releaseFlagship(id as string);
  updateTag("catalog");
  return { id: id as string, audit: { slug: p.slug, status: p.status, saleMode: p.saleMode, offers: p.offers.length, suppliers: p.suppliers.length } };
});
export async function saveProduct(input: unknown) {
  return saveProductImpl(input);
}

const statusImpl = adminAction(
  { permission: "products.write", schema: z.object({ id: z.string().uuid(), status: z.enum(["draft", "published", "archived"]) }), audit: { action: "status", entity: "products" } },
  async ({ id, status }) => {
    const sb = await createServerSupabase();
    const { data: cur } = await sb.from("products").select("published_at").eq("id", id).single();
    const { error } = await sb.from("products").update({ status, ...(status === "published" && !cur?.published_at ? { published_at: new Date().toISOString() } : {}) }).eq("id", id);
    if (error) throw error;
    updateTag("catalog");
    return { id, audit: { status } };
  },
);
export async function setProductStatus(input: unknown) {
  return statusImpl(input);
}

const featuredImpl = adminAction({ permission: "products.write", schema: z.object({ id: z.string().uuid(), featured: z.boolean() }), audit: { action: "featured", entity: "products" } }, async ({ id, featured }) => {
  const sb = await createServerSupabase();
  const { error } = await sb.from("products").update({ featured }).eq("id", id);
  if (error) throw error;
  if (!featured) await releaseFlagship(id);
  updateTag("catalog");
  return { id, audit: { featured } };
});
export async function setFeatured(input: unknown) {
  return featuredImpl(input);
}

// site_settings is writable with settings.write only; this one key belongs to whoever manages products
const flagshipImpl = adminAction({ permission: "products.write", schema: z.object({ id: z.string().uuid().nullable() }), audit: { action: "flagship", entity: "products" } }, async ({ id }, ctx) => {
  const svc = createServiceSupabase();
  if (id) {
    const { data } = await svc.from("products").select("status").eq("id", id).single();
    if (data?.status !== "published") throw new ActionFailure("invalid", "Publique o produto antes de colocá-lo em destaque.");
    // the pick and the product's own highlight stay in step, so saving the product doesn't release it
    const { error: featuredError } = await svc.from("products").update({ featured: true }).eq("id", id);
    if (featuredError) throw featuredError;
  }
  const { error } = await svc.from("site_settings").upsert({ key: "public.flagship_product", value: id ?? "", updated_by: ctx.userId }, { onConflict: "key" });
  if (error) throw error;
  updateTag("catalog");
  return { id: id ?? "auto", audit: { flagship: id } };
});
export async function setFlagshipProduct(input: unknown) {
  return flagshipImpl(input);
}

const deleteImpl = adminAction({ permission: "products.delete", schema: z.object({ id: z.string().uuid() }), audit: { action: "delete", entity: "products" } }, async ({ id }) => {
  const sb = await createServerSupabase();
  const { data: p } = await sb.from("products").select("slug").eq("id", id).single();
  const { error } = await sb.from("products").delete().eq("id", id);
  if (error) throw error;
  updateTag("catalog");
  return { id, audit: { slug: p?.slug } };
});
export async function deleteProduct(input: unknown) {
  return deleteImpl(input);
}

// ---------------------------------------------------------------- CSV import
export type ImportPreview = { products: number; offers: number; errors: { line: number; message: string }[]; created: number; updated: number; committed: boolean };

async function downloadImage(url: string): Promise<string | null> {
  try {
    // SSRF guard: public https hosts only, every redirect hop re-checked
    const res = await fetchPublicHttps(url);
    if (!res) return null;
    const type = res.headers.get("content-type")?.split(";")[0] ?? "";
    if (!res.ok || !["image/jpeg", "image/png", "image/webp", "image/avif"].includes(type)) return null;
    if (Number(res.headers.get("content-length") ?? 0) > 5 * 1024 * 1024) return null;
    const buf = await res.arrayBuffer();
    if (buf.byteLength > 5 * 1024 * 1024) return null;
    const ext = type.split("/")[1].replace("jpeg", "jpg");
    const path = `import/${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}.${ext}`;
    const sb = await createServerSupabase();
    const { error } = await sb.storage.from("products").upload(path, buf, { contentType: type });
    return error ? null : path;
  } catch {
    return null;
  }
}

const importImpl = adminAction(
  { permission: "products.import", schema: z.object({ text: z.string().max(5_000_000), filename: z.string().max(200), commit: z.boolean() }), audit: { action: "import_csv", entity: "products" } },
  async ({ text, filename, commit }) => {
    const parsed = parseProductsCsv(text);
    const sb = await createServerSupabase();
    const [cats, brands, stores, existing] = await Promise.all([
      sb.from("categories").select("id, slug"),
      sb.from("brands").select("id, slug"),
      sb.from("stores").select("id, slug, network_id, name, store_domains(domain)"),
      sb.from("products").select("id, slug, affiliate_links(id, store_id, market)").in("slug", parsed.products.map((p) => p.slug).slice(0, 2000)),
    ]);
    const catId = new Map((cats.data ?? []).map((c) => [c.slug, c.id]));
    const brandId = new Map((brands.data ?? []).map((b) => [b.slug, b.id]));
    const storeBySlug = new Map((stores.data ?? []).map((s) => [s.slug, s]));
    const existingBySlug = new Map((existing.data ?? []).map((p) => [p.slug, p]));
    const errors = [...parsed.errors];
    const ready: { csv: CsvProduct; payload: ProductParsed }[] = [];

    for (const p of parsed.products) {
      const category = catId.get(p.categorySlug);
      if (!category) {
        errors.push({ line: 0, message: `${p.slug}: categoria "${p.categorySlug}" não existe.` });
        continue;
      }
      if (p.brandSlug && !brandId.get(p.brandSlug)) {
        errors.push({ line: 0, message: `${p.slug}: marca "${p.brandSlug}" não existe.` });
        continue;
      }
      const prev = existingBySlug.get(p.slug);
      const offers = [];
      let bad = false;
      for (const o of p.offers) {
        const store = storeBySlug.get(o.storeSlug);
        if (!store) {
          errors.push({ line: 0, message: `${p.slug}: loja "${o.storeSlug}" não existe.` });
          bad = true;
          continue;
        }
        const urlErrors = validateOfferUrls([{ storeId: store.id, originalUrl: o.originalUrl, affiliateUrl: o.affiliateUrl }], new Map([[store.id, { name: store.name, domains: store.store_domains.map((d) => d.domain) }]]));
        for (const msgs of Object.values(urlErrors)) {
          errors.push({ line: 0, message: `${p.slug}: ${msgs[0]}` });
          bad = true;
        }
        const existingLink = prev?.affiliate_links.find((l) => l.store_id === store.id && l.market === o.market);
        offers.push({
          id: existingLink?.id,
          storeId: store.id,
          networkId: store.network_id,
          market: o.market,
          currency: o.currency,
          originalUrl: o.originalUrl,
          affiliateUrl: o.affiliateUrl,
          externalId: null,
          priceMinor: o.priceMinor,
          previousPriceMinor: o.previousPriceMinor,
          previousVerified: o.previousVerified,
          previousEvidence: o.previousEvidence,
          active: true,
          price: "",
          previousPrice: "",
        });
      }
      if (bad) continue;
      ready.push({
        csv: p,
        payload: {
          id: prev?.id,
          slug: p.slug,
          brandId: p.brandSlug ? (brandId.get(p.brandSlug) ?? null) : null,
          categoryId: category,
          tags: p.tags,
          status: p.status,
          featured: false,
          sku: p.sku,
          externalId: null,
          rating: null,
          ratingCount: null,
          ratingSource: null,
          specs: [],
          translations: Object.fromEntries(
            Object.entries(p.names).map(([l, name]) => [l, { name, shortDescription: l === "pt-BR" ? (p.shortPtBr ?? "") : "", descriptionMd: l === "pt-BR" ? (p.descriptionPtBr ?? "") : "", specs: [] }]),
          ),
          images: [],
          offers,
        } as unknown as ProductParsed,
      });
    }

    let created = 0;
    let updated = 0;
    if (commit) {
      if (errors.length) throw new ActionFailure("invalid", `Corrija os ${errors.length} erro(s) antes de importar.`);
      for (const r of ready) {
        if (r.csv.imageUrls.length && !r.payload.id) {
          const paths = (await Promise.all(r.csv.imageUrls.slice(0, 10).map(downloadImage))).filter((x): x is string => !!x);
          r.payload.images = paths.map((path, i) => ({ path, alt: r.csv.names["pt-BR"], isMain: i === 0 }));
        }
        const keepImages = !!r.payload.id;
        if (keepImages) {
          const { data: imgs } = await sb.from("product_images").select("path, alt, is_main, sort_order").eq("product_id", r.payload.id!).order("sort_order");
          r.payload.images = (imgs ?? []).map((i) => ({ path: i.path, alt: i.alt ?? "", isMain: i.is_main }));
        }
        const { error } = await sb.rpc("admin_save_product", { p: rpcPayload(r.payload, { priceSource: "import", sourceRef: filename, replaceOffers: false }) as never });
        if (error) throw new ActionFailure("invalid", `${r.csv.slug}: ${error.message}`);
        if (r.payload.id) updated++;
        else created++;
      }
      updateTag("catalog");
    }
    const preview: ImportPreview = {
      products: ready.length,
      offers: ready.reduce((n, r) => n + r.payload.offers.length, 0),
      errors: errors.slice(0, 200),
      created,
      updated,
      committed: commit,
    };
    return { ...preview, audit: { filename, created, updated, committed: commit } };
  },
);
export async function importProductsCsv(input: unknown) {
  return importImpl(input);
}

// ---------------------------------------------------------------- JSON import
export type JsonImportPreview = {
  items: { name: string; slug: string; summary: string; id?: string }[];
  errors: { line: number; message: string }[];
  warnings: string[];
  created: number;
  committed: boolean;
};

const STATUS_LABEL = { draft: "rascunho", published: "publicado", archived: "arquivado" } as const;

/** Creates only: a repeated slug is an error, so an import never overwrites a product already edited. */
const importJsonImpl = adminAction(
  { permission: "products.import", schema: z.object({ text: z.string().max(5_000_000), commit: z.boolean() }), audit: { action: "import_json", entity: "products" } },
  async ({ text, commit }, ctx) => {
    if (!ctx.permissions.has("products.write")) throw new ActionFailure("forbidden");
    const parsed = parseProductsJson(text, await getProductJsonCatalog());
    const sb = await createServerSupabase();
    const { data: taken } = await sb.from("products").select("slug").in("slug", parsed.items.map((i) => i.slug));
    const takenSlugs = new Set((taken ?? []).map((p) => p.slug));
    const errors = [...parsed.errors];
    for (const item of parsed.items) {
      if (takenSlugs.has(item.slug)) errors.push({ line: 0, message: `${item.name}: já existe um produto com o endereço "${item.slug}".` });
    }
    const ready = parsed.items.filter((i) => !takenSlugs.has(i.slug));
    let items: JsonImportPreview["items"] = ready.map((i) => ({ name: i.name, slug: i.slug, summary: `${formatMoney(i.payload.sale?.priceMinor ?? 0, "BRL", "pt-BR")} · ${STATUS_LABEL[i.payload.status]}` }));

    let created = 0;
    if (commit) {
      if (errors.length) throw new ActionFailure("invalid", `Corrija os ${errors.length} erro(s) antes de importar.`);
      const saved: JsonImportPreview["items"] = [];
      for (const [i, item] of ready.entries()) {
        const { data: id, error } = await sb.rpc("admin_save_product_full", { p: rpcPayload(item.payload) as never });
        if (error) {
          errors.push({ line: 0, message: `${item.name}: ${error.message}` });
          continue;
        }
        saved.push({ ...items[i], id: id as string });
        created++;
      }
      items = saved;
      updateTag("catalog");
    }
    const preview: JsonImportPreview = { items, errors: errors.slice(0, 200), warnings: parsed.warnings, created, committed: commit };
    return { ...preview, audit: { created, committed: commit } };
  },
);
export async function importProductsJson(input: unknown) {
  return importJsonImpl(input);
}
