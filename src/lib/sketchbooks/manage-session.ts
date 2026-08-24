import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export const MANAGE_COOKIE_NAME = 'sketchbook_manage_token';

export function createManageToken() {
  return randomBytes(32).toString('base64url');
}

export function hashManageToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function createManageCookieValue(publicId: string, token: string) {
  return `${publicId}.${token}`;
}

export function isValidManageToken(token: string, manageTokenHash: string) {
  const expected = Buffer.from(manageTokenHash, 'hex');
  const actual = Buffer.from(hashManageToken(token), 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function parseManageSession(cookieValue?: string) {
  if (!cookieValue) return null;
  const separator = cookieValue.indexOf('.');
  if (separator < 1 || separator === cookieValue.length - 1) return null;

  return {
    publicId: cookieValue.slice(0, separator),
    token: cookieValue.slice(separator + 1),
  };
}

export function isValidManageSession(
  session: ReturnType<typeof parseManageSession>,
  publicId: string,
  manageTokenHash: string,
) {
  if (!session || session.publicId !== publicId) return false;
  return isValidManageToken(session.token, manageTokenHash);
}
