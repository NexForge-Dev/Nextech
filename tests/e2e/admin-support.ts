import type { Page } from "@playwright/test";

export const ADMIN = { email: "admin@nextech.local", password: "admin-nextech-123" };

export async function adminLogin(page: Page, email = ADMIN.email, password = ADMIN.password) {
  await page.goto("/admin/entrar");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/admin/entrar"));
}
