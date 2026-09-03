import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

const { findSketchbookByPublicId, listVisibleDrawings, notFound } = vi.hoisted(() => ({
  findSketchbookByPublicId: vi.fn(),
  listVisibleDrawings: vi.fn(),
  notFound: vi.fn(),
}));

vi.mock('next/navigation', () => ({ notFound }));
vi.mock('@/lib/sketchbooks/repository', () => ({
  findSketchbookByPublicId,
  listVisibleDrawings,
}));

import PublicSketchbookPage from '@/app/s/[publicId]/page';

const sketchbook = {
  createdAt: new Date('2026-09-03T00:00:00.000Z'),
  entitlements: { watermarkFree: false },
  id: 'book-1',
  managePinEnabledAt: new Date('2026-09-03T00:00:00.000Z'),
  managePinHash: 'hash',
  managePinHint: null,
  manageTokenHash: 'legacy-hash',
  moderatedAt: null,
  moderationStatus: 'ACTIVE' as const,
  name: '해비',
  ownerDrawingPath: 'sketchbooks/book-1/owner/original.webp',
  ownerBestRank: null,
  participantCount: 0,
  participantLimit: 20,
  publicId: 'public-1',
  status: 'PUBLIC' as const,
  storyHeading: '친구들이 그린 내 모습',
  updatedAt: new Date('2026-09-03T00:00:00.000Z'),
};

describe('공개 스케치북 소유자 그림', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findSketchbookByPublicId.mockResolvedValue(sketchbook);
    listVisibleDrawings.mockResolvedValue([]);
  });

  it('친구 그림이 아직 없어도 소유자가 직접 그린 모습을 별도 섹션으로 보여준다', async () => {
    render(await PublicSketchbookPage({
      params: Promise.resolve({ publicId: 'public-1' }),
      searchParams: Promise.resolve({}),
    }));

    expect(screen.getByRole('heading', { name: '내가 그린 나' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '해비님이 직접 그린 모습' })).toHaveAttribute(
      'src',
      '/api/sketchbooks/public-1/owner/image',
    );
  });

  it('소유자 그림이 없는 이전 스케치북에는 빈 소유자 섹션을 만들지 않는다', async () => {
    findSketchbookByPublicId.mockResolvedValue({ ...sketchbook, ownerDrawingPath: null });

    render(await PublicSketchbookPage({
      params: Promise.resolve({ publicId: 'public-1' }),
      searchParams: Promise.resolve({}),
    }));

    expect(screen.queryByRole('heading', { name: '내가 그린 나' })).not.toBeInTheDocument();
  });

  it('친구 그림이 없어도 직접 지정한 소유자 그림을 공개 BEST에 표시한다', async () => {
    findSketchbookByPublicId.mockResolvedValue({ ...sketchbook, ownerBestRank: 2 });

    render(await PublicSketchbookPage({
      params: Promise.resolve({ publicId: 'public-1' }),
      searchParams: Promise.resolve({}),
    }));

    expect(screen.getByRole('img', { name: 'BEST 2, 해비님의 그림' })).toHaveAttribute(
      'src',
      '/api/sketchbooks/public-1/owner/image',
    );
  });

  it('내 그림, BEST, 친구 그림 순서로 보여주고 최근 그림을 중복 노출하지 않는다', async () => {
    listVisibleDrawings.mockResolvedValue([{
      authorName: '친구',
      bestRank: 1,
      createdAt: new Date('2026-09-03T01:00:00.000Z'),
      id: 'drawing-1',
      imagePath: 'sketchbooks/book-1/drawings/drawing-1.webp',
      message: '안녕',
      moderatedAt: null,
      moderationStatus: 'ACTIVE',
      publicImageVersion: 'v1',
      sketchbookId: 'book-1',
      sketchbookName: '해비',
      sketchbookPublicId: 'public-1',
      status: 'VISIBLE',
      thumbnailPath: 'sketchbooks/book-1/drawings/drawing-1-thumbnail.webp',
      updatedAt: new Date('2026-09-03T01:00:00.000Z'),
    }]);

    render(await PublicSketchbookPage({
      params: Promise.resolve({ publicId: 'public-1' }),
      searchParams: Promise.resolve({}),
    }));

    const ownerHeading = screen.getByRole('heading', { name: '내가 그린 나' });
    const bestHeading = screen.getByRole('heading', { name: '♕ 베스트 그림' });
    const friendHeading = screen.getByRole('heading', { name: '친구들이 그린 나' });

    expect(ownerHeading.compareDocumentPosition(bestHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(bestHeading.compareDocumentPosition(friendHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByRole('heading', { name: '◷ 최근 올라온 그림' })).not.toBeInTheDocument();
  });
});
