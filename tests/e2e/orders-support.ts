import type { Page } from "@playwright/test";
import { svc } from "./support";
import { resetAuthRateLimit } from "./admin-support";

export const CUSTOMER_PASSWORD = "cliente-e2e-123";
const ADDRESS = { recipientName: "Ana Souza", street: "Av. Paulista", number: "1000", complement: null, district: "Bela Vista", city: "São Paulo", state: "SP", cep: "01310100" };

export async function makeCustomer(email: string): Promise<string> {
  const s = svc();
  const list = await s.auth.admin.listUsers({ perPage: 1000 });
  const old = list.data.users.find((u) => u.email === email);
  if (old) await s.auth.admin.deleteUser(old.id);
  const { data, error } = await s.auth.admin.createUser({ email, password: CUSTOMER_PASSWORD, email_confirm: true, user_metadata: { full_name: "Ana Souza" } });
  if (error) throw error;
  return data.user!.id;
}

export async function customerLogin(page: Page, email: string) {
  await resetAuthRateLimit();
  await page.goto("/pt-br/entrar");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(CUSTOMER_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/pt-br\/minha-conta/);
}

/** A paid order (as the webhook would leave it) for e2e — status awaiting_supplier. */
export async function makePaidOrder(userId: string, product: { id: string; slug: string; name: string; priceMinor: number }, opts: { method?: "card" | "boleto"; status?: string } = {}) {
  const s = svc();
  const { data: o, error } = await s
    .from("orders")
    .insert({
      user_id: userId,
      status: opts.status ?? "awaiting_supplier",
      payment_method: opts.method ?? "card",
      subtotal_minor: product.priceMinor,
      total_minor: product.priceMinor,
      paid_at: new Date().toISOString(),
      stripe_payment_intent_id: `pi_e2e_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      payment_summary: "Cartão visa final 4242",
      stripe_fee_minor: 1037,
      shipping: ADDRESS,
      customer: { name: "Ana Souza", email: "ana@example.com", cpf: "52998224725", phone: "11987654321" },
    })
    .select("id, number")
    .single();
  if (error) throw error;
  await s.from("order_items").insert({ order_id: o!.id, product_id: product.id, name: product.name, slug: product.slug, unit_price_minor: product.priceMinor, quantity: 1, line_total_minor: product.priceMinor });
  await s.from("order_events").insert({ order_id: o!.id, actor: "stripe", kind: "paid", data: {} });
  return { id: o!.id as string, number: Number(o!.number) };
}
