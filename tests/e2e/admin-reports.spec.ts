import { test, expect } from "@playwright/test";
import { adminLogin } from "./admin-support";

test("dashboard renders and the clicks report downloads as CSV", async ({ page }) => {
  await adminLogin(page);
  await expect(page.getByText("Cliques por dia")).toBeVisible();
  const res = await page.request.get("/admin/relatorios/clicks?p=30d");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("text/csv");
  const body = await res.text();
  expect(body.startsWith("\uFEFFData;Produto;Loja;Rede;Campanha;País;Idioma")).toBe(true);
});

test("reports require login", async ({ request }) => {
  const res = await request.get("/admin/relatorios/clicks", { maxRedirects: 0 });
  expect([302, 307, 403]).toContain(res.status());
});
