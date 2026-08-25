import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

const { getCachedAdminStats } = vi.hoisted(() => ({
  getCachedAdminStats: vi.fn(),
}));

vi.mock('@/lib/admin/repository', () => ({ getCachedAdminStats }));

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

describe('AdminDashboard', () => {
  it('운영에 필요한 여섯 개 통계와 모의 결제 안내를 표시한다', () => {
    render(<AdminDashboard stats={stats} />);

    expect(screen.getByText('전체 스케치북')).toBeVisible();
    expect(screen.getByText('1,234')).toBeVisible();
    expect(screen.getByText('오늘 생성')).toBeVisible();
    expect(screen.getByText('7')).toBeVisible();
    expect(screen.getByText('전체 친구 그림')).toBeVisible();
    expect(screen.getByText('9,876')).toBeVisible();
    expect(screen.getByText('오늘 제출')).toBeVisible();
    expect(screen.getByText('18')).toBeVisible();
    expect(screen.getByText('모의 결제 건수')).toBeVisible();
    expect(screen.getByText('3건')).toBeVisible();
    expect(screen.getByText('모의 결제 누적')).toBeVisible();
    expect(screen.getByText('12,870원')).toBeVisible();
    expect(screen.getByText('결제 통계는 모의 결제 성공 건만 포함합니다.')).toBeVisible();
  });

  it('세 관리 화면으로 바로 이동할 수 있다', () => {
    render(<AdminDashboard stats={stats} />);

    expect(screen.getByRole('link', { name: '스케치북 관리' })).toHaveAttribute('href', '/admin/sketchbooks');
    expect(screen.getByRole('link', { name: '그림 관리' })).toHaveAttribute('href', '/admin/drawings');
    expect(screen.getByRole('link', { name: '결제 내역' })).toHaveAttribute('href', '/admin/purchases');
  });

  it('서버에서 캐시된 최신 통계를 읽어 대시보드에 전달한다', async () => {
    getCachedAdminStats.mockResolvedValue(stats);

    render(await AdminDashboardPage());

    expect(getCachedAdminStats).toHaveBeenCalledTimes(1);
    expect(screen.getByText('12,870원')).toBeVisible();
  });
});
