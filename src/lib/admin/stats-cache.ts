import type { AdminDashboardStats } from './types';

const CACHE_TTL_MS = 5 * 60 * 1_000;

type CachedStats = {
  promise: Promise<AdminDashboardStats>;
  createdAtMs: number;
};

export function createAdminStatsCache() {
  let cachedStats: CachedStats | null = null;

  return {
    getCachedValue(
      load: () => Promise<AdminDashboardStats>,
      nowMs: number,
    ): Promise<AdminDashboardStats> {
      if (cachedStats && nowMs - cachedStats.createdAtMs < CACHE_TTL_MS) {
        return cachedStats.promise;
      }

      let promise: Promise<AdminDashboardStats>;
      try {
        promise = load();
      } catch (error) {
        return Promise.reject(error);
      }
      cachedStats = { promise, createdAtMs: nowMs };
      void promise.catch(() => {
        if (cachedStats?.promise === promise) cachedStats = null;
      });
      return promise;
    },
  };
}

const adminStatsCache = createAdminStatsCache();

export const getCachedValue = adminStatsCache.getCachedValue;
