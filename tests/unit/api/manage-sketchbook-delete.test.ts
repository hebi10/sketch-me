import { vi } from 'vitest';

const {
  deleteFiles,
  deleteSketchbookDeletionJob,
  deleteSketchbookPermanently,
  getAdminStorage,
  getManagedSketchbook,
  findVisibleBestDrawing,
  markSketchbookDeletionStarted,
  operations,
  prepareSketchbookDeletion,
  clearOwnerBestDrawing,
  setOwnerBestDrawing,
  updateSketchbookShareThumbnailMode,
  updateSketchbookStoryHeading,
} = vi.hoisted(() => ({
  deleteFiles: vi.fn(),
  deleteSketchbookDeletionJob: vi.fn(),
  deleteSketchbookPermanently: vi.fn(),
  getAdminStorage: vi.fn(),
  getManagedSketchbook: vi.fn(),
  findVisibleBestDrawing: vi.fn(),
  markSketchbookDeletionStarted: vi.fn(),
  operations: [] as string[],
  prepareSketchbookDeletion: vi.fn(),
  clearOwnerBestDrawing: vi.fn(),
  setOwnerBestDrawing: vi.fn(),
  updateSketchbookShareThumbnailMode: vi.fn(),
  updateSketchbookStoryHeading: vi.fn(),
}));

vi.mock('@/lib/firebase/admin', () => ({ getAdminStorage }));
vi.mock('@/lib/sketchbooks/management', () => ({ getManagedSketchbook, prepareSketchbookDeletion }));
vi.mock('@/lib/sketchbooks/repository', () => ({
  deleteSketchbookDeletionJob,
  deleteSketchbookPermanently,
  markSketchbookDeletionStarted,
  clearOwnerBestDrawing,
  findVisibleBestDrawing,
  setOwnerBestDrawing,
  updateSketchbookShareThumbnailMode,
  updateSketchbookStoryHeading,
}));

import { DELETE, PATCH } from '@/app/api/manage/[publicId]/sketchbook/route';

const request = new Request('http://localhost/api/manage/public-1/sketchbook', { method: 'DELETE' });
const context = { params: Promise.resolve({ publicId: 'public-1' }) };

describe('DELETE /api/manage/:publicId/sketchbook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    operations.length = 0;
    prepareSketchbookDeletion.mockImplementation(async () => {
      operations.push('preserve-authorization');
      return { id: 'book-1', publicId: 'public-1' };
    });
    markSketchbookDeletionStarted.mockImplementation(async () => { operations.push('mark-deleted'); });
    deleteFiles.mockImplementation(async () => { operations.push('delete-storage'); });
    deleteSketchbookPermanently.mockImplementation(async () => { operations.push('delete-firestore'); });
    deleteSketchbookDeletionJob.mockImplementation(async () => { operations.push('remove-authorization'); });
    getAdminStorage.mockReturnValue({ bucket: vi.fn(() => ({ deleteFiles })) });
  });

  it('공개 상태를 먼저 숨긴 뒤 Storage와 Firestore를 순서대로 정리한다', async () => {
    const response = await DELETE(request, context);

    expect(response.status).toBe(200);
    expect(operations).toEqual([
      'preserve-authorization',
      'mark-deleted',
      'delete-storage',
      'delete-firestore',
      'remove-authorization',
    ]);
    expect(prepareSketchbookDeletion).toHaveBeenCalledWith('public-1');
    expect(markSketchbookDeletionStarted).toHaveBeenCalledWith('book-1');
    expect(deleteFiles).toHaveBeenCalledWith({ prefix: 'sketchbooks/book-1/' });
    expect(response.headers.get('set-cookie')).toContain('sketchbook_manage_token=;');
  });

  it('Storage 삭제가 실패하면 세션을 유지하고 같은 요청으로 처음부터 재시도할 수 있다', async () => {
    deleteFiles
      .mockImplementationOnce(async () => {
        operations.push('delete-storage');
        throw new Error('temporary storage failure');
      })
      .mockImplementationOnce(async () => { operations.push('delete-storage'); });

    const failedResponse = await DELETE(request, context);

    expect(failedResponse.status).toBe(500);
    expect(failedResponse.headers.get('set-cookie')).toBeNull();
    expect(deleteSketchbookPermanently).not.toHaveBeenCalled();
    expect(operations).toEqual(['preserve-authorization', 'mark-deleted', 'delete-storage']);

    const retriedResponse = await DELETE(request, context);

    expect(retriedResponse.status).toBe(200);
    expect(prepareSketchbookDeletion).toHaveBeenCalledTimes(2);
    expect(operations).toEqual([
      'preserve-authorization',
      'mark-deleted',
      'delete-storage',
      'preserve-authorization',
      'mark-deleted',
      'delete-storage',
      'delete-firestore',
      'remove-authorization',
    ]);
  });

  it('재귀 삭제가 루트와 세션을 지운 뒤 실패해도 외부 보존 권한으로 재시도한다', async () => {
    prepareSketchbookDeletion
      .mockResolvedValueOnce({ id: 'book-1', publicId: 'public-1', source: 'sketchbook' })
      .mockResolvedValueOnce({ id: 'book-1', publicId: 'public-1', source: 'deletion-job' });
    deleteSketchbookPermanently
      .mockImplementationOnce(async () => {
        operations.push('delete-firestore-partial');
        throw new Error('recursive delete removed root before reporting a child failure');
      })
      .mockImplementationOnce(async () => { operations.push('delete-firestore'); });

    const failedResponse = await DELETE(request, context);

    expect(failedResponse.status).toBe(500);
    expect(deleteSketchbookDeletionJob).not.toHaveBeenCalled();

    const retriedResponse = await DELETE(request, context);

    expect(retriedResponse.status).toBe(200);
    expect(prepareSketchbookDeletion).toHaveBeenCalledTimes(2);
    await expect(prepareSketchbookDeletion.mock.results[1]?.value).resolves.toEqual({
      id: 'book-1',
      publicId: 'public-1',
      source: 'deletion-job',
    });
    expect(deleteSketchbookDeletionJob).toHaveBeenCalledWith('public-1');
  });

  it('삭제 시작 상태 기록이 실패하면 바이너리 삭제를 시작하지 않는다', async () => {
    markSketchbookDeletionStarted.mockRejectedValue(new Error('firestore unavailable'));

    const response = await DELETE(request, context);

    expect(response.status).toBe(500);
    expect(deleteFiles).not.toHaveBeenCalled();
    expect(deleteSketchbookPermanently).not.toHaveBeenCalled();
  });
});

describe('PATCH /api/manage/:publicId/sketchbook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getManagedSketchbook.mockResolvedValue({ id: 'book-1' });
    clearOwnerBestDrawing.mockResolvedValue(undefined);
    setOwnerBestDrawing.mockResolvedValue(undefined);
    updateSketchbookStoryHeading.mockResolvedValue(undefined);
    updateSketchbookShareThumbnailMode.mockResolvedValue(undefined);
    findVisibleBestDrawing.mockResolvedValue({ id: 'drawing-1' });
  });

  it('관리 중인 사용자가 제목을 저장하면 공백을 정리해 영구 반영한다', async () => {
    const response = await PATCH(new Request('http://localhost/api/manage/public-1/sketchbook', {
      body: JSON.stringify({ storyHeading: '  우리들의 소중한 추억  ' }),
      headers: { 'Content-Type': 'application/json' },
      method: 'PATCH',
    }), context);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ storyHeading: '우리들의 소중한 추억' });
    expect(updateSketchbookStoryHeading).toHaveBeenCalledWith('book-1', '우리들의 소중한 추억');
  });

  it('내 그림의 BEST 순위를 지정하거나 해제한다', async () => {
    const rankedResponse = await PATCH(new Request('http://localhost/api/manage/public-1/sketchbook', {
      body: JSON.stringify({ ownerBestRank: 2 }),
      headers: { 'Content-Type': 'application/json' },
      method: 'PATCH',
    }), context);
    const clearedResponse = await PATCH(new Request('http://localhost/api/manage/public-1/sketchbook', {
      body: JSON.stringify({ ownerBestRank: null }),
      headers: { 'Content-Type': 'application/json' },
      method: 'PATCH',
    }), context);

    expect(rankedResponse.status).toBe(200);
    await expect(rankedResponse.json()).resolves.toEqual({ ownerBestRank: 2 });
    expect(setOwnerBestDrawing).toHaveBeenCalledWith('book-1', 2);
    expect(clearedResponse.status).toBe(200);
    await expect(clearedResponse.json()).resolves.toEqual({ ownerBestRank: null });
    expect(clearOwnerBestDrawing).toHaveBeenCalledWith('book-1');
  });

  it('기본 이미지, 존재하는 내 그림 또는 공개 중인 1위 그림을 링크 공유 썸네일로 저장한다', async () => {
    getManagedSketchbook.mockResolvedValue({
      id: 'book-1',
      ownerDrawingPath: 'sketchbooks/book-1/owner/original.webp',
    });

    for (const shareThumbnailMode of ['DEFAULT', 'OWNER', 'BEST_1']) {
      const response = await PATCH(new Request('http://localhost/api/manage/public-1/sketchbook', {
        body: JSON.stringify({ shareThumbnailMode }),
        headers: { 'Content-Type': 'application/json' },
        method: 'PATCH',
      }), context);

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ shareThumbnailMode });
      expect(updateSketchbookShareThumbnailMode).toHaveBeenCalledWith('book-1', shareThumbnailMode);
    }
    expect(findVisibleBestDrawing).toHaveBeenCalledWith('book-1', 1);
  });

  it('원본이 없거나 허용되지 않은 링크 공유 썸네일 설정을 거부한다', async () => {
    getManagedSketchbook.mockResolvedValue({ id: 'book-1', ownerDrawingPath: null });
    findVisibleBestDrawing.mockResolvedValue(null);

    for (const shareThumbnailMode of ['OWNER', 'BEST_1', 'RECENT']) {
      const response = await PATCH(new Request('http://localhost/api/manage/public-1/sketchbook', {
        body: JSON.stringify({ shareThumbnailMode }),
        headers: { 'Content-Type': 'application/json' },
        method: 'PATCH',
      }), context);

      expect([400, 409]).toContain(response.status);
    }
    expect(updateSketchbookShareThumbnailMode).not.toHaveBeenCalled();
  });

  it('내 그림에는 BEST 1부터 4까지만 지정할 수 있다', async () => {
    const response = await PATCH(new Request('http://localhost/api/manage/public-1/sketchbook', {
      body: JSON.stringify({ ownerBestRank: 5 }),
      headers: { 'Content-Type': 'application/json' },
      method: 'PATCH',
    }), context);

    expect(response.status).toBe(400);
    expect(setOwnerBestDrawing).not.toHaveBeenCalled();
  });

  it('빈 제목과 30자를 넘는 제목을 저장하지 않는다', async () => {
    for (const storyHeading of ['   ', '가'.repeat(31)]) {
      const response = await PATCH(new Request('http://localhost/api/manage/public-1/sketchbook', {
        body: JSON.stringify({ storyHeading }),
        headers: { 'Content-Type': 'application/json' },
        method: 'PATCH',
      }), context);

      expect(response.status).toBe(400);
    }
    expect(updateSketchbookStoryHeading).not.toHaveBeenCalled();
  });

  it('관리 권한이 없으면 제목을 저장하지 않는다', async () => {
    getManagedSketchbook.mockResolvedValue(null);

    const response = await PATCH(new Request('http://localhost/api/manage/public-1/sketchbook', {
      body: JSON.stringify({ storyHeading: '우리들의 소중한 추억' }),
      headers: { 'Content-Type': 'application/json' },
      method: 'PATCH',
    }), context);

    expect(response.status).toBe(403);
    expect(updateSketchbookStoryHeading).not.toHaveBeenCalled();
  });
});
