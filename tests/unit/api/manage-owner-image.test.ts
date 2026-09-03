import { vi } from 'vitest';

const {
  bucketFile,
  fileDownload,
  fileGetMetadata,
  findSketchbookByPublicId,
  getAdminStorage,
  isManagePinSessionValid,
  cookieGet,
  fileSave,
  optimizeImageForStorage,
  updateOwnerDrawingForManagement,
} = vi.hoisted(() => ({
  bucketFile: vi.fn(),
  cookieGet: vi.fn(),
  fileDownload: vi.fn(),
  fileGetMetadata: vi.fn(),
  fileSave: vi.fn(),
  findSketchbookByPublicId: vi.fn(),
  getAdminStorage: vi.fn(),
  isManagePinSessionValid: vi.fn(),
  optimizeImageForStorage: vi.fn(),
  updateOwnerDrawingForManagement: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ get: cookieGet })),
}));
vi.mock('@/lib/firebase/admin', () => ({ getAdminStorage }));
vi.mock('@/lib/images/optimize', () => ({ optimizeImageForStorage }));
vi.mock('@/lib/sketchbooks/repository', () => ({
  findSketchbookByPublicId,
  isManagePinSessionValid,
  updateOwnerDrawingForManagement,
}));

import { GET, PUT } from '@/app/api/manage/[publicId]/owner/image/route';
import type { Sketchbook } from '@/lib/domain/types';

const createdAt = new Date('2026-08-25T00:00:00.000Z');
const blockedSketchbook: Sketchbook = {
  createdAt,
  entitlements: { watermarkFree: false },
  id: 'book-1',
  managePinEnabledAt: createdAt,
  managePinHash: 'scrypt$salt$hash',
  managePinHint: null,
  manageTokenHash: 'legacy-hash',
  moderatedAt: createdAt,
  moderationStatus: 'BLOCKED',
  name: '내 이름',
  ownerDrawingPath: 'sketchbooks/book-1/owner/original.webp',
  participantCount: 0,
  participantLimit: 20,
  publicId: 'public-1',
  status: 'PUBLIC',
  updatedAt: createdAt,
};
const request = new Request('http://localhost/api/manage/public-1/owner/image');
const context = { params: Promise.resolve({ publicId: 'public-1' }) };

describe('관리 세션 보호 소유자 이미지 API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cookieGet.mockReturnValue({ value: 'public-1.session-1.secret-token' });
    findSketchbookByPublicId.mockResolvedValue(blockedSketchbook);
    isManagePinSessionValid.mockResolvedValue(true);
    fileDownload.mockResolvedValue([Buffer.from('owner-image')]);
    fileGetMetadata.mockResolvedValue([{ contentType: 'image/webp' }]);
    getAdminStorage.mockReturnValue({
      bucket: vi.fn(() => ({
        file: bucketFile.mockReturnValue({
          download: fileDownload,
          getMetadata: fileGetMetadata,
          save: fileSave,
        }),
      })),
    });
  });

  it('인증된 관리자만 최적화된 소유자 그림을 정해진 경로에 교체한다', async () => {
    optimizeImageForStorage.mockResolvedValue({
      buffer: Buffer.from('optimized-owner-image'),
      contentType: 'image/webp',
    });
    const updateRequest = new Request(request.url, {
      body: JSON.stringify({ imageDataUrl: 'data:image/webp;base64,b3duZXI=' }),
      headers: { 'Content-Type': 'application/json' },
      method: 'PUT',
    });

    const response = await PUT(updateRequest, context);

    expect(response.status).toBe(200);
    expect(optimizeImageForStorage).toHaveBeenCalledWith(Buffer.from('owner'), 'sketch');
    expect(bucketFile).toHaveBeenCalledWith('sketchbooks/book-1/owner/original.webp');
    expect(fileSave).toHaveBeenCalledWith(Buffer.from('optimized-owner-image'), {
      metadata: {
        cacheControl: 'private, max-age=0',
        contentType: 'image/webp',
      },
    });
    expect(updateOwnerDrawingForManagement).toHaveBeenCalledWith(
      'book-1',
      'sketchbooks/book-1/owner/original.webp',
    );
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it('인증되지 않은 소유자 그림 교체 요청은 이미지 처리 전에 401로 거부한다', async () => {
    cookieGet.mockReturnValue(undefined);
    const updateRequest = new Request(request.url, {
      body: JSON.stringify({ imageDataUrl: 'data:image/webp;base64,b3duZXI=' }),
      headers: { 'Content-Type': 'application/json' },
      method: 'PUT',
    });

    const response = await PUT(updateRequest, context);

    expect(response.status).toBe(401);
    expect(optimizeImageForStorage).not.toHaveBeenCalled();
    expect(fileSave).not.toHaveBeenCalled();
  });

  it('잘못된 소유자 그림 데이터는 Storage 접근 전에 400으로 거부한다', async () => {
    const updateRequest = new Request(request.url, {
      body: JSON.stringify({ imageDataUrl: 'data:text/html;base64,PHNjcmlwdD4=' }),
      headers: { 'Content-Type': 'application/json' },
      method: 'PUT',
    });

    const response = await PUT(updateRequest, context);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: expect.any(String) });
    expect(optimizeImageForStorage).not.toHaveBeenCalled();
    expect(fileSave).not.toHaveBeenCalled();
  });

  it('BLOCKED여도 인증된 소유자에게는 안전한 비캐시 이미지를 반환한다', async () => {
    const response = await GET(request, context);

    expect(response.status).toBe(200);
    expect(findSketchbookByPublicId).toHaveBeenCalledWith('public-1');
    expect(isManagePinSessionValid).toHaveBeenCalled();
    expect(bucketFile).toHaveBeenCalledWith('sketchbooks/book-1/owner/original.webp');
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(response.headers.get('Content-Disposition')).toBe('inline');
    expect(response.headers.get('Content-Type')).toBe('image/webp');
    expect(response.headers.get('Cross-Origin-Resource-Policy')).toBe('same-origin');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    await expect(response.arrayBuffer()).resolves.toEqual(
      Uint8Array.from(Buffer.from('owner-image')).buffer,
    );
  });

  it.each([
    { cookieValue: undefined, label: '인증되지 않은', publicId: 'public-1' },
    { cookieValue: 'public-1.session-1.secret-token', label: '다른 공개 ID를 요청한', publicId: 'public-2' },
  ])('$label 요청은 Firestore와 Storage를 읽지 않고 generic 401을 반환한다', async ({ cookieValue, publicId }) => {
    cookieGet.mockReturnValue(cookieValue ? { value: cookieValue } : undefined);

    const response = await GET(request, { params: Promise.resolve({ publicId }) });

    expect(response.status).toBe(401);
    expect(findSketchbookByPublicId).not.toHaveBeenCalled();
    expect(getAdminStorage).not.toHaveBeenCalled();
    expect(await response.text()).toBe('');
  });

  it('소유자 그림이 없으면 Storage를 읽지 않고 generic 404를 반환한다', async () => {
    findSketchbookByPublicId.mockResolvedValue({ ...blockedSketchbook, ownerDrawingPath: null });

    const response = await GET(request, context);

    expect(response.status).toBe(404);
    expect(getAdminStorage).not.toHaveBeenCalled();
    expect(await response.text()).toBe('');
  });

  it.each([
    'sketchbooks/other-book/owner/original.webp',
    'sketchbooks/book-1/share-images/story.webp',
    'sketchbooks/book-1/owner/../share-images/story.webp',
    'sketchbooks/book-1/owner/%2e%2e%2fshare-images/story.webp',
  ])('다른 대상이나 traversal 가능성이 있는 경로는 Storage 접근 전에 404로 거부한다: %s', async (ownerDrawingPath) => {
    findSketchbookByPublicId.mockResolvedValue({ ...blockedSketchbook, ownerDrawingPath });

    const response = await GET(request, context);

    expect(response.status).toBe(404);
    expect(getAdminStorage).not.toHaveBeenCalled();
  });

  it('7498352에서 생성한 scoped legacy PNG 원본도 소유자에게 반환한다', async () => {
    findSketchbookByPublicId.mockResolvedValue({
      ...blockedSketchbook,
      ownerDrawingPath: 'sketchbooks/book-1/owner/original.png',
    });
    fileGetMetadata.mockResolvedValue([{ contentType: 'image/png' }]);

    const response = await GET(request, context);

    expect(response.status).toBe(200);
    expect(bucketFile).toHaveBeenCalledWith('sketchbooks/book-1/owner/original.png');
    expect(response.headers.get('Content-Type')).toBe('image/png');
  });

  it('Storage 오류와 안전하지 않은 콘텐츠 형식은 비밀값 없는 500으로 처리한다', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    fileDownload.mockRejectedValueOnce(new Error('SECRET_BUCKET=private-bucket'));
    const storageFailure = await GET(request, context);

    expect(storageFailure.status).toBe(500);
    expect(await storageFailure.text()).not.toContain('SECRET_BUCKET');

    fileGetMetadata.mockResolvedValueOnce([{ contentType: 'text/html' }]);
    const unsafeMetadata = await GET(request, context);

    expect(unsafeMetadata.status).toBe(500);
    expect(unsafeMetadata.headers.get('Content-Type')).not.toBe('text/html');
    expect(consoleError).toHaveBeenCalledTimes(2);
    expect(consoleError.mock.calls.flat().join(' ')).not.toContain('SECRET_BUCKET');
    consoleError.mockRestore();
  });
});
