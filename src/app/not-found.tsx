import NextLink from "next/link";
import { fontVariables } from "@/lib/fonts";

export default function RootNotFound() {
  return (
    <html lang="pt-BR" className={fontVariables}>
      <body className="flex min-h-screen items-center justify-center bg-white text-black">
        <main className="text-center">
          <p className="tabular text-6xl font-semibold tracking-tight">404</p>
          <h1 className="t-page mt-3">Página não encontrada</h1>
          <NextLink href="/" className="btn btn-primary mt-6">NEXTECH</NextLink>
        </main>
      </body>
    </html>
  );
}
