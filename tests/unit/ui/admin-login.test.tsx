import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Auth } from 'firebase/auth';
import { vi } from 'vitest';

const {
  cookieGet,
  getAdminSessionCookieName,
  getFirebaseClientAuth,
  redirect,
  replace,
  setPersistence,
  signInWithPopup,
  signOut,
  verifyAdminSessionCookie,
} = vi.hoisted(() => ({
  cookieGet: vi.fn(),
  getAdminSessionCookieName: vi.fn(() => 'admin_session'),
  getFirebaseClientAuth: vi.fn(),
  redirect: vi.fn(),
  replace: vi.fn(),
  setPersistence: vi.fn(),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
  verifyAdminSessionCookie: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect,
  useRouter: () => ({ replace }),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ get: cookieGet })),
}));

vi.mock('@/lib/admin/auth', () => ({
  getAdminSessionCookieName,
  verifyAdminSessionCookie,
}));

vi.mock('@/lib/firebase/auth-client', () => ({ getFirebaseClientAuth }));

vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: vi.fn(function GoogleAuthProvider() {}),
  inMemoryPersistence: { type: 'NONE' },
  setPersistence,
  signInWithPopup,
  signOut,
}));

import { AdminLogin } from '@/app/admin/login/AdminLogin';
import AdminLoginPage from '@/app/admin/login/page';
import { inMemoryPersistence } from 'firebase/auth';

describe('AdminLogin', () => {
  const auth = {} as Auth;

  beforeEach(() => {
    vi.clearAllMocks();
    getFirebaseClientAuth.mockReturnValue(auth);
    setPersistence.mockResolvedValue(undefined);
    signInWithPopup.mockResolvedValue({
      user: { getIdToken: vi.fn().mockResolvedValue('id-token') },
    });
    signOut.mockResolvedValue(undefined);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 204 }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('Google 로그인 후 서버 세션을 만들고 클라이언트 로그아웃 뒤 관리자 홈으로 이동한다', async () => {
    render(<AdminLogin />);

    fireEvent.click(screen.getByRole('button', { name: 'Google 계정으로 로그인' }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/admin'));
    expect(setPersistence).toHaveBeenCalledWith(auth, inMemoryPersistence);
    expect(fetch).toHaveBeenCalledWith('/api/admin/session', {
      body: JSON.stringify({ idToken: 'id-token' }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });
    expect(signOut).toHaveBeenCalledWith(auth);
    expect(setPersistence.mock.invocationCallOrder[0]).toBeLessThan(signInWithPopup.mock.invocationCallOrder[0]);
    expect(signOut.mock.invocationCallOrder[0]).toBeLessThan(replace.mock.invocationCallOrder[0]);
  });

  it.each([
    [401, '로그인 시간이 지났습니다. 다시 시도해 주세요.'],
    [403, '허용된 관리자 계정이 아닙니다.'],
    [500, '로그인 처리 중 오류가 발생했습니다.'],
  ])('세션 API %i 응답을 알맞은 안내로 보여준다', async (status, message) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status }));
    render(<AdminLogin />);

    fireEvent.click(screen.getByRole('button', { name: 'Google 계정으로 로그인' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(signOut).toHaveBeenCalledWith(auth);
    expect(replace).not.toHaveBeenCalled();
  });

  it('팝업 취소를 취소 안내로 보여준다', async () => {
    signInWithPopup.mockRejectedValue({ code: 'auth/popup-closed-by-user' });
    render(<AdminLogin />);

    fireEvent.click(screen.getByRole('button', { name: 'Google 계정으로 로그인' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('로그인이 취소됐습니다.');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('네트워크 실패를 연결 안내로 보여주고 Firebase 로그인 상태를 정리한다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    render(<AdminLogin />);

    fireEvent.click(screen.getByRole('button', { name: 'Google 계정으로 로그인' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('로그인 연결을 확인해 주세요.');
    expect(signOut).toHaveBeenCalledWith(auth);
    expect(replace).not.toHaveBeenCalled();
  });

  it('로그인 중에는 버튼을 비활성화해 중복 요청을 막는다', async () => {
    signInWithPopup.mockReturnValue(new Promise(() => undefined));
    render(<AdminLogin />);

    fireEvent.click(screen.getByRole('button', { name: 'Google 계정으로 로그인' }));

    expect(await screen.findByRole('button', { name: '로그인하는 중...' })).toBeDisabled();
  });
});

describe('AdminLoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cookieGet.mockReturnValue({ value: 'session-cookie' });
    getAdminSessionCookieName.mockReturnValue('admin_session');
    verifyAdminSessionCookie.mockResolvedValue(null);
  });

  it('유효한 관리자 세션이 있으면 관리자 홈으로 이동한다', async () => {
    verifyAdminSessionCookie.mockResolvedValue({ email: 'owner@example.com', uid: 'admin-uid' });

    await AdminLoginPage();

    expect(cookieGet).toHaveBeenCalledWith('admin_session');
    expect(verifyAdminSessionCookie).toHaveBeenCalledWith('session-cookie');
    expect(redirect).toHaveBeenCalledWith('/admin');
  });

  it('유효한 세션이 없을 때만 Google 로그인 화면을 보여준다', async () => {
    cookieGet.mockReturnValue(undefined);

    render(await AdminLoginPage());

    expect(verifyAdminSessionCookie).toHaveBeenCalledWith(undefined);
    expect(screen.getByRole('button', { name: 'Google 계정으로 로그인' })).toBeInTheDocument();
    expect(redirect).not.toHaveBeenCalled();
  });
});
