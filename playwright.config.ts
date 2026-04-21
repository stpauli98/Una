import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";

// Load env file: DOTENV_CONFIG_PATH=.env.test for local, or defaults to .env.local
config({ path: process.env.DOTENV_CONFIG_PATH ?? ".env.local" });

export default defineConfig({
  testDir: "./tests/e2e",
  // Globalni setup briše sve test podatke (Test Klijent*, E2E*) prije run-a
  // kako bi testovi krenuli sa čistim slate-om.
  globalSetup: "./tests/e2e/global-setup.ts",
  // Svi testovi manipulišu istom bazom (appointments, time_blocks,
  // working_hours) i neki od njih seed-uju podatke na "sljedeći weekday"
  // koji se dijeli između testova. Serial mode sprečava interferenciju.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: process.env.PLAYWRIGHT_SKIP_WEB_SERVER
    ? undefined
    : {
        command: process.env.DOTENV_CONFIG_PATH
          ? `env $(cat ${process.env.DOTENV_CONFIG_PATH} | grep -v '^#' | grep -v '^$' | xargs) npm run dev`
          : "npm run dev",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
