import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  retries: 0,
  use: { baseURL: "http://localhost:3300", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3300/api/health",
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
