import { resolve } from "node:path";
import { defineConfig } from "playwright/test";
import { boundedInteger } from "../property-options";
const port = boundedInteger(process.env.PROBE_PORT, 4173, 1024, 65535);
export default defineConfig({
  testDir: ".", testMatch: "*.pw.ts", fullyParallel: false, workers: 1,
  forbidOnly: Boolean(process.env.CI), retries: 0, timeout: 30_000,
  outputDir: resolve("../../output/playwright/results"),
  reporter: [["list"], ["json", { outputFile: resolve("../../output/playwright/results.json") }]],
  use: { baseURL: `http://127.0.0.1:${port}`, viewport: { width: 1100, height: 800 }, locale: "en-US", timezoneId: "America/New_York", trace: "retain-on-failure", screenshot: "only-on-failure", serviceWorkers: "block", ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) },
  webServer: { command: "bun run validation/browser/server.ts", cwd: process.cwd(), url: `http://127.0.0.1:${port}/health`, reuseExistingServer: false, timeout: 45_000 },
});
