import { vi } from 'vitest';

const {
  bucketFile,
  fileDownload,
  fileGetMetadata,
  getAdminStorage,
  getManagedSketchbook,
} = vi.hoisted(() => ({
  bucketFile: vi.fn(),
  fileDownload: vi.fn(),
  fileGetMetadata: vi.fn(),
  getAdminStorage: vi.fn(),
  getManagedSketchbook: vi.fn(),
}));

vi.mock('@/lib/firebase/admin', () => ({ getAdminStorage }));
vi.mock('@/lib/sketchbooks/management', () => ({ getManagedSketchbook }));

import { GET } from '@/app/api/manage/[publicId]/owner/image/route';
import type { Sketchbook } from '@/lib/domain/types';

const createdAt = new Date('2026-08-25T00:00:00.000Z');
const blockedSketchbook: Sketchbook = {
  createdAt,
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
  referenceImageEnabled: false,
  referenceImagePath: null,
  status: 'PUBLIC',
  updatedAt: createdAt,
};
const request = new Request('http://localhost/api/manage/public-1/owner/image');
const context = { params: Promise.resolve({ publicId: 'public-1' }) };

describe('관리 세션 보호 소유자 이미지 API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getManagedSketchbook.mockResolvedValue(blockedSketchbook);
    fileDownload.mockResolvedValue([Buffer.from('owner-image')]);
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

  it('BLOCKED여도 인증된 소유자에게는 안전한 비캐시 이미지를 반환한다', async () => {
    const response = await GET(request, context);

    expect(response.status).toBe(200);
    expect(getManagedSketchbook).toHaveBeenCalledWith('public-1');
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
    { label: '인증되지 않은', publicId: 'public-1' },
    { label: '다른 공개 ID를 요청한', publicId: 'public-2' },
  ])('$label 요청은 Storage를 읽지 않고 generic 401을 반환한다', async ({ publicId }) => {
    getManagedSketchbook.mockResolvedValue(null);

    const response = await GET(request, { params: Promise.resolve({ publicId }) });

    expect(response.status).toBe(401);
    expect(getManagedSketchbook).toHaveBeenCalledWith(publicId);
    expect(getAdminStorage).not.toHaveBeenCalled();
    expect(await response.text()).toBe('');
  });

  it('소유자 그림이 없으면 Storage를 읽지 않고 generic 404를 반환한다', async () => {
    getManagedSketchbook.mockResolvedValue({ ...blockedSketchbook, ownerDrawingPath: null });

    const response = await GET(request, context);

    expect(response.status).toBe(404);
    expect(getAdminStorage).not.toHaveBeenCalled();
    expect(await response.text()).toBe('');
  });

  it.each([
    'sketchbooks/other-book/owner/original.webp',
    'sketchbooks/book-1/reference/source.webp',
    'sketchbooks/book-1/owner/../reference/source.webp',
    'sketchbooks/book-1/owner/%2e%2e%2freference/source.webp',
  ])('다른 대상이나 traversal 가능성이 있는 경로는 Storage 접근 전에 404로 거부한다: %s', async (ownerDrawingPath) => {
    getManagedSketchbook.mockResolvedValue({ ...blockedSketchbook, ownerDrawingPath });

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
