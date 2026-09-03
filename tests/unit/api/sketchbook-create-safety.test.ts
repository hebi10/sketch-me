import { vi } from 'vitest';

const {
  createManagePinSession,
  deleteSketchbookPermanently,
  fileDelete,
  fileSave,
  findSketchbookByPublicId,
  getAdminStorage,
  saveSketchbook,
  storageFile,
} = vi.hoisted(() => ({
  createManagePinSession: vi.fn(),
  deleteSketchbookPermanently: vi.fn(),
  fileDelete: vi.fn(),
  fileSave: vi.fn(),
  findSketchbookByPublicId: vi.fn(),
  getAdminStorage: vi.fn(),
  saveSketchbook: vi.fn(),
  storageFile: vi.fn(),
}));

vi.mock('@/lib/security/app-check-server', () => ({ enforceAppCheck: vi.fn().mockResolvedValue(null) }));
vi.mock('@/lib/security/rate-limit', () => ({ enforcePublicMutationLimit: vi.fn().mockReturnValue(null) }));
vi.mock('@/lib/firebase/admin', () => ({ getAdminStorage }));
vi.mock('@/lib/images/optimize', () => ({
  ImageOptimizationError: class ImageOptimizationError extends Error {},
  optimizeImageForStorage: vi.fn().mockResolvedValue({
    buffer: Buffer.from('optimized'),
    contentType: 'image/webp',
  }),
}));
vi.mock('@/lib/sketchbooks/manage-pin', () => ({ hashManagePin: vi.fn().mockResolvedValue('pin-hash') }));
vi.mock('@/lib/sketchbooks/manage-session', () => ({
  createManageToken: vi.fn(() => 'manage-token'),
  createPinManageCookieValue: vi.fn(() => 'cookie-value'),
  hashManageToken: vi.fn(() => 'token-hash'),
  MANAGE_COOKIE_NAME: 'sketchbook_manage_token',
}));
vi.mock('@/lib/sketchbooks/repository', () => ({
  createManagePinSession,
  deleteSketchbookPermanently,
  findSketchbookByPublicId,
  saveSketchbook,
}));

import { createUniquePublicId, POST } from '@/app/api/sketchbooks/route';

function createRequest(ownerImageDataUrl?: string) {
  return new Request('http://localhost/api/sketchbooks', {
    body: JSON.stringify({
      managePin: '1234',
      name: '해비',
      ...(ownerImageDataUrl ? { ownerImageDataUrl } : {}),
    }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });
}

describe('스케치북 생성 안전성', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findSketchbookByPublicId.mockResolvedValue(null);
    createManagePinSession.mockResolvedValue({ sessionId: 'session-1', token: 'session-token' });
    storageFile.mockReturnValue({ delete: fileDelete, save: fileSave });
    getAdminStorage.mockReturnValue({ bucket: vi.fn(() => ({ file: storageFile })) });
  });

  it('UUID 전체 엔트로피의 공개 ID를 사용하고 저장 전에 중복을 확인한다', async () => {
    const response = await POST(createRequest());

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.manageUrl).toMatch(/^\/m\/[a-f0-9]{32}$/);
    expect(body.publicUrl).toBe(`/s/${body.manageUrl.slice(3)}`);
    expect(findSketchbookByPublicId).toHaveBeenCalledWith(body.manageUrl.slice(3));
    expect(saveSketchbook).toHaveBeenCalledWith(expect.objectContaining({
      publicId: body.manageUrl.slice(3),
    }));
  });

  it('공개 ID가 이미 있으면 새 후보로 재시도한다', async () => {
    const generate = vi.fn()
      .mockReturnValueOnce('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
      .mockReturnValueOnce('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
    const findExisting = vi.fn()
      .mockResolvedValueOnce({ id: 'existing' })
      .mockResolvedValueOnce(null);

    const publicId = await createUniquePublicId(generate, findExisting);

    expect(publicId).toBe('bbbbbbbbbbbb4bbb8bbbbbbbbbbbbbbb');
    expect(findExisting).toHaveBeenNthCalledWith(1, 'aaaaaaaaaaaa4aaa8aaaaaaaaaaaaaaa');
    expect(findExisting).toHaveBeenNthCalledWith(2, 'bbbbbbbbbbbb4bbb8bbbbbbbbbbbbbbb');
  });

  it('관리 세션 생성 실패 시 저장된 스케치북과 업로드 이미지를 함께 정리한다', async () => {
    createManagePinSession.mockRejectedValueOnce(new Error('session database details'));

    const response = await POST(createRequest('data:image/png;base64,aW1hZ2U='));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      message: '스케치북을 만들지 못했어요. 잠시 후 다시 시도해 주세요.',
    });
    expect(deleteSketchbookPermanently).toHaveBeenCalledWith(saveSketchbook.mock.calls[0][0].id);
    expect(fileDelete).toHaveBeenCalledWith({ ignoreNotFound: true });
  });

  it('예상하지 못한 저장 오류의 원문을 응답에 노출하지 않는다', async () => {
    saveSketchbook.mockRejectedValueOnce(new Error('firestore credential details'));

    const response = await POST(createRequest());

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      message: '스케치북을 만들지 못했어요. 잠시 후 다시 시도해 주세요.',
    });
  });
});
