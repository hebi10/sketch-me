import { NextResponse } from 'next/server';

import { createFixedWindowRateLimiter } from '@/lib/security/rate-limit';

export type PublicMutationAction = 'createSketchbook' | 'submitDrawing';

export interface RateLimitResult {
  allowed: boolean;
  retryAfter: number;
}

export interface PublicMutationRateLimiter {
  consume(request: Request, action: PublicMutationAction): RateLimitResult;
}

const hour = 60 * 60 * 1_000;

function requestIp(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return (request.headers.get('cf-connecting-ip') ?? forwarded ?? request.headers.get('x-real-ip') ?? 'unknown')
    .replace(/[^a-fA-F0-9.:]/g, '')
    .slice(0, 64) || 'unknown';
}

export function createInMemoryPublicMutationRateLimiter(): PublicMutationRateLimiter {
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

export function enforcePublicMutationLimit(
  request: Request,
  action: PublicMutationAction,
  limiter: PublicMutationRateLimiter = defaultPublicMutationRateLimiter,
) {
  const result = limiter.consume(request, action);
  if (result.allowed) return null;

  return NextResponse.json(
    { message: `요청이 많아요. ${result.retryAfter}초 뒤 다시 시도해 주세요.` },
    { status: 429, headers: { 'Retry-After': String(result.retryAfter) } },
  );
}
