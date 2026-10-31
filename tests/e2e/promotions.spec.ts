import { test, expect } from "@playwright/test";
import { acceptCookies, svc } from "./support";

test.beforeEach(async ({ page }) => acceptCookies(page));

const hour = 3600_000;

test("offers page lists only live promotions and never invents a discount", async ({ page }) => {
  const s = svc();
  const { data: live } = await s.from("products").select("id").eq("slug", "produto-de-demonstracao-1").single();
  const { data: expired } = await s.from("products").select("id").eq("slug", "produto-de-demonstracao-5").single();
  const { data: rows } = await s.from("promotions").insert([
    { product_id: live!.id, reason: "Semana do teste E2E", starts_at: new Date(Date.now() - hour).toISOString(), ends_at: new Date(Date.now() + 24 * hour).toISOString(), active: true },
    { product_id: expired!.id, reason: "Promo expirada E2E", starts_at: new Date(Date.now() - 48 * hour).toISOString(), ends_at: new Date(Date.now() - 24 * hour).toISOString(), active: true },
  ]).select("id");
  try {
    await page.goto("/pt-br/ofertas");
    const card = page.getByTestId("product-card").filter({ hasText: "Produto de demonstração 1" });
    await expect(card).toBeVisible();
    await expect(card).toContainText("Semana do teste E2E");
    await expect(card).not.toContainText("%");
    await expect(page.getByText("Promo expirada E2E")).toHaveCount(0);
  } finally {
    await s.from("promotions").delete().in("id", (rows ?? []).map((r) => r.id));
  }
});

test("campaign landing links CTAs through /go with the campaign slug", async ({ page }) => {
  const s = svc();
  const slug = `camp-e2e-${Date.now()}`;
  const { data: c } = await s.from("campaigns").insert({ slug, name: "Campanha E2E", status: "active", starts_at: new Date(Date.now() - hour).toISOString(), ends_at: new Date(Date.now() + 24 * hour).toISOString() }).select("id").single();
  await s.from("campaign_translations").insert({ campaign_id: c!.id, locale: "pt-BR", title: "Campanha de teste", description: "Descrição da campanha" });
  const { data: p } = await s.from("products").select("id").eq("slug", "produto-de-demonstracao-2").single();
  await s.from("campaign_products").insert({ campaign_id: c!.id, product_id: p!.id });
  try {
    await page.goto(`/pt-br/campanha/${slug}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Campanha de teste");
    await expect(page.locator(`a[href*="/go/${p!.id}"]`).first()).toHaveAttribute("href", new RegExp(`c=${slug}`));
  } finally {
    await s.from("campaigns").delete().eq("id", c!.id);
  }
});

test("an ended campaign is a 404", async ({ page }) => {
  const s = svc();
  const slug = `camp-ended-${Date.now()}`;
  const { data: c } = await s.from("campaigns").insert({ slug, name: "Encerrada", status: "ended" }).select("id").single();
  try {
    const res = await page.goto(`/pt-br/campanha/${slug}`);
    expect(res?.status()).toBe(404);
  } finally {
    await s.from("campaigns").delete().eq("id", c!.id);
  }
});
