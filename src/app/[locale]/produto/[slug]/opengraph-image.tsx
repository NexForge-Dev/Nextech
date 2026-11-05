import { ImageResponse } from "next/og";
import { resolveLocaleParam } from "@/i18n/routing";
import { getProduct } from "@/lib/data/product";
import { storagePublicUrl } from "@/lib/supabase/env";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "NEXTECH";

export default async function Image({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const p = await params;
  const locale = resolveLocaleParam(p.locale) ?? "pt-BR";
  const product = await getProduct(p.slug, locale);
  const name = product?.name ?? "NEXTECH";
  const img = product?.images[0] ? storagePublicUrl("products", product.images[0].path) : null;
  // satori renders PNG/JPEG reliably; skip SVG sources
  const imgSrc = img && !img.endsWith(".svg") ? img : null;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#ffffff", padding: 64, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1, paddingRight: 48 }}>
          <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: -2, color: "#000000" }}>NEXTECH</div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {product?.brand && <div style={{ fontSize: 26, color: "#6b6b6b", textTransform: "uppercase", letterSpacing: 2 }}>{product.brand.name}</div>}
            <div style={{ fontSize: 64, fontWeight: 700, color: "#000000", lineHeight: 1.05, marginTop: 12 }}>{name.slice(0, 80)}</div>
          </div>
          <div style={{ width: 120, height: 6, background: "#000000" }} />
        </div>
        <div style={{ width: 460, height: 502, background: "#f7f7f7", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {imgSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imgSrc} alt="" width={400} height={400} style={{ objectFit: "contain" }} />
          ) : (
            <div style={{ fontSize: 120, fontWeight: 800, color: "#e5e5e5" }}>N</div>
          )}
        </div>
      </div>
    ),
    size,
  );
}
