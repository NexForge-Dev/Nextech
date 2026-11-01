import { test, expect } from "@playwright/test";
import { svc } from "./support";

test("/go records a click and redirects to the allowed store URL", async ({ request }) => {
  const s = svc();
  const { data: p } = await s.from("products").select("id").eq("slug", "produto-de-demonstracao-2").single();
  const { count: before } = await s.from("affiliate_clicks").select("id", { count: "exact", head: true }).eq("product_id", p!.id);
  const res = await request.get(`/go/${p!.id}`, { maxRedirects: 0, headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36" } });
  expect(res.status()).toBe(302);
  expect(res.headers()["location"]).toMatch(/^https:\/\/example\.com\//);
  await expect.poll(async () => (await s.from("affiliate_clicks").select("id", { count: "exact", head: true }).eq("product_id", p!.id)).count, { timeout: 5000 }).toBe((before ?? 0) + 1);
});

test("/go 404s for an unknown product and never redirects", async ({ request }) => {
  const res = await request.get("/go/00000000-0000-4000-8000-000000000000", { maxRedirects: 0 });
  expect(res.status()).toBe(404);
});

test("/go 404s for an inactive product", async ({ request }) => {
  const s = svc();
  const { data: p } = await s.from("products").select("id").eq("slug", "produto-de-demonstracao-23").single();
  await s.from("products").update({ status: "draft" }).eq("id", p!.id);
  try {
    const res = await request.get(`/go/${p!.id}`, { maxRedirects: 0 });
    expect(res.status()).toBe(404);
  } finally {
    await s.from("products").update({ status: "published" }).eq("id", p!.id);
  }
});
