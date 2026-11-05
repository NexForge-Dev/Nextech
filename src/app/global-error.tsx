"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#ffffff", color: "#000000" }}>
        <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 24, textAlign: "center" }}>
          <p style={{ fontWeight: 800, letterSpacing: "-0.04em" }}>NEXTECH</p>
          <h1 style={{ fontSize: 28, margin: 0 }}>Algo deu errado · Something went wrong</h1>
          <p style={{ color: "#6b6b6b", margin: 0 }}>Tente novamente em instantes. · Please try again shortly.</p>
          <button type="button" onClick={reset} style={{ height: 40, padding: "0 20px", borderRadius: 6, border: 0, background: "#000000", color: "#ffffff", cursor: "pointer" }}>
            Tentar novamente
          </button>
        </main>
      </body>
    </html>
  );
}
