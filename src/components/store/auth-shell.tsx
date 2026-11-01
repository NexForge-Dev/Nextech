import type { ReactNode } from "react";

export function AuthShell({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-16 md:py-24">
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      <div className="mt-8">{children}</div>
      {aside && <div className="mt-8 border-t border-line pt-6 text-sm text-mute">{aside}</div>}
    </main>
  );
}
