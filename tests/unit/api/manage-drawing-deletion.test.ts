import { vi } from 'vitest';

const { getAdminFirestore, getAdminStorage, getManagedSketchbook } = vi.hoisted(() => ({
  getAdminFirestore: vi.fn(),
  getAdminStorage: vi.fn(),
  getManagedSketchbook: vi.fn(),
}));

vi.mock('@/lib/firebase/admin', () => ({ getAdminFirestore, getAdminStorage }));
vi.mock('@/lib/sketchbooks/management', () => ({ getManagedSketchbook }));

import { DELETE, PATCH } from '@/app/api/manage/[publicId]/drawings/[drawingId]/route';
import { deleteDrawingForManagement, setBestDrawing, setOwnerBestDrawing } from '@/lib/sketchbooks/repository';

const context = { params: Promise.resolve({ drawingId: 'drawing-1', publicId: 'public-1' }) };
const originalPath = 'sketchbooks/book-1/drawings/drawing-1/original.webp';
const thumbnailPath = 'sketchbooks/book-1/drawings/drawing-1/thumbnail.webp';

function request(method: 'DELETE' | 'PATCH', body: Record<string, unknown> = {}) {
  return new Request('http://localhost/api/manage/public-1/drawings/drawing-1', {
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
    method,
  });
}

function createDrawingStore() {
  const drawing: Record<string, unknown> = {
    bestRank: null,
    imagePath: originalPath,
    moderationStatus: 'ACTIVE',
    publicImageVersion: 'original-version',
    status: 'VISIBLE',
    submissionQuotaRestoredAt: null,
    submissionSourceHash: 'source-1',
    thumbnailPath,
  };
  const deletedDrawing: Record<string, unknown> = { bestRank: null, status: 'DELETED' };
  const sketchbook: Record<string, unknown> = { ownerDrawingPath: 'owner.webp', participantCount: 4 };
  const source: Record<string, unknown> = { submissionCount: 2 };
  const records = { drawing, deletedDrawing, sketchbook, source };
  type RecordKind = keyof typeof records;
  const drawingReference = {
    id: 'drawing-1',
    kind: 'drawing' as const,
    update: vi.fn(async (changes: Record<string, unknown>) => Object.assign(drawing, changes)),
  };
  const deletedReference = { id: 'deleted-1', kind: 'deletedDrawing' as const };
  const sourceReference = { kind: 'source' as const };
  const rankedQuery = { kind: 'ranked' as const };
  const drawingsCollection = { doc: vi.fn(() => drawingReference), where: vi.fn(() => rankedQuery) };
  const sketchbookReference = {
    kind: 'sketchbook' as const,
    collection: vi.fn((name: string) => name === 'drawings'
      ? drawingsCollection
      : { doc: vi.fn(() => sourceReference) }),
  };
  const transaction = {
    get: vi.fn(async (reference: { kind: RecordKind | 'ranked' }) => {
      if (reference.kind === 'ranked') {
        return {
          docs: [drawingReference, deletedReference]
            .filter(({ kind }) => [1, 2, 3, 4].includes(Number(records[kind].bestRank)))
            .map((ref) => ({ data: () => ({ ...records[ref.kind] }), id: ref.id, ref })),
        };
      }
      const data = { ...records[reference.kind] };
      return { data: () => data, exists: true };
    }),
    update: vi.fn((reference: { kind: RecordKind }, changes: Record<string, unknown>) => {
      Object.assign(records[reference.kind], changes);
    }),
  };
  getAdminFirestore.mockReturnValue({
    collection: vi.fn(() => ({ doc: vi.fn(() => sketchbookReference) })),
    runTransaction: vi.fn(async (callback: (value: typeof transaction) => Promise<unknown>) => callback(transaction)),
  });
  return { ...records, transaction };
}

describe('관리 그림 삭제 이후의 상태와 재시도', () => {
  const originalDelete = vi.fn();
  const thumbnailDelete = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    getManagedSketchbook.mockResolvedValue({ id: 'book-1' });
    originalDelete.mockResolvedValue(undefined);
    thumbnailDelete.mockResolvedValue(undefined);
    getAdminStorage.mockReturnValue({
      bucket: vi.fn(() => ({
        file: vi.fn((path: string) => ({ delete: path === originalPath ? originalDelete : thumbnailDelete })),
      })),
    });
  });

  it.each(['hide', 'show', 'clearBest', 'best'])('다른 탭에서 삭제한 그림의 %s를 409로 거부하고 삭제 상태를 유지한다', async (action) => {
    const store = createDrawingStore();
    expect((await DELETE(request('DELETE'), context)).status).toBe(200);
    const deletedState = { ...store.drawing };

    const response = await PATCH(request('PATCH', { action, bestRank: 1 }), context);

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ message: '삭제된 그림은 변경할 수 없습니다. 새로고침해 주세요.' });
    expect(store.drawing).toEqual(deletedState);
    expect(store.sketchbook.participantCount).toBe(3);
  });

  it.each([false, true])('삭제 재시도는 파일 경로만 반환하고 제출 횟수 복구(%s)와 참여 인원을 중복 변경하지 않는다', async (restoreSubmissionQuota) => {
    const store = createDrawingStore();
    await deleteDrawingForManagement('book-1', 'drawing-1', { restoreSubmissionQuota });
    const deletedState = { ...store.drawing };
    const writesAfterDeletion = store.transaction.update.mock.calls.length;

    await expect(deleteDrawingForManagement('book-1', 'drawing-1', { restoreSubmissionQuota: true })).resolves.toEqual({
      imagePath: originalPath,
      thumbnailPath,
    });

    expect(store.drawing).toEqual(deletedState);
    expect(store.sketchbook.participantCount).toBe(3);
    expect(store.source.submissionCount).toBe(restoreSubmissionQuota ? 1 : 2);
    expect(store.transaction.update).toHaveBeenCalledTimes(writesAfterDeletion);
  });

  it('파일 일부 삭제 실패를 재시도 안내로 응답하고 재요청으로 남은 파일만 안전하게 정리한다', async () => {
    const store = createDrawingStore();
    thumbnailDelete.mockRejectedValueOnce(new Error('private bucket detail'));

    const failedResponse = await DELETE(request('DELETE', { restoreSubmissionQuota: true }), context);

    expect(failedResponse.status).toBe(503);
    await expect(failedResponse.json()).resolves.toEqual({
      message: '그림 파일을 모두 정리하지 못했습니다. 삭제를 다시 시도해 주세요.',
    });
    expect(store.drawing.status).toBe('DELETED');

    const retryResponse = await DELETE(request('DELETE', { restoreSubmissionQuota: true }), context);

    expect(retryResponse.status).toBe(200);
    expect(originalDelete).toHaveBeenCalledTimes(2);
    expect(thumbnailDelete).toHaveBeenCalledTimes(2);
    expect(originalDelete).toHaveBeenLastCalledWith({ ignoreNotFound: true });
    expect(thumbnailDelete).toHaveBeenLastCalledWith({ ignoreNotFound: true });
    expect(store.sketchbook.participantCount).toBe(3);
    expect(store.source.submissionCount).toBe(1);
  });

  it.each(['drawing', 'owner'])('%s BEST 순위를 이동할 때 오래된 순위가 남은 삭제 문서는 변경하지 않는다', async (target) => {
    const store = createDrawingStore();
    store.deletedDrawing.bestRank = 1;
    const deletedState = { ...store.deletedDrawing };

    if (target === 'drawing') await setBestDrawing('book-1', 'drawing-1', 1);
    else await setOwnerBestDrawing('book-1', 1);

    expect(store.deletedDrawing).toEqual(deletedState);
    expect(target === 'drawing' ? store.drawing.bestRank : store.sketchbook.ownerBestRank).toBe(1);
  });
});
