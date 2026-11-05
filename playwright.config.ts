import { defineConfig, devices } from "@playwright/test";

// E2E_PORT runs an isolated production build (against the local Supabase env exported in the shell),
// so a developer's own `npm run dev` on 3300 is never reused by the tests.
const port = Number(process.env.E2E_PORT ?? 3300);
const isolated = !!process.env.E2E_PORT;

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  retries: 0,
  use: { baseURL: `http://localhost:${port}`, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: isolated ? `npm run build && npx next start -p ${port}` : "npm run dev",
    url: `http://localhost:${port}/api/health`,
    reuseExistingServer: !isolated,
    // specs flip the business-model switches: the proxy's 30 s cache would hide the change
    env: { BUSINESS_MODELS_PROXY_TTL_MS: "0" },
    timeout: 600_000,
  },
});
