import { test, expect } from "@playwright/test";
import { adminLogin } from "./admin-support";
import { acceptCookies, deleteProduct, makeOwnProduct, setBusinessModels, svc } from "./support";
import { customerLogin, makeCustomer, makePaidOrder } from "./orders-support";

const email = `cliente-admin-e2e+${Date.now()}@nextech.local`;
let userId: string;
let product: { id: string; slug: string; name: string; priceMinor: number };

test.beforeAll(async () => {
  await setBusinessModels({ ownStore: true, affiliates: false });
  userId = await makeCustomer(email);
  const p = await makeOwnProduct({ name: "Power Bank Admin E2E", priceMinor: 24990 });
  product = { ...p, name: "Power Bank Admin E2E", priceMinor: 24990 };
});
test.afterAll(async () => {
  await svc().from("orders").delete().eq("user_id", userId);
  await svc().auth.admin.deleteUser(userId);
  await deleteProduct(product.id);
  await setBusinessModels({ ownStore: true, affiliates: true });
});
test.beforeEach(async ({ page }) => acceptCookies(page));

test("admin registers the supplier purchase and tracking; the customer sees the shipment", async ({ page, browser }) => {
  const o = await makePaidOrder(userId, product);
  await adminLogin(page);
  await page.goto("/admin/pedidos");
  await expect(page.getByTestId("awaiting-banner")).toBeVisible();
  await page.getByRole("link", { name: String(o.number), exact: true }).click();
  await expect(page.getByRole("heading", { name: `Pedido #${o.number}` })).toBeVisible();
  await expect(page.getByTestId("ship-address")).toContainText("Av. Paulista, 1000");

  const item = page.getByTestId("order-item").first();
  await item.getByLabel("Onde comprei").selectOption({ label: "Amazon BR" });
  await item.getByLabel("Quanto paguei (R$)").fill("158,90");
  await item.getByLabel("Nº do pedido no fornecedor").fill("702-1234567");
  await item.getByRole("switch", { name: "Comprado no fornecedor" }).click();
  await item.getByRole("button", { name: "Salvar item" }).click();
  await expect(page.getByText("Produto comprado no fornecedor").first()).toBeVisible();
  // 249,90 − fee 10,37 − cost 158,90 = 80,63
  await expect(page.getByTestId("margin")).toContainText("R$ 80,63");

  await page.getByLabel("Status").selectOption("shipped");
  await page.getByRole("button", { name: "Salvar status" }).click();
  await expect(page.getByText("Informe o código de rastreio de todos os itens")).toBeVisible();

  await item.getByLabel("Transportadora").fill("Correios");
  await item.getByLabel("Código de rastreio").fill("br987654321br");
  await item.getByRole("button", { name: "Salvar item" }).click();
  await expect(item.getByLabel("Código de rastreio")).toHaveValue("BR987654321BR");
  await page.getByLabel("Status").selectOption("shipped");
  await page.getByRole("button", { name: "Salvar status" }).click();
  await expect(page.getByTestId("history")).toContainText("Pedido enviado");

  const ctx = await browser.newContext();
  const customer = await ctx.newPage();
  await acceptCookies(customer);
  await customerLogin(customer, email);
  await customer.goto(`/pt-br/minha-conta/pedidos/${o.number}`);
  await expect(customer.getByTestId("order-stage")).toHaveText("Enviado");
  await expect(customer.getByTestId("tracking")).toContainText("BR987654321BR");
  await expect(customer.getByTestId("my-order-detail")).not.toContainText("Amazon");
  await ctx.close();
});

test("a boleto order is refunded by hand and marked refunded", async ({ page }) => {
  const o = await makePaidOrder(userId, product, { method: "boleto" });
  await adminLogin(page);
  await page.goto(`/admin/pedidos/${o.number}`);
  await expect(page.getByRole("switch", { name: "Reembolsado por fora (Pix/transferência)" })).toBeDisabled();
  await page.getByRole("button", { name: "Reembolsar" }).click();
  await expect(page.getByTestId("history")).toContainText("Reembolso total");
  await expect(page.getByText("Reembolsado").first()).toBeVisible();
});
