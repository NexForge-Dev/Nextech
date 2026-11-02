import { test, expect } from "@playwright/test";
import { adminLogin } from "./admin-support";
import { svc } from "./support";

test("credentials are stored encrypted and never shown again", async ({ page }) => {
  const s = svc();
  const { data: net } = await s.from("affiliate_networks").select("id").eq("key", "awin").single();
  await s.from("network_credentials").delete().eq("network_id", net!.id);
  await adminLogin(page);
  await page.goto(`/admin/afiliados/${net!.id}`);
  await page.getByLabel("API token (OAuth2)").fill("token-super-secreto-1234");
  await page.getByRole("button", { name: "Salvar credenciais" }).click();
  await expect(page.getByText("Configurado · ••••1234")).toBeVisible();
  const { data: row } = await s.from("network_credentials").select("ciphertext").eq("network_id", net!.id).single();
  expect(row!.ciphertext).not.toContain("token-super-secreto");
  await expect(page.locator("body")).not.toContainText("token-super-secreto");
  await s.from("network_credentials").delete().eq("network_id", net!.id);
});

test("Amazon tag generates the affiliate link in the product form", async ({ page }) => {
  const s = svc();
  const { data: net } = await s.from("affiliate_networks").select("id, settings").eq("key", "amazon").single();
  await s.from("affiliate_networks").update({ settings: { tag_BR: "nextech-20" } }).eq("id", net!.id);
  const stamp = Date.now();
  const { data: store } = await s.from("stores").insert({ slug: `amazon-e2e-${stamp}`, name: `Amazon E2E ${stamp}`, official_url: "https://www.amazon.com.br", network_id: net!.id, markets: ["BR"], active: true }).select("id").single();
  await s.from("store_domains").insert({ store_id: store!.id, domain: "amazon.com.br" });
  try {
    await adminLogin(page);
    await page.goto("/admin/produtos/novo");
    await page.getByLabel("Modo de venda").selectOption("affiliate");
    await page.getByRole("button", { name: "Adicionar oferta" }).click();
    await page.getByLabel("Loja parceira").selectOption({ label: `Amazon E2E ${stamp}` });
    await page.getByLabel("Link original do produto").fill("https://www.amazon.com.br/dp/B0TEST1234");
    await page.getByRole("button", { name: "Gerar link de afiliado pela rede" }).click();
    await expect(page.getByLabel("Link de afiliado")).toHaveValue(/tag=nextech-20/);
  } finally {
    await s.from("stores").delete().eq("id", store!.id);
    await s.from("affiliate_networks").update({ settings: net!.settings }).eq("id", net!.id);
  }
});
