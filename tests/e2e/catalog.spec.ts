import { test, expect } from "@playwright/test";
import { acceptCookies } from "./support";

test.beforeEach(async ({ page }) => acceptCookies(page));

function toNumber(text: string) {
  const m = text.replace(/\s/g, "").match(/R\$([\d.]+,\d{2})/);
  return m ? Number(m[1].replace(/\./g, "").replace(",", ".")) : NaN;
}

test("sorting by lowest price orders cards ascending", async ({ page }) => {
  await page.goto("/pt-br/produtos?sort=price_asc");
  const prices = page.getByTestId("product-card").locator("[data-testid=price-main]");
  await expect(prices.nth(1)).toBeVisible();
  const a = toNumber(await prices.nth(0).innerText());
  const b = toNumber(await prices.nth(1).innerText());
  expect(a).toBeLessThanOrEqual(b);
});

test("a search without results offers to clear filters", async ({ page }) => {
  await page.goto("/pt-br/produtos?q=inexistentexyz");
  await expect(page.getByText("Nenhum produto encontrado")).toBeVisible();
  await expect(page.getByRole("link", { name: "Limpar filtros" })).toBeVisible();
});

test("English category page renders with a translated heading", async ({ page }) => {
  const res = await page.goto("/en/category/informatica");
  expect(res?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Computers");
});

test("an unknown category is a 404", async ({ page }) => {
  const res = await page.goto("/pt-br/categoria/nao-existe");
  expect(res?.status()).toBe(404);
});

test("search finds demo products accent-insensitively", async ({ page }) => {
  await page.goto("/pt-br/produtos?q=demonstracao");
  await expect(page.getByTestId("product-card").first()).toContainText("Produto de demonstração");
});
