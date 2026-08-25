// @vitest-environment node

import { describe, expect, it } from 'vitest';

import {
  hasSafeFirebaseEmulatorEnvironment,
  requireSafeFirebaseEmulatorEnvironment,
  resolvePlaywrightEmulatorHosts,
} from '../../helpers/firebase-emulator-safety';

const safeEnvironment = {
  FIREBASE_PROJECT_ID: 'sketch-me-local',
  FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
  FIRESTORE_EMULATOR_HOST: 'localhost:8080',
  FIREBASE_STORAGE_EMULATOR_HOST: '[::1]:9199',
};

describe('Firebase emulator safety', () => {
  it('requires the fixed local project and loopback hosts before emulator access', () => {
    expect(hasSafeFirebaseEmulatorEnvironment(['firestore', 'storage'], safeEnvironment)).toBe(true);

    for (const unsafeEnvironment of [
      { ...safeEnvironment, FIREBASE_PROJECT_ID: 'production-project' },
      { ...safeEnvironment, FIRESTORE_EMULATOR_HOST: 'firestore.googleapis.com:443' },
      { ...safeEnvironment, FIRESTORE_EMULATOR_HOST: '127.0.0.1.evil.test:8080' },
      { ...safeEnvironment, FIRESTORE_EMULATOR_HOST: undefined },
    ]) {
      expect(hasSafeFirebaseEmulatorEnvironment(['firestore'], unsafeEnvironment)).toBe(false);
      expect(() => requireSafeFirebaseEmulatorEnvironment(['firestore'], unsafeEnvironment)).toThrow(
        /sketch-me-local|loopback/,
      );
    }
  });

  it('rejects Playwright port overrides that its managed Firebase process cannot honor', () => {
    expect(() => resolvePlaywrightEmulatorHosts({
      PLAYWRIGHT_FIRESTORE_EMULATOR_HOST: '127.0.0.1:18080',
    }, true)).toThrow(/PLAYWRIGHT_FIRESTORE_EMULATOR_HOST.*8080.*PLAYWRIGHT_SKIP_WEBSERVER=1/);

    expect(resolvePlaywrightEmulatorHosts({
      PLAYWRIGHT_AUTH_EMULATOR_HOST: '127.0.0.1:19099',
      PLAYWRIGHT_FIRESTORE_EMULATOR_HOST: '127.0.0.1:18080',
      PLAYWRIGHT_STORAGE_EMULATOR_HOST: '127.0.0.1:19199',
    }, false)).toEqual({
      auth: '127.0.0.1:19099',
      firestore: '127.0.0.1:18080',
      storage: '127.0.0.1:19199',
    });
  });
});
