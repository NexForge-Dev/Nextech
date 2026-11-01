// Dev helper: node scripts/dev/shot.mjs <path-without-leading-slash> <out.png> [width] [height] [fullPage]
import { chromium } from "@playwright/test";

const [, , rawPath = "pt-br", out = "shot.png", w = "1280", h = "800", full = "0"] = process.argv;
const path = rawPath.split("/").filter(Boolean).join("/");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) } });
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`http://localhost:3300/${path}`, { waitUntil: "networkidle" });
const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
await page.screenshot({ path: out, fullPage: full === "1" });
console.log(JSON.stringify({ overflow, errors }));
await browser.close();
