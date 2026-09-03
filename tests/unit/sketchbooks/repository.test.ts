import { vi } from 'vitest';

import { hashManageToken } from '@/lib/sketchbooks/manage-session';

const { getAdminFirestore } = vi.hoisted(() => ({ getAdminFirestore: vi.fn() }));

vi.mock('@/lib/firebase/admin', () => ({ getAdminFirestore }));

import {
  createAdminSketchbookDeletionJob,
  createSketchbookDeletionJob,
  deleteAdminSketchbookDeletionJob,
  deleteDrawingForManagement,
  deleteSketchbookDeletionJob,
  DrawingPublicPromotionBlockedError,
  findSketchbookByPublicId,
  findVisibleBestDrawing,
  findSketchbookDeletionTargetById,
  listVisibleDrawings,
  markSketchbookDeletionStarted,
  saveDrawingWithinLimit,
  setOwnerBestDrawing,
  setBestDrawing,
  updateOwnerDrawingForManagement,
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

  it('스케치북 문서의 링크 공유 썸네일 설정을 도메인 값으로 복원한다', async () => {
    const get = vi.fn().mockResolvedValue({
      docs: [{ data: () => ({ ...sketchbook, shareThumbnailMode: 'BEST_1' }), id: sketchbook.id }],
      empty: false,
    });
    const limit = vi.fn(() => ({ get }));
    const where = vi.fn(() => ({ limit }));
    getAdminFirestore.mockReturnValue({ collection: vi.fn(() => ({ where })) });

    await expect(findSketchbookByPublicId('public-1')).resolves.toEqual(
      expect.objectContaining({ shareThumbnailMode: 'BEST_1' }),
    );
  });

  it('숨김 또는 운영자 차단된 1위 그림은 링크 공유 썸네일 후보에서 제외한다', async () => {
    for (const unavailableDrawing of [
      { ...drawing, bestRank: 1, status: 'HIDDEN' as const },
      { ...drawing, bestRank: 1, moderationStatus: 'BLOCKED' as const },
    ]) {
      const get = vi.fn().mockResolvedValue({
        docs: [{ data: () => unavailableDrawing, id: unavailableDrawing.id }],
      });
      const limit = vi.fn(() => ({ get }));
      const where = vi.fn(() => ({ limit }));
      getAdminFirestore.mockReturnValue({
        collection: vi.fn(() => ({
          doc: vi.fn(() => ({ collection: vi.fn(() => ({ where })) })),
        })),
      });

      await expect(findVisibleBestDrawing('book-1', 1)).resolves.toBeNull();
      expect(where).toHaveBeenCalledWith('bestRank', '==', 1);
    }
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

  it('새 친구 그림은 제출 트랜잭션에서 가장 낮은 빈 BEST 순위를 자동으로 받는다', async () => {
    const sketchbookReference = { id: 'book-1', kind: 'sketchbook' };
    const drawingReference = { id: 'drawing-1', kind: 'drawing' };
    const rankedQuery = { kind: 'ranked-query' };
    const drawingsCollection = {
      doc: vi.fn(() => drawingReference),
      where: vi.fn(() => rankedQuery),
    };
    const transaction = {
      get: vi.fn(async (reference: { kind: string }) => reference.kind === 'sketchbook'
        ? {
            data: () => ({
              moderationStatus: 'ACTIVE',
              ownerBestRank: 1,
              participantCount: 2,
              participantLimit: 20,
              status: 'PUBLIC',
            }),
            exists: true,
          }
        : {
            docs: [
              { data: () => ({ bestRank: 1 }) },
              { data: () => ({ bestRank: 3 }) },
            ],
          }),
      set: vi.fn(),
      update: vi.fn(),
    };
    getAdminFirestore.mockReturnValue({
      collection: vi.fn(() => ({
        doc: vi.fn(() => ({
          ...sketchbookReference,
          collection: vi.fn(() => drawingsCollection),
        })),
      })),
      runTransaction: vi.fn(async (callback: (value: typeof transaction) => Promise<void>) => callback(transaction)),
    });

    await saveDrawingWithinLimit(sketchbook, drawing);

    expect(drawingsCollection.where).toHaveBeenCalledWith('bestRank', 'in', [1, 2, 3, 4]);
    expect(transaction.set).toHaveBeenCalledWith(drawingReference, {
      ...drawing,
      bestRank: 2,
    });
  });

  it('순위가 없는 소유자 그림을 1위로 지정하면 기존 친구 그림을 아래로 밀고 4위를 해제한다', async () => {
    const sketchbookReference = { id: 'book-1', kind: 'sketchbook' };
    const friendReferences = [1, 2, 3, 4].map((rank) => ({ id: `friend-${rank}` }));
    const rankedQuery = { kind: 'ranked' };
    const drawingsCollection = { where: vi.fn(() => rankedQuery) };
    const transaction = {
      get: vi.fn(async (reference: { kind: string }) => reference.kind === 'sketchbook'
        ? { data: () => ({ ownerBestRank: null, ownerDrawingPath: 'sketchbooks/book-1/owner/original.webp' }), exists: true }
        : {
            docs: friendReferences.map((ref, index) => ({
              data: () => ({ bestRank: index + 1 }),
              id: ref.id,
              ref,
            })),
          }),
      update: vi.fn(),
    };
    getAdminFirestore.mockReturnValue({
      collection: vi.fn(() => ({
        doc: vi.fn(() => ({
          ...sketchbookReference,
          collection: vi.fn(() => drawingsCollection),
        })),
      })),
      runTransaction: vi.fn(async (callback: (value: typeof transaction) => Promise<void>) => callback(transaction)),
    });

    await setOwnerBestDrawing('book-1', 1);

    expect(drawingsCollection.where).toHaveBeenCalledWith('bestRank', 'in', [1, 2, 3, 4]);
    expect(transaction.update).toHaveBeenCalledWith(friendReferences[0], { bestRank: 2, updatedAt: expect.any(Date) });
    expect(transaction.update).toHaveBeenCalledWith(friendReferences[1], { bestRank: 3, updatedAt: expect.any(Date) });
    expect(transaction.update).toHaveBeenCalledWith(friendReferences[2], { bestRank: 4, updatedAt: expect.any(Date) });
    expect(transaction.update).toHaveBeenCalledWith(friendReferences[3], { bestRank: null, updatedAt: expect.any(Date) });
    expect(transaction.update).toHaveBeenCalledWith(expect.objectContaining(sketchbookReference), {
      ownerBestRank: 1,
      updatedAt: expect.any(Date),
    });
  });

  it('친구 그림을 BEST로 지정하면 같은 순위의 소유자 그림을 다음 순위로 민다', async () => {
    const sketchbookReference = { id: 'book-1', kind: 'sketchbook' };
    const target = { id: 'drawing-1', kind: 'target' };
    const rankedQuery = { kind: 'ranked' };
    const drawingsCollection = {
      doc: vi.fn(() => target),
      where: vi.fn(() => rankedQuery),
    };
    const transaction = {
      get: vi.fn(async (reference: { kind: string }) => {
        if (reference.kind === 'sketchbook') return { data: () => ({ ownerBestRank: 3 }), exists: true };
        if (reference.kind === 'target') return { data: () => ({ moderationStatus: 'ACTIVE', status: 'VISIBLE' }), exists: true };
        return { docs: [] };
      }),
      update: vi.fn(),
    };
    getAdminFirestore.mockReturnValue({
      collection: vi.fn(() => ({
        doc: vi.fn(() => ({
          ...sketchbookReference,
          collection: vi.fn(() => drawingsCollection),
        })),
      })),
      runTransaction: vi.fn(async (callback: (value: typeof transaction) => Promise<void>) => callback(transaction)),
    });

    await setBestDrawing('book-1', 'drawing-1', 3);

    expect(transaction.update).toHaveBeenCalledWith(expect.objectContaining(sketchbookReference), {
      ownerBestRank: 4,
      updatedAt: expect.any(Date),
    });
    expect(transaction.update).toHaveBeenCalledWith(target, {
      bestRank: 3,
      updatedAt: expect.any(Date),
    });
  });

  it('기존 1위 친구 그림을 3위로 옮기면 중간 순위를 위로 당긴다', async () => {
    const sketchbookReference = { id: 'book-1', kind: 'sketchbook' };
    const target = { id: 'drawing-1', kind: 'target' };
    const friend2 = { id: 'drawing-2' };
    const friend3 = { id: 'drawing-3' };
    const friend4 = { id: 'drawing-4' };
    const rankedQuery = { kind: 'ranked' };
    const drawingsCollection = {
      doc: vi.fn(() => target),
      where: vi.fn(() => rankedQuery),
    };
    const transaction = {
      get: vi.fn(async (reference: { kind: string }) => {
        if (reference.kind === 'sketchbook') return { data: () => ({ ownerBestRank: null }), exists: true };
        if (reference.kind === 'target') return { data: () => ({ bestRank: 1, moderationStatus: 'ACTIVE', status: 'VISIBLE' }), exists: true };
        return {
          docs: [
            { data: () => ({ bestRank: 1 }), id: target.id, ref: target },
            { data: () => ({ bestRank: 2 }), id: friend2.id, ref: friend2 },
            { data: () => ({ bestRank: 3 }), id: friend3.id, ref: friend3 },
            { data: () => ({ bestRank: 4 }), id: friend4.id, ref: friend4 },
          ],
        };
      }),
      update: vi.fn(),
    };
    getAdminFirestore.mockReturnValue({
      collection: vi.fn(() => ({
        doc: vi.fn(() => ({
          ...sketchbookReference,
          collection: vi.fn(() => drawingsCollection),
        })),
      })),
      runTransaction: vi.fn(async (callback: (value: typeof transaction) => Promise<void>) => callback(transaction)),
    });

    await setBestDrawing('book-1', target.id, 3);

    expect(drawingsCollection.where).toHaveBeenCalledWith('bestRank', 'in', [1, 2, 3, 4]);
    expect(transaction.update).toHaveBeenCalledWith(friend2, { bestRank: 1, updatedAt: expect.any(Date) });
    expect(transaction.update).toHaveBeenCalledWith(friend3, { bestRank: 2, updatedAt: expect.any(Date) });
    expect(transaction.update).not.toHaveBeenCalledWith(friend4, expect.anything());
    expect(transaction.update).toHaveBeenCalledWith(target, { bestRank: 3, updatedAt: expect.any(Date) });
  });

  it('기존 3위 친구 그림을 1위로 옮기면 중간 순위를 아래로 민다', async () => {
    const sketchbookReference = { id: 'book-1', kind: 'sketchbook' };
    const target = { id: 'drawing-3', kind: 'target' };
    const friend1 = { id: 'drawing-1' };
    const friend2 = { id: 'drawing-2' };
    const friend4 = { id: 'drawing-4' };
    const rankedQuery = { kind: 'ranked' };
    const drawingsCollection = {
      doc: vi.fn(() => target),
      where: vi.fn(() => rankedQuery),
    };
    const transaction = {
      get: vi.fn(async (reference: { kind: string }) => {
        if (reference.kind === 'sketchbook') return { data: () => ({ ownerBestRank: null }), exists: true };
        if (reference.kind === 'target') return { data: () => ({ bestRank: 3, moderationStatus: 'ACTIVE', status: 'VISIBLE' }), exists: true };
        return {
          docs: [
            { data: () => ({ bestRank: 1 }), id: friend1.id, ref: friend1 },
            { data: () => ({ bestRank: 2 }), id: friend2.id, ref: friend2 },
            { data: () => ({ bestRank: 3 }), id: target.id, ref: target },
            { data: () => ({ bestRank: 4 }), id: friend4.id, ref: friend4 },
          ],
        };
      }),
      update: vi.fn(),
    };
    getAdminFirestore.mockReturnValue({
      collection: vi.fn(() => ({
        doc: vi.fn(() => ({
          ...sketchbookReference,
          collection: vi.fn(() => drawingsCollection),
        })),
      })),
      runTransaction: vi.fn(async (callback: (value: typeof transaction) => Promise<void>) => callback(transaction)),
    });

    await setBestDrawing('book-1', target.id, 1);

    expect(transaction.update).toHaveBeenCalledWith(friend1, { bestRank: 2, updatedAt: expect.any(Date) });
    expect(transaction.update).toHaveBeenCalledWith(friend2, { bestRank: 3, updatedAt: expect.any(Date) });
    expect(transaction.update).not.toHaveBeenCalledWith(friend4, expect.anything());
    expect(transaction.update).toHaveBeenCalledWith(target, { bestRank: 1, updatedAt: expect.any(Date) });
  });

  it('다섯 번째 그림부터는 빈 BEST 자리가 있어도 자동 순위를 배정하지 않는다', async () => {
    const sketchbookReference = { id: 'book-1', kind: 'sketchbook' };
    const drawingReference = { id: 'drawing-1', kind: 'drawing' };
    const rankedQuery = { kind: 'ranked-query' };
    const drawingsCollection = {
      doc: vi.fn(() => drawingReference),
      where: vi.fn(() => rankedQuery),
    };
    const transaction = {
      get: vi.fn(async (reference: { kind: string }) => reference.kind === 'sketchbook'
        ? {
            data: () => ({
              moderationStatus: 'ACTIVE',
              participantCount: 4,
              participantLimit: 20,
              status: 'PUBLIC',
            }),
            exists: true,
          }
        : { docs: [{ data: () => ({ bestRank: 1 }) }] }),
      set: vi.fn(),
      update: vi.fn(),
    };
    getAdminFirestore.mockReturnValue({
      collection: vi.fn(() => ({
        doc: vi.fn(() => ({
          ...sketchbookReference,
          collection: vi.fn(() => drawingsCollection),
        })),
      })),
      runTransaction: vi.fn(async (callback: (value: typeof transaction) => Promise<void>) => callback(transaction)),
    });

    await saveDrawingWithinLimit(sketchbook, drawing);

    expect(drawingsCollection.where).not.toHaveBeenCalled();
    expect(transaction.set).toHaveBeenCalledWith(drawingReference, drawing);
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

  it('관리자 영구 삭제 대상은 문서 ID와 공개 ID, 조회 출처만 반환한다', async () => {
    const get = vi.fn().mockResolvedValue({
      data: () => ({ managePinHash: 'secret-hash', name: '해비', publicId: 'public-1' }),
      exists: true,
    });
    getAdminFirestore.mockReturnValue({
      collection: vi.fn(() => ({ doc: vi.fn(() => ({ get })) })),
    });

    await expect(findSketchbookDeletionTargetById('book-1')).resolves.toEqual({
      id: 'book-1',
      publicId: 'public-1',
      source: 'sketchbook',
    });
  });

  it('루트가 지워진 관리자 영구 삭제 대상은 외부 작업 문서에서 복구한다', async () => {
    const sketchbookGet = vi.fn().mockResolvedValue({ data: () => undefined, exists: false });
    const jobGet = vi.fn().mockResolvedValue({
      data: () => ({ publicId: 'public-1', sketchbookId: 'book-1' }),
      exists: true,
    });
    getAdminFirestore.mockReturnValue({
      collection: vi.fn((name: string) => ({
        doc: vi.fn(() => ({ get: name === 'sketchbooks' ? sketchbookGet : jobGet })),
      })),
    });

    await expect(findSketchbookDeletionTargetById('book-1')).resolves.toEqual({
      id: 'book-1',
      publicId: 'public-1',
      source: 'admin-deletion-job',
    });
  });

  it('루트와 외부 작업 문서가 없으면 관리자 영구 삭제 대상을 반환하지 않는다', async () => {
    const get = vi.fn().mockResolvedValue({ data: () => undefined, exists: false });
    getAdminFirestore.mockReturnValue({
      collection: vi.fn(() => ({ doc: vi.fn(() => ({ get })) })),
    });

    await expect(findSketchbookDeletionTargetById('missing')).resolves.toBeNull();
  });

  it('관리자 삭제 재시도 작업을 보존하고 완료 후 제거한다', async () => {
    const set = vi.fn();
    const deleteDocument = vi.fn();
    const doc = vi.fn(() => ({ delete: deleteDocument, set }));
    const collection = vi.fn(() => ({ doc }));
    getAdminFirestore.mockReturnValue({ collection });

    await createAdminSketchbookDeletionJob({
      adminUid: 'admin-uid',
      publicId: 'public-1',
      sketchbookId: 'book-1',
    });
    await deleteAdminSketchbookDeletionJob('book-1');

    expect(collection).toHaveBeenCalledWith('adminSketchbookDeletionJobs');
    expect(set).toHaveBeenCalledWith({
      adminUid: 'admin-uid',
      createdAt: expect.any(Date),
      publicId: 'public-1',
      sketchbookId: 'book-1',
    }, { merge: true });
    expect(deleteDocument).toHaveBeenCalledOnce();
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

  it('관리자가 교체한 소유자 그림 경로와 수정 시각을 함께 저장한다', async () => {
    const update = vi.fn();
    getAdminFirestore.mockReturnValue({
      collection: vi.fn(() => ({ doc: vi.fn(() => ({ update })) })),
    });

    await updateOwnerDrawingForManagement('book-1', 'sketchbooks/book-1/owner/original.webp');

    expect(update).toHaveBeenCalledWith({
      ownerDrawingPath: 'sketchbooks/book-1/owner/original.webp',
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
