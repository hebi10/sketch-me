import { vi } from 'vitest';

const { getAdminFirestore } = vi.hoisted(() => ({
  getAdminFirestore: vi.fn(),
}));

vi.mock('@/lib/firebase/admin', () => ({ getAdminFirestore }));

import {
  ModerationTargetNotFoundError,
  setDrawingModeration,
  setSketchbookModeration,
} from '@/lib/admin/moderation';

type FakeDocument = {
  exists: boolean;
  data: () => Record<string, unknown> | undefined;
};

function document(data?: Record<string, unknown>): FakeDocument {
  return {
    exists: data !== undefined,
    data: () => data,
  };
}

function createFirestoreDouble(options: {
  sketchbook?: Record<string, unknown>;
  drawing?: Record<string, unknown>;
  sketchbookId?: string;
  drawingId?: string;
}) {
  const sketchbookId = options.sketchbookId ?? 'book-1';
  const drawingId = options.drawingId ?? 'draw-1';
  const sketchbookReference = {
    collection: vi.fn(),
    path: `sketchbooks/${sketchbookId}`,
  };
  const drawingReference = { path: `sketchbooks/${sketchbookId}/drawings/${drawingId}` };
  const drawingDocument = vi.fn((requestedId: string) => {
    if (requestedId !== drawingId) throw new Error(`Unexpected drawing ID: ${requestedId}`);
    return drawingReference;
  });
  sketchbookReference.collection.mockImplementation((name: string) => {
    if (name !== 'drawings') throw new Error(`Unexpected subcollection: ${name}`);
    return { doc: drawingDocument };
  });
  const auditReference = { path: 'adminAuditLogs/audit-1' };
  const sketchbookDocument = vi.fn((requestedId: string) => {
    if (requestedId !== sketchbookId) throw new Error(`Unexpected sketchbook ID: ${requestedId}`);
    return sketchbookReference;
  });
  const auditDocument = vi.fn(() => auditReference);
  const transaction = {
    get: vi.fn().mockResolvedValue(document(options.sketchbook)),
    getAll: vi.fn().mockResolvedValue([
      document(options.drawing),
      document(options.sketchbook),
    ]),
    set: vi.fn(),
    update: vi.fn(),
  };
  const firestore = {
    collection: vi.fn((name: string) => {
      if (name === 'sketchbooks') {
        return { doc: sketchbookDocument };
      }
      if (name === 'adminAuditLogs') return { doc: auditDocument };
      throw new Error(`Unexpected collection: ${name}`);
    }),
    runTransaction: vi.fn(async (callback: (value: typeof transaction) => unknown) => (
      callback(transaction)
    )),
  };
  getAdminFirestore.mockReturnValue(firestore);

  return {
    auditReference,
    auditDocument,
    drawingDocument,
    drawingReference,
    firestore,
    sketchbookDocument,
    sketchbookReference,
    transaction,
  };
}

describe('admin moderation transactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('스케치북을 차단하며 운영 필드만 갱신하고 같은 트랜잭션에 감사 로그를 기록한다', async () => {
    const now = new Date('2026-08-25T00:05:00.000Z');
    vi.setSystemTime(now);
    const {
      auditDocument,
      auditReference,
      firestore,
      sketchbookDocument,
      sketchbookReference,
      transaction,
    } = createFirestoreDouble({
      sketchbook: {
        moderationStatus: 'ACTIVE',
        publicId: 'public-1',
        status: 'PRIVATE',
        updatedAt: new Date('2026-08-24T10:00:00.000Z'),
      },
    });

    await expect(setSketchbookModeration({
      adminUid: 'admin-uid',
      moderationStatus: 'BLOCKED',
      sketchbookId: 'book-1',
    })).resolves.toEqual({ changed: true, status: 'BLOCKED' });

    expect(transaction.get).toHaveBeenCalledWith(sketchbookReference);
    expect(firestore.collection).toHaveBeenCalledWith('sketchbooks');
    expect(sketchbookDocument).toHaveBeenCalledWith('book-1');
    expect(transaction.update).toHaveBeenCalledWith(sketchbookReference, {
      moderatedAt: now,
      moderationStatus: 'BLOCKED',
    });
    expect(transaction.set).toHaveBeenCalledWith(auditReference, {
      action: 'BLOCK_SKETCHBOOK',
      adminUid: 'admin-uid',
      createdAt: now,
      nextModerationStatus: 'BLOCKED',
      previousModerationStatus: 'ACTIVE',
      publicId: 'public-1',
      targetId: 'book-1',
      targetType: 'SKETCHBOOK',
    });
    expect(firestore.collection).toHaveBeenCalledWith('adminAuditLogs');
    expect(auditDocument).toHaveBeenCalledWith();
  });

  it('legacy 스케치북의 누락 상태를 ACTIVE로 보고 같은 상태 요청에는 쓰거나 감사하지 않는다', async () => {
    const { transaction } = createFirestoreDouble({
      sketchbook: { publicId: 'public-1', status: 'PUBLIC' },
    });

    await expect(setSketchbookModeration({
      adminUid: 'admin-uid',
      moderationStatus: 'ACTIVE',
      sketchbookId: 'book-1',
    })).resolves.toEqual({ changed: false, status: 'ACTIVE' });

    expect(transaction.update).not.toHaveBeenCalled();
    expect(transaction.set).not.toHaveBeenCalled();
  });

  it('차단된 스케치북을 복구하며 UNBLOCK_SKETCHBOOK 감사 로그를 남긴다', async () => {
    const { transaction } = createFirestoreDouble({
      sketchbook: { moderationStatus: 'BLOCKED', publicId: 'public-1' },
    });

    await expect(setSketchbookModeration({
      adminUid: 'admin-uid',
      moderationStatus: 'ACTIVE',
      sketchbookId: 'book-1',
    })).resolves.toEqual({ changed: true, status: 'ACTIVE' });

    expect(transaction.update).toHaveBeenCalledWith(expect.anything(), {
      moderatedAt: expect.any(Date),
      moderationStatus: 'ACTIVE',
    });
    expect(transaction.set).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      action: 'UNBLOCK_SKETCHBOOK',
      nextModerationStatus: 'ACTIVE',
      previousModerationStatus: 'BLOCKED',
    }));
  });

  it('스케치북이 없으면 404로 변환 가능한 오류를 내고 쓰지 않는다', async () => {
    const { transaction } = createFirestoreDouble({ sketchbookId: 'missing-book' });

    await expect(setSketchbookModeration({
      adminUid: 'admin-uid',
      moderationStatus: 'BLOCKED',
      sketchbookId: 'missing-book',
    })).rejects.toBeInstanceOf(ModerationTargetNotFoundError);

    expect(transaction.update).not.toHaveBeenCalled();
    expect(transaction.set).not.toHaveBeenCalled();
  });

  it('그림과 부모 스케치북을 함께 읽고 그림 운영 필드만 갱신하며 부모 publicId를 감사한다', async () => {
    const now = new Date('2026-08-25T00:06:00.000Z');
    vi.setSystemTime(now);
    const {
      auditReference,
      auditDocument,
      drawingDocument,
      drawingReference,
      firestore,
      sketchbookDocument,
      sketchbookReference,
      transaction,
    } = createFirestoreDouble({
      drawing: {
        bestRank: 2,
        moderationStatus: 'ACTIVE',
        status: 'HIDDEN',
        updatedAt: new Date('2026-08-24T11:00:00.000Z'),
      },
      sketchbook: { publicId: 'parent-public', status: 'PRIVATE' },
    });

    await expect(setDrawingModeration({
      adminUid: 'admin-uid',
      drawingId: 'draw-1',
      moderationStatus: 'BLOCKED',
      sketchbookId: 'book-1',
    })).resolves.toEqual({ changed: true, status: 'BLOCKED' });

    expect(transaction.getAll).toHaveBeenCalledWith(
      drawingReference,
      sketchbookReference,
    );
    expect(firestore.collection).toHaveBeenCalledWith('sketchbooks');
    expect(sketchbookDocument).toHaveBeenCalledWith('book-1');
    expect(sketchbookReference.collection).toHaveBeenCalledWith('drawings');
    expect(drawingDocument).toHaveBeenCalledWith('draw-1');
    expect(transaction.update).toHaveBeenCalledWith(drawingReference, {
      moderatedAt: now,
      moderationStatus: 'BLOCKED',
      publicImageVersion: expect.stringMatching(/^[0-9a-f-]{36}$/),
    });
    expect(transaction.set).toHaveBeenCalledWith(auditReference, {
      action: 'BLOCK_DRAWING',
      adminUid: 'admin-uid',
      createdAt: now,
      nextModerationStatus: 'BLOCKED',
      previousModerationStatus: 'ACTIVE',
      publicId: 'parent-public',
      targetId: 'draw-1',
      targetType: 'DRAWING',
    });
    expect(firestore.collection).toHaveBeenCalledWith('adminAuditLogs');
    expect(auditDocument).toHaveBeenCalledWith();
  });

  it('이미 차단된 그림에는 쓰기와 감사 로그를 만들지 않는다', async () => {
    const { transaction } = createFirestoreDouble({
      drawing: { bestRank: 1, moderationStatus: 'BLOCKED', status: 'VISIBLE' },
      sketchbook: { publicId: 'parent-public' },
    });

    await expect(setDrawingModeration({
      adminUid: 'admin-uid',
      drawingId: 'draw-1',
      moderationStatus: 'BLOCKED',
      sketchbookId: 'book-1',
    })).resolves.toEqual({ changed: false, status: 'BLOCKED' });

    expect(transaction.update).not.toHaveBeenCalled();
    expect(transaction.set).not.toHaveBeenCalled();
  });

  it('차단된 그림을 복구하며 UNBLOCK_DRAWING 감사 로그를 남긴다', async () => {
    const { transaction } = createFirestoreDouble({
      drawing: { bestRank: 4, moderationStatus: 'BLOCKED', status: 'HIDDEN' },
      sketchbook: { publicId: 'parent-public' },
    });

    await expect(setDrawingModeration({
      adminUid: 'admin-uid',
      drawingId: 'draw-1',
      moderationStatus: 'ACTIVE',
      sketchbookId: 'book-1',
    })).resolves.toEqual({ changed: true, status: 'ACTIVE' });

    expect(transaction.update).toHaveBeenCalledWith(expect.anything(), {
      moderatedAt: expect.any(Date),
      moderationStatus: 'ACTIVE',
      publicImageVersion: expect.stringMatching(/^[0-9a-f-]{36}$/),
    });
    expect(transaction.set).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      action: 'UNBLOCK_DRAWING',
      nextModerationStatus: 'ACTIVE',
      previousModerationStatus: 'BLOCKED',
    }));
  });

  it.each([
    { drawing: undefined, label: '그림 누락', sketchbook: { publicId: 'parent-public' } },
    { drawing: { moderationStatus: 'ACTIVE' }, label: '부모 누락', sketchbook: undefined },
  ])('$label이면 404로 변환 가능한 오류를 내고 쓰지 않는다', async ({ drawing, sketchbook }) => {
    const { transaction } = createFirestoreDouble({ drawing, sketchbook });

    await expect(setDrawingModeration({
      adminUid: 'admin-uid',
      drawingId: 'draw-1',
      moderationStatus: 'ACTIVE',
      sketchbookId: 'book-1',
    })).rejects.toBeInstanceOf(ModerationTargetNotFoundError);

    expect(transaction.update).not.toHaveBeenCalled();
    expect(transaction.set).not.toHaveBeenCalled();
  });
});
