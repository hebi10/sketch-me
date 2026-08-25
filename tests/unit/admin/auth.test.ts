import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const { verifyIdToken, createSessionCookie, verifySessionCookie, getAdminAuth } = vi.hoisted(() => ({
  verifyIdToken: vi.fn(),
  createSessionCookie: vi.fn(),
  verifySessionCookie: vi.fn(),
  getAdminAuth: vi.fn(),
}));

vi.mock('@/lib/firebase/admin', () => ({ getAdminAuth }));

import {
  createAdminSessionCookie,
  getAdminSessionCookieName,
  getAdminSessionCookieOptions,
  verifyAdminSessionCookie,
} from '@/lib/admin/auth';

describe('관리자 세션 인증', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-25T00:05:00.000Z'));
    vi.stubEnv('ADMIN_UID', 'admin-uid');
    vi.stubEnv('ADMIN_EMAIL', 'owner@example.com');
    vi.stubEnv('NODE_ENV', 'test');
    getAdminAuth.mockReturnValue({ verifyIdToken, createSessionCookie, verifySessionCookie });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it('UID와 이메일이 모두 일치하고 이메일이 인증된 계정만 세션을 발급한다', async () => {
    verifyIdToken.mockResolvedValue({
      uid: 'admin-uid',
      email: 'owner@example.com',
      email_verified: true,
      auth_time: 1_787_616_240,
      firebase: { sign_in_provider: 'google.com' },
    });
    createSessionCookie.mockResolvedValue('session-cookie');

    await expect(createAdminSessionCookie('id-token')).resolves.toBe('session-cookie');
    expect(createSessionCookie).toHaveBeenCalledWith('id-token', { expiresIn: 43_200_000 });
  });

  it.each([
    { uid: 'other', email: 'owner@example.com', email_verified: true, auth_time: 1_787_616_240, firebase: { sign_in_provider: 'google.com' } },
    { uid: 'admin-uid', email: 'other@example.com', email_verified: true, auth_time: 1_787_616_240, firebase: { sign_in_provider: 'google.com' } },
    { uid: 'admin-uid', email: 'owner@example.com', email_verified: false, auth_time: 1_787_616_240, firebase: { sign_in_provider: 'google.com' } },
  ])('허용되지 않은 클레임은 거부한다', async (claims) => {
    verifyIdToken.mockResolvedValue(claims);

    await expect(createAdminSessionCookie('id-token')).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('Google 이외의 공급자로 로그인한 계정은 세션 발급을 거부한다', async () => {
    verifyIdToken.mockResolvedValue({
      uid: 'admin-uid',
      email: 'owner@example.com',
      email_verified: true,
      auth_time: 1_787_616_240,
      firebase: { sign_in_provider: 'password' },
    });

    await expect(createAdminSessionCookie('id-token')).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(createSessionCookie).not.toHaveBeenCalled();
  });

  it.each([undefined, 1_787_615_900])('auth_time이 없거나 5분을 넘으면 재로그인을 요구한다', async (authTime) => {
    verifyIdToken.mockResolvedValue({
      uid: 'admin-uid',
      email: 'owner@example.com',
      email_verified: true,
      auth_time: authTime,
      firebase: { sign_in_provider: 'google.com' },
    });

    await expect(createAdminSessionCookie('id-token')).rejects.toMatchObject({ code: 'RECENT_LOGIN_REQUIRED' });
    expect(createSessionCookie).not.toHaveBeenCalled();
  });

  it('검증할 수 없는 ID 토큰은 INVALID_TOKEN으로 구분한다', async () => {
    verifyIdToken.mockRejectedValue(new Error('invalid token'));

    await expect(createAdminSessionCookie('bad-token')).rejects.toMatchObject({ code: 'INVALID_TOKEN' });
  });

  it('관리자 환경 변수가 없으면 Firebase 호출 전에 CONFIGURATION 오류를 낸다', async () => {
    vi.stubEnv('ADMIN_UID', '');

    await expect(createAdminSessionCookie('id-token')).rejects.toMatchObject({ code: 'CONFIGURATION' });
    expect(verifyIdToken).not.toHaveBeenCalled();
  });

  it('세션 생성 실패는 SESSION_CREATION_FAILED로 구분한다', async () => {
    verifyIdToken.mockResolvedValue({
      uid: 'admin-uid',
      email: 'owner@example.com',
      email_verified: true,
      auth_time: 1_787_616_240,
      firebase: { sign_in_provider: 'google.com' },
    });
    createSessionCookie.mockRejectedValue(new Error('session creation failed'));

    await expect(createAdminSessionCookie('id-token')).rejects.toMatchObject({ code: 'SESSION_CREATION_FAILED' });
  });

  it('세션 검증 시 폐기 여부를 확인한다', async () => {
    verifySessionCookie.mockResolvedValue({
      uid: 'admin-uid',
      email: 'owner@example.com',
      email_verified: true,
      firebase: { sign_in_provider: 'google.com' },
    });

    await expect(verifyAdminSessionCookie('session-cookie')).resolves.toEqual({ uid: 'admin-uid', email: 'owner@example.com' });
    expect(verifySessionCookie).toHaveBeenCalledWith('session-cookie', true);
  });

  it('Google 이외의 공급자로 발급된 세션은 인증하지 않는다', async () => {
    verifySessionCookie.mockResolvedValue({
      uid: 'admin-uid',
      email: 'owner@example.com',
      email_verified: true,
      firebase: { sign_in_provider: 'password' },
    });

    await expect(verifyAdminSessionCookie('password-session')).resolves.toBeNull();
  });

  it('누락되었거나 유효하지 않거나 허용되지 않은 세션은 인증되지 않은 것으로 처리한다', async () => {
    verifySessionCookie.mockRejectedValue(new Error('revoked'));
    await expect(verifyAdminSessionCookie()).resolves.toBeNull();
    await expect(verifyAdminSessionCookie('invalid-session')).resolves.toBeNull();

    verifySessionCookie.mockResolvedValue({
      uid: 'other',
      email: 'owner@example.com',
      email_verified: true,
      firebase: { sign_in_provider: 'google.com' },
    });
    await expect(verifyAdminSessionCookie('other-session')).resolves.toBeNull();
  });

  it('프로덕션에서만 __Host 접두사와 secure 쿠키를 사용한다', () => {
    vi.stubEnv('NODE_ENV', 'production');

    expect(getAdminSessionCookieName()).toBe('__Host-admin_session');
    expect(getAdminSessionCookieOptions()).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/',
      maxAge: 43_200,
    });
  });

  it('비프로덕션에서는 secure가 아닌 세션 쿠키를 사용한다', () => {
    expect(getAdminSessionCookieName()).toBe('admin_session');
    expect(getAdminSessionCookieOptions()).toEqual({
      httpOnly: true,
      secure: false,
      sameSite: 'strict',
      path: '/',
      maxAge: 43_200,
    });
  });
});
