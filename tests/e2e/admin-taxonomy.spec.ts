import { test, expect } from "@playwright/test";
import { adminLogin } from "./admin-support";
import { svc } from "./support";

test("admin creates a store with allowed domains", async ({ page }) => {
  const slug = `loja-e2e-${Date.now()}`;
  await adminLogin(page);
  await page.goto("/admin/lojas/novo");
  await page.getByLabel("Nome", { exact: true }).fill("Loja E2E");
  await page.getByLabel("Slug").fill(slug);
  await page.getByLabel("URL oficial").fill("https://www.loja-e2e.com");
  await page.getByLabel("Novo domínio").fill("https://www.Loja-E2E.com/qualquer");
  await page.getByRole("button", { name: "Adicionar" }).click();
  await page.getByRole("button", { name: "Salvar loja" }).click();
  await expect(page).toHaveURL(/\/admin\/lojas\/[0-9a-f-]{36}/);
  const s = svc();
  const { data } = await s.from("stores").select("id, store_domains(domain)").eq("slug", slug).single();
  expect(data?.store_domains.map((d) => d.domain)).toEqual(["loja-e2e.com"]);
  await s.from("stores").delete().eq("id", data!.id);
});

test("category with products cannot be deleted", async ({ page }) => {
  await adminLogin(page);
  await page.goto("/admin/categorias");
  const row = page.getByRole("row").filter({ hasText: "Beleza" });
  await row.getByRole("button", { name: "Excluir Beleza" }).click();
  await page.getByRole("button", { name: "Excluir", exact: true }).click();
  await expect(page.getByText(/Mova os \d+ produto\(s\)/)).toBeVisible();
});
