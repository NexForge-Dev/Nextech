import type { ReactNode } from "react";
import type { Metadata } from "next";
import { fontVariables } from "@/lib/fonts";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: { default: "NEXTECH Admin", template: "%s · NEXTECH Admin" },
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className={`${fontVariables} h-full`}>
      <body className="min-h-full bg-white text-black">
        {children}
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
