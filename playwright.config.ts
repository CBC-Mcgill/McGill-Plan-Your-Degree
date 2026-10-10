import { defineConfig, devices } from "@playwright/test";

const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: "e2e",
  testMatch: "**/*.e2e.ts",
  forbidOnly: isCI,
  retries: 0,
  reporter: isCI ? "github" : "list",
  use: { baseURL: "http://localhost:3000", trace: "retain-on-failure" },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: /\/mobile[^/]*\.e2e\.ts$/,
    },
    {
      name: "small-desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1024, height: 768 },
      },
      testIgnore: /\/mobile[^/]*\.e2e\.ts$/,
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] },
      testMatch: /\/mobile[^/]*\.e2e\.ts$/,
    },
  ],
  webServer: {
    command: isCI ? "pnpm start" : "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !isCI,
  },
});
