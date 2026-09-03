import { vi } from 'vitest';

const { getAdminFirestore } = vi.hoisted(() => ({
  getAdminFirestore: vi.fn(),
}));

vi.mock('@/lib/firebase/admin', () => ({ getAdminFirestore }));

import { consumeManagePinAttempt } from '@/lib/sketchbooks/repository';

describe('consumeManagePinAttempt', () => {
  it('트랜잭션 안에서 최신 실패 횟수를 읽고 다음 상태를 저장한다', async () => {
    const attemptReference = { kind: 'attempt' };
    const transaction = {
      get: vi.fn().mockResolvedValue({
        data: () => ({ failureCount: 4, lockedUntil: null }),
        exists: true,
      }),
      set: vi.fn(),
    };
    const runTransaction = vi.fn(async (callback) => callback(transaction));
    getAdminFirestore.mockReturnValue({
      collection: vi.fn(() => ({
        doc: vi.fn(() => ({
          collection: vi.fn(() => ({ doc: vi.fn(() => attemptReference) })),
        })),
      })),
      runTransaction,
    });
    const now = new Date('2026-09-02T00:00:00.000Z');

    await expect(consumeManagePinAttempt('book-1', 'source-1', false, now)).resolves.toEqual({
      attempt: {
        failureCount: 5,
        lockedUntil: new Date('2026-09-02T00:10:00.000Z'),
      },
      wasLocked: false,
    });
    expect(transaction.get).toHaveBeenCalledWith(attemptReference);
    expect(transaction.set).toHaveBeenCalledWith(attemptReference, {
      failureCount: 5,
      lockedUntil: new Date('2026-09-02T00:10:00.000Z'),
      updatedAt: now,
    });
  });

  it('이미 잠긴 최신 상태는 변경하지 않고 반환한다', async () => {
    const lockedUntil = new Date('2026-09-02T00:10:00.000Z');
    const transaction = {
      get: vi.fn().mockResolvedValue({
        data: () => ({ failureCount: 5, lockedUntil }),
        exists: true,
      }),
      set: vi.fn(),
    };
    getAdminFirestore.mockReturnValue({
      collection: vi.fn(() => ({
        doc: vi.fn(() => ({
          collection: vi.fn(() => ({ doc: vi.fn(() => ({ kind: 'attempt' })) })),
        })),
      })),
      runTransaction: vi.fn(async (callback) => callback(transaction)),
    });

    await expect(consumeManagePinAttempt(
      'book-1',
      'source-1',
      true,
      new Date('2026-09-02T00:05:00.000Z'),
    )).resolves.toEqual({
      attempt: { failureCount: 5, lockedUntil },
      wasLocked: true,
    });
    expect(transaction.set).not.toHaveBeenCalled();
  });
});
