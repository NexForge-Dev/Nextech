import { test, expect } from "@playwright/test";
import { acceptCookies, deleteProduct, makeOwnProduct, setBusinessModels, svc } from "./support";
import { customerLogin, makeCustomer, makePaidOrder } from "./orders-support";

const email = `cliente-e2e+${Date.now()}@nextech.local`;
let userId: string;
let product: { id: string; slug: string; name: string; priceMinor: number };

test.beforeAll(async () => {
  await setBusinessModels({ ownStore: true, affiliates: false });
  userId = await makeCustomer(email);
  const p = await makeOwnProduct({ name: "Carregador Pedido E2E", priceMinor: 18990 });
  product = { ...p, name: "Carregador Pedido E2E", priceMinor: 18990 };
});
test.afterAll(async () => {
  await svc().from("orders").delete().eq("user_id", userId);
  await svc().auth.admin.deleteUser(userId);
  await deleteProduct(product.id);
  await setBusinessModels({ ownStore: true, affiliates: true });
});
test.beforeEach(async ({ page }) => acceptCookies(page));

test("checkout requires sign-in and returns to checkout", async ({ page }) => {
  await page.goto("/pt-br/checkout");
  await expect(page).toHaveURL(/\/pt-br\/entrar\?next=%2Fpt-br%2Fcheckout/);
});

test("a paid order is listed, can be cancelled before the supplier purchase", async ({ page }) => {
  const o = await makePaidOrder(userId, product);
  await customerLogin(page, email);
  await page.goto("/pt-br/minha-conta/pedidos");
  const row = page.getByTestId("my-order").filter({ hasText: `Pedido #${o.number}` });
  await expect(row).toContainText("Em preparação");
  await row.click();
  await expect(page.getByTestId("order-stage")).toHaveText("Em preparação");
  await expect(page.getByTestId("my-order-detail")).toContainText("Cartão visa final 4242");
  await expect(page.getByTestId("my-order-detail")).not.toContainText("Amazon");
  await page.getByRole("button", { name: "Cancelar pedido" }).click();
  await page.getByRole("button", { name: "Sim, cancelar" }).click();
  await expect(page.getByTestId("order-stage")).toHaveText("Cancelado");
  await expect(page.getByRole("button", { name: "Cancelar pedido" })).toHaveCount(0);
});

test("after the supplier purchase the customer can no longer cancel, and sees tracking once shipped", async ({ page }) => {
  const o = await makePaidOrder(userId, product);
  const s = svc();
  await s.from("order_items").update({ supplier_purchased_at: new Date().toISOString(), tracking_carrier: "Correios", tracking_code: "BR123456789BR" }).eq("order_id", o.id);
  await s.from("orders").update({ status: "shipped" }).eq("id", o.id);
  await s.from("order_events").insert({ order_id: o.id, actor: "admin", kind: "shipped", data: {} });
  await customerLogin(page, email);
  await page.goto(`/pt-br/minha-conta/pedidos/${o.number}`);
  await expect(page.getByTestId("order-stage")).toHaveText("Enviado");
  await expect(page.getByTestId("tracking")).toContainText("BR123456789BR");
  await expect(page.getByRole("button", { name: "Cancelar pedido" })).toHaveCount(0);

  await page.getByRole("button", { name: "Solicitar devolução ou suporte" }).click();
  await page.getByLabel("Conte o que aconteceu").fill("Chegou com o cabo danificado.");
  await page.getByRole("button", { name: "Enviar solicitação" }).click();
  await expect(page.getByText("Recebemos sua solicitação")).toBeVisible();
});
