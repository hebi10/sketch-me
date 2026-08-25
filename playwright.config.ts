import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000';
const adminTestEnv = {
  FIREBASE_PROJECT_ID: 'sketch-me-local',
  FIREBASE_AUTH_EMULATOR_HOST: process.env.PLAYWRIGHT_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099',
  FIRESTORE_EMULATOR_HOST: process.env.PLAYWRIGHT_FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080',
  FIREBASE_STORAGE_EMULATOR_HOST: process.env.PLAYWRIGHT_STORAGE_EMULATOR_HOST ?? '127.0.0.1:9199',
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: 'sketch-me-local.appspot.com',
  ADMIN_UID: 'admin-e2e-uid',
  ADMIN_EMAIL: 'admin@example.com',
  ADMIN_ALLOWED_ORIGIN: new URL(baseURL).origin,
  NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST: process.env.PLAYWRIGHT_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099',
};

Object.assign(process.env, adminTestEnv);

const webPort = new URL(baseURL).port || '3000';
const reuseExistingServer = process.env.PLAYWRIGHT_REUSE_EXISTING_SERVER === '1';

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER ? undefined : [
    {
      command: 'npm run emulators -- --project sketch-me-local',
      port: Number(adminTestEnv.FIREBASE_AUTH_EMULATOR_HOST.split(':').at(-1)),
      reuseExistingServer,
    },
    {
      command: `npm run dev -- --hostname 127.0.0.1 --port ${webPort}`,
      env: { ...process.env, ...adminTestEnv },
      reuseExistingServer,
      url: baseURL,
    },
  ],
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
  ],
});
