import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import {
  createInMemoryPublicMutationRateLimiter,
  enforcePublicMutationLimit,
  type PublicMutationRateLimiter,
} from '@/lib/security/public-mutation-rate-limiter';

describe('공개 mutation 요청 제한 경계', () => {
  it('주입한 limiter의 차단 결과를 기존 429 응답으로 변환한다', async () => {
    const limiter: PublicMutationRateLimiter = {
      consume: vi.fn(() => ({ allowed: false, retryAfter: 30 })),
    };

    const response = await enforcePublicMutationLimit(
      new Request('https://example.com/api/sketchbooks'),
      'createSketchbook',
      limiter,
    );

    expect(response?.status).toBe(429);
    expect(response?.headers.get('Retry-After')).toBe('30');
    await expect(response?.json()).resolves.toEqual({
      message: '요청이 많아요. 30초 뒤 다시 시도해 주세요.',
    });
  });

  it('영속 제한 저장소 오류는 생성을 허용하지 않고 503으로 닫는다', async () => {
    const limiter: PublicMutationRateLimiter = {
      consume: vi.fn(async () => {
        throw new Error('firestore details');
      }),
    };

    const response = await enforcePublicMutationLimit(
      new Request('https://example.com/api/sketchbooks'),
      'createSketchbook',
      limiter,
    );

    expect(response?.status).toBe(503);
    await expect(response?.json()).resolves.toEqual({
      message: '요청 제한을 확인하지 못했어요. 잠시 후 다시 시도해 주세요.',
    });
  });

  it('메모리 구현은 기존 스케치북 생성 IP 한도를 유지한다', () => {
    const limiter = createInMemoryPublicMutationRateLimiter();
    const request = new Request('https://example.com/api/sketchbooks', {
      headers: { 'x-forwarded-for': '203.0.113.5' },
    });

    expect(limiter.consume(request, 'createSketchbook').allowed).toBe(true);
    expect(limiter.consume(request, 'createSketchbook').allowed).toBe(true);
    expect(limiter.consume(request, 'createSketchbook').allowed).toBe(true);
    expect(limiter.consume(request, 'createSketchbook').allowed).toBe(false);
  });

  it('메모리 limiter 배포는 단일 인스턴스로 고정한다', () => {
    const appHostingConfig = readFileSync(resolve(process.cwd(), 'apphosting.yaml'), 'utf8');

    expect(appHostingConfig).toMatch(/runConfig:\s*\r?\n\s+maxInstances:\s*1(?:\s|$)/);
  });
});
