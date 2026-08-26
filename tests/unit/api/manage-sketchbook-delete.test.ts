import { vi } from 'vitest';

const {
  deleteFiles,
  deleteSketchbookPermanently,
  getAdminStorage,
  getManagedSketchbook,
  markSketchbookDeletionStarted,
  operations,
} = vi.hoisted(() => ({
  deleteFiles: vi.fn(),
  deleteSketchbookPermanently: vi.fn(),
  getAdminStorage: vi.fn(),
  getManagedSketchbook: vi.fn(),
  markSketchbookDeletionStarted: vi.fn(),
  operations: [] as string[],
}));

vi.mock('@/lib/firebase/admin', () => ({ getAdminStorage }));
vi.mock('@/lib/sketchbooks/management', () => ({ getManagedSketchbook }));
vi.mock('@/lib/sketchbooks/repository', () => ({
  deleteSketchbookPermanently,
  markSketchbookDeletionStarted,
}));

import { DELETE } from '@/app/api/manage/[publicId]/sketchbook/route';

const request = new Request('http://localhost/api/manage/public-1/sketchbook', { method: 'DELETE' });
const context = { params: Promise.resolve({ publicId: 'public-1' }) };
const sketchbook = { id: 'book-1', publicId: 'public-1', status: 'PUBLIC' };

describe('DELETE /api/manage/:publicId/sketchbook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    operations.length = 0;
    getManagedSketchbook.mockResolvedValue(sketchbook);
    markSketchbookDeletionStarted.mockImplementation(async () => { operations.push('mark-deleted'); });
    deleteFiles.mockImplementation(async () => { operations.push('delete-storage'); });
    deleteSketchbookPermanently.mockImplementation(async () => { operations.push('delete-firestore'); });
    getAdminStorage.mockReturnValue({ bucket: vi.fn(() => ({ deleteFiles })) });
  });

  it('공개 상태를 먼저 숨긴 뒤 Storage와 Firestore를 순서대로 정리한다', async () => {
    const response = await DELETE(request, context);

    expect(response.status).toBe(200);
    expect(operations).toEqual(['mark-deleted', 'delete-storage', 'delete-firestore']);
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
    expect(operations).toEqual(['mark-deleted', 'delete-storage']);

    const retriedResponse = await DELETE(request, context);

    expect(retriedResponse.status).toBe(200);
    expect(getManagedSketchbook).toHaveBeenCalledTimes(2);
    expect(operations).toEqual([
      'mark-deleted',
      'delete-storage',
      'mark-deleted',
      'delete-storage',
      'delete-firestore',
    ]);
  });

  it('삭제 시작 상태 기록이 실패하면 바이너리 삭제를 시작하지 않는다', async () => {
    markSketchbookDeletionStarted.mockRejectedValue(new Error('firestore unavailable'));

    const response = await DELETE(request, context);

    expect(response.status).toBe(500);
    expect(deleteFiles).not.toHaveBeenCalled();
    expect(deleteSketchbookPermanently).not.toHaveBeenCalled();
  });
});
