import { defineConfig } from "@playwright/test";
import base from "./playwright.config";
process.env.NO_PROXY = [process.env.NO_PROXY, "127.0.0.1", "localhost"]
  .filter(Boolean)
  .join(",");
process.env.no_proxy = process.env.NO_PROXY;
export default defineConfig({
  ...base,
  testMatch: "online.spec.ts",
  reporter: [
    ["list"],
    ["json", { outputFile: "docs/playwright-online-results.json" }],
  ],
  webServer: {
    command: "node scripts/serve-web-test.mjs",
    url: "http://127.0.0.1:4173/frame-cs/",
    reuseExistingServer: false,
  },
});
