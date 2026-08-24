import { describe, expect, it } from 'vitest';

import { createFixedWindowRateLimiter } from '@/lib/security/rate-limit';

describe('createFixedWindowRateLimiter', () => {
  it('allows requests up to the configured limit', () => {
    const limiter = createFixedWindowRateLimiter({ limit: 2, windowMs: 60_000 });

    expect(limiter.consume('friend', 1_000)).toMatchObject({ allowed: true, remaining: 1 });
    expect(limiter.consume('friend', 1_001)).toMatchObject({ allowed: true, remaining: 0 });
  });

  it('blocks excess requests and reports retry seconds', () => {
    const limiter = createFixedWindowRateLimiter({ limit: 1, windowMs: 60_000 });
    limiter.consume('friend', 1_000);

    expect(limiter.consume('friend', 16_000)).toEqual({ allowed: false, remaining: 0, retryAfter: 45 });
  });

  it('starts a fresh window after expiry', () => {
    const limiter = createFixedWindowRateLimiter({ limit: 1, windowMs: 60_000 });
    limiter.consume('friend', 1_000);

    expect(limiter.consume('friend', 61_000)).toMatchObject({ allowed: true, remaining: 0 });
  });

  it('bounds the number of tracked keys', () => {
    const limiter = createFixedWindowRateLimiter({ limit: 1, windowMs: 60_000, maxKeys: 2 });
    limiter.consume('one', 1_000);
    limiter.consume('two', 1_001);
    limiter.consume('three', 1_002);

    expect(limiter.size()).toBeLessThanOrEqual(2);
  });
});
