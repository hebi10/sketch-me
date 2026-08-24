import { createHash, randomBytes } from 'node:crypto';

export const MANAGE_COOKIE_NAME = 'sketchbook_manage_token';

export function createManageToken() {
  return randomBytes(32).toString('base64url');
}

export function hashManageToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}
