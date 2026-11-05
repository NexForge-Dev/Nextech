import { ImageResponse } from "next/og";
import { getTranslations } from "next-intl/server";
import { resolveLocaleParam } from "@/i18n/routing";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "NEXTECH";

export default async function Image({ params }: { params: Promise<{ locale: string }> }) {
  const locale = resolveLocaleParam((await params).locale) ?? "pt-BR";
  const t = await getTranslations({ locale, namespace: "home" });
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#ffffff", padding: 72, fontFamily: "sans-serif" }}>
        <div style={{ fontSize: 44, fontWeight: 800, letterSpacing: -2, color: "#000000" }}>NEXTECH</div>
        <div style={{ fontSize: 72, fontWeight: 700, color: "#000000", lineHeight: 1.05, maxWidth: 1000 }}>{t("heroTitle")}</div>
        <div style={{ fontSize: 30, color: "#6b6b6b" }}>{t("heroSubtitle")}</div>
      </div>
    ),
    size,
  );
}
