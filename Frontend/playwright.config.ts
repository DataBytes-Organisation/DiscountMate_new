import { defineConfig, devices } from "@playwright/test";

const existingBaseUrl = process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
   testDir: "./e2e",
   fullyParallel: false,
   retries: process.env.CI ? 2 : 0,
   reporter: "list",
   use: {
      baseURL: existingBaseUrl || "http://127.0.0.1:19006",
      trace: "retain-on-failure",
   },
   webServer: existingBaseUrl ? undefined : {
      command: "npm run build:web && npm run serve:web",
      url: "http://127.0.0.1:19006",
      env: {
         PORT: "19006",
         EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: "e2e-web-client-id",
         EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: "e2e-ios-client-id",
         EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID: "e2e-android-client-id",
      },
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
   },
   projects: [
      { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
      { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
   ],
});
