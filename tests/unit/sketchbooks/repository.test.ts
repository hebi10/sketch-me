import { vi } from 'vitest';

import { hashManageToken } from '@/lib/sketchbooks/manage-session';

const { getAdminFirestore } = vi.hoisted(() => ({ getAdminFirestore: vi.fn() }));

vi.mock('@/lib/firebase/admin', () => ({ getAdminFirestore }));

import {
  createSketchbookDeletionJob,
  deleteDrawingForManagement,
  deleteSketchbookDeletionJob,
  DrawingPublicPromotionBlockedError,
  listVisibleDrawings,
  markSketchbookDeletionStarted,
  saveDrawingWithinLimit,
  setBestDrawing,
  updateSketchbookStoryHeading,
  updateDrawingForManagement,
} from '@/lib/sketchbooks/repository';

const createdAt = new Date('2026-08-25T00:00:00.000Z');
const sketchbook = {
  createdAt,
  entitlements: { watermarkFree: false },
  id: 'book-1',
  manageTokenHash: 'hash',
  moderatedAt: null,
  moderationStatus: 'ACTIVE' as const,
  name: '해비',
  ownerDrawingPath: null,
  participantCount: 0,
  participantLimit: 20,
  publicId: 'public-1',
  status: 'PUBLIC' as const,
  updatedAt: createdAt,
};
const drawing = {
  authorName: '친구',
  bestRank: null,
  createdAt,
  id: 'active-drawing',
  imagePath: 'sketchbooks/book-1/drawings/active.webp',
  publicImageVersion: 'version-1',
  thumbnailPath: null,
  message: null,
  moderatedAt: null,
  moderationStatus: 'ACTIVE' as const,
  sketchbookId: 'book-1',
  sketchbookName: '해비',
  sketchbookPublicId: 'public-1',
  status: 'VISIBLE' as const,
  updatedAt: createdAt,
};

describe('공개 그림 저장소 운영자 차단', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('VISIBLE 전체 결과에서 BLOCKED 20개 뒤의 ACTIVE 그림도 누락 없이 반환한다', async () => {
    const legacyDrawing = { ...drawing, publicImageVersion: undefined, usedReferenceImage: true };
    const documents = [
      ...Array.from({ length: 20 }, (_, index) => ({
        data: () => ({ ...legacyDrawing, id: `blocked-${index}`, moderationStatus: 'BLOCKED' }),
        id: `blocked-${index}`,
      })),
      { data: () => legacyDrawing, id: drawing.id },
    ];
    const get = vi.fn().mockResolvedValue({ docs: documents });
    const query = {
      get,
      limit: vi.fn(() => ({ get })),
    };
    const orderBy = vi.fn(() => query);
    const where = vi.fn(() => ({ orderBy }));
    getAdminFirestore.mockReturnValue({
      collection: vi.fn(() => ({
        doc: vi.fn(() => ({ collection: vi.fn(() => ({ where })) })),
      })),
    });

    const visibleDrawings = await listVisibleDrawings('book-1');

    expect(visibleDrawings).toEqual([
      expect.objectContaining({
        id: 'active-drawing',
        moderationStatus: 'ACTIVE',
        publicImageVersion: createdAt.getTime().toString(36),
        thumbnailPath: null,
      }),
    ]);
    expect(visibleDrawings[0]).not.toHaveProperty('usedReferenceImage');
    expect(where).toHaveBeenCalledWith('status', '==', 'VISIBLE');
    expect(query.limit).not.toHaveBeenCalled();
  });

  it('제출 트랜잭션은 차단된 스케치북에 그림을 쓰지 않는다', async () => {
    const sketchbookReference = { id: 'book-1' };
    const drawingReference = { id: 'drawing-1' };
    const transaction = {
      get: vi.fn().mockResolvedValue({
        data: () => ({
          moderationStatus: 'BLOCKED',
          participantCount: 0,
          participantLimit: 20,
          status: 'PUBLIC',
        }),
        exists: true,
      }),
      set: vi.fn(),
      update: vi.fn(),
    };
    getAdminFirestore.mockReturnValue({
      collection: vi.fn(() => ({
        doc: vi.fn(() => ({
          ...sketchbookReference,
          collection: vi.fn(() => ({ doc: vi.fn(() => drawingReference) })),
        })),
      })),
      runTransaction: vi.fn(async (callback: (value: typeof transaction) => Promise<void>) => callback(transaction)),
    });

    await expect(saveDrawingWithinLimit(sketchbook, drawing)).rejects.toThrow();
    expect(transaction.set).not.toHaveBeenCalled();
    expect(transaction.update).not.toHaveBeenCalled();
  });

  it('차단된 그림은 공개 중이어도 BEST로 지정하지 않는다', async () => {
    const target = { id: 'drawing-1', kind: 'target' };
    const rankedQuery = { kind: 'ranked' };
    const drawingsCollection = {
      doc: vi.fn(() => target),
      where: vi.fn(() => rankedQuery),
    };
    const transaction = {
      get: vi.fn(async (reference: { kind: string }) => reference.kind === 'target'
        ? {
            data: () => ({ moderationStatus: 'BLOCKED', status: 'VISIBLE' }),
            exists: true,
          }
        : { docs: [] }),
      update: vi.fn(),
    };
    getAdminFirestore.mockReturnValue({
      collection: vi.fn(() => ({
        doc: vi.fn(() => ({ collection: vi.fn(() => drawingsCollection) })),
      })),
      runTransaction: vi.fn(async (callback: (value: typeof transaction) => Promise<void>) => callback(transaction)),
    });

    await expect(setBestDrawing('book-1', 'drawing-1', 1))
      .rejects.toBeInstanceOf(DrawingPublicPromotionBlockedError);
    expect(transaction.update).not.toHaveBeenCalled();
  });

  it('관리자가 차단한 그림을 show해도 최신 문서를 읽는 transaction에서 공개 승격을 거부한다', async () => {
    const drawingReference = { id: 'drawing-1' };
    const transaction = {
      get: vi.fn().mockResolvedValue({
        data: () => ({ moderationStatus: 'BLOCKED', status: 'HIDDEN' }),
        exists: true,
      }),
      update: vi.fn(),
    };
    const runTransaction = vi.fn(async (callback: (value: typeof transaction) => Promise<void>) => callback(transaction));
    getAdminFirestore.mockReturnValue({
      collection: vi.fn(() => ({
        doc: vi.fn(() => ({
          collection: vi.fn(() => ({ doc: vi.fn(() => drawingReference) })),
        })),
      })),
      runTransaction,
    });

    await expect(updateDrawingForManagement('book-1', 'drawing-1', { status: 'VISIBLE' }))
      .rejects.toBeInstanceOf(DrawingPublicPromotionBlockedError);
    expect(transaction.get).toHaveBeenCalledWith(drawingReference);
    expect(transaction.update).not.toHaveBeenCalled();
  });

  it('차단된 그림의 hide는 비공개 방향이므로 허용한다', async () => {
    const update = vi.fn();
    getAdminFirestore.mockReturnValue({
      collection: vi.fn(() => ({
        doc: vi.fn(() => ({
          collection: vi.fn(() => ({ doc: vi.fn(() => ({ update })) })),
        })),
      })),
    });

    await updateDrawingForManagement('book-1', 'drawing-1', { status: 'HIDDEN' });

    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      bestRank: null,
      publicImageVersion: expect.stringMatching(/^[0-9a-f-]{36}$/),
      status: 'HIDDEN',
    }));
  });

  it('그림 삭제는 공개 버전을 바꾸고 원본·썸네일 정리 대상을 함께 반환한다', async () => {
    const sketchbookReference = { id: 'book-1' };
    const drawingReference = { id: 'drawing-1' };
    const transaction = {
      get: vi.fn()
        .mockResolvedValueOnce({ data: () => ({ participantCount: 1 }), exists: true })
        .mockResolvedValueOnce({
          data: () => ({
            imagePath: 'sketchbooks/book-1/drawings/drawing-1/original.webp',
            status: 'VISIBLE',
            thumbnailPath: 'sketchbooks/book-1/drawings/drawing-1/thumbnail.webp',
          }),
          exists: true,
        }),
      update: vi.fn(),
    };
    getAdminFirestore.mockReturnValue({
      collection: vi.fn(() => ({
        doc: vi.fn(() => ({
          ...sketchbookReference,
          collection: vi.fn(() => ({ doc: vi.fn(() => drawingReference) })),
        })),
      })),
      runTransaction: vi.fn(async (callback: (value: typeof transaction) => Promise<unknown>) => callback(transaction)),
    });

    await expect(deleteDrawingForManagement('book-1', 'drawing-1')).resolves.toEqual({
      imagePath: 'sketchbooks/book-1/drawings/drawing-1/original.webp',
      thumbnailPath: 'sketchbooks/book-1/drawings/drawing-1/thumbnail.webp',
    });
    expect(transaction.update).toHaveBeenCalledWith(drawingReference, expect.objectContaining({
      publicImageVersion: expect.stringMatching(/^[0-9a-f-]{36}$/),
      status: 'DELETED',
    }));
  });

  it('전체 삭제 시작 시 공개 접근을 막는 DELETED 상태를 먼저 기록한다', async () => {
    const set = vi.fn();
    const document = { set };
    const doc = vi.fn(() => document);
    const collection = vi.fn(() => ({ doc }));
    getAdminFirestore.mockReturnValue({ collection });

    await markSketchbookDeletionStarted('book-1');

    expect(collection).toHaveBeenCalledWith('sketchbooks');
    expect(doc).toHaveBeenCalledWith('book-1');
    expect(set).toHaveBeenCalledWith(
      { status: 'DELETED', updatedAt: expect.any(Date) },
      { merge: true },
    );
  });

  it('스토리 제목과 수정 시각을 스케치북 문서에 함께 저장한다', async () => {
    const update = vi.fn();
    getAdminFirestore.mockReturnValue({
      collection: vi.fn(() => ({ doc: vi.fn(() => ({ update })) })),
    });

    await updateSketchbookStoryHeading('book-1', '우리들의 소중한 추억');

    expect(update).toHaveBeenCalledWith({
      storyHeading: '우리들의 소중한 추억',
      updatedAt: expect.any(Date),
    });
  });

  it('활성 PIN 세션을 확인한 뒤 삭제 재시도 식별자와 토큰 해시만 외부 문서 하나로 보존한다', async () => {
    const expiresAt = new Date(Date.now() + 60_000);
    const create = vi.fn();
    const sessionGet = vi.fn().mockResolvedValue({
      data: () => ({ expiresAt, tokenHash: hashManageToken('secret-token') }),
      exists: true,
    });
    const collection = vi.fn((name: string) => name === 'sketchbookDeletionJobs'
      ? { doc: vi.fn(() => ({ create })) }
      : {
          doc: vi.fn(() => ({
            collection: vi.fn(() => ({
              doc: vi.fn(() => ({ get: sessionGet })),
            })),
          })),
        });
    getAdminFirestore.mockReturnValue({ collection });

    await createSketchbookDeletionJob(sketchbook, {
      publicId: 'public-1',
      sessionId: 'session-1',
      token: 'secret-token',
      type: 'pin',
    });

    expect(create).toHaveBeenCalledWith({
      createdAt: expect.any(Date),
      publicId: 'public-1',
      sessionId: 'session-1',
      sessionType: 'pin',
      sketchbookId: 'book-1',
      tokenHash: hashManageToken('secret-token'),
    });
  });

  it('전체 삭제 성공 시 외부 재시도 권한 문서를 즉시 제거한다', async () => {
    const deleteDocument = vi.fn();
    const doc = vi.fn(() => ({ delete: deleteDocument }));
    const collection = vi.fn(() => ({ doc }));
    getAdminFirestore.mockReturnValue({ collection });

    await deleteSketchbookDeletionJob('public-1');

    expect(collection).toHaveBeenCalledWith('sketchbookDeletionJobs');
    expect(doc).toHaveBeenCalledWith('public-1');
    expect(deleteDocument).toHaveBeenCalledOnce();
  });
});
