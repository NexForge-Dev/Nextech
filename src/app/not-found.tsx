import { fontVariables } from "@/lib/fonts";

export default function RootNotFound() {
  return (
    <html lang="pt-BR" className={fontVariables}>
      <body className="flex min-h-screen items-center justify-center bg-white text-black">
        <main className="text-center">
          <p className="text-sm tracking-widest text-mute">404</p>
          <h1 className="mt-2 text-2xl font-semibold">Página não encontrada</h1>
          <a href="/" className="mt-6 inline-block underline">NEXTECH</a>
        </main>
      </body>
    </html>
  );
}
