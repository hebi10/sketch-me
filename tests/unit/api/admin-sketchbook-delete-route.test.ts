import { vi } from 'vitest';

const {
  cookies,
  createAdminSketchbookDeletionJob,
  deleteAdminSketchbookDeletionJob,
  deleteFiles,
  deleteSketchbookDeletionJob,
  deleteSketchbookPermanently,
  findSketchbookDeletionTargetById,
  getAdminSessionCookieName,
  getAdminStorage,
  isAllowedAdminOrigin,
  markSketchbookDeletionStarted,
  operations,
  verifyAdminSessionCookie,
} = vi.hoisted(() => ({
  cookies: vi.fn(),
  createAdminSketchbookDeletionJob: vi.fn(),
  deleteAdminSketchbookDeletionJob: vi.fn(),
  deleteFiles: vi.fn(),
  deleteSketchbookDeletionJob: vi.fn(),
  deleteSketchbookPermanently: vi.fn(),
  findSketchbookDeletionTargetById: vi.fn(),
  getAdminSessionCookieName: vi.fn(() => 'admin_session'),
  getAdminStorage: vi.fn(),
  isAllowedAdminOrigin: vi.fn(() => true),
  markSketchbookDeletionStarted: vi.fn(),
  operations: [] as string[],
  verifyAdminSessionCookie: vi.fn(),
}));

vi.mock('next/headers', () => ({ cookies }));
vi.mock('@/lib/admin/auth', () => ({
  getAdminSessionCookieName,
  verifyAdminSessionCookie,
}));
vi.mock('@/lib/admin/origin', () => ({ isAllowedAdminOrigin }));
vi.mock('@/lib/firebase/admin', () => ({ getAdminStorage }));
vi.mock('@/lib/sketchbooks/repository', () => ({
  createAdminSketchbookDeletionJob,
  deleteAdminSketchbookDeletionJob,
  deleteSketchbookDeletionJob,
  deleteSketchbookPermanently,
  findSketchbookDeletionTargetById,
  markSketchbookDeletionStarted,
}));

import { DELETE } from '@/app/api/admin/sketchbooks/[sketchbookId]/route';

const context = { params: Promise.resolve({ sketchbookId: 'book-1' }) };

function deleteRequest(confirmation = 'public-1') {
  return new Request('http://localhost/api/admin/sketchbooks/book-1', {
    body: JSON.stringify({ confirmation }),
    headers: { Origin: 'http://localhost:3000' },
    method: 'DELETE',
  });
}

describe('DELETE /api/admin/sketchbooks/:sketchbookId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    operations.length = 0;
    cookies.mockResolvedValue({
      get: vi.fn(() => ({ value: 'session-cookie' })),
    });
    getAdminSessionCookieName.mockReturnValue('admin_session');
    isAllowedAdminOrigin.mockReturnValue(true);
    verifyAdminSessionCookie.mockResolvedValue({
      email: 'owner@example.com',
      uid: 'admin-uid',
    });
    findSketchbookDeletionTargetById.mockImplementation(async () => {
      operations.push('find-target');
      return { id: 'book-1', publicId: 'public-1', source: 'sketchbook' };
    });
    createAdminSketchbookDeletionJob.mockImplementation(async () => {
      operations.push('preserve-retry-target');
    });
    markSketchbookDeletionStarted.mockImplementation(async () => {
      operations.push('mark-deleted');
    });
    deleteFiles.mockImplementation(async () => {
      operations.push('delete-storage');
    });
    deleteSketchbookDeletionJob.mockImplementation(async () => {
      operations.push('remove-deletion-job');
    });
    deleteAdminSketchbookDeletionJob.mockImplementation(async () => {
      operations.push('remove-admin-deletion-job');
    });
    deleteSketchbookPermanently.mockImplementation(async () => {
      operations.push('delete-firestore');
    });
    getAdminStorage.mockReturnValue({ bucket: vi.fn(() => ({ deleteFiles })) });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('대상을 즉시 숨긴 뒤 파일, 삭제 작업, 모든 하위 문서를 순서대로 영구 삭제한다', async () => {
    const response = await DELETE(deleteRequest(), context);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(operations).toEqual([
      'find-target',
      'preserve-retry-target',
      'mark-deleted',
      'delete-storage',
      'delete-firestore',
      'remove-deletion-job',
      'remove-admin-deletion-job',
    ]);
    expect(createAdminSketchbookDeletionJob).toHaveBeenCalledWith({
      adminUid: 'admin-uid',
      publicId: 'public-1',
      sketchbookId: 'book-1',
    });
    expect(markSketchbookDeletionStarted).toHaveBeenCalledWith('book-1');
    expect(deleteFiles).toHaveBeenCalledWith({ prefix: 'sketchbooks/book-1/' });
    expect(deleteSketchbookDeletionJob).toHaveBeenCalledWith('public-1');
    expect(deleteSketchbookPermanently).toHaveBeenCalledWith('book-1');
    expect(deleteAdminSketchbookDeletionJob).toHaveBeenCalledWith('book-1');
  });

  it('허용되지 않은 Origin을 세션 확인과 삭제 전에 거부한다', async () => {
    isAllowedAdminOrigin.mockReturnValue(false);

    const response = await DELETE(deleteRequest(), context);

    expect(response.status).toBe(403);
    expect(cookies).not.toHaveBeenCalled();
    expect(findSketchbookDeletionTargetById).not.toHaveBeenCalled();
  });

  it('관리자 세션이 없으면 삭제 대상을 조회하지 않는다', async () => {
    verifyAdminSessionCookie.mockResolvedValue(null);

    const response = await DELETE(deleteRequest(), context);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ message: '관리자 로그인이 필요합니다.' });
    expect(findSketchbookDeletionTargetById).not.toHaveBeenCalled();
  });

  it('잘못된 문서 ID를 Firebase 호출 전에 거부한다', async () => {
    const response = await DELETE(deleteRequest(), {
      params: Promise.resolve({ sketchbookId: 'book/escape' }),
    });

    expect(response.status).toBe(400);
    expect(findSketchbookDeletionTargetById).not.toHaveBeenCalled();
  });

  it('삭제 대상이 없으면 404를 반환한다', async () => {
    findSketchbookDeletionTargetById.mockResolvedValue(null);

    const response = await DELETE(deleteRequest(), context);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ message: '대상을 찾을 수 없습니다.' });
    expect(markSketchbookDeletionStarted).not.toHaveBeenCalled();
  });

  it('공개 ID 확인값이 대상과 다르면 삭제를 시작하지 않는다', async () => {
    const response = await DELETE(deleteRequest('different-public-id'), context);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ message: '공개 ID 확인값이 일치하지 않습니다.' });
    expect(createAdminSketchbookDeletionJob).not.toHaveBeenCalled();
    expect(markSketchbookDeletionStarted).not.toHaveBeenCalled();
    expect(deleteFiles).not.toHaveBeenCalled();
  });

  it('중간 실패를 비밀값 없는 오류로 변환하고 남은 삭제를 진행하지 않는다', async () => {
    const secret = 'firebase unavailable: secret-token';
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    deleteFiles.mockRejectedValue(new Error(secret));

    const response = await DELETE(deleteRequest(), context);
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload).toEqual({ message: '스케치북을 완전히 삭제하지 못했습니다.' });
    expect(JSON.stringify(payload)).not.toContain(secret);
    expect(deleteSketchbookDeletionJob).not.toHaveBeenCalled();
    expect(deleteSketchbookPermanently).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith('Admin sketchbook deletion failed', 'Error');
    expect(consoleError.mock.calls.flat().join(' ')).not.toContain(secret);
  });

  it('재귀 삭제가 루트를 지운 뒤 실패해도 보존 작업으로 다시 완료한다', async () => {
    findSketchbookDeletionTargetById
      .mockResolvedValueOnce({ id: 'book-1', publicId: 'public-1', source: 'sketchbook' })
      .mockResolvedValueOnce({ id: 'book-1', publicId: 'public-1', source: 'admin-deletion-job' });
    deleteSketchbookPermanently
      .mockRejectedValueOnce(new Error('partial recursive delete'))
      .mockResolvedValueOnce(undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const failed = await DELETE(deleteRequest(), context);
    const retried = await DELETE(deleteRequest(), context);

    expect(failed.status).toBe(500);
    expect(retried.status).toBe(200);
    expect(createAdminSketchbookDeletionJob).toHaveBeenCalledTimes(1);
    expect(markSketchbookDeletionStarted).toHaveBeenCalledTimes(1);
    expect(deleteFiles).toHaveBeenCalledTimes(2);
    expect(deleteSketchbookPermanently).toHaveBeenCalledTimes(2);
    expect(deleteAdminSketchbookDeletionJob).toHaveBeenCalledTimes(1);
  });
});
