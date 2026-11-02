import type { Page } from "@playwright/test";
import { svc } from "./support";

/** The suite signs in many times; reset the local sign-in rate limit so it never trips mid-run. */
export async function resetAuthRateLimit() {
  await svc().from("rate_limits").delete().neq("key", "");
}

export const ADMIN = { email: "admin@nextech.local", password: "admin-nextech-123" };

export async function adminLogin(page: Page, email = ADMIN.email, password = ADMIN.password) {
  await resetAuthRateLimit();
  await page.goto("/admin/entrar");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/admin/entrar"));
}
