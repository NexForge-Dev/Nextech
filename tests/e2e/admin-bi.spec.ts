import { test, expect } from "@playwright/test";
import { adminLogin } from "./admin-support";
import { deleteProduct, makeOwnProduct, svc } from "./support";
import { makeCustomer, makePaidOrder } from "./orders-support";

const email = `cliente-bi-e2e+${Date.now()}@nextech.local`;
let userId: string;
let best: { id: string; slug: string; name: string; priceMinor: number };
let other: { id: string; slug: string; name: string; priceMinor: number };

test.beforeAll(async () => {
  userId = await makeCustomer(email);
  best = { ...(await makeOwnProduct({ name: "Fone BI E2E", priceMinor: 20000 })), name: "Fone BI E2E", priceMinor: 20000 };
  other = { ...(await makeOwnProduct({ name: "Cabo BI E2E", priceMinor: 5000 })), name: "Cabo BI E2E", priceMinor: 5000 };
});
test.afterAll(async () => {
  await svc().from("orders").delete().eq("user_id", userId);
  await svc().auth.admin.deleteUser(userId);
  await deleteProduct(best.id);
  await deleteProduct(other.id);
});

test("the BI shows best sellers and refunds from real orders", async ({ page }) => {
  await makePaidOrder(userId, best);
  await makePaidOrder(userId, best);
  await makePaidOrder(userId, other);
  const refunded = await makePaidOrder(userId, best);
  await svc().rpc("order_record_refund", { p_order: refunded.id, p_pi: null as never, p_amount: 5000, p_method: "manual", p_stripe_refund: null as never, p_status: "succeeded", p_note: "E2E" as never, p_actor: null as never });

  await adminLogin(page);
  await page.goto("/admin");
  await page.getByRole("link", { name: "BI de vendas" }).first().click();
  await expect(page.getByRole("heading", { name: "BI de vendas" })).toBeVisible();

  const table = page.locator("section", { has: page.getByRole("heading", { name: "Todos os produtos vendidos" }) });
  const rows = table.locator("tbody tr");
  await expect(rows.filter({ hasText: "Fone BI E2E" })).toContainText("3");
  await expect(rows.filter({ hasText: "Cabo BI E2E" })).toHaveCount(1);
  await expect(rows.filter({ hasText: "Fone BI E2E" })).toContainText("R$ 50,00");

  const refunds = page.locator("section", { has: page.getByRole("heading", { name: "Reembolsos do período" }) });
  await expect(refunds.getByRole("link", { name: `#${refunded.number}` })).toBeVisible();
  await expect(refunds).toContainText("Por fora");
  if (process.env.BI_SHOT) await page.screenshot({ path: process.env.BI_SHOT, fullPage: true });

  await refunds.getByRole("link", { name: `#${refunded.number}` }).click();
  await expect(page.getByRole("heading", { name: `Pedido #${refunded.number}` })).toBeVisible();
});

test("the sales reports download as CSV", async ({ page }) => {
  await adminLogin(page);
  const res = await page.request.get("/admin/relatorios/sales-products?p=30d");
  expect(res.status()).toBe(200);
  expect(await res.text()).toContain("Unidades");
});
