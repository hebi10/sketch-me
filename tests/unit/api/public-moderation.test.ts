import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

const {
  enforcePublicMutationLimit,
  findDrawing,
  findSketchbookByPublicId,
  getAdminStorage,
  getManagedSketchbook,
  listDrawings,
  listVisibleDrawings,
  notFound,
  optimizeDrawingImages,
  optimizeImageForStorage,
  saveDrawingWithinLimit,
} = vi.hoisted(() => ({
  enforcePublicMutationLimit: vi.fn(),
  findDrawing: vi.fn(),
  findSketchbookByPublicId: vi.fn(),
  getAdminStorage: vi.fn(),
  getManagedSketchbook: vi.fn(),
  listDrawings: vi.fn(),
  listVisibleDrawings: vi.fn(),
  notFound: vi.fn(() => { throw new Error('NEXT_NOT_FOUND'); }),
  optimizeDrawingImages: vi.fn(),
  optimizeImageForStorage: vi.fn(),
  saveDrawingWithinLimit: vi.fn(),
}));

vi.mock('next/navigation', () => ({ notFound }));
vi.mock('@/lib/firebase/admin', () => ({ getAdminStorage }));
vi.mock('@/lib/images/optimize', () => ({
  ImageOptimizationError: class ImageOptimizationError extends Error {},
  optimizeDrawingImages,
  optimizeImageForStorage,
}));
vi.mock('@/lib/security/rate-limit', () => ({ enforcePublicMutationLimit }));
vi.mock('@/lib/sketchbooks/management', () => ({ getManagedSketchbook }));
vi.mock('@/lib/sketchbooks/repository', () => ({
  findDrawing,
  findSketchbookByPublicId,
  listDrawings,
  listVisibleDrawings,
  saveDrawingWithinLimit,
}));

import { POST as submitDrawing } from '@/app/api/sketchbooks/[publicId]/drawings/route';
import { GET as getDrawingImage } from '@/app/api/sketchbooks/[publicId]/drawings/[drawingId]/image/route';
import { GET as getOwnerImage } from '@/app/api/sketchbooks/[publicId]/owner/image/route';
import SharePage from '@/app/m/[publicId]/share/page';
import PublicSketchbookPage, { generateMetadata } from '@/app/s/[publicId]/page';
import DrawFriendPage, { generateMetadata as generateDrawMetadata } from '@/app/s/[publicId]/draw/page';

const createdAt = new Date('2026-08-25T00:00:00.000Z');
const sketchbook = {
  createdAt,
  id: 'book-1',
  manageTokenHash: 'hash',
  moderatedAt: null,
  moderationStatus: 'ACTIVE' as const,
  name: '해비',
  ownerDrawingPath: 'sketchbooks/book-1/owner/original.webp',
  participantCount: 1,
  participantLimit: 20,
  publicId: 'public-1',
  entitlements: { watermarkFree: false },
  status: 'PUBLIC' as const,
  updatedAt: createdAt,
};
const drawing = {
  authorName: '친구',
  bestRank: 1 as const,
  createdAt,
  id: 'drawing-1',
  imagePath: 'sketchbooks/book-1/drawings/drawing-1/original.webp',
  thumbnailPath: 'sketchbooks/book-1/drawings/drawing-1/thumbnail.webp',
  publicImageVersion: 'version-1',
  message: null,
  moderatedAt: null,
  moderationStatus: 'ACTIVE' as const,
  sketchbookId: 'book-1',
  sketchbookName: '해비',
  sketchbookPublicId: 'public-1',
  status: 'VISIBLE' as const,
  updatedAt: createdAt,
};
const sketchbookContext = { params: Promise.resolve({ publicId: 'public-1' }) };
const drawingContext = {
  params: Promise.resolve({ drawingId: 'drawing-1', publicId: 'public-1' }),
};

describe('공개 경로 운영자 차단', () => {
  const file = {
    delete: vi.fn(),
    download: vi.fn(),
    getMetadata: vi.fn(),
    save: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    enforcePublicMutationLimit.mockReturnValue(null);
    findSketchbookByPublicId.mockResolvedValue(sketchbook);
    findDrawing.mockResolvedValue(drawing);
    getManagedSketchbook.mockResolvedValue(sketchbook);
    listDrawings.mockResolvedValue([]);
    listVisibleDrawings.mockResolvedValue([]);
    file.download.mockResolvedValue([Buffer.from('image')]);
    file.getMetadata.mockResolvedValue([{ contentType: 'image/webp' }]);
    getAdminStorage.mockReturnValue({
      bucket: vi.fn(() => ({ file: vi.fn(() => file) })),
    });
  });

  it('차단된 스케치북의 공개 페이지는 내용을 노출하지 않는 이용 제한 안내를 나타낸다', async () => {
    findSketchbookByPublicId.mockResolvedValue({ ...sketchbook, moderationStatus: 'BLOCKED' });

    render(await PublicSketchbookPage({
      params: Promise.resolve({ publicId: 'public-1' }),
      searchParams: Promise.resolve({}),
    }));

    expect(screen.getByRole('heading', { name: '현재 이용할 수 없는 스케치북이에요' })).toBeVisible();
    expect(screen.queryByText('해비의 스케치북')).not.toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(listVisibleDrawings).not.toHaveBeenCalled();
    await expect(generateMetadata({ params: Promise.resolve({ publicId: 'public-1' }) }))
      .resolves.toEqual({
        robots: { follow: false, index: false },
        title: '이용이 제한된 스케치북',
      });
  });

  it('차단된 스케치북의 그리기 페이지는 캔버스와 소유자 정보 없이 제한 안내만 나타낸다', async () => {
    findSketchbookByPublicId.mockResolvedValue({ ...sketchbook, moderationStatus: 'BLOCKED' });

    render(await DrawFriendPage({ params: Promise.resolve({ publicId: 'public-1' }) }));

    expect(screen.getByRole('heading', { name: '현재 이용할 수 없는 스케치북이에요' })).toBeVisible();
    expect(screen.queryByText(/\uD574\uBE44/)).not.toBeInTheDocument();
    expect(document.querySelector('canvas')).not.toBeInTheDocument();
    await expect(generateDrawMetadata({ params: Promise.resolve({ publicId: 'public-1' }) }))
      .resolves.toEqual({
        robots: { follow: false, index: false },
        title: '이용이 제한된 스케치북',
      });
  });

  it.each([
    { label: '존재하지 않는', value: null },
    { label: '비공개', value: { ...sketchbook, status: 'PRIVATE' } },
  ])('$label 스케치북은 공개·그리기 페이지 모두 404 처리한다', async ({ value }) => {
    findSketchbookByPublicId.mockResolvedValue(value);

    await expect(PublicSketchbookPage({
      params: Promise.resolve({ publicId: 'public-1' }),
      searchParams: Promise.resolve({}),
    })).rejects.toThrow('NEXT_NOT_FOUND');
    await expect(DrawFriendPage({ params: Promise.resolve({ publicId: 'public-1' }) }))
      .rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('공개 페이지의 그림 이미지는 최적화 프록시를 거치지 않는다', async () => {
    listVisibleDrawings.mockResolvedValue([drawing]);

    render(await PublicSketchbookPage({
      params: Promise.resolve({ publicId: 'public-1' }),
      searchParams: Promise.resolve({}),
    }));

    expect(screen.getByRole('img', { name: '친구님의 그림' })).toHaveAttribute(
      'src',
      '/api/sketchbooks/public-1/drawings/drawing-1/thumbnail?v=version-1',
    );
    expect(screen.getByRole('img', { name: 'BEST 1, 친구님의 그림' })).toHaveAttribute(
      'src',
      '/api/sketchbooks/public-1/drawings/drawing-1/thumbnail?v=version-1',
    );
    expect(screen.getByRole('img', { name: '친구님의 최근 그림' })).toHaveAttribute(
      'src',
      '/api/sketchbooks/public-1/drawings/drawing-1/thumbnail?v=version-1',
    );
  });

  it('공개 페이지는 전달된 BLOCKED 그림을 렌더링하지 않는다', async () => {
    listVisibleDrawings.mockResolvedValue([
      drawing,
      { ...drawing, bestRank: null, id: 'blocked', moderationStatus: 'BLOCKED' },
    ]);

    render(await PublicSketchbookPage({
      params: Promise.resolve({ publicId: 'public-1' }),
      searchParams: Promise.resolve({}),
    }));

    expect(screen.getByRole('img', { name: '친구님의 그림' })).toBeVisible();
    expect(document.querySelector('img[src*="/drawings/blocked/image"]')).not.toBeInTheDocument();
  });

  it('차단된 스케치북의 제출은 이미지 변환과 Storage 쓰기 전에 404 처리한다', async () => {
    findSketchbookByPublicId.mockResolvedValue({ ...sketchbook, moderationStatus: 'BLOCKED' });
    const request = new Request('http://localhost/api/sketchbooks/public-1/drawings', {
      body: JSON.stringify({
        authorName: '친구',
        imageDataUrl: `data:image/png;base64,${Buffer.from('image').toString('base64')}`,
      }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });

    const response = await submitDrawing(request, sketchbookContext);

    expect(response.status).toBe(404);
    expect(optimizeImageForStorage).not.toHaveBeenCalled();
    expect(getAdminStorage).not.toHaveBeenCalled();
    expect(saveDrawingWithinLimit).not.toHaveBeenCalled();
  });

  it.each([
    { getImage: getOwnerImage, label: '소유자 그림', context: sketchbookContext },
    { getImage: getDrawingImage, label: '친구 그림', context: drawingContext },
  ])('차단된 스케치북의 $label 이미지는 Storage를 읽지 않고 no-store 404를 반환한다', async ({ getImage, context }) => {
    findSketchbookByPublicId.mockResolvedValue({ ...sketchbook, moderationStatus: 'BLOCKED' });

    const response = await getImage(new Request('http://localhost/image'), context as never);

    expect(response.status).toBe(404);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(findDrawing).not.toHaveBeenCalled();
    expect(getAdminStorage).not.toHaveBeenCalled();
  });

  it('차단된 그림의 기존 공개 주소는 Storage를 읽지 않고 no-store 404를 반환한다', async () => {
    findDrawing.mockResolvedValue({ ...drawing, moderationStatus: 'BLOCKED' });

    const response = await getDrawingImage(new Request('http://localhost/image'), drawingContext);

    expect(response.status).toBe(404);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(getAdminStorage).not.toHaveBeenCalled();
  });

  it.each([
    { getImage: getOwnerImage, label: '소유자 그림', context: sketchbookContext },
    { getImage: getDrawingImage, label: '친구 그림', context: drawingContext },
  ])('$label 이미지 성공 응답은 브라우저 밖에 캐시되지 않는다', async ({ getImage, context }) => {
    const response = await getImage(new Request('http://localhost/image'), context as never);

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  });

  it.each([
    {
      context: sketchbookContext,
      getImage: getOwnerImage,
      label: '다른 스케치북 소유자 그림',
      setStoredPath: () => {
        findSketchbookByPublicId.mockResolvedValue({
          ...sketchbook,
          ownerDrawingPath: 'sketchbooks/other-book/owner/original.webp',
        });
      },
    },
    {
      context: drawingContext,
      getImage: getDrawingImage,
      label: '다른 그림 원본',
      setStoredPath: () => {
        findDrawing.mockResolvedValue({
          ...drawing,
          imagePath: 'sketchbooks/book-1/drawings/other-drawing/original.webp',
        });
      },
    },
  ])('$label 경로는 Storage를 읽지 않고 no-store 404를 반환한다', async ({
    context,
    getImage,
    setStoredPath,
  }) => {
    setStoredPath();

    const response = await getImage(new Request('http://localhost/image'), context as never);

    expect(response.status).toBe(404);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(getAdminStorage).not.toHaveBeenCalled();
    expect(await response.text()).toBe('');
  });

  it.each([
    { getImage: getOwnerImage, label: '소유자 그림', context: sketchbookContext },
    { getImage: getDrawingImage, label: '친구 그림', context: drawingContext },
  ])('$label의 안전하지 않은 MIME 메타데이터는 빈 500으로 처리한다', async ({
    getImage,
    context,
  }) => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    file.getMetadata.mockResolvedValueOnce([{ contentType: 'text/html' }]);

    const response = await getImage(new Request('http://localhost/image'), context as never);

    expect(response.status).toBe(500);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(response.headers.get('Content-Type')).not.toBe('text/html');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(await response.text()).toBe('');
    consoleError.mockRestore();
  });

  it('Story에는 공개 중인 ACTIVE BEST 그림만 전달한다', async () => {
    listDrawings.mockResolvedValue([
      drawing,
      { ...drawing, bestRank: 2, id: 'blocked', moderationStatus: 'BLOCKED' },
      { ...drawing, bestRank: 3, id: 'hidden', status: 'HIDDEN' },
    ]);

    render(await SharePage({ params: Promise.resolve({ publicId: 'public-1' }) }));

    expect(screen.getByRole('img', { name: 'BEST 1 그림' })).toBeVisible();
    expect(screen.queryByRole('img', { name: 'BEST 2 그림' })).not.toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'BEST 3 그림' })).not.toBeInTheDocument();
  });
});
