import { vi } from 'vitest';

const {
  findDrawing,
  findSketchbookByPublicId,
  getAdminStorage,
  optimizeImageForStorage,
  optimizeDrawingThumbnail,
  originalDownload,
  thumbnailDownload,
  thumbnailSave,
} = vi.hoisted(() => ({
  findDrawing: vi.fn(),
  findSketchbookByPublicId: vi.fn(),
  getAdminStorage: vi.fn(),
  optimizeImageForStorage: vi.fn(),
  optimizeDrawingThumbnail: vi.fn(),
  originalDownload: vi.fn(),
  thumbnailDownload: vi.fn(),
  thumbnailSave: vi.fn(),
}));

vi.mock('@/lib/firebase/admin', () => ({ getAdminStorage }));
vi.mock('@/lib/images/optimize', () => ({ optimizeDrawingThumbnail, optimizeImageForStorage }));
vi.mock('@/lib/sketchbooks/repository', () => ({ findDrawing, findSketchbookByPublicId }));

import { GET } from '@/app/api/sketchbooks/[publicId]/drawings/[drawingId]/thumbnail/route';

const context = {
  params: Promise.resolve({ drawingId: 'drawing-1', publicId: 'public-1' }),
};
const sketchbook = {
  id: 'book-1',
  moderationStatus: 'ACTIVE',
  status: 'PUBLIC',
};
const drawing = {
  id: 'drawing-1',
  imagePath: 'sketchbooks/book-1/drawings/drawing-1/original.webp',
  moderationStatus: 'ACTIVE',
  publicImageVersion: 'version-1',
  status: 'VISIBLE',
  thumbnailPath: 'sketchbooks/book-1/drawings/drawing-1/thumbnail.webp',
};

function request(version = 'version-1') {
  return new Request(`http://localhost/api/sketchbooks/public-1/drawings/drawing-1/thumbnail?v=${version}`);
}

describe('공개 갤러리 썸네일', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    findSketchbookByPublicId.mockResolvedValue(sketchbook);
    findDrawing.mockResolvedValue(drawing);
    thumbnailDownload.mockResolvedValue([Buffer.from('stored-thumbnail')]);
    originalDownload.mockResolvedValue([Buffer.from('original')]);
    optimizeDrawingThumbnail.mockResolvedValue({
      buffer: Buffer.from('generated-thumbnail'),
      contentType: 'image/webp',
    });
    optimizeImageForStorage.mockResolvedValue({
      buffer: Buffer.from('share-thumbnail'),
      contentType: 'image/webp',
    });
    getAdminStorage.mockReturnValue({
      bucket: vi.fn(() => ({
        file: vi.fn((path: string) => path.endsWith('/thumbnail.webp')
          ? { download: thumbnailDownload, save: thumbnailSave }
          : { download: originalDownload }),
      })),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('현재 버전의 공개 그림만 5분 공유 캐시와 ETag로 반환한다', async () => {
    const response = await GET(request(), context);

    expect(response.status).toBe(200);
    expect(Buffer.from(await response.arrayBuffer()).toString()).toBe('stored-thumbnail');
    expect(response.headers.get('Content-Type')).toBe('image/webp');
    expect(response.headers.get('Cache-Control')).toBe(
      'public, max-age=300, s-maxage=300, stale-while-revalidate=60',
    );
    expect(response.headers.get('ETag')).toBe('"drawing-1-version-1-thumb"');
    expect(originalDownload).not.toHaveBeenCalled();
  });

  it('링크 공유 요청은 정사각형 썸네일을 가로형 중앙 정렬 이미지로 변환한다', async () => {
    const response = await GET(new Request(
      'http://localhost/api/sketchbooks/public-1/drawings/drawing-1/thumbnail?v=version-1&share=1',
    ), context);

    expect(response.status).toBe(200);
    expect(optimizeImageForStorage).toHaveBeenCalledWith(
      Buffer.from('stored-thumbnail'),
      'link-share',
    );
    expect(Buffer.from(await response.arrayBuffer()).toString()).toBe('share-thumbnail');
  });

  it.each([
    { label: '버전 누락', requestUrl: 'http://localhost/api/sketchbooks/public-1/drawings/drawing-1/thumbnail' },
    { label: '이전 버전', requestUrl: 'http://localhost/api/sketchbooks/public-1/drawings/drawing-1/thumbnail?v=old-version' },
  ])('$label 요청은 Storage를 읽지 않고 no-store 404를 반환한다', async ({ requestUrl }) => {
    const response = await GET(new Request(requestUrl), context);

    expect(response.status).toBe(404);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(thumbnailDownload).not.toHaveBeenCalled();
    expect(originalDownload).not.toHaveBeenCalled();
  });

  it.each([
    { label: '비공개 스케치북', book: { ...sketchbook, status: 'PRIVATE' }, item: drawing },
    { label: '차단 스케치북', book: { ...sketchbook, moderationStatus: 'BLOCKED' }, item: drawing },
    { label: '숨긴 그림', book: sketchbook, item: { ...drawing, status: 'HIDDEN' } },
    { label: '차단 그림', book: sketchbook, item: { ...drawing, moderationStatus: 'BLOCKED' } },
  ])('$label은 Storage 전에 no-store 404를 반환한다', async ({ book, item }) => {
    findSketchbookByPublicId.mockResolvedValue(book);
    findDrawing.mockResolvedValue(item);

    const response = await GET(request(), context);

    expect(response.status).toBe(404);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(thumbnailDownload).not.toHaveBeenCalled();
    expect(originalDownload).not.toHaveBeenCalled();
  });

  it('기존 그림의 결정적 썸네일이 없으면 원본에서 생성해 저장하고 응답한다', async () => {
    findDrawing.mockResolvedValue({ ...drawing, thumbnailPath: null });
    thumbnailDownload.mockRejectedValueOnce(Object.assign(new Error('missing'), { code: 404 }));

    const response = await GET(request(), context);

    expect(response.status).toBe(200);
    expect(originalDownload).toHaveBeenCalledOnce();
    expect(optimizeDrawingThumbnail).toHaveBeenCalledWith(Buffer.from('original'));
    expect(thumbnailSave).toHaveBeenCalledWith(Buffer.from('generated-thumbnail'), {
      metadata: { cacheControl: 'public, max-age=300', contentType: 'image/webp' },
    });
    expect(Buffer.from(await response.arrayBuffer()).toString()).toBe('generated-thumbnail');
  });

  it('지연 생성 파일 저장이 실패해도 생성된 작은 이미지를 현재 요청에 반환한다', async () => {
    findDrawing.mockResolvedValue({ ...drawing, thumbnailPath: null });
    thumbnailDownload.mockRejectedValueOnce(Object.assign(new Error('missing'), { code: 404 }));
    thumbnailSave.mockRejectedValueOnce(new Error('storage unavailable'));

    const response = await GET(request(), context);

    expect(response.status).toBe(200);
    expect(Buffer.from(await response.arrayBuffer()).toString()).toBe('generated-thumbnail');
  });
});
