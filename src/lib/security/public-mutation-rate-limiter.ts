import { NextResponse } from 'next/server';

import { consumeCreateSketchbookRateLimit } from '@/lib/security/create-sketchbook-rate-limit';
import { createFixedWindowRateLimiter } from '@/lib/security/rate-limit';

export type PublicMutationAction = 'createSketchbook' | 'submitDrawing';

export interface RateLimitResult {
  allowed: boolean;
  retryAfter: number;
}

export interface PublicMutationRateLimiter {
  consume(request: Request, action: PublicMutationAction): RateLimitResult | Promise<RateLimitResult>;
}

const hour = 60 * 60 * 1_000;

function requestIp(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return (forwarded ?? request.headers.get('x-real-ip') ?? 'unknown')
    .replace(/[^a-fA-F0-9.:]/g, '')
    .slice(0, 64) || 'unknown';
}

export function createInMemoryPublicMutationRateLimiter(): {
  consume(request: Request, action: PublicMutationAction): RateLimitResult;
} {
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

  return {
    consume(request, action) {
      const actionLimits = limits[action];
      const perIp = actionLimits.perIp.consume(requestIp(request));
      const global = perIp.allowed ? actionLimits.global.consume('global') : null;
      const blocked = !perIp.allowed ? perIp : global && !global.allowed ? global : null;
      return blocked ?? { allowed: true, retryAfter: perIp.retryAfter };
    },
  };
}

const defaultPublicMutationRateLimiter = createInMemoryPublicMutationRateLimiter();
const persistentPublicMutationRateLimiter: PublicMutationRateLimiter = {
  consume(request, action) {
    if (action === 'createSketchbook') return consumeCreateSketchbookRateLimit(request);
    return defaultPublicMutationRateLimiter.consume(request, action);
  },
};

export async function enforcePublicMutationLimit(
  request: Request,
  action: PublicMutationAction,
  limiter: PublicMutationRateLimiter = persistentPublicMutationRateLimiter,
) {
  let result: RateLimitResult;
  try {
    result = await limiter.consume(request, action);
  } catch (error) {
    console.error(
      'Public mutation rate limit unavailable',
      error instanceof Error ? error.name : 'UnknownError',
    );
    return NextResponse.json(
      { message: '요청 제한을 확인하지 못했어요. 잠시 후 다시 시도해 주세요.' },
      { status: 503 },
    );
  }
  if (result.allowed) return null;

  return NextResponse.json(
    { message: `요청이 많아요. ${result.retryAfter}초 뒤 다시 시도해 주세요.` },
    { status: 429, headers: { 'Retry-After': String(result.retryAfter) } },
  );
}
