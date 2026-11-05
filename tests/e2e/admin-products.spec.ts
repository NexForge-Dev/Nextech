import { test, expect } from "@playwright/test";
import { adminLogin } from "./admin-support";
import { acceptCookies, svc } from "./support";

test("admin creates a store and a product; it appears in the store with its price", async ({ page }) => {
  const s = svc();
  const stamp = Date.now();
  const storeSlug = `loja-teste-${stamp}`;
  const { data: store } = await s.from("stores").insert({ slug: storeSlug, name: `Loja Teste ${stamp}`, official_url: "https://loja-teste.com", markets: ["BR"], active: true }).select("id").single();
  await s.from("store_domains").insert({ store_id: store!.id, domain: "loja-teste.com" });
  const productName = `Fone Teste ${stamp}`;
  const slug = `fone-teste-${stamp}`;
  try {
    await acceptCookies(page);
    await adminLogin(page);
    await page.goto("/admin/produtos/novo");
    await page.getByLabel("Nome do produto").fill(productName);
    await expect(page.getByLabel("Slug")).toHaveValue(slug);
    await page.getByLabel("Categoria").selectOption({ label: "Eletrônicos" });
    await page.getByLabel("Modo de venda").selectOption("affiliate");
    await page.getByRole("button", { name: "Adicionar oferta" }).click();
    await page.getByLabel("Loja parceira").selectOption({ label: `Loja Teste ${stamp}` });
    await page.getByLabel("Link original do produto").fill("http://loja-teste.com/p/1");
    await page.getByLabel("Preço atual (BRL)").fill("199,90");
    await page.getByLabel("Status").selectOption("published");
    await page.getByRole("button", { name: "Salvar produto" }).click();
    await expect(page.getByText("Use um endereço https:// válido.")).toBeVisible();

    await page.getByLabel("Link original do produto").fill("https://outra-loja.com/p/1");
    await page.getByRole("button", { name: "Salvar produto" }).click();
    await expect(page.getByText(`Domínio "outra-loja.com" não está cadastrado na loja Loja Teste ${stamp}.`)).toBeVisible();

    await page.getByLabel("Link original do produto").fill("https://www.loja-teste.com/p/1");
    await page.getByRole("button", { name: "Salvar produto" }).click();
    await expect(page).toHaveURL(/\/admin\/produtos\/[0-9a-f-]{36}$/);

    await page.goto(`/pt-br/produto/${slug}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(productName);
    await expect(page.getByTestId("price-main").first()).toContainText("R$ 199,90");
    await expect(page.getByText(/-\d+%/)).toHaveCount(0);
  } finally {
    await s.from("products").delete().eq("slug", slug);
    await s.from("stores").delete().eq("id", store!.id);
  }
});

test("admin creates an own-store product with a private supplier and sees the margin", async ({ page }) => {
  const s = svc();
  const stamp = Date.now();
  const slug = `fone-proprio-${stamp}`;
  try {
    await acceptCookies(page);
    await adminLogin(page);
    await page.goto("/admin/produtos/novo");
    await expect(page.getByLabel("Modo de venda")).toHaveValue("dropship");
    await page.getByLabel("Nome do produto").fill(`Fone Próprio ${stamp}`);
    await page.getByLabel("Slug").fill(slug);
    await page.getByLabel("Categoria").selectOption({ label: "Eletrônicos" });
    await page.getByRole("button", { name: "Salvar produto" }).click();
    await expect(page.getByText("Informe o preço de venda.")).toBeVisible();

    await page.getByLabel("Preço de venda (R$)").fill("249,90");
    await page.getByRole("button", { name: "Adicionar fornecedor" }).click();
    await page.getByLabel("Fornecedor", { exact: true }).selectOption({ label: "Amazon BR" });
    await page.getByLabel("Custo (R$)").fill("165,00");
    await expect(page.getByTestId("margin-estimate")).toContainText("R$ 74,53");
    await page.getByRole("button", { name: "Salvar produto" }).click();
    await expect(page).toHaveURL(/\/admin\/produtos\/[0-9a-f-]{36}$/);
    await expect(page.getByLabel("Preço de venda (R$)")).toHaveValue("249,90");
    await expect(page.getByLabel("Custo (R$)")).toHaveValue("165,00");
  } finally {
    await s.from("products").delete().eq("slug", slug);
  }
});
