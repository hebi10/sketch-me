// @vitest-environment node

import { describe, expect, it } from 'vitest';

import {
  hasSafeFirebaseEmulatorEnvironment,
  normalizeFirebaseAdminStorageEmulatorEnvironment,
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

  it('rejects unsafe or mismatched Firebase Admin Storage aliases', () => {
    for (const unsafeEnvironment of [
      { ...safeEnvironment, STORAGE_EMULATOR_HOST: 'https://storage.googleapis.com' },
      { ...safeEnvironment, STORAGE_EMULATOR_HOST: 'http://127.0.0.1:19199' },
      { ...safeEnvironment, STORAGE_EMULATOR_HOST: '127.0.0.1:9199' },
      { ...safeEnvironment, STORAGE_EMULATOR_HOST: 'http://127.0.0.1:9199/v0' },
      { ...safeEnvironment, FIREBASE_STORAGE_EMULATOR_HOST: 'http://127.0.0.1:9199' },
      { ...safeEnvironment, FIREBASE_STORAGE_EMULATOR_HOST: '127.0.0.1:9199/v0' },
    ]) {
      expect(hasSafeFirebaseEmulatorEnvironment(['storage'], unsafeEnvironment)).toBe(false);
      expect(() => requireSafeFirebaseEmulatorEnvironment(['storage'], unsafeEnvironment)).toThrow(
        /FIREBASE_STORAGE_EMULATOR_HOST|STORAGE_EMULATOR_HOST/,
      );
    }
  });

  it('normalizes both Firebase Admin Storage emulator variables after validation', () => {
    const environment = {
      ...safeEnvironment,
      FIREBASE_STORAGE_EMULATOR_HOST: 'localhost:9199',
      STORAGE_EMULATOR_HOST: 'http://localhost:9199',
    };

    expect(normalizeFirebaseAdminStorageEmulatorEnvironment(environment)).toBe('localhost:9199');
    expect(environment.FIREBASE_STORAGE_EMULATOR_HOST).toBe('localhost:9199');
    expect(environment.STORAGE_EMULATOR_HOST).toBe('http://localhost:9199');

    const environmentWithoutAlias: Record<string, string | undefined> = { ...safeEnvironment };
    normalizeFirebaseAdminStorageEmulatorEnvironment(environmentWithoutAlias);
    expect(environmentWithoutAlias.FIREBASE_STORAGE_EMULATOR_HOST).toBe('[::1]:9199');
    expect(environmentWithoutAlias.STORAGE_EMULATOR_HOST).toBe('http://[::1]:9199');
  });

  it('does not overwrite a preexisting unsafe Storage alias with an approved Playwright host', () => {
    const environment = {
      FIREBASE_PROJECT_ID: 'sketch-me-local',
      FIREBASE_STORAGE_EMULATOR_HOST: 'storage.googleapis.com:443',
      STORAGE_EMULATOR_HOST: 'https://storage.googleapis.com',
    };

    expect(() => normalizeFirebaseAdminStorageEmulatorEnvironment(
      environment,
      '127.0.0.1:9199',
    )).toThrow(/FIREBASE_STORAGE_EMULATOR_HOST|STORAGE_EMULATOR_HOST/);
    expect(environment.STORAGE_EMULATOR_HOST).toBe('https://storage.googleapis.com');
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
