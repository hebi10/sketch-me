import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export const MANAGE_COOKIE_NAME = 'sketchbook_manage_token';

export interface LegacyManageSession {
  type: 'legacy';
  publicId: string;
  token: string;
}

export interface PinManageSession {
  type: 'pin';
  publicId: string;
  sessionId: string;
  token: string;
}

export function createManageToken() {
  return randomBytes(32).toString('base64url');
}

export function hashManageToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function createManageCookieValue(publicId: string, token: string) {
  return `${publicId}.${token}`;
}

export function createPinManageCookieValue(publicId: string, sessionId: string, token: string) {
  return `${publicId}.${sessionId}.${token}`;
}

export function isValidManageToken(token: string, manageTokenHash: string) {
  const expected = Buffer.from(manageTokenHash, 'hex');
  const actual = Buffer.from(hashManageToken(token), 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function parseManageSession(cookieValue?: string) {
  if (!cookieValue) return null;
  const parts = cookieValue.split('.');
  if (parts.length === 2 && parts[0] && parts[1]) {
    return { publicId: parts[0], token: parts[1], type: 'legacy' } satisfies LegacyManageSession;
  }
  if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
    return { publicId: parts[0], sessionId: parts[1], token: parts[2], type: 'pin' } satisfies PinManageSession;
  }
  return null;
}

export function isValidManageSession(
  session: LegacyManageSession | null,
  publicId: string,
  manageTokenHash: string,
) {
  if (!session || session.publicId !== publicId) return false;
  return isValidManageToken(session.token, manageTokenHash);
}
