import { NextResponse } from 'next/server';

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

type PublicMutationAction = 'createSketchbook' | 'submitDrawing';

const hour = 60 * 60 * 1_000;
const limits = {
  createSketchbook: {
    perIp: createFixedWindowRateLimiter({ limit: 3, windowMs: hour }),
    global: createFixedWindowRateLimiter({ limit: 60, windowMs: hour, maxKeys: 1 }),
  },
  submitDrawing: {
    perIp: createFixedWindowRateLimiter({ limit: 20, windowMs: hour }),
    global: createFixedWindowRateLimiter({ limit: 600, windowMs: hour, maxKeys: 1 }),
  },
};

function requestIp(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return (request.headers.get('cf-connecting-ip') ?? forwarded ?? request.headers.get('x-real-ip') ?? 'unknown')
    .replace(/[^a-fA-F0-9.:]/g, '')
    .slice(0, 64) || 'unknown';
}

export function enforcePublicMutationLimit(request: Request, action: PublicMutationAction) {
  const actionLimits = limits[action];
  const perIp = actionLimits.perIp.consume(requestIp(request));
  const global = perIp.allowed ? actionLimits.global.consume('global') : null;
  const blocked = !perIp.allowed ? perIp : global && !global.allowed ? global : null;

  if (!blocked) return null;
  return NextResponse.json(
    { message: `요청이 많아요. ${blocked.retryAfter}초 뒤 다시 시도해 주세요.` },
    { status: 429, headers: { 'Retry-After': String(blocked.retryAfter) } },
  );
}
