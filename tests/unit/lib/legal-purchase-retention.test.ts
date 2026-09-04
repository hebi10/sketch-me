import { describe, expect, it, vi } from 'vitest';

import {
  deleteExpiredLegalPurchaseRecords,
  preservePurchaseRecordsBeforeSketchbookDeletion,
} from '@/lib/purchases/legal-retention';

function createFirestore(purchases: Array<{ id: string; data: Record<string, unknown> }> = []) {
  const archived = new Map<string, Record<string, unknown>>();
  const deleted: string[] = [];
  const purchaseSnapshot = {
    docs: purchases.map((purchase) => ({
      data: () => purchase.data,
      id: purchase.id,
    })),
    empty: purchases.length === 0,
  };
  const expiredDocuments = [
    { id: 'expired-1', ref: { id: 'expired-1' } },
    { id: 'expired-2', ref: { id: 'expired-2' } },
  ];
  const commit = vi.fn(async () => undefined);
  const batch = {
    commit,
    delete: vi.fn((reference: { id: string }) => { deleted.push(reference.id); }),
    set: vi.fn((reference: { id: string }, data: Record<string, unknown>) => {
      archived.set(reference.id, data);
    }),
  };
  const legalCollection = {
    doc: vi.fn((id: string) => ({ id })),
    where: vi.fn(() => ({
      limit: vi.fn(() => ({
        get: vi.fn(async () => ({ docs: expiredDocuments, empty: false })),
      })),
    })),
  };
  const firestore = {
    batch: vi.fn(() => batch),
    collection: vi.fn((name: string) => {
      if (name === 'legalPurchaseRecords') return legalCollection;
      return {
        doc: vi.fn(() => ({
          collection: vi.fn(() => ({
            get: vi.fn(async () => purchaseSnapshot),
          })),
        })),
      };
    }),
  };

  return { archived, batch, commit, deleted, firestore };
}

describe('법정 결제 기록 보관', () => {
  it('스케치북 삭제 전에 최소 결제 기록만 분리 보관하고 결제 URL은 제외한다', async () => {
    const state = createFirestore([{
      id: 'request-1',
      data: {
        amount: 3900,
        buyerPhoneLast4: '1234',
        createdAt: new Date('2026-09-04T00:00:00.000Z'),
        orderId: 'order-1',
        paidAt: new Date('2026-09-04T01:00:00.000Z'),
        paymentStatus: 'SUCCEEDED',
        productType: 'WATERMARK_FREE',
        provider: 'PAYAPP',
        providerOrderId: 'provider-1',
        providerPayUrl: 'https://pay.example/secret',
        sketchbookName: '삭제할 스케치북',
        sketchbookPublicId: 'public-1',
      },
    }]);
    const now = new Date('2026-09-05T00:00:00.000Z');

    await preservePurchaseRecordsBeforeSketchbookDeletion(
      state.firestore as never,
      'book-1',
      now,
    );

    expect(state.archived.get('order-1')).toEqual(expect.objectContaining({
      amount: 3900,
      archivedAt: now,
      buyerPhoneLast4: '1234',
      orderId: 'order-1',
      requestId: 'request-1',
      retentionExpiresAt: new Date('2031-09-04T01:00:00.000Z'),
      sketchbookId: 'book-1',
      sketchbookPublicId: 'public-1',
    }));
    expect(state.archived.get('order-1')).not.toHaveProperty('providerPayUrl');
    expect(state.archived.get('order-1')).not.toHaveProperty('sketchbookName');
    expect(state.commit).toHaveBeenCalledTimes(1);
  });

  it('보관 기한이 지난 결제 기록을 배치 삭제한다', async () => {
    const state = createFirestore();
    const now = new Date('2031-09-05T00:00:00.000Z');

    await expect(deleteExpiredLegalPurchaseRecords(state.firestore as never, now, 20))
      .resolves.toBe(2);

    expect(state.deleted).toEqual(['expired-1', 'expired-2']);
    expect(state.commit).toHaveBeenCalledTimes(1);
  });

  it('결제가 완료되지 않은 주문 시도는 분쟁 대응에 필요한 3년만 보관한다', async () => {
    const state = createFirestore([{
      id: 'request-failed',
      data: {
        amount: 1000,
        createdAt: new Date('2026-09-04T00:00:00.000Z'),
        orderId: 'order-failed',
        paymentStatus: 'FAILED',
      },
    }]);

    await preservePurchaseRecordsBeforeSketchbookDeletion(
      state.firestore as never,
      'book-1',
      new Date('2026-09-05T00:00:00.000Z'),
    );

    expect(state.archived.get('order-failed')).toEqual(expect.objectContaining({
      retentionExpiresAt: new Date('2029-09-04T00:00:00.000Z'),
    }));
  });

  it('결제 기록이 많아도 Firestore 배치 한도를 넘기지 않고 나누어 보관한다', async () => {
    const purchases = Array.from({ length: 401 }, (_, index) => ({
      id: `request-${index}`,
      data: {
        amount: 1000,
        createdAt: new Date('2026-09-04T00:00:00.000Z'),
        orderId: `order-${index}`,
        paymentStatus: 'SUCCEEDED',
      },
    }));
    const state = createFirestore(purchases);

    await preservePurchaseRecordsBeforeSketchbookDeletion(
      state.firestore as never,
      'book-many',
      new Date('2026-09-05T00:00:00.000Z'),
    );

    expect(state.archived.size).toBe(401);
    expect(state.commit).toHaveBeenCalledTimes(2);
  });
});
