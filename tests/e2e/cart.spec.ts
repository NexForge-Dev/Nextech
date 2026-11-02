import { test, expect } from "@playwright/test";
import { acceptCookies, deleteProduct, makeOwnProduct, setBusinessModels } from "./support";

let a: { id: string; slug: string };
let b: { id: string; slug: string };

test.beforeAll(async () => {
  await setBusinessModels({ ownStore: true, affiliates: false });
  a = await makeOwnProduct({ name: "Power bank Teste", priceMinor: 24990, compareAtMinor: 29990 });
  b = await makeOwnProduct({ name: "Fone Esgotado Teste", priceMinor: 18990, available: false });
});
test.afterAll(async () => {
  await deleteProduct(a.id);
  await deleteProduct(b.id);
  await setBusinessModels({ ownStore: true, affiliates: true });
});
test.beforeEach(async ({ page }) => acceptCookies(page));

test("own product page shows price, free shipping and the NEXTECH seller line", async ({ page }) => {
  await page.goto(`/pt-br/produto/${a.slug}`);
  const box = page.getByTestId("own-buy-box");
  await expect(box.getByTestId("price-main")).toContainText("R$ 249,90");
  await expect(box).toContainText("R$ 299,90");
  await expect(box).toContainText("-17%");
  await expect(box).toContainText("Frete grátis · chega em 3 a 7 dias úteis");
  await expect(box).toContainText("Vendido e entregue por NEXTECH");
  await expect(box).not.toContainText("Pix");
  await expect(page.getByRole("link", { name: /ver produto na loja/i })).toHaveCount(0);
});

test("sold-out product cannot be added", async ({ page }) => {
  await page.goto(`/pt-br/produto/${b.slug}`);
  await expect(page.getByRole("button", { name: "Esgotado" })).toBeDisabled();
});

test("add to cart, change quantity, totals come from the server", async ({ page }) => {
  await page.goto(`/pt-br/produto/${a.slug}`);
  await page.getByRole("button", { name: "Adicionar ao carrinho" }).click();
  await expect(page.getByTestId("cart-link").first()).toHaveAttribute("aria-label", "Carrinho (1)");
  await page.goto("/pt-br/carrinho");
  await expect(page.getByTestId("cart-line")).toHaveCount(1);
  await page.getByRole("button", { name: "Aumentar quantidade" }).click();
  await expect(page.getByTestId("cart-qty")).toHaveText("2");
  await expect(page.getByTestId("cart-total")).toContainText("R$ 499,80");
  // a tampered cart in storage cannot change the price
  await page.evaluate((id) => localStorage.setItem("nx_cart_v1", JSON.stringify([{ productId: id, quantity: 1, priceMinor: 1 }])), a.id);
  await page.reload();
  await expect(page.getByTestId("cart-total")).toContainText("R$ 249,90");
  await expect(page.getByRole("link", { name: "Finalizar compra" })).toBeVisible();
});
