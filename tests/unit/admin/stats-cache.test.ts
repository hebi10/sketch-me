import { vi } from 'vitest';

import { createAdminStatsCache } from '@/lib/admin/stats-cache';
import type { AdminDashboardStats } from '@/lib/admin/types';

const stats: AdminDashboardStats = {
  succeededPurchaseAmount: 12_870,
  succeededPurchaseCount: 3,
  todayDrawings: 4,
  todaySketchbooks: 2,
  totalDrawings: 20,
  totalSketchbooks: 10,
};

describe('admin stats cache', () => {
  it('5분 동안 동시에 진행 중인 요청을 포함해 같은 통계 Promise를 재사용한다', async () => {
    const cache = createAdminStatsCache();
    let resolveLoad: ((value: AdminDashboardStats) => void) | undefined;
    const load = vi.fn(() => new Promise<AdminDashboardStats>((resolve) => {
      resolveLoad = resolve;
    }));

    const first = cache.getCachedValue(load, 1_000);
    const second = cache.getCachedValue(load, 299_999);

    expect(load).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
    resolveLoad?.(stats);
    await expect(Promise.all([first, second])).resolves.toEqual([stats, stats]);
  });

  it('5분이 지나면 새 통계 Promise를 조회한다', async () => {
    const cache = createAdminStatsCache();
    const load = vi.fn().mockResolvedValue(stats);

    await cache.getCachedValue(load, 1_000);
    await cache.getCachedValue(load, 301_000);

    expect(load).toHaveBeenCalledTimes(2);
  });

  it('집계가 실패하면 Promise를 제거해 다음 요청에서 다시 조회한다', async () => {
    const cache = createAdminStatsCache();
    const load = vi.fn()
      .mockRejectedValueOnce(new Error('temporary failure'))
      .mockResolvedValueOnce(stats);

    await expect(cache.getCachedValue(load, 1_000)).rejects.toThrow('temporary failure');
    await expect(cache.getCachedValue(load, 1_001)).resolves.toEqual(stats);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('캐시 인스턴스 간에 값을 공유하지 않는다', async () => {
    const firstCache = createAdminStatsCache();
    const secondCache = createAdminStatsCache();
    const load = vi.fn().mockResolvedValue(stats);

    await firstCache.getCachedValue(load, 1_000);
    await secondCache.getCachedValue(load, 1_000);

    expect(load).toHaveBeenCalledTimes(2);
  });
});
