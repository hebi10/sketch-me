import { vi } from 'vitest';

const {
  bucketFile,
  cookieGet,
  fileDownload,
  fileGetMetadata,
  findDrawing,
  getAdminSessionCookieName,
  getAdminStorage,
  verifyAdminSessionCookie,
} = vi.hoisted(() => ({
  bucketFile: vi.fn(),
  cookieGet: vi.fn(),
  fileDownload: vi.fn(),
  fileGetMetadata: vi.fn(),
  findDrawing: vi.fn(),
  getAdminSessionCookieName: vi.fn(() => 'admin_session'),
  getAdminStorage: vi.fn(),
  verifyAdminSessionCookie: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ get: cookieGet })),
}));
vi.mock('@/lib/admin/auth', () => ({
  getAdminSessionCookieName,
  verifyAdminSessionCookie,
}));
vi.mock('@/lib/firebase/admin', () => ({ getAdminStorage }));
vi.mock('@/lib/sketchbooks/repository', () => ({ findDrawing }));

import { GET } from '@/app/api/admin/sketchbooks/[sketchbookId]/drawings/[drawingId]/image/route';
import type { Drawing } from '@/lib/domain/types';

const request = new Request('http://localhost/api/admin/sketchbooks/book-1/drawings/draw-1/image');
const context = {
  params: Promise.resolve({ drawingId: 'draw-1', sketchbookId: 'book-1' }),
};
const createdAt = new Date('2026-08-25T01:23:00.000Z');
const drawing: Drawing = {
  authorName: '친구1',
  bestRank: null,
  createdAt,
  id: 'draw-1',
  imagePath: 'sketchbooks/book-1/drawings/draw-1/original.webp',
  message: null,
  moderatedAt: null,
  moderationStatus: 'ACTIVE',
  sketchbookId: 'book-1',
  sketchbookName: '내 이름',
  sketchbookPublicId: 'public-1',
  status: 'VISIBLE',
  updatedAt: createdAt,
  usedReferenceImage: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  cookieGet.mockReturnValue({ value: 'session-cookie' });
  verifyAdminSessionCookie.mockResolvedValue({
    email: 'owner@example.com',
    uid: 'admin-uid',
  });
  findDrawing.mockResolvedValue(drawing);
  fileDownload.mockResolvedValue([Buffer.from('private-image')]);
  fileGetMetadata.mockResolvedValue([{ contentType: 'image/webp' }]);
  getAdminStorage.mockReturnValue({
    bucket: vi.fn(() => ({
      file: bucketFile.mockReturnValue({
        download: fileDownload,
        getMetadata: fileGetMetadata,
      }),
    })),
  });
});

describe('관리자 그림 이미지 API', () => {
  it('관리자 세션이 없으면 식별자가 잘못되어도 문서와 Storage를 읽지 않고 401을 반환한다', async () => {
    verifyAdminSessionCookie.mockResolvedValue(null);
    const invalidContext = {
      params: Promise.resolve({ drawingId: '../draw', sketchbookId: 'book/one' }),
    };

    const response = await GET(request, invalidContext);

    expect(response.status).toBe(401);
    expect(findDrawing).not.toHaveBeenCalled();
    expect(getAdminStorage).not.toHaveBeenCalled();
    expect(await response.text()).not.toContain('session-cookie');
  });

  it.each([
    { drawingId: '../draw', sketchbookId: 'book-1' },
    { drawingId: 'draw-1', sketchbookId: 'book/one' },
    { drawingId: '__reserved__', sketchbookId: 'book-1' },
  ])('공유 Firestore ID 스키마가 거부하는 식별자는 문서를 읽지 않고 404를 반환한다', async (params) => {
    const response = await GET(request, { params: Promise.resolve(params) });

    expect(response.status).toBe(404);
    expect(findDrawing).not.toHaveBeenCalled();
    expect(getAdminStorage).not.toHaveBeenCalled();
  });

  it('그림이 없거나 요청한 스케치북 소속이 아니면 Storage를 읽지 않는다', async () => {
    findDrawing.mockResolvedValueOnce(null);
    const missingResponse = await GET(request, context);

    expect(missingResponse.status).toBe(404);
    expect(getAdminStorage).not.toHaveBeenCalled();

    findDrawing.mockResolvedValueOnce({ ...drawing, sketchbookId: 'other-book' });
    const mismatchedResponse = await GET(request, context);

    expect(mismatchedResponse.status).toBe(404);
    expect(getAdminStorage).not.toHaveBeenCalled();
  });

  it('인증된 관리자는 BLOCKED 그림도 안전한 비캐시 이미지 응답으로 검토한다', async () => {
    findDrawing.mockResolvedValue({ ...drawing, moderationStatus: 'BLOCKED' });

    const response = await GET(request, context);

    expect(response.status).toBe(200);
    expect(findDrawing).toHaveBeenCalledWith('book-1', 'draw-1');
    expect(bucketFile).toHaveBeenCalledWith(
      'sketchbooks/book-1/drawings/draw-1/original.webp',
    );
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(response.headers.get('Content-Type')).toBe('image/webp');
    expect(response.headers.get('Content-Disposition')).toBe('inline');
    expect(response.headers.get('Cross-Origin-Resource-Policy')).toBe('same-origin');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    await expect(response.arrayBuffer()).resolves.toEqual(
      Uint8Array.from(Buffer.from('private-image')).buffer,
    );
  });

  it('인증된 관리자는 소유자가 숨긴 ACTIVE 그림도 검토한다', async () => {
    findDrawing.mockResolvedValue({
      ...drawing,
      moderationStatus: 'ACTIVE',
      status: 'HIDDEN',
    });

    const response = await GET(request, context);

    expect(response.status).toBe(200);
    expect(bucketFile).toHaveBeenCalledWith(
      'sketchbooks/book-1/drawings/draw-1/original.webp',
    );
  });

  it('이전 앱이 기록한 확장자 없는 동일 그림 경로를 허용한다', async () => {
    findDrawing.mockResolvedValue({
      ...drawing,
      imagePath: 'sketchbooks/book-1/drawings/draw-1/original',
    });

    const response = await GET(request, context);

    expect(response.status).toBe(200);
    expect(bucketFile).toHaveBeenCalledWith(
      'sketchbooks/book-1/drawings/draw-1/original',
    );
  });

  it.each([
    'sketchbooks/other-book/drawings/draw-1/original.webp',
    'sketchbooks/book-1/drawings/other-drawing/original.webp',
    'sketchbooks/book-1/owner/original.webp',
    'sketchbooks/book-1/reference/source.webp',
    'sketchbooks/book-1/drawings/draw-1.webp',
    'sketchbooks/book-1/drawings/draw-1/../original.webp',
    'sketchbooks/book-1/drawings/draw-1/%2e%2e/owner/original.webp',
    'sketchbooks/book-1/drawings/draw-1%2foriginal.webp',
  ])('허용된 동일 그림 경로가 아니면 Storage 접근 전에 404를 반환한다: %s', async (imagePath) => {
    findDrawing.mockResolvedValue({ ...drawing, imagePath });

    const response = await GET(request, context);

    expect(response.status).toBe(404);
    expect(getAdminStorage).not.toHaveBeenCalled();
    expect(bucketFile).not.toHaveBeenCalled();
  });

  it('DELETED 그림은 관리자에게도 제공하지 않는다', async () => {
    findDrawing.mockResolvedValue({ ...drawing, status: 'DELETED' });

    const response = await GET(request, context);

    expect(response.status).toBe(404);
    expect(getAdminStorage).not.toHaveBeenCalled();
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
