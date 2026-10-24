import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  workers: 1,
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:3107", trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [
    { name: "desktop", use: { viewport: { width: 1280, height: 900 } } },
    { name: "mobile", use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
  webServer: {
    command: "node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3107",
    url: "http://127.0.0.1:3107/admin/login",
    reuseExistingServer: false,
    env: {
      // Server-rendered admin layout uses a synthetic session, never a DB.
      NODE_OPTIONS: "--require ./tests/browser/fixtures/admin-layout.cjs",
      // Deliberately unreachable: UI tests mock API responses, never a real DB.
      DATABASE_URL: "postgresql://browser:browser@127.0.0.1:1/unused?connect_timeout=1",
      DIRECT_URL: "postgresql://browser:browser@127.0.0.1:1/unused?connect_timeout=1",
      ADMIN_SESSION_SECRET: "local-browser-test-secret-at-least-32-bytes",
    },
  },
});
