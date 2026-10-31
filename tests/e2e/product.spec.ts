import { test, expect } from "@playwright/test";
import { acceptCookies, svc } from "./support";

test.beforeEach(async ({ page }) => acceptCookies(page));

test("product page has a tracked CTA, notice and specs", async ({ page }) => {
  await page.goto("/pt-br/produto/produto-de-demonstracao-3");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Produto de demonstração 3");
  const cta = page.getByRole("link", { name: "VER PRODUTO NA LOJA" });
  await expect(cta).toHaveAttribute("href", /^\/go\/[0-9a-f-]{36}\?offer=/);
  await expect(cta).toHaveAttribute("rel", /sponsored/);
  await expect(page.getByText("A NEXTECH pode receber uma comissão").first()).toBeVisible();
  await expect(page.getByText("-20%").first()).toBeVisible();
});

test("a BR-only product shows where it is available when the market is PT", async ({ page }) => {
  // demo product 1 (odd) only has a BR offer; PT is an available market (demo store serves BR + PT)
  await page.context().addCookies([{ name: "nx_market", value: "PT", url: "http://localhost:3300" }]);
  await page.goto("/pt-br/produto/produto-de-demonstracao-1");
  await expect(page.getByText("Indisponível no seu país").first()).toBeVisible();
  await expect(page.getByText(/Disponível em: .*Brasil/)).toBeVisible();
  await expect(page.getByRole("link", { name: "VER PRODUTO NA LOJA" })).toHaveCount(0);
});

test("an archived product is a 404", async ({ page }) => {
  const s = svc();
  await s.from("products").update({ status: "archived" }).eq("slug", "produto-de-demonstracao-24");
  try {
    const res = await page.goto("/pt-br/produto/produto-de-demonstracao-24");
    expect(res?.status()).toBe(404);
  } finally {
    await s.from("products").update({ status: "published" }).eq("slug", "produto-de-demonstracao-24");
  }
});

test("localized product path works in English", async ({ page }) => {
  const res = await page.goto("/en/product/produto-de-demonstracao-2");
  expect(res?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Demo product 2");
});
