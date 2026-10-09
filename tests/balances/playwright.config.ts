import { defineConfig } from "@playwright/test";

if (!process.env.BALANCE_E2E_URL || !process.env.BALANCE_E2E_DATABASE) {
  throw new Error("Run npm run test:balances:browser; never point these tests at a shared server.");
}

export default defineConfig({
  testDir: ".",
  testMatch: "*.spec.ts",
  outputDir: "../../test-results/balances/runs",
  workers: 1,
  retries: 0,
  timeout: 60000,
  expect: { timeout: 10000 },
  reporter: [["list"], ["html", { outputFolder: "playwright-report/balances", open: "never" }]],
  use: {
    baseURL: process.env.BALANCE_E2E_URL,
    browserName: "chromium",
    launchOptions: process.env.BALANCE_E2E_CHROMIUM ? { executablePath: process.env.BALANCE_E2E_CHROMIUM } : {},
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 1000 } } },
    { name: "mobile", use: { viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true } },
  ],
});
