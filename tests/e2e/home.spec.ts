import { test, expect } from "@playwright/test";
import { acceptCookies, withEmptyCatalog } from "./support";

test.beforeEach(async ({ page }) => acceptCookies(page));

test("empty store shows the hero and a coming-soon block, no product sections", async ({ page }) => {
  await withEmptyCatalog(async () => {
    await page.goto("/pt-br");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Encontre o que você procura");
    await expect(page.getByText("Novos produtos em breve")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Seleção NEXTECH" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Categorias principais" })).toBeVisible();
  });
});

test("store with demo data shows its products with honest prices", async ({ page }) => {
  await page.goto("/pt-br");
  const demoCards = page.getByTestId("product-card").filter({ hasText: "Produto de demonstração" });
  await expect(demoCards.first()).toBeVisible();
  const text = await page.locator("main").innerText();
  expect(text).not.toContain("NaN");
  expect(text).not.toMatch(/R\$\s?0,00/);
});

test("English home is translated", async ({ page }) => {
  await page.goto("/en");
  // the h1 is the flagship product when there is one, so check a fixed heading
  await expect(page.getByRole("heading", { name: "Main categories" })).toBeVisible();
});
