"use server";
import { updateTag } from "next/cache";
import { z } from "zod";
import { adminAction, ActionFailure } from "@/lib/admin/action";
import { createServerSupabase } from "@/lib/supabase/server";
import { productInputSchema, validateOfferUrls, type ProductParsed } from "@/lib/admin/schemas/product";
import { parseProductsCsv, type CsvProduct } from "@/lib/domain/csv";

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

const saveProductImpl = adminAction({ permission: "products.write", schema: productInputSchema, audit: { action: "save", entity: "products" } }, async (p) => {
  const errors = validateOfferUrls(p.offers, await storeDomains([...new Set(p.offers.map((o) => o.storeId))]));
  if (Object.keys(errors).length) throw new ActionFailure("invalid", "Há links de oferta com domínio não autorizado.", errors);
  const sb = await createServerSupabase();
  const { data: id, error } = await sb.rpc("admin_save_product_full", { p: rpcPayload(p) as never });
  if (error) throw error;
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
  updateTag("catalog");
  return { id, audit: { featured } };
});
export async function setFeatured(input: unknown) {
  return featuredImpl(input);
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
  if (!url.startsWith("https://")) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000), redirect: "follow" });
    const type = res.headers.get("content-type")?.split(";")[0] ?? "";
    if (!res.ok || !["image/jpeg", "image/png", "image/webp", "image/avif"].includes(type)) return null;
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
