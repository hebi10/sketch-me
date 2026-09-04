import { describe, expect, it, vi } from 'vitest';

import { createFirestoreCreateSketchbookRateLimiter } from '@/lib/security/create-sketchbook-rate-limit';

interface FakeReference {
  id: string;
}

function createFirestoreDouble() {
  const documents = new Map<string, Record<string, unknown>>();
  const transaction = {
    get: vi.fn(async (reference: FakeReference) => {
      const data = documents.get(reference.id);
      return {
        data: () => data,
        exists: Boolean(data),
      };
    }),
    set: vi.fn((reference: FakeReference, data: Record<string, unknown>) => {
      documents.set(reference.id, data);
    }),
  };
  const firestore = {
    collection: vi.fn(() => ({ doc: (id: string) => ({ id }) })),
    runTransaction: vi.fn(async (callback: (value: typeof transaction) => Promise<unknown>) => callback(transaction)),
  };
  return { documents, firestore };
}

function request(ip: string) {
  return new Request('https://example.com/api/sketchbooks', {
    headers: { 'x-forwarded-for': `${ip}, 10.0.0.1` },
  });
}

describe('Firestore 스케치북 생성 제한', () => {
  it('같은 IP는 한 시간에 세 번만 허용한다', async () => {
    const state = createFirestoreDouble();
    const consume = createFirestoreCreateSketchbookRateLimiter({
      firestore: state.firestore as never,
      secret: 'rate-limit-secret',
    });
    const now = new Date('2026-09-04T00:00:00.000Z');

    await expect(consume(request('203.0.113.5'), now)).resolves.toMatchObject({ allowed: true });
    await expect(consume(request('203.0.113.5'), now)).resolves.toMatchObject({ allowed: true });
    await expect(consume(request('203.0.113.5'), now)).resolves.toMatchObject({ allowed: true });
    await expect(consume(request('203.0.113.5'), now)).resolves.toEqual({
      allowed: false,
      retryAfter: 3600,
    });
  });

  it('시간당 한도가 초기화되어도 72시간 동안 아홉 번만 허용한다', async () => {
    const state = createFirestoreDouble();
    const consume = createFirestoreCreateSketchbookRateLimiter({
      firestore: state.firestore as never,
      secret: 'rate-limit-secret',
    });
    const ipRequest = request('203.0.113.10');

    for (const hour of [0, 2, 4]) {
      const now = new Date(Date.parse('2026-09-04T00:00:00.000Z') + hour * 60 * 60 * 1_000);
      await expect(consume(ipRequest, now)).resolves.toMatchObject({ allowed: true });
      await expect(consume(ipRequest, now)).resolves.toMatchObject({ allowed: true });
      await expect(consume(ipRequest, now)).resolves.toMatchObject({ allowed: true });
    }

    await expect(consume(ipRequest, new Date('2026-09-04T05:00:00.000Z'))).resolves.toEqual({
      allowed: false,
      retryAfter: 67 * 60 * 60,
    });
    await expect(consume(ipRequest, new Date('2026-09-07T00:00:00.001Z'))).resolves.toMatchObject({
      allowed: true,
    });
  });

  it('서로 다른 IP를 합쳐 한 시간에 60번만 허용한다', async () => {
    const state = createFirestoreDouble();
    const consume = createFirestoreCreateSketchbookRateLimiter({
      firestore: state.firestore as never,
      secret: 'rate-limit-secret',
    });
    const now = new Date('2026-09-04T00:00:00.000Z');

    for (let index = 0; index < 60; index += 1) {
      await expect(consume(request(`203.0.113.${index + 1}`), now)).resolves.toMatchObject({ allowed: true });
    }
    await expect(consume(request('198.51.100.1'), now)).resolves.toEqual({
      allowed: false,
      retryAfter: 3600,
    });
  });

  it('IP 원문 대신 비밀키 기반 해시 문서만 저장하고 Cloudflare 헤더를 신뢰하지 않는다', async () => {
    const state = createFirestoreDouble();
    const consume = createFirestoreCreateSketchbookRateLimiter({
      firestore: state.firestore as never,
      secret: 'rate-limit-secret',
    });
    const first = new Request('https://example.com/api/sketchbooks', {
      headers: {
        'cf-connecting-ip': '198.51.100.20',
        'x-forwarded-for': '203.0.113.8, 10.0.0.1',
      },
    });
    const second = new Request('https://example.com/api/sketchbooks', {
      headers: {
        'cf-connecting-ip': '198.51.100.21',
        'x-forwarded-for': '203.0.113.8, 10.0.0.1',
      },
    });

    await consume(first, new Date('2026-09-04T00:00:00.000Z'));
    await consume(second, new Date('2026-09-04T00:00:01.000Z'));

    const ids = [...state.documents.keys()];
    expect(ids).toHaveLength(2);
    expect(ids).toContain('global');
    expect(ids.find((id) => id !== 'global')).toMatch(/^ip_[a-f0-9]{64}$/);
    expect(ids.join(' ')).not.toContain('203.0.113.8');
  });

  it('Firestore 트랜잭션 오류를 허용 응답으로 바꾸지 않는다', async () => {
    const state = createFirestoreDouble();
    state.firestore.runTransaction.mockRejectedValue(new Error('firestore unavailable'));
    const consume = createFirestoreCreateSketchbookRateLimiter({
      firestore: state.firestore as never,
      secret: 'rate-limit-secret',
    });

    await expect(consume(request('203.0.113.5'))).rejects.toThrow('firestore unavailable');
  });
});
