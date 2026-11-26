import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 90_000,
  forbidOnly: Boolean(process.env.CI),
  reporter: "list",
  use: {
    baseURL: process.env.SITEGATE_E2E_PORTAL_URL,
    browserName: "chromium",
    launchOptions: { executablePath: process.env.SITEGATE_E2E_CHROMIUM },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
});
