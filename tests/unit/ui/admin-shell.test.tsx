import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

const {
  cookieGet,
  getAdminSessionCookieName,
  redirect,
  refresh,
  replace,
  usePathname,
  verifyAdminSessionCookie,
} = vi.hoisted(() => ({
  cookieGet: vi.fn(),
  getAdminSessionCookieName: vi.fn(() => 'admin_session'),
  redirect: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
  usePathname: vi.fn(() => '/admin'),
  verifyAdminSessionCookie: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect,
  usePathname,
  useRouter: () => ({ refresh, replace }),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ get: cookieGet })),
}));

vi.mock('@/lib/admin/auth', () => ({
  getAdminSessionCookieName,
  verifyAdminSessionCookie,
}));

import { AdminBottomNav } from '@/app/admin/(protected)/AdminBottomNav';
import AdminError from '@/app/admin/(protected)/error';
import ProtectedAdminLayout from '@/app/admin/(protected)/layout';
import AdminLoading from '@/app/admin/(protected)/loading';
import { AdminLogoutButton } from '@/app/admin/(protected)/AdminLogoutButton';
import { AdminShell } from '@/app/admin/(protected)/AdminShell';
import { getRequiredAdminIdentity } from '@/lib/admin/server-session';

describe('관리자 보호 레이아웃', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cookieGet.mockReturnValue({ value: 'session-cookie' });
    verifyAdminSessionCookie.mockResolvedValue({
      email: 'owner@example.com',
      uid: 'admin-uid',
    });
  });

  it('유효한 서버 세션의 관리자에게 보호된 셸과 내용을 보여준다', async () => {
    render(await ProtectedAdminLayout({ children: <p>보호된 내용</p> }));

    expect(cookieGet).toHaveBeenCalledWith('admin_session');
    expect(verifyAdminSessionCookie).toHaveBeenCalledWith('session-cookie');
    expect(screen.getByText('보호된 내용')).toBeVisible();
    expect(screen.getByText('owner@example.com')).toBeVisible();
    expect(redirect).not.toHaveBeenCalled();
  });

  it('서버 세션이 없으면 로그인 화면으로 이동한다', async () => {
    cookieGet.mockReturnValue(undefined);
    verifyAdminSessionCookie.mockResolvedValue(null);
    redirect.mockImplementation(() => {
      throw new Error('NEXT_REDIRECT');
    });

    await expect(getRequiredAdminIdentity()).rejects.toThrow('NEXT_REDIRECT');

    expect(verifyAdminSessionCookie).toHaveBeenCalledWith(undefined);
    expect(redirect).toHaveBeenCalledWith('/admin/login');
  });
});

describe('AdminShell', () => {
  it('네 개의 관리자 내비게이션과 로그아웃을 표시한다', () => {
    render(
      <AdminShell identity={{ email: 'owner@example.com', uid: 'admin-uid' }}>
        <p>내용</p>
      </AdminShell>,
    );

    expect(screen.getByRole('banner')).toBeVisible();
    expect(screen.getByRole('navigation', { name: '관리자 메뉴' })).toBeVisible();
    expect(screen.getByRole('link', { name: '대시보드' })).toHaveAttribute('href', '/admin');
    expect(screen.getByRole('link', { name: '스케치북' })).toHaveAttribute('href', '/admin/sketchbooks');
    expect(screen.getByRole('link', { name: '그림' })).toHaveAttribute('href', '/admin/drawings');
    expect(screen.getByRole('link', { name: '결제' })).toHaveAttribute('href', '/admin/purchases');
    expect(screen.getByRole('button', { name: '로그아웃' })).toBeVisible();
  });

  it('현재 관리자 하위 화면을 하단 메뉴에 표시한다', () => {
    usePathname.mockReturnValue('/admin/drawings/example');

    render(<AdminBottomNav />);

    expect(screen.getByRole('link', { name: '그림' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: '대시보드' })).not.toHaveAttribute('aria-current');
  });
});

describe('AdminLogoutButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 204 }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('동일 출처 세션을 삭제하고 로그인 화면으로 이동한다', async () => {
    render(<AdminLogoutButton />);

    fireEvent.click(screen.getByRole('button', { name: '로그아웃' }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/admin/login'));
    expect(fetch).toHaveBeenCalledWith('/api/admin/session', { method: 'DELETE' });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('로그아웃 요청 실패를 알리고 다시 시도할 수 있게 한다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    render(<AdminLogoutButton />);

    fireEvent.click(screen.getByRole('button', { name: '로그아웃' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('로그아웃하지 못했습니다. 다시 시도해 주세요.');
    expect(screen.getByRole('button', { name: '로그아웃' })).toBeEnabled();
    expect(replace).not.toHaveBeenCalled();
  });
});

describe('관리자 대시보드 상태 UI', () => {
  it('통계 카드 크기를 유지하는 여섯 개의 로딩 항목을 보여준다', () => {
    render(<AdminLoading />);

    expect(screen.getByRole('status', { name: '관리자 통계를 불러오는 중' })).toHaveAttribute('aria-busy', 'true');
    expect(screen.getAllByRole('listitem')).toHaveLength(6);
  });

  it('오류 설명과 다시 시도 동작을 제공한다', () => {
    const retry = vi.fn();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    render(<AdminError error={new Error('stats failed')} retry={retry} />);
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));

    expect(screen.getByRole('alert')).toHaveTextContent('통계를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
    expect(retry).toHaveBeenCalledTimes(1);
    consoleError.mockRestore();
  });
});
