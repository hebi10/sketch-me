import { defineConfig, devices } from '@playwright/test';

import {
  normalizeFirebaseAdminStorageEmulatorEnvironment,
  resolvePlaywrightBaseUrl,
  resolvePlaywrightEmulatorHosts,
} from './tests/helpers/firebase-emulator-safety';
import { ADMIN_E2E_SERVER_IDENTITY } from './src/lib/testing/e2e-readiness';

const baseURL = resolvePlaywrightBaseUrl(process.env.PLAYWRIGHT_BASE_URL);
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
  ADMIN_UID: ADMIN_E2E_SERVER_IDENTITY.uid,
  ADMIN_EMAIL: ADMIN_E2E_SERVER_IDENTITY.email,
  ADMIN_ALLOWED_ORIGIN: new URL(baseURL).origin,
  NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST: emulatorHosts.auth,
  PLAYWRIGHT_BASE_URL: baseURL,
  PLAYWRIGHT_E2E_SERVER: '1',
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
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 7'] },
      // The mobile flow mutates one shared Firebase Emulator project and must stay deterministic.
      workers: 1,
    },
  ],
});
