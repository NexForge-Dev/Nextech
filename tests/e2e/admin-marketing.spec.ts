import { test, expect } from "@playwright/test";
import { adminLogin } from "./admin-support";
import { svc } from "./support";

test("a promotion without proven discount requires a reason", async ({ page }) => {
  await adminLogin(page);
  await page.goto("/admin/ofertas/novo");
  await page.getByLabel("Filtrar produtos").fill("demonstração 1");
  await page.locator("#pr-product").selectOption({ label: "Produto de demonstração 1" });
  await page.getByLabel("Início").fill("2026-11-01T00:00");
  await page.getByLabel("Fim").fill("2026-11-30T00:00");
  await page.getByRole("button", { name: "Salvar oferta" }).click();
  await expect(page.getByText(/o produto não tem desconto comprovado/)).toBeVisible();

  await page.getByLabel("Motivo da oferta").fill("Semana E2E");
  await page.getByRole("button", { name: "Salvar oferta" }).click();
  await expect(page).toHaveURL(/\/admin\/ofertas$/);
  await expect(page.getByText("Semana E2E")).toBeVisible();
  await svc().from("promotions").delete().eq("reason", "Semana E2E");
});

test("banner form validates the link and offers a preview", async ({ page }) => {
  await adminLogin(page);
  await page.goto("/admin/banners/novo");
  await page.getByLabel("Título", { exact: true }).fill("Banner E2E");
  await page.getByLabel("Link").fill("javascript:alert(1)");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByText("Use um caminho interno (/pt-br/ofertas) ou um endereço https://.")).toBeVisible();
  await page.getByRole("tab", { name: "Pré-visualizar" }).click();
  await expect(page.getByText("Envie a imagem para visualizar o banner.")).toBeVisible();
});
