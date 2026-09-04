import { vi } from 'vitest';

const { getAdminFirestore } = vi.hoisted(() => ({ getAdminFirestore: vi.fn() }));

vi.mock('@/lib/firebase/admin', () => ({ getAdminFirestore }));

import {
  PurchaseConflictError,
  PurchaseVerificationError,
  applyPayAppFeedback,
  attachProviderPayment,
  createPendingPurchase,
  findPurchaseByOrderId,
} from '@/lib/purchases/orders';

type Stored = Record<string, unknown>;
type Reference = { id: string; kind: 'legal' | 'purchase' | 'sketchbook'; path: string };

function createFirestoreDouble() {
  const books = new Map<string, Stored>([[
    'book-1',
    { entitlements: { watermarkFree: false }, participantLimit: 20, publicId: 'public-1' },
  ]]);
  const legalRecords = new Map<string, Stored>();
  const purchases = new Map<string, Stored>();

  const purchaseReference = (bookId: string, requestId: string): Reference => ({
    id: requestId,
    kind: 'purchase',
    path: `sketchbooks/${bookId}/purchases/${requestId}`,
  });
  const sketchbookReference = (bookId: string) => ({
    id: bookId,
    kind: 'sketchbook' as const,
    path: `sketchbooks/${bookId}`,
    collection: () => ({ doc: (requestId: string) => purchaseReference(bookId, requestId) }),
  });
  const legalRecordReference = (orderId: string): Reference => ({
    id: orderId,
    kind: 'legal',
    path: `legalTransactionRecords/${orderId}`,
  });
  const read = (reference: Reference) => {
    const data = reference.kind === 'sketchbook'
      ? books.get(reference.id)
      : reference.kind === 'legal'
        ? legalRecords.get(reference.id)
        : purchases.get(reference.path);
    return {
      data: () => data,
      exists: Boolean(data),
      id: reference.id,
      ref: reference,
    };
  };
  const update = (reference: Reference, values: Stored) => {
    const store = reference.kind === 'sketchbook'
      ? books
      : reference.kind === 'legal'
        ? legalRecords
        : purchases;
    const key = reference.kind === 'purchase' ? reference.path : reference.id;
    store.set(key, { ...store.get(key), ...values });
  };
  const firestore = {
    collection: vi.fn((name: string) => name === 'legalTransactionRecords'
      ? { doc: (orderId: string) => legalRecordReference(orderId) }
      : { doc: (bookId: string) => sketchbookReference(bookId) }),
    collectionGroup: vi.fn(() => ({
      where: (_field: string, _operator: string, orderId: string) => ({
        limit: () => ({
          get: async () => {
            const matches = [...purchases.entries()].filter(([, value]) => value.orderId === orderId);
            return {
              docs: matches.map(([path, data]) => ({
                data: () => data,
                id: path.split('/').at(-1)!,
                ref: purchaseReference(path.split('/')[1], path.split('/').at(-1)!),
              })),
              empty: matches.length === 0,
            };
          },
        }),
      }),
    })),
    runTransaction: vi.fn(async (callback: (transaction: Record<string, unknown>) => Promise<unknown>) => callback({
      get: async (reference: Reference) => read(reference),
      set: (reference: Reference, values: Stored) => update(reference, values),
      update,
    })),
  };
  return { books, firestore, legalRecords, purchases };
}

const sketchbook = {
  createdAt: new Date(),
  entitlements: { watermarkFree: false },
  id: 'book-1',
  manageTokenHash: 'hash',
  moderatedAt: null,
  moderationStatus: 'ACTIVE' as const,
  name: '내 이름',
  ownerDrawingPath: null,
  participantCount: 0,
  participantLimit: 20,
  publicId: 'public-1',
  status: 'PUBLIC' as const,
  updatedAt: new Date(),
};
const plan = {
  additionalLimit: 10 as const,
  amount: 1000 as const,
  kind: 'capacity' as const,
  label: '친구 그림 10명 추가' as const,
  productId: 'FRIENDS_10' as const,
};

describe('페이앱 주문 저장', () => {
  it('READY 주문에는 전체 전화번호를 남기지 않고 혜택도 적용하지 않는다', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-04T00:00:00.000Z'));
    const state = createFirestoreDouble();
    getAdminFirestore.mockReturnValue(state.firestore);

    const result = await createPendingPurchase({
      buyerPhone: '01012345678',
      digitalContentConsentVersion: '2026-09-03',
      orderId: 'order-public-random',
      plan,
      requestId: 'request-1234',
      sketchbook,
    });

    expect(result).toMatchObject({ isNew: true, orderId: 'order-public-random' });
    expect(state.books.get('book-1')?.participantLimit).toBe(20);
    const saved = state.purchases.get('sketchbooks/book-1/purchases/request-1234');
    expect(saved).toMatchObject({
      buyerPhoneLast4: '5678',
      digitalContentConsentAt: expect.any(Date),
      digitalContentConsentVersion: '2026-09-03',
      paymentStatus: 'READY',
      provider: 'PAYAPP',
    });
    expect(JSON.stringify(saved)).not.toContain('01012345678');
    expect(state.legalRecords.get('order-public-random')).toMatchObject({
      amount: 1000,
      buyerPhoneLast4: '5678',
      orderId: 'order-public-random',
      paymentStatus: 'READY',
      retentionExpiresAt: new Date('2031-09-04T00:00:00.000Z'),
    });
    expect(JSON.stringify(state.legalRecords.get('order-public-random')))
      .not.toContain('01012345678');
    vi.useRealTimers();
  });

  it('동일 요청은 기존 주문을 반환하고 다른 상품 재사용은 거부한다', async () => {
    const state = createFirestoreDouble();
    getAdminFirestore.mockReturnValue(state.firestore);
    const input = {
      buyerPhone: '01012345678',
      digitalContentConsentVersion: '2026-09-03',
      orderId: 'order-public-random',
      plan,
      requestId: 'request-1234',
      sketchbook,
    };

    await createPendingPurchase(input);
    await expect(createPendingPurchase(input)).resolves.toMatchObject({ isNew: false });
    await expect(createPendingPurchase({
      ...input,
      plan: {
        additionalLimit: 0,
        amount: 1000,
        kind: 'watermark',
        label: '워터마크 제거',
        productId: 'WATERMARK_FREE',
      },
    })).rejects.toBeInstanceOf(PurchaseConflictError);
  });

  it('동의 기록이 없는 기존 READY 주문을 재개할 때 동의 시각과 버전을 보완한다', async () => {
    const state = createFirestoreDouble();
    getAdminFirestore.mockReturnValue(state.firestore);
    const input = {
      buyerPhone: '01012345678',
      digitalContentConsentVersion: '2026-09-03',
      orderId: 'order-public-random',
      plan,
      requestId: 'request-1234',
      sketchbook,
    };

    await createPendingPurchase(input);
    const path = 'sketchbooks/book-1/purchases/request-1234';
    const legacyPurchase = state.purchases.get(path);
    delete legacyPurchase?.digitalContentConsentAt;
    delete legacyPurchase?.digitalContentConsentVersion;

    await expect(createPendingPurchase(input)).resolves.toMatchObject({ isNew: false });
    expect(state.purchases.get(path)).toMatchObject({
      digitalContentConsentAt: expect.any(Date),
      digitalContentConsentVersion: '2026-09-03',
    });
  });

  it('페이앱 주문번호를 연결한 뒤 주문번호로 안전하게 조회한다', async () => {
    const state = createFirestoreDouble();
    getAdminFirestore.mockReturnValue(state.firestore);
    await createPendingPurchase({
      buyerPhone: '01012345678',
      digitalContentConsentVersion: '2026-09-03',
      orderId: 'order-public-random',
      plan,
      requestId: 'request-1234',
      sketchbook,
    });

    await attachProviderPayment({
      orderId: 'order-public-random',
      payUrl: 'https://payapp.kr/pay/2000',
      providerOrderId: '2000',
    });

    await expect(findPurchaseByOrderId('order-public-random')).resolves.toMatchObject({
      providerOrderId: '2000',
    });
  });

  it('동일 완료 통보가 반복되어도 혜택은 한 번만 적용한다', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-04T00:00:00.000Z'));
    const state = createFirestoreDouble();
    getAdminFirestore.mockReturnValue(state.firestore);
    await createPendingPurchase({
      buyerPhone: '01012345678',
      digitalContentConsentVersion: '2026-09-03',
      orderId: 'order-public-random',
      plan,
      requestId: 'request-1234',
      sketchbook,
    });
    await attachProviderPayment({
      orderId: 'order-public-random',
      payUrl: 'https://payapp.kr/pay/2000',
      providerOrderId: '2000',
    });

    const feedback = {
      amount: 1000,
      orderId: 'order-public-random',
      payState: '4',
      payType: 'CARD',
      providerOrderId: '2000',
    };
    await expect(applyPayAppFeedback(feedback)).resolves.toBe('APPLIED');
    expect(state.books.get('book-1')).toMatchObject({
      retentionExpiresAt: null,
      retentionGuaranteedUntil: new Date('2027-09-04T00:00:00.000Z'),
      retentionTier: 'PAID',
    });
    vi.setSystemTime(new Date('2026-10-04T00:00:00.000Z'));
    await expect(applyPayAppFeedback(feedback)).resolves.toBe('DUPLICATE');

    expect(state.books.get('book-1')?.participantLimit).toBe(30);
    expect(state.books.get('book-1')?.retentionGuaranteedUntil)
      .toEqual(new Date('2027-09-04T00:00:00.000Z'));
    expect(state.purchases.get('sketchbooks/book-1/purchases/request-1234')?.benefitAppliedAt).toBeInstanceOf(Date);
    vi.useRealTimers();
  });

  it('금액 또는 페이앱 주문번호가 다른 완료 통보를 거부한다', async () => {
    const state = createFirestoreDouble();
    getAdminFirestore.mockReturnValue(state.firestore);
    await createPendingPurchase({
      buyerPhone: '01012345678',
      digitalContentConsentVersion: '2026-09-03',
      orderId: 'order-public-random',
      plan,
      requestId: 'request-1234',
      sketchbook,
    });
    await attachProviderPayment({
      orderId: 'order-public-random',
      payUrl: 'https://payapp.kr/pay/2000',
      providerOrderId: '2000',
    });

    await expect(applyPayAppFeedback({
      amount: 1,
      orderId: 'order-public-random',
      payState: '4',
      providerOrderId: 'changed',
    })).rejects.toBeInstanceOf(PurchaseVerificationError);
    expect(state.books.get('book-1')?.participantLimit).toBe(20);
  });

  it('동의 기록이 없는 이전 주문의 결제가 완료되면 혜택을 적용하지 않고 검토 상태로 격리한다', async () => {
    const state = createFirestoreDouble();
    getAdminFirestore.mockReturnValue(state.firestore);
    await createPendingPurchase({
      buyerPhone: '01012345678',
      digitalContentConsentVersion: '2026-09-03',
      orderId: 'order-public-random',
      plan,
      requestId: 'request-1234',
      sketchbook,
    });
    const path = 'sketchbooks/book-1/purchases/request-1234';
    const legacyPurchase = state.purchases.get(path);
    delete legacyPurchase?.digitalContentConsentAt;
    delete legacyPurchase?.digitalContentConsentVersion;
    await attachProviderPayment({
      orderId: 'order-public-random',
      payUrl: 'https://payapp.kr/pay/2000',
      providerOrderId: '2000',
    });

    await expect(applyPayAppFeedback({
      amount: 1000,
      orderId: 'order-public-random',
      payState: '4',
      providerOrderId: '2000',
    })).resolves.toBe('REVIEW_REQUIRED');

    expect(state.books.get('book-1')?.participantLimit).toBe(20);
    expect(state.purchases.get(path)).toMatchObject({
      benefitAppliedAt: null,
      paymentStatus: 'REVIEW_REQUIRED',
    });
  });
});
