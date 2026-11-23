import { defineConfig, devices } from "@playwright/test";

const apiPort = process.env.KUBELAB_E2E_API_PORT ?? "18081";
const webPort = process.env.KUBELAB_E2E_WEB_PORT ?? "5174";
const apiUrl = `http://127.0.0.1:${apiPort}`;
const webUrl = `http://127.0.0.1:${webPort}`;

export default defineConfig({
  testDir: "./e2e",
  outputDir: "test-results",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: webUrl,
    trace: "on-first-retry",
  },
  webServer: [
    {
      command: "go -C apps/api run ./cmd/api",
      url: `${apiUrl}/api/healthz`,
      env: { PORT: apiPort },
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: "pnpm dev",
      url: webUrl,
      env: { KUBELAB_API_PROXY: apiUrl, KUBELAB_WEB_PORT: webPort },
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
