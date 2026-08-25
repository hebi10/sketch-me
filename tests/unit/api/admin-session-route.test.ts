import { vi } from 'vitest';

const {
  createAdminSessionCookie,
  getAdminSessionCookieName,
  getAdminSessionCookieOptions,
  isAllowedAdminOrigin,
} = vi.hoisted(() => ({
  createAdminSessionCookie: vi.fn(),
  getAdminSessionCookieName: vi.fn(() => 'admin_session'),
  getAdminSessionCookieOptions: vi.fn(() => ({
    httpOnly: true as const,
    maxAge: 43_200,
    path: '/' as const,
    sameSite: 'strict' as const,
    secure: false,
  })),
  isAllowedAdminOrigin: vi.fn(() => true),
}));

vi.mock('@/lib/admin/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/admin/auth')>();
  return {
    ...actual,
    createAdminSessionCookie,
    getAdminSessionCookieName,
    getAdminSessionCookieOptions,
  };
});

vi.mock('@/lib/admin/origin', () => ({ isAllowedAdminOrigin }));

import { DELETE, POST } from '@/app/api/admin/session/route';
import { AdminAuthError } from '@/lib/admin/auth';

function createRequest(method: 'POST' | 'DELETE', body?: unknown) {
  return new Request('http://localhost/api/admin/session', {
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      Origin: 'http://localhost:3000',
    },
    method,
  });
}

describe('/api/admin/session', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    createAdminSessionCookie.mockResolvedValue('firebase-session');
    getAdminSessionCookieName.mockReturnValue('admin_session');
    getAdminSessionCookieOptions.mockReturnValue({
      httpOnly: true,
      maxAge: 43_200,
      path: '/',
      sameSite: 'strict',
      secure: false,
    });
    isAllowedAdminOrigin.mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('허용된 ID 토큰을 세션 쿠키로 교환한다', async () => {
    const response = await POST(createRequest('POST', { idToken: 'id-token' }));

    expect(response.status).toBe(204);
    expect(response.headers.get('set-cookie')).toContain('admin_session=firebase-session');
    expect(createAdminSessionCookie).toHaveBeenCalledWith('id-token');
  });

  it('허용되지 않은 Origin은 토큰을 검증하지 않는다', async () => {
    isAllowedAdminOrigin.mockReturnValue(false);

    const response = await POST(createRequest('POST', { idToken: 'id-token' }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ message: '허용되지 않은 요청입니다.' });
    expect(createAdminSessionCookie).not.toHaveBeenCalled();
  });

  it.each([
    { body: undefined, label: '본문 없음' },
    { body: {}, label: '토큰 없음' },
    { body: { idToken: 123 }, label: '문자열이 아닌 토큰' },
  ])('잘못된 로그인 본문은 세션을 만들지 않는다: $label', async ({ body }) => {
    const response = await POST(createRequest('POST', body));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ message: '로그인 정보를 확인해 주세요.' });
    expect(createAdminSessionCookie).not.toHaveBeenCalled();
  });

  it.each([
    { code: 'INVALID_TOKEN', status: 401 },
    { code: 'RECENT_LOGIN_REQUIRED', status: 401 },
    { code: 'FORBIDDEN', status: 403 },
    { code: 'CONFIGURATION', status: 500 },
    { code: 'SESSION_CREATION_FAILED', status: 500 },
  ] as const)('$code 오류를 $status로 구분한다', async ({ code, status }) => {
    createAdminSessionCookie.mockRejectedValue(new AdminAuthError(code, 'test'));

    const response = await POST(createRequest('POST', { idToken: 'id-token' }));

    expect(response.status).toBe(status);
  });

  it('예상하지 못한 Firebase 오류는 비밀값 없이 기록하고 500을 반환한다', async () => {
    const consoleError = vi.mocked(console.error);
    createAdminSessionCookie.mockRejectedValue(new Error('firebase unavailable: secret-detail'));

    const response = await POST(createRequest('POST', { idToken: 'id-token' }));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ message: '로그인 처리 중 오류가 발생했습니다.' });
    expect(consoleError).toHaveBeenCalledWith('Admin session creation failed', 'Error');
    expect(consoleError).not.toHaveBeenCalledWith(expect.stringContaining('secret-detail'));
  });

  it('로그아웃은 세션 쿠키를 즉시 만료한다', async () => {
    const response = await DELETE(createRequest('DELETE'));

    expect(response.status).toBe(204);
    expect(response.headers.get('set-cookie')).toContain('admin_session=');
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
  });

  it('허용되지 않은 Origin의 로그아웃 요청은 쿠키를 변경하지 않는다', async () => {
    isAllowedAdminOrigin.mockReturnValue(false);

    const response = await DELETE(createRequest('DELETE'));

    expect(response.status).toBe(403);
    expect(response.headers.get('set-cookie')).toBeNull();
  });
});
