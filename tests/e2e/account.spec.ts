import { test, expect } from "@playwright/test";
import { acceptCookies } from "./support";

test.beforeEach(async ({ page }) => acceptCookies(page));

test("sign up, favourite, export data, delete account", async ({ page }) => {
  const email = `e2e+${Date.now()}@nextech.local`;
  const password = "senha-e2e-123";

  await page.goto("/pt-br/cadastro");
  await page.getByLabel("Nome completo").fill("Pessoa Teste");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page).toHaveURL(/\/pt-br\/minha-conta/);

  await page.goto("/pt-br/produto/produto-de-demonstracao-4");
  await page.getByRole("button", { name: "Adicionar aos favoritos" }).first().click();
  await expect(page.getByRole("button", { name: "Remover dos favoritos" }).first()).toBeVisible();

  await page.goto("/pt-br/minha-conta/favoritos");
  await expect(page.getByTestId("product-card").filter({ hasText: "Produto de demonstração 4" })).toBeVisible();

  await page.goto("/pt-br/minha-conta/privacidade");
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Exportar meus dados" }).click();
  const file = await download;
  const content = await (await file.createReadStream())?.toArray();
  expect(Buffer.concat(content ?? []).toString()).toContain("favorites");

  await page.getByLabel("Digite EXCLUIR para confirmar").fill("EXCLUIR");
  await page.getByRole("button", { name: "Excluir conta" }).click();
  await expect(page).toHaveURL(/\/pt-br$/);

  await page.goto("/pt-br/entrar");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  // the account no longer exists: sign-in sends the visitor to sign-up (auth_email_exists, 2026-11-01)
  await expect(page).toHaveURL(/\/pt-br\/cadastro\?.*motivo=sem-conta/);
});

test("guest favourites live in the browser", async ({ page }) => {
  await page.goto("/pt-br/produto/produto-de-demonstracao-7");
  await page.getByRole("button", { name: "Adicionar aos favoritos" }).first().click();
  await page.goto("/pt-br/favoritos");
  await expect(page.getByTestId("product-card").filter({ hasText: "Produto de demonstração 7" })).toBeVisible();
});

test("account pages require sign-in", async ({ page }) => {
  await page.goto("/pt-br/minha-conta");
  await expect(page).toHaveURL(/\/pt-br\/entrar/);
});
