import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { proxy } from '@/proxy';
import { createDrawingParticipantToken, DRAWING_PARTICIPANT_COOKIE, readDrawingParticipantId } from '@/lib/security/drawing-submission-source';

afterEach(() => vi.unstubAllEnvs());

describe('익명 참여 쿠키', () => {
  const secret = 'test-only-cookie-signing-secret';
  it('공개 페이지에서 서버 서명 HttpOnly 쿠키를 발급한다', () => {
    vi.stubEnv('PUBLIC_MUTATION_RATE_LIMIT_SECRET', secret);
    vi.stubEnv('NODE_ENV', 'production');
    const response = proxy(new NextRequest('https://example.com/s/public-1/draw'));
    const cookie = response.cookies.get(DRAWING_PARTICIPANT_COOKIE);
    expect(cookie).toMatchObject({ httpOnly: true, secure: true, sameSite: 'lax', path: '/' });
    expect(readDrawingParticipantId(cookie?.value, secret)).not.toBeNull();
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  });

  it('유효한 기존 쿠키는 재발급하지 않아 브라우저 한도를 유지한다', () => {
    vi.stubEnv('PUBLIC_MUTATION_RATE_LIMIT_SECRET', secret);
    const token = createDrawingParticipantToken(secret);
    const response = proxy(new NextRequest('https://example.com/s/public-1', {
      headers: { cookie: `${DRAWING_PARTICIPANT_COOKIE}=${token}` },
    }));
    expect(response.cookies.get(DRAWING_PARTICIPANT_COOKIE)).toBeUndefined();
  });

  it('위조 쿠키는 새 서버 식별자로 교체하고 일반 정적 요청에는 발급하지 않는다', () => {
    vi.stubEnv('PUBLIC_MUTATION_RATE_LIMIT_SECRET', secret);
    const response = proxy(new NextRequest('https://example.com/s/public-1', {
      headers: { cookie: `${DRAWING_PARTICIPANT_COOKIE}=forged` },
    }));
    expect(readDrawingParticipantId(response.cookies.get(DRAWING_PARTICIPANT_COOKIE)?.value, secret)).not.toBeNull();
    expect(proxy(new NextRequest('https://example.com/_next/image?url=logo.webp')).headers.get('set-cookie')).toBeNull();
  });
});
