import { defineConfig, devices } from "@playwright/test";

const apiPort = process.env.KUBELAB_E2E_API_PORT ?? "18081";
const apiUrl = `http://127.0.0.1:${apiPort}`;

export default defineConfig({
  testDir: "./e2e",
  outputDir: "test-results",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "on-first-retry",
  },
  webServer: [
    {
      command: "go -C apps/api run ./cmd/api",
      url: `${apiUrl}/api/healthz`,
      env: { PORT: apiPort },
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: "pnpm dev",
      url: "http://127.0.0.1:5173",
      env: { KUBELAB_API_PROXY: apiUrl },
      reuseExistingServer: !process.env.CI,
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
