interface RateLimitOptions {
  limit: number;
  windowMs: number;
  maxKeys?: number;
}

interface WindowEntry {
  count: number;
  startedAt: number;
}

export function createFixedWindowRateLimiter({ limit, windowMs, maxKeys = 5_000 }: RateLimitOptions) {
  const entries = new Map<string, WindowEntry>();

  function removeExpired(now: number) {
    entries.forEach((entry, key) => {
      if (now - entry.startedAt >= windowMs) entries.delete(key);
    });
  }

  return {
    consume(key: string, now = Date.now()) {
      const current = entries.get(key);
      if (!current || now - current.startedAt >= windowMs) {
        if (!current && entries.size >= maxKeys) {
          removeExpired(now);
          if (entries.size >= maxKeys) entries.delete(entries.keys().next().value as string);
        }
        entries.set(key, { count: 1, startedAt: now });
        return { allowed: true, remaining: limit - 1, retryAfter: Math.ceil(windowMs / 1_000) };
      }

      const retryAfter = Math.max(1, Math.ceil((windowMs - (now - current.startedAt)) / 1_000));
      if (current.count >= limit) return { allowed: false, remaining: 0, retryAfter };
      current.count += 1;
      return { allowed: true, remaining: limit - current.count, retryAfter };
    },
    size: () => entries.size,
  };
}

export { enforcePublicMutationLimit } from '@/lib/security/public-mutation-rate-limiter';
