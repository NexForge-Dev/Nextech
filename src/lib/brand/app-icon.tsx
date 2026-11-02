import { ImageResponse } from "next/og";

/** Monochrome app icon (black square, white "N") in the storefront's wordmark style. */
export function appIcon(size: number): ImageResponse {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#000000", color: "#ffffff", fontFamily: "sans-serif", fontWeight: 800, fontSize: Math.round(size * 0.6), letterSpacing: -Math.round(size * 0.02) }}>
        N
      </div>
    ),
    { width: size, height: size },
  );
}
