import { defineConfig, devices } from "@playwright/test";

const isCI = Boolean(process.env.CI);
// Its own port, so a dev server on 3000 from another checkout is never tested by mistake.
const port = 3100;
const url = `http://localhost:${port}`;

export default defineConfig({
  testDir: "e2e",
  testMatch: "**/*.e2e.ts",
  forbidOnly: isCI,
  retries: 0,
  reporter: isCI ? "github" : "list",
  use: { baseURL: url, trace: "retain-on-failure" },
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
    command: `${isCI ? "" : "pnpm build && "}pnpm start --port ${port}`,
    url,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
