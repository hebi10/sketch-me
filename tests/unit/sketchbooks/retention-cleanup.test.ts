import { describe, expect, it, vi } from 'vitest';

import {
  cleanupExpiredSketchbooks,
  type RetentionCleanupDependencies,
} from '@/lib/sketchbooks/retention-cleanup';

function createDependencies() {
  const operations: string[] = [];
  const dependencies: RetentionCleanupDependencies = {
    createDeletionJob: vi.fn(async (target) => { operations.push(`job:${target.id}`); }),
    deleteAdminDeletionJob: vi.fn(async (id) => { operations.push(`admin-job-delete:${id}`); }),
    deleteDeletionJob: vi.fn(async (publicId) => { operations.push(`manage-job-delete:${publicId}`); }),
    deleteExpiredLegalPurchaseRecords: vi.fn(async () => {
      operations.push('legal-records');
      return 2;
    }),
    deleteFirestoreTree: vi.fn(async (id) => { operations.push(`firestore:${id}`); }),
    deleteStoragePrefix: vi.fn(async (id) => { operations.push(`storage:${id}`); }),
    listExpired: vi.fn(async () => []),
    listPending: vi.fn(async () => []),
    markDeletionStarted: vi.fn(async (id) => { operations.push(`mark:${id}`); }),
  };
  return { dependencies, operations };
}

describe('만료 스케치북 정리', () => {
  it('새 만료 대상은 작업을 보존한 뒤 공개 차단, Storage, Firestore 순서로 삭제한다', async () => {
    const state = createDependencies();
    vi.mocked(state.dependencies.listExpired).mockResolvedValue([{
      id: 'book-1',
      publicId: 'public-1',
      source: 'sketchbook',
    }]);

    await expect(cleanupExpiredSketchbooks({
      dependencies: state.dependencies,
      now: new Date('2027-03-04T00:00:00.000Z'),
    })).resolves.toEqual({ attempted: 1, failed: 0, legalRecordsDeleted: 2, succeeded: 1 });

    expect(state.operations).toEqual([
      'job:book-1',
      'mark:book-1',
      'storage:book-1',
      'firestore:book-1',
      'manage-job-delete:public-1',
      'admin-job-delete:book-1',
      'legal-records',
    ]);
  });

  it('이전 실행에서 남은 작업은 새 만료 대상보다 먼저 재시도하고 루트 문서를 다시 만들지 않는다', async () => {
    const state = createDependencies();
    vi.mocked(state.dependencies.listPending).mockResolvedValue([{
      id: 'book-pending',
      publicId: 'public-pending',
      source: 'admin-deletion-job',
    }]);
    vi.mocked(state.dependencies.listExpired).mockResolvedValue([{
      id: 'book-new',
      publicId: 'public-new',
      source: 'sketchbook',
    }]);

    await cleanupExpiredSketchbooks({ dependencies: state.dependencies, limit: 2 });

    expect(state.operations).toEqual([
      'storage:book-pending',
      'firestore:book-pending',
      'manage-job-delete:public-pending',
      'admin-job-delete:book-pending',
      'job:book-new',
      'mark:book-new',
      'storage:book-new',
      'firestore:book-new',
      'manage-job-delete:public-new',
      'admin-job-delete:book-new',
      'legal-records',
    ]);
  });

  it('한 대상의 실패를 집계하고 나머지 대상은 계속 정리한다', async () => {
    const state = createDependencies();
    vi.mocked(state.dependencies.listExpired).mockResolvedValue([
      { id: 'book-fail', publicId: 'public-fail', source: 'sketchbook' },
      { id: 'book-ok', publicId: 'public-ok', source: 'sketchbook' },
    ]);
    vi.mocked(state.dependencies.deleteStoragePrefix).mockImplementation(async (id) => {
      state.operations.push(`storage:${id}`);
      if (id === 'book-fail') throw new Error('storage unavailable');
    });

    await expect(cleanupExpiredSketchbooks({ dependencies: state.dependencies }))
      .resolves.toEqual({ attempted: 2, failed: 1, legalRecordsDeleted: 2, succeeded: 1 });

    expect(state.operations).toContain('firestore:book-ok');
    expect(state.operations).not.toContain('firestore:book-fail');
    expect(state.dependencies.deleteAdminDeletionJob).not.toHaveBeenCalledWith('book-fail');
  });
});
