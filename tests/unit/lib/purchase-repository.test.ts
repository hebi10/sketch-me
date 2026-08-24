import { vi } from 'vitest';

const { getAdminFirestore } = vi.hoisted(() => ({ getAdminFirestore: vi.fn() }));

vi.mock('@/lib/firebase/admin', () => ({ getAdminFirestore }));

import { addMockPurchase } from '@/lib/sketchbooks/repository';

describe('addMockPurchase', () => {
  it('같은 결제 시도 ID를 다시 처리해도 한도를 한 번만 증가시킨다', async () => {
    let participantLimit = 20;
    let purchaseExists = false;
    const purchaseReference = { id: 'purchase-attempt-1234', kind: 'purchase' };
    const sketchbookReference = {
      collection: vi.fn(() => ({ doc: vi.fn(() => purchaseReference) })),
      id: 'book-1',
      kind: 'sketchbook',
    };
    const transaction = {
      get: vi.fn(async (reference: { kind: string }) => reference.kind === 'purchase'
        ? { exists: purchaseExists }
        : { data: () => ({ participantLimit }), exists: true }),
      set: vi.fn(() => { purchaseExists = true; }),
      update: vi.fn((_reference, data: { participantLimit: number }) => { participantLimit = data.participantLimit; }),
    };
    getAdminFirestore.mockReturnValue({
      collection: vi.fn(() => ({ doc: vi.fn(() => sketchbookReference) })),
      runTransaction: vi.fn(async (callback: (value: typeof transaction) => Promise<number>) => callback(transaction)),
    });
    const sketchbook = {
      createdAt: new Date(),
      id: 'book-1',
      manageTokenHash: 'hash',
      name: '내 이름',
      ownerDrawingPath: 'owner.webp',
      participantCount: 0,
      participantLimit: 20,
      publicId: 'public-1',
      referenceImageEnabled: false,
      referenceImagePath: null,
      status: 'PUBLIC' as const,
      updatedAt: new Date(),
    };
    const plan = { additionalLimit: 10 as const, amount: 990 as const, productId: 'FRIENDS_10' as const };

    await expect(addMockPurchase(sketchbook, plan, 'purchase-attempt-1234')).resolves.toBe(30);
    await expect(addMockPurchase(sketchbook, plan, 'purchase-attempt-1234')).resolves.toBe(30);

    expect(transaction.update).toHaveBeenCalledTimes(1);
    expect(transaction.set).toHaveBeenCalledTimes(1);
    expect(sketchbookReference.collection).toHaveBeenCalledWith('purchases');
  });
});
