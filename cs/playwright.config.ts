import { defineConfig, chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
let executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
if (!executablePath && !fs.existsSync(chromium.executablePath())) {
  const cache = path.join(os.homedir(), "Library/Caches/ms-playwright");
  if (fs.existsSync(cache)) {
    for (const f of fs
      .readdirSync(cache)
      .filter((x) => /^chromium-\d+$/.test(x))
      .reverse()) {
      const p = path.join(
        cache,
        f,
        "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
      );
      if (fs.existsSync(p)) {
        executablePath = p;
        break;
      }
    }
  }
}
export default defineConfig({
  testDir: "tests/e2e",
  workers: 1,
  fullyParallel: false,
  timeout: 45000,
  expect: { timeout: 8000 },
  reporter: [
    ["list"],
    ["json", { outputFile: "docs/playwright-results.json" }],
  ],
  use: {
    headless: true,
    viewport: { width: 1440, height: 1000 },
    launchOptions: { ...(executablePath ? { executablePath } : {}) },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run preview -- --port 4173 --host 127.0.0.1",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
  },
});
