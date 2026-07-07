import { defineConfig, devices } from "@playwright/test";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, ".env") });

const ADMIN_PORT = 3000;
const AGENT_PORT = 3001;

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["html", { open: "never" }]],
  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "admin",
      testDir: "./tests/admin",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: `http://localhost:${ADMIN_PORT}`,
      },
    },
    {
      name: "agent",
      testDir: "./tests/agent",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: `http://localhost:${AGENT_PORT}`,
      },
    },
  ],
  webServer: [
    {
      command: "npm run dev",
      cwd: "../admin",
      url: `http://localhost:${ADMIN_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: `PORT=${AGENT_PORT} npm run dev -- -p ${AGENT_PORT}`,
      cwd: "../agent",
      url: `http://localhost:${AGENT_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
