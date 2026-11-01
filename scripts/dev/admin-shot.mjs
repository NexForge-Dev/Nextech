// Dev helper: node scripts/dev/admin-shot.mjs <path> <out.png> [width] [height]
import { chromium } from "@playwright/test";
const [, , rawPath = "admin", out = "admin.png", w = "1440", h = "900"] = process.argv;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://localhost:3300/admin/entrar");
await page.getByLabel("E-mail").fill("admin@nextech.local");
await page.getByLabel("Senha").fill("admin-nextech-123");
await page.getByRole("button", { name: "Entrar" }).click();
await page.waitForURL((u) => !u.pathname.startsWith("/admin/entrar"));
await page.goto(`http://localhost:3300/${rawPath.split("/").filter(Boolean).join("/")}`, { waitUntil: "networkidle" });
const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
await page.screenshot({ path: out, fullPage: true });
console.log(JSON.stringify({ overflow, errors }));
await browser.close();
