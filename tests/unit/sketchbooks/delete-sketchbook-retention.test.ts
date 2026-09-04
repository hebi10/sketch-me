import { beforeEach, describe, expect, it, vi } from 'vitest';

const { firestore, preservePurchaseRecordsBeforeSketchbookDeletion } = vi.hoisted(() => {
  const sketchbookReference = { id: 'book-1' };
  return {
    firestore: {
      collection: vi.fn(() => ({ doc: vi.fn(() => sketchbookReference) })),
      recursiveDelete: vi.fn(async () => undefined),
    },
    preservePurchaseRecordsBeforeSketchbookDeletion: vi.fn(async () => undefined),
  };
});

vi.mock('@/lib/firebase/admin', () => ({ getAdminFirestore: () => firestore }));
vi.mock('@/lib/purchases/legal-retention', () => ({
  preservePurchaseRecordsBeforeSketchbookDeletion,
}));

import { deleteSketchbookPermanently } from '@/lib/sketchbooks/repository';

describe('스케치북 영구 삭제', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('법정 결제 기록 보관이 완료된 뒤 Firestore 트리를 삭제한다', async () => {
    const operations: string[] = [];
    preservePurchaseRecordsBeforeSketchbookDeletion.mockImplementation(async () => {
      operations.push('preserve');
    });
    firestore.recursiveDelete.mockImplementation(async () => {
      operations.push('delete');
    });

    await deleteSketchbookPermanently('book-1');

    expect(operations).toEqual(['preserve', 'delete']);
  });

  it('법정 결제 기록 보관에 실패하면 원본 Firestore 트리를 유지한다', async () => {
    preservePurchaseRecordsBeforeSketchbookDeletion.mockRejectedValueOnce(
      new Error('archive unavailable'),
    );

    await expect(deleteSketchbookPermanently('book-1')).rejects.toThrow('archive unavailable');

    expect(firestore.recursiveDelete).not.toHaveBeenCalled();
  });
});
