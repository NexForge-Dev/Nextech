import type { ReactNode } from "react";
import "./globals.css";

// The <html> element is rendered by the store ([locale]) and admin root layouts.
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
