import { vi } from 'vitest';

const { getAdminFirestore } = vi.hoisted(() => ({ getAdminFirestore: vi.fn() }));

vi.mock('@/lib/firebase/admin', () => ({ getAdminFirestore }));

import {
  addMockPurchase,
  findSketchbookByPublicId,
  listDrawings,
} from '@/lib/sketchbooks/repository';

describe('repository moderation compatibility', () => {
  it('기존 스케치북 문서의 누락된 운영 상태를 활성 상태로 읽는다', async () => {
    const document = {
      data: () => ({
        createdAt: new Date('2026-08-24T00:00:00.000Z'),
        manageTokenHash: 'hash',
        name: '내 이름',
        ownerDrawingPath: null,
        participantCount: 0,
        participantLimit: 20,
        publicId: 'public-1',
        status: 'PUBLIC',
        updatedAt: new Date('2026-08-24T00:00:00.000Z'),
      }),
      id: 'book-1',
    };
    const get = vi.fn().mockResolvedValue({ docs: [document], empty: false });
    getAdminFirestore.mockReturnValue({
      collection: vi.fn(() => ({
        where: vi.fn(() => ({ limit: vi.fn(() => ({ get })) })),
      })),
    });

    await expect(findSketchbookByPublicId('public-1')).resolves.toMatchObject({
      entitlements: { watermarkFree: false },
      moderatedAt: null,
      moderationStatus: 'ACTIVE',
      ownerDrawingPath: null,
      retentionExpiresAt: null,
      retentionGuaranteedUntil: null,
      retentionTier: 'LEGACY',
      storyHeading: '친구들이 그린 내 모습',
    });
  });

  it('기존 그림 문서의 누락된 운영 상태를 활성 상태로 읽는다', async () => {
    const document = {
      data: () => ({
        authorName: '수연',
        bestRank: null,
        createdAt: new Date('2026-08-24T00:00:00.000Z'),
        imagePath: 'drawing.webp',
        message: null,
        sketchbookId: 'book-1',
        sketchbookName: '내 이름',
        sketchbookPublicId: 'public-1',
        status: 'VISIBLE',
        updatedAt: new Date('2026-08-24T00:00:00.000Z'),
      }),
      id: 'drawing-1',
    };
    const get = vi.fn().mockResolvedValue({ docs: [document] });
    getAdminFirestore.mockReturnValue({
      collection: vi.fn(() => ({
        doc: vi.fn(() => ({
          collection: vi.fn(() => ({ orderBy: vi.fn(() => ({ get })) })),
        })),
      })),
    });

    await expect(listDrawings('book-1')).resolves.toEqual([
      expect.objectContaining({
        moderatedAt: null,
        moderationStatus: 'ACTIVE',
        sketchbookName: '내 이름',
        sketchbookPublicId: 'public-1',
      }),
    ]);
  });

  it('legacy 그림 문서의 누락된 관리자 목록과 운영 필드를 기본값으로 읽는다', async () => {
    const document = {
      data: () => ({
        authorName: '수연',
        bestRank: null,
        createdAt: new Date('2026-08-24T00:00:00.000Z'),
        imagePath: 'drawing.webp',
        message: null,
        sketchbookId: 'book-1',
        status: 'VISIBLE',
        updatedAt: new Date('2026-08-24T00:00:00.000Z'),
      }),
      id: 'drawing-legacy',
    };
    const get = vi.fn().mockResolvedValue({ docs: [document] });
    getAdminFirestore.mockReturnValue({
      collection: vi.fn(() => ({
        doc: vi.fn(() => ({
          collection: vi.fn(() => ({ orderBy: vi.fn(() => ({ get })) })),
        })),
      })),
    });

    await expect(listDrawings('book-1')).resolves.toEqual([
      expect.objectContaining({
        moderatedAt: null,
        moderationStatus: 'ACTIVE',
        sketchbookName: '',
        sketchbookPublicId: '',
      }),
    ]);
  });
});

describe('addMockPurchase', () => {
  it('같은 결제 시도 ID를 다시 처리해도 한도를 한 번만 증가시킨다', async () => {
    let participantLimit = 20;
    let purchaseExists = false;
    let savedPurchase: Record<string, unknown> | undefined;
    const purchaseReference = { id: 'purchase-attempt-1234', kind: 'purchase' };
    const sketchbookReference = {
      collection: vi.fn(() => ({ doc: vi.fn(() => purchaseReference) })),
      id: 'book-1',
      kind: 'sketchbook',
    };
    const transaction = {
      get: vi.fn(async (reference: { kind: string }) => reference.kind === 'purchase'
        ? { exists: purchaseExists }
        : { data: () => ({ entitlements: { watermarkFree: false }, participantLimit }), exists: true }),
      set: vi.fn((_reference, data: Record<string, unknown>) => {
        purchaseExists = true;
        savedPurchase = data;
      }),
      update: vi.fn((_reference, data: { participantLimit?: number }) => {
        if (typeof data.participantLimit === 'number') participantLimit = data.participantLimit;
      }),
    };
    getAdminFirestore.mockReturnValue({
      collection: vi.fn(() => ({ doc: vi.fn(() => sketchbookReference) })),
      runTransaction: vi.fn(async (callback: (value: typeof transaction) => Promise<number>) => callback(transaction)),
    });
    const sketchbook = {
      createdAt: new Date(),
      id: 'book-1',
      entitlements: { watermarkFree: false },
      manageTokenHash: 'hash',
      moderatedAt: null,
      moderationStatus: 'ACTIVE' as const,
      name: '내 이름',
      ownerDrawingPath: 'owner.webp',
      participantCount: 0,
      participantLimit: 20,
      publicId: 'public-1',
      status: 'PUBLIC' as const,
      updatedAt: new Date(),
    };
    const plan = { additionalLimit: 10 as const, amount: 1000 as const, kind: 'capacity' as const, label: '친구 그림 10명 추가' as const, productId: 'FRIENDS_10' as const };

    await expect(addMockPurchase(sketchbook, plan, 'purchase-attempt-1234')).resolves.toEqual({
      entitlements: { watermarkFree: false },
      participantLimit: 30,
    });
    await expect(addMockPurchase(sketchbook, plan, 'purchase-attempt-1234')).resolves.toEqual({
      entitlements: { watermarkFree: false },
      participantLimit: 30,
    });

    expect(transaction.update).toHaveBeenCalledTimes(1);
    expect(transaction.set).toHaveBeenCalledTimes(1);
    expect(sketchbookReference.collection).toHaveBeenCalledWith('purchases');
    expect(savedPurchase).toMatchObject({
      orderId: 'order_purchase-attempt-1234',
      sketchbookId: 'book-1',
      sketchbookPublicId: 'public-1',
      sketchbookName: '내 이름',
    });
    expect(transaction.update).toHaveBeenCalledWith(sketchbookReference, expect.objectContaining({
      retentionExpiresAt: null,
      retentionGuaranteedUntil: expect.any(Date),
      retentionTier: 'PAID',
    }));
  });

  it('워터마크 제거 결제는 참여 한도를 바꾸지 않고 권한과 구매 기록을 함께 저장한다', async () => {
    const purchaseReference = { kind: 'purchase' };
    const sketchbookReference = {
      collection: vi.fn(() => ({ doc: vi.fn(() => purchaseReference) })),
      kind: 'sketchbook',
    };
    const transaction = {
      get: vi.fn(async (reference: { kind: string }) => reference.kind === 'purchase'
        ? { exists: false }
        : {
            data: () => ({ entitlements: { watermarkFree: false }, participantLimit: 20 }),
            exists: true,
          }),
      set: vi.fn(),
      update: vi.fn(),
    };
    getAdminFirestore.mockReturnValue({
      collection: vi.fn(() => ({ doc: vi.fn(() => sketchbookReference) })),
      runTransaction: vi.fn(async (callback: (value: typeof transaction) => Promise<unknown>) => callback(transaction)),
    });
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
    const plan = { additionalLimit: 0 as const, amount: 1000 as const, kind: 'watermark' as const, label: '워터마크 제거' as const, productId: 'WATERMARK_FREE' as const };

    await expect(addMockPurchase(sketchbook, plan, 'watermark-attempt-1234')).resolves.toEqual({
      entitlements: { watermarkFree: true },
      participantLimit: 20,
    });
    expect(transaction.update).toHaveBeenCalledWith(sketchbookReference, expect.objectContaining({
      entitlements: { watermarkFree: true },
      retentionExpiresAt: null,
      retentionGuaranteedUntil: expect.any(Date),
      retentionTier: 'PAID',
    }));
    expect(transaction.update.mock.calls[0]?.[1]).not.toHaveProperty('participantLimit');
    expect(transaction.set).toHaveBeenCalledWith(purchaseReference, expect.objectContaining({
      additionalLimit: 0,
      amount: 1000,
      productType: 'WATERMARK_FREE',
    }));
  });
});
