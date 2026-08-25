// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { resolveE2ENextDistDir } from '../../../src/lib/testing/e2e-readiness';

import {
  hasSafeFirebaseEmulatorEnvironment,
  normalizeFirebaseAdminStorageEmulatorEnvironment,
  resolvePlaywrightBaseUrl,
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
  it('isolates the Next.js build directory only for an explicit Playwright E2E server', () => {
    expect(resolveE2ENextDistDir({})).toBe('.next');
    expect(resolveE2ENextDistDir({ PLAYWRIGHT_E2E_SERVER: '0' })).toBe('.next');
    expect(resolveE2ENextDistDir({ PLAYWRIGHT_E2E_SERVER: '1' }))
      .toBe('.superpowers/sdd/2026-08-25-operator-admin/.next-task10');
  });

  it('accepts only a bare HTTP loopback origin as the Playwright base URL', () => {
    expect(resolvePlaywrightBaseUrl('http://127.0.0.1:13000')).toBe('http://127.0.0.1:13000');
    expect(resolvePlaywrightBaseUrl('http://localhost:3000/')).toBe('http://localhost:3000');
    expect(resolvePlaywrightBaseUrl('http://[::1]:3000')).toBe('http://[::1]:3000');

    for (const unsafeUrl of [
      'https://127.0.0.1:3000',
      'http://example.com:3000',
      'http://0.0.0.0:3000',
      'http://127.0.0.1:0',
      'http://127.0.0.1.evil.test:3000',
      'http://user:password@127.0.0.1:3000',
      'http://127.0.0.1:3000/admin',
      'http://127.0.0.1:3000/?project=sketch-me-local',
      'http://127.0.0.1:3000/#ready',
    ]) {
      expect(() => resolvePlaywrightBaseUrl(unsafeUrl)).toThrow(/PLAYWRIGHT_BASE_URL.*HTTP loopback origin/);
    }
  });

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
