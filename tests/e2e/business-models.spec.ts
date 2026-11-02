import { test, expect } from "@playwright/test";
import { acceptCookies, setBusinessModels } from "./support";

test.beforeEach(async ({ page }) => acceptCookies(page));
test.afterAll(async () => setBusinessModels({ ownStore: true, affiliates: true }));

test.describe("own store only (affiliates off)", () => {
  test.beforeAll(async () => setBusinessModels({ ownStore: true, affiliates: false }));

  test("other locales redirect to pt-BR", async ({ page }) => {
    await page.goto("/es/productos");
    await expect(page).toHaveURL(/\/pt-br\/produtos$/);
  });

  test("affiliate pages are gone", async ({ page }) => {
    expect((await page.goto("/pt-br/afiliados"))?.status()).toBe(404);
    expect((await page.goto("/pt-br/como-ganhamos-dinheiro"))?.status()).toBe(404);
  });

  test("affiliate products are hidden and never redirected", async ({ page, request }) => {
    expect((await page.goto("/pt-br/produto/produto-de-demonstracao-3"))?.status()).toBe(404);
    await page.goto("/pt-br");
    await expect(page.getByText("A NEXTECH pode receber uma comissão")).toHaveCount(0);
    const go = await request.get("/go/00000000-0000-4000-8000-000000000000", { maxRedirects: 0 });
    expect(go.status()).toBe(404);
  });
});

test("switching affiliates back on restores the affiliate product page", async ({ page }) => {
  await setBusinessModels({ ownStore: true, affiliates: true });
  await page.goto("/pt-br/produto/produto-de-demonstracao-3");
  await expect(page.getByRole("link", { name: "VER PRODUTO NA LOJA" })).toBeVisible();
});
