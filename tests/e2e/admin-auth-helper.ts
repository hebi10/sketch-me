import { expect, type APIResponse, type Page } from '@playwright/test';

import { ADMIN_E2E } from './admin-fixture';

type EmulatorSignInResponse = {
  idToken: string;
  localId: string;
};

function getAuthEmulatorOrigin() {
  const host = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099';
  return `http://${host}`;
}

export function readFirebaseIdTokenClaims(idToken: string) {
  const payload = idToken.split('.')[1];
  if (!payload) throw new Error('Firebase ID token payload가 없습니다.');
  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
    email?: string;
    firebase?: { sign_in_provider?: string };
    user_id?: string;
  };
}

export async function signInAdminWithPassword(page: Page) {
  const response = await page.request.post(
    `${getAuthEmulatorOrigin()}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key`,
    {
      data: {
        email: ADMIN_E2E.email,
        password: ADMIN_E2E.password,
        returnSecureToken: true,
      },
    },
  );
  expect(response.ok()).toBe(true);
  return response.json() as Promise<EmulatorSignInResponse>;
}

export async function signInAdminWithGoogleProvider(page: Page) {
  const fakeGoogleIdToken = JSON.stringify({
    email: ADMIN_E2E.email,
    email_verified: true,
    name: '관리자 E2E',
    sub: ADMIN_E2E.googleSubject,
  });
  const response = await page.request.post(
    `${getAuthEmulatorOrigin()}/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=fake-api-key`,
    {
      data: {
        postBody: new URLSearchParams({
          id_token: fakeGoogleIdToken,
          providerId: 'google.com',
        }).toString(),
        requestUri: process.env.ADMIN_ALLOWED_ORIGIN ?? 'http://127.0.0.1:3000',
        returnIdpCredential: true,
        returnSecureToken: true,
      },
    },
  );
  expect(response.ok()).toBe(true);
  return response.json() as Promise<EmulatorSignInResponse>;
}

export async function exchangeAdminIdToken(page: Page, idToken: string): Promise<APIResponse> {
  return page.request.post('/api/admin/session', {
    data: { idToken },
    headers: { Origin: process.env.ADMIN_ALLOWED_ORIGIN ?? 'http://127.0.0.1:3000' },
  });
}

export async function createAdminEmulatorSession(page: Page) {
  const { idToken, localId } = await signInAdminWithGoogleProvider(page);
  const claims = readFirebaseIdTokenClaims(idToken);
  expect(localId).toBe(ADMIN_E2E.uid);
  expect(claims.email).toBe(ADMIN_E2E.email);
  expect(claims.user_id).toBe(ADMIN_E2E.uid);
  expect(claims.firebase?.sign_in_provider).toBe('google.com');

  const session = await exchangeAdminIdToken(page, idToken);
  expect(session.status()).toBe(204);
}
