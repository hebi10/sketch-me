import { describe, expect, it } from 'vitest';

import { getDrawingSubmissionSourceHash } from '@/lib/security/drawing-submission-source';

describe('친구 그림 제출 출처', () => {
  it('같은 IP와 같은 스케치북 비밀값은 동일한 비식별 해시를 만든다', () => {
    const request = new Request('https://example.com', {
      headers: { 'x-forwarded-for': '203.0.113.10, 10.0.0.1' },
    });

    const first = getDrawingSubmissionSourceHash(request, 'sketchbook-secret');
    const second = getDrawingSubmissionSourceHash(request, 'sketchbook-secret');

    expect(first).toBe(second);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(first).not.toContain('203.0.113.10');
  });

  it('같은 IP라도 다른 스케치북 비밀값이면 별도 해시를 만든다', () => {
    const request = new Request('https://example.com', {
      headers: { 'x-forwarded-for': '203.0.113.10' },
    });

    expect(getDrawingSubmissionSourceHash(request, 'book-a-secret'))
      .not.toBe(getDrawingSubmissionSourceHash(request, 'book-b-secret'));
  });

  it('App Hosting 프록시 헤더보다 클라이언트가 임의로 보낼 수 있는 Cloudflare 헤더를 신뢰하지 않는다', () => {
    const firstRequest = new Request('https://example.com', {
      headers: {
        'cf-connecting-ip': '198.51.100.20',
        'x-forwarded-for': '203.0.113.10, 10.0.0.1',
      },
    });
    const secondRequest = new Request('https://example.com', {
      headers: {
        'cf-connecting-ip': '198.51.100.21',
        'x-forwarded-for': '203.0.113.10, 10.0.0.1',
      },
    });

    expect(getDrawingSubmissionSourceHash(firstRequest, 'sketchbook-secret'))
      .toBe(getDrawingSubmissionSourceHash(secondRequest, 'sketchbook-secret'));
  });
});
