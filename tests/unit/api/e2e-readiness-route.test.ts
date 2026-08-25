// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest';

import { GET } from '@/app/api/e2e-readiness/route';

const safeServerEnvironment = {
  ADMIN_ALLOWED_ORIGIN: 'http://127.0.0.1:13000',
  ADMIN_EMAIL: 'admin@example.com',
  ADMIN_UID: 'admin-e2e-uid',
  FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:19099',
  FIREBASE_PROJECT_ID: 'sketch-me-local',
  FIREBASE_STORAGE_EMULATOR_HOST: '127.0.0.1:19199',
  FIRESTORE_EMULATOR_HOST: '127.0.0.1:18080',
  NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:19099',
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: 'sketch-me-local.appspot.com',
  PLAYWRIGHT_E2E_SERVER: '1',
  STORAGE_EMULATOR_HOST: 'http://127.0.0.1:19199',
} as const;

function stubServerEnvironment(overrides: Record<string, string> = {}) {
  for (const [name, value] of Object.entries({ ...safeServerEnvironment, ...overrides })) {
    vi.stubEnv(name, value);
  }
}

describe('GET /api/e2e-readiness', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('hides the test route when the server was not explicitly started for Playwright', async () => {
    stubServerEnvironment({ PLAYWRIGHT_E2E_SERVER: '' });

    const response = await GET(new Request('http://127.0.0.1:13000/api/e2e-readiness'));

    expect(response.status).toBe(404);
    expect(await response.text()).toBe('');
    expect([...response.headers.values()].join(' ')).not.toContain('sketch-me-local');
  });

  it.each([
    ['wrong project', { FIREBASE_PROJECT_ID: 'production-project' }],
    ['external Auth host', { FIREBASE_AUTH_EMULATOR_HOST: 'identitytoolkit.googleapis.com:443' }],
    ['zero Auth ports', {
      FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:0',
      NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:0',
    }],
    ['external Firestore host', { FIRESTORE_EMULATOR_HOST: 'firestore.googleapis.com:443' }],
    ['external Storage alias', { STORAGE_EMULATOR_HOST: 'https://storage.googleapis.com' }],
    ['wrong admin UID', { ADMIN_UID: 'some-user' }],
    ['wrong admin email', { ADMIN_EMAIL: 'operator@example.com' }],
    ['wrong request origin', { ADMIN_ALLOWED_ORIGIN: 'http://localhost:13000' }],
  ])('returns a generic unavailable response for %s', async (_label, overrides) => {
    stubServerEnvironment(overrides);

    const response = await GET(new Request('http://127.0.0.1:13000/api/e2e-readiness'));

    expect(response.status).toBe(503);
    expect(await response.text()).toBe('');
    expect([...response.headers.values()].join(' ')).not.toContain('sketch-me-local');
  });

  it('confirms an isolated server only when all test identities and emulator hosts are safe', async () => {
    stubServerEnvironment();

    const response = await GET(new Request('http://127.0.0.1:13000/api/e2e-readiness'));

    expect(response.status).toBe(204);
    expect(response.headers.get('x-sketch-me-e2e-ready')).toBe('1');
    expect(await response.text()).toBe('');
  });

  it('uses the validated Playwright origin when Next.js normalizes the request URL host', async () => {
    stubServerEnvironment();

    const response = await GET(new Request('http://localhost:13000/api/e2e-readiness', {
      headers: { 'X-Sketch-Me-E2E-Origin': 'http://127.0.0.1:13000' },
    }));

    expect(response.status).toBe(204);
    expect(response.headers.get('x-sketch-me-e2e-ready')).toBe('1');
  });
});
