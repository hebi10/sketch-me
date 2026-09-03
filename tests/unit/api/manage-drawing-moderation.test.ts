import { vi } from 'vitest';

const {
  clearBestDrawing,
  deleteDrawingForManagement,
  getAdminStorage,
  getManagedSketchbook,
  setBestDrawing,
  updateDrawingForManagement,
} = vi.hoisted(() => ({
  clearBestDrawing: vi.fn(),
  deleteDrawingForManagement: vi.fn(),
  getAdminStorage: vi.fn(),
  getManagedSketchbook: vi.fn(),
  setBestDrawing: vi.fn(),
  updateDrawingForManagement: vi.fn(),
}));

vi.mock('@/lib/firebase/admin', () => ({ getAdminStorage }));
vi.mock('@/lib/sketchbooks/management', () => ({ getManagedSketchbook }));
vi.mock('@/lib/sketchbooks/repository', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/sketchbooks/repository')>();
  return {
    ...actual,
    clearBestDrawing,
    deleteDrawingForManagement,
    setBestDrawing,
    updateDrawingForManagement,
  };
});

import { DELETE, PATCH } from '@/app/api/manage/[publicId]/drawings/[drawingId]/route';
import { DrawingPublicPromotionBlockedError } from '@/lib/sketchbooks/repository';

const context = {
  params: Promise.resolve({ drawingId: 'drawing-1', publicId: 'public-1' }),
};

function patchRequest(action: string, bestRank?: number) {
  return new Request('http://localhost/api/manage/public-1/drawings/drawing-1', {
    body: JSON.stringify({ action, bestRank }),
    headers: { 'Content-Type': 'application/json' },
    method: 'PATCH',
  });
}

describe('관리 그림 운영 상태 경계', () => {
  const fileDelete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    getManagedSketchbook.mockResolvedValue({ id: 'book-1' });
    getAdminStorage.mockReturnValue({
      bucket: vi.fn(() => ({ file: vi.fn(() => ({ delete: fileDelete })) })),
    });
    clearBestDrawing.mockResolvedValue(undefined);
    deleteDrawingForManagement.mockResolvedValue({
      imagePath: 'sketchbooks/book-1/drawings/drawing-1/original.webp',
      thumbnailPath: 'sketchbooks/book-1/drawings/drawing-1/thumbnail.webp',
    });
    setBestDrawing.mockResolvedValue(undefined);
    updateDrawingForManagement.mockResolvedValue(undefined);
  });

  it.each([
    { action: 'show', operation: updateDrawingForManagement },
    { action: 'best', bestRank: 1, operation: setBestDrawing },
  ])('BLOCKED 그림을 $action로 공개 승격하는 직접 PATCH를 409로 거부한다', async ({ action, bestRank, operation }) => {
    operation.mockRejectedValue(new DrawingPublicPromotionBlockedError());

    const response = await PATCH(patchRequest(action, bestRank), context);

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      message: '운영자가 차단한 그림은 공개할 수 없습니다.',
    });
  });

  it.each([
    { action: 'hide', operation: updateDrawingForManagement },
    { action: 'clearBest', operation: clearBestDrawing },
  ])('BLOCKED 그림의 비공개 방향 $action 요청은 유지한다', async ({ action, operation }) => {
    const response = await PATCH(patchRequest(action), context);

    expect(response.status).toBe(200);
    expect(operation).toHaveBeenCalled();
  });

  it('BLOCKED 그림도 기존 관리 삭제 흐름을 유지한다', async () => {
    const response = await DELETE(new Request('http://localhost'), context);

    expect(response.status).toBe(200);
    expect(deleteDrawingForManagement).toHaveBeenCalledWith('book-1', 'drawing-1', {
      restoreSubmissionQuota: false,
    });
    expect(fileDelete).toHaveBeenCalledTimes(2);
    expect(fileDelete).toHaveBeenNthCalledWith(1, { ignoreNotFound: true });
    expect(fileDelete).toHaveBeenNthCalledWith(2, { ignoreNotFound: true });
  });

  it('관리자가 선택한 제출 횟수 복구 여부를 삭제 트랜잭션에 전달한다', async () => {
    const request = new Request('http://localhost', {
      body: JSON.stringify({ restoreSubmissionQuota: true }),
      headers: { 'Content-Type': 'application/json' },
      method: 'DELETE',
    });

    const response = await DELETE(request, context);

    expect(response.status).toBe(200);
    expect(deleteDrawingForManagement).toHaveBeenCalledWith('book-1', 'drawing-1', {
      restoreSubmissionQuota: true,
    });
  });
});
