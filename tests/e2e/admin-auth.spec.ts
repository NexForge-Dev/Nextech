import { test, expect } from "@playwright/test";
import { adminLogin } from "./admin-support";
import { svc } from "./support";

test("admin requires login", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/entrar/);
});

test("superadmin logs in and sees the overview and sidebar", async ({ page }) => {
  await adminLogin(page);
  await expect(page.getByRole("heading", { name: "Visão geral" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Menu do painel" }).getByRole("link", { name: "Configurações" })).toBeVisible();
});

test("a store customer cannot enter the panel", async ({ page }) => {
  const s = svc();
  const email = `cliente-${Date.now()}@nextech.local`;
  const { data } = await s.auth.admin.createUser({ email, password: "cliente-123456", email_confirm: true });
  try {
    await adminLogin(page, email, "cliente-123456");
    await expect(page.getByRole("heading", { name: "Acesso restrito" })).toBeVisible();
  } finally {
    await s.auth.admin.deleteUser(data.user!.id);
  }
});
