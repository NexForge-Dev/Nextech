import { test, expect } from "@playwright/test";
import { acceptCookies, deleteProduct, makeOwnProduct, setBusinessModels, svc } from "./support";
import { adminLogin, resetAuthRateLimit } from "./admin-support";

let p: { id: string; slug: string };
const promo = (startMs: number, endMs: number) =>
  svc()
    .from("product_sale")
    .update({ promo_price_minor: 15000, promo_starts_at: new Date(Date.now() + startMs).toISOString(), promo_ends_at: new Date(Date.now() + endMs).toISOString() })
    .eq("product_id", p.id);

test.beforeAll(async () => {
  await setBusinessModels({ ownStore: true, affiliates: false });
  p = await makeOwnProduct({ name: "Fone Promoção Teste", priceMinor: 20000 });
});
test.afterAll(async () => {
  await deleteProduct(p.id);
  await setBusinessModels({ ownStore: true, affiliates: true });
});
test.beforeEach(async ({ page }) => acceptCookies(page));

test("a promotion not started yet changes nothing", async ({ page }) => {
  await promo(3_600_000, 7_200_000);
  await page.goto(`/pt-br/produto/${p.slug}`);
  await expect(page.getByTestId("own-buy-box").getByTestId("price-main")).toContainText("R$ 200,00");
  await expect(page.getByTestId("promo-countdown")).toHaveCount(0);
});

test("the countdown runs, and at zero the product returns to the regular price", async ({ page }) => {
  await promo(-1000, 12_000);
  await page.goto(`/pt-br/produto/${p.slug}`);
  const box = page.getByTestId("own-buy-box");
  await expect(box.getByTestId("price-main")).toContainText("R$ 150,00");
  await expect(box).toContainText("R$ 200,00");
  await expect(box).toContainText("-25%");
  await expect(box.getByTestId("promo-countdown")).toContainText(/Oferta termina em\s*00:00:\d\d/);
  await expect(box.getByTestId("price-main")).toContainText("R$ 200,00", { timeout: 20_000 });
  await expect(page.getByTestId("promo-countdown")).toHaveCount(0);
});

test("the admin sets the promotion with a start and a duration", async ({ page }) => {
  await svc().from("product_sale").update({ promo_price_minor: null, promo_starts_at: null, promo_ends_at: null }).eq("product_id", p.id);
  await resetAuthRateLimit();
  await adminLogin(page);
  await page.goto(`/admin/produtos/${p.id}`);
  await page.getByLabel("Preço promocional (R$)").fill("150,00");
  await page.getByLabel("Início").fill("2026-10-23T20:00");
  await page.getByRole("button", { name: "2h", exact: true }).click();
  await expect(page.getByLabel("Término")).toHaveValue("2026-10-23T22:00");
  await page.getByRole("button", { name: /salvar/i }).first().click();
  await expect.poll(async () => (await svc().from("product_sale").select("promo_price_minor, promo_ends_at").eq("product_id", p.id).single()).data?.promo_price_minor).toBe(15000);
  const { data } = await svc().from("product_sale").select("promo_starts_at, promo_ends_at").eq("product_id", p.id).single();
  expect(new Date(data!.promo_starts_at!).toISOString()).toBe("2026-10-23T23:00:00.000Z");
  expect(new Date(data!.promo_ends_at!).toISOString()).toBe("2026-10-24T01:00:00.000Z");
});
