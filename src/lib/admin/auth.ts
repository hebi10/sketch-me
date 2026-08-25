import type { DecodedIdToken } from 'firebase-admin/auth';

import { getAdminAuth } from '@/lib/firebase/admin';

const SESSION_MAX_AGE_SECONDS = 12 * 60 * 60;
const RECENT_LOGIN_MAX_AGE_SECONDS = 5 * 60;

export type AdminIdentity = {
  uid: string;
  email: string;
};

export type AdminAuthErrorCode =
  | 'INVALID_TOKEN'
  | 'RECENT_LOGIN_REQUIRED'
  | 'FORBIDDEN'
  | 'CONFIGURATION'
  | 'SESSION_CREATION_FAILED';

export class AdminAuthError extends Error {
  constructor(public readonly code: AdminAuthErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'AdminAuthError';
  }
}

export function getAdminSessionCookieName(): string {
  return process.env.NODE_ENV === 'production' ? '__Host-admin_session' : 'admin_session';
}

export function getAdminSessionCookieOptions(): {
  httpOnly: true;
  secure: boolean;
  sameSite: 'strict';
  path: '/';
  maxAge: number;
} {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

function toAllowedIdentity(claims: DecodedIdToken): AdminIdentity | null {
  const email = claims.email?.toLowerCase();

  if (
    !claims.email_verified
    || !email
    || claims.uid !== process.env.ADMIN_UID
    || email !== process.env.ADMIN_EMAIL?.toLowerCase()
    || claims.firebase.sign_in_provider !== 'google.com'
  ) {
    return null;
  }

  return { uid: claims.uid, email };
}

function assertAdminConfiguration(): void {
  const missingConfig = ['ADMIN_UID', 'ADMIN_EMAIL'].filter((key) => !process.env[key]);

  if (missingConfig.length > 0) {
    console.error(`Admin auth configuration missing: ${missingConfig.join(', ')}`);
    throw new AdminAuthError('CONFIGURATION', '관리자 인증 환경 변수가 설정되지 않았습니다.');
  }
}

export async function createAdminSessionCookie(idToken: string): Promise<string> {
  assertAdminConfiguration();

  let claims: DecodedIdToken;
  try {
    claims = await getAdminAuth().verifyIdToken(idToken, true);
  } catch (cause) {
    throw new AdminAuthError('INVALID_TOKEN', '유효하지 않은 로그인 정보입니다.', { cause });
  }

  if (
    typeof claims.auth_time !== 'number'
    || Date.now() / 1000 - claims.auth_time > RECENT_LOGIN_MAX_AGE_SECONDS
  ) {
    throw new AdminAuthError('RECENT_LOGIN_REQUIRED', '다시 로그인해 주세요.');
  }

  if (!toAllowedIdentity(claims)) {
    throw new AdminAuthError('FORBIDDEN', '관리자 권한이 없습니다.');
  }

  try {
    return await getAdminAuth().createSessionCookie(idToken, {
      expiresIn: SESSION_MAX_AGE_SECONDS * 1000,
    });
  } catch (cause) {
    throw new AdminAuthError('SESSION_CREATION_FAILED', '관리자 세션을 만들지 못했습니다.', { cause });
  }
}

export async function verifyAdminSessionCookie(cookieValue?: string): Promise<AdminIdentity | null> {
  if (!cookieValue) {
    return null;
  }

  try {
    return toAllowedIdentity(await getAdminAuth().verifySessionCookie(cookieValue, true));
  } catch {
    return null;
  }
}
