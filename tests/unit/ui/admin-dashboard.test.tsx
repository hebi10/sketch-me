import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

const { getCachedAdminStats, getRequiredAdminIdentity } = vi.hoisted(() => ({
  getCachedAdminStats: vi.fn(),
  getRequiredAdminIdentity: vi.fn(),
}));

vi.mock('@/lib/admin/repository', () => ({ getCachedAdminStats }));
vi.mock('@/lib/admin/server-session', () => ({ getRequiredAdminIdentity }));

import { AdminDashboard } from '@/app/admin/(protected)/AdminDashboard';
import AdminDashboardPage from '@/app/admin/(protected)/page';
import type { AdminDashboardStats } from '@/lib/admin/types';

const stats: AdminDashboardStats = {
  succeededPurchaseAmount: 12_870,
  succeededPurchaseCount: 3,
  todayDrawings: 18,
  todaySketchbooks: 7,
  totalDrawings: 9_876,
  totalSketchbooks: 1_234,
};

beforeEach(() => {
  vi.clearAllMocks();
  getRequiredAdminIdentity.mockResolvedValue({
    email: 'owner@example.com',
    uid: 'admin-uid',
  });
  getCachedAdminStats.mockResolvedValue(stats);
});

describe('AdminDashboard', () => {
  it('무료 운영에 필요한 네 개 통계를 표시한다', () => {
    render(<AdminDashboard stats={stats} />);

    expect(screen.getByText('전체 스케치북')).toBeVisible();
    expect(screen.getByText('1,234')).toBeVisible();
    expect(screen.getByText('오늘 생성')).toBeVisible();
    expect(screen.getByText('7')).toBeVisible();
    expect(screen.getByText('전체 친구 그림')).toBeVisible();
    expect(screen.getByText('9,876')).toBeVisible();
    expect(screen.getByText('오늘 제출')).toBeVisible();
    expect(screen.getByText('18')).toBeVisible();
    expect(screen.queryByText('결제 건수')).not.toBeInTheDocument();
    expect(screen.queryByText('결제 누적')).not.toBeInTheDocument();
    expect(screen.queryByText('결제 통계는 성공 건만 포함합니다.')).not.toBeInTheDocument();
    expect(screen.queryByText(/모의 결제/)).not.toBeInTheDocument();
  });

  it('스케치북과 그림 관리 화면으로 바로 이동할 수 있다', () => {
    render(<AdminDashboard stats={stats} />);

    expect(screen.getByRole('link', { name: '스케치북 관리' })).toHaveAttribute('href', '/admin/sketchbooks');
    expect(screen.getByRole('link', { name: '그림 관리' })).toHaveAttribute('href', '/admin/drawings');
    expect(screen.queryByRole('link', { name: '결제 내역' })).not.toBeInTheDocument();
  });
});

describe('AdminDashboardPage 데이터 경계', () => {
  it('페이지 인증이 거부되면 통계 저장소를 호출하지 않는다', async () => {
    getRequiredAdminIdentity.mockRejectedValue(new Error('NEXT_REDIRECT'));

    await expect(AdminDashboardPage()).rejects.toThrow('NEXT_REDIRECT');

    expect(getCachedAdminStats).not.toHaveBeenCalled();
  });

  it('페이지 인증 직후 캐시된 통계를 읽어 대시보드에 전달한다', async () => {
    render(await AdminDashboardPage());

    expect(getRequiredAdminIdentity).toHaveBeenCalledTimes(1);
    expect(getCachedAdminStats).toHaveBeenCalledTimes(1);
    expect(getRequiredAdminIdentity.mock.invocationCallOrder[0])
      .toBeLessThan(getCachedAdminStats.mock.invocationCallOrder[0]);
    expect(screen.getByText('1,234')).toBeVisible();
  });

  it('인증 후 통계 조회 오류를 페이지 오류 경계로 전달한다', async () => {
    getCachedAdminStats.mockRejectedValue(new Error('stats failed'));

    await expect(AdminDashboardPage()).rejects.toThrow('stats failed');

    expect(getRequiredAdminIdentity).toHaveBeenCalledTimes(1);
    expect(getCachedAdminStats).toHaveBeenCalledTimes(1);
  });
});
