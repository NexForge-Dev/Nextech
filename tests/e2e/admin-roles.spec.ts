import { test, expect } from "@playwright/test";
import { adminLogin } from "./admin-support";
import { svc } from "./support";

test("superadmin invites an editor; the editor is blocked from settings", async ({ page, browser }) => {
  const s = svc();
  const email = `editor-${Date.now()}@nextech.local`;
  await adminLogin(page);
  await page.goto("/admin/administradores");
  await page.getByLabel("E-mail").fill(email);
  await page.locator("#inv-role").selectOption("editor");
  await page.getByRole("button", { name: "Convidar" }).click();
  await expect(page.getByRole("cell", { name: email })).toBeVisible();

  // local only: give the invited user a password so we can sign in as them
  const { data: list } = await s.auth.admin.listUsers({ perPage: 1000 });
  const user = list.users.find((u) => u.email === email)!;
  await s.auth.admin.updateUserById(user.id, { password: "editor-senha-123", email_confirm: true });

  const ctx = await browser.newContext();
  const editor = await ctx.newPage();
  try {
    await adminLogin(editor, email, "editor-senha-123");
    await expect(editor.getByRole("navigation", { name: "Menu do painel" }).getByRole("link", { name: "Configurações" })).toHaveCount(0);
    await editor.goto("/admin/configuracoes");
    await expect(editor.getByRole("heading", { name: "Acesso restrito" })).toBeVisible();
    await editor.goto("/admin/produtos");
    await expect(editor.getByRole("heading", { name: "Produtos" })).toBeVisible();
  } finally {
    await ctx.close();
    await s.auth.admin.deleteUser(user.id);
  }
});

test("a superadmin cannot change their own role", async ({ page }) => {
  await adminLogin(page);
  await page.goto("/admin/administradores");
  await expect(page.getByRole("row").filter({ hasText: "admin@nextech.local" }).getByText("Você")).toBeVisible();
});

test("settings save and reach the store", async ({ page }) => {
  await adminLogin(page);
  await page.goto("/admin/configuracoes");
  await page.getByRole("tab", { name: "Analytics" }).click();
  await page.getByLabel("Google Analytics 4 — ID de medição").fill("UA-123");
  await page.getByRole("button", { name: "Salvar configurações" }).click();
  await expect(page.getByText("ID do GA4 no formato G-XXXXXXX.")).toBeVisible();
  await page.getByLabel("Google Analytics 4 — ID de medição").fill("");
  await page.getByRole("tab", { name: "Informações legais" }).click();
  await page.getByLabel("Razão social").fill("NEXTECH Comércio Digital Ltda.");
  await page.getByRole("button", { name: "Salvar configurações" }).click();
  await expect(page.getByText("Configurações salvas.")).toBeVisible();
  await page.goto("/pt-br/privacidade");
  await expect(page.getByText("NEXTECH Comércio Digital Ltda.").first()).toBeVisible();
  await svc().from("site_settings").update({ value: { company_name: "", tax_id: "", address: "" } }).eq("key", "public.legal");
});
