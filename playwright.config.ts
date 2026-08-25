import { defineConfig, devices } from '@playwright/test';

import {
  normalizeFirebaseAdminStorageEmulatorEnvironment,
  resolvePlaywrightEmulatorHosts,
} from './tests/helpers/firebase-emulator-safety';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000';
const managesFirebaseEmulators = !process.env.PLAYWRIGHT_SKIP_WEBSERVER;
const emulatorHosts = resolvePlaywrightEmulatorHosts(process.env, managesFirebaseEmulators);
const storageAdminEnvironment: NodeJS.ProcessEnv = {
  ...process.env,
  FIREBASE_PROJECT_ID: 'sketch-me-local',
};
const storageHost = normalizeFirebaseAdminStorageEmulatorEnvironment(
  storageAdminEnvironment,
  emulatorHosts.storage,
);
const adminStorageHost = storageAdminEnvironment.STORAGE_EMULATOR_HOST;
if (!adminStorageHost) throw new Error('Storage Emulator 환경을 정규화하지 못했습니다.');
const adminTestEnv = {
  FIREBASE_PROJECT_ID: 'sketch-me-local',
  FIREBASE_AUTH_EMULATOR_HOST: emulatorHosts.auth,
  FIRESTORE_EMULATOR_HOST: emulatorHosts.firestore,
  FIREBASE_STORAGE_EMULATOR_HOST: storageHost,
  STORAGE_EMULATOR_HOST: adminStorageHost,
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: 'sketch-me-local.appspot.com',
  ADMIN_UID: 'admin-e2e-uid',
  ADMIN_EMAIL: 'admin@example.com',
  ADMIN_ALLOWED_ORIGIN: new URL(baseURL).origin,
  NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST: emulatorHosts.auth,
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
    {
      name: 'chromium',
      testIgnore: /admin-flow\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
  ],
});
