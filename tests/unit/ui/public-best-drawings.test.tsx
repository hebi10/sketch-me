import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

const { findSketchbookByPublicId, listVisibleDrawings } = vi.hoisted(() => ({
  findSketchbookByPublicId: vi.fn(),
  listVisibleDrawings: vi.fn(),
}));

vi.mock('@/lib/sketchbooks/repository', () => ({
  findSketchbookByPublicId,
  listVisibleDrawings,
}));

import PublicSketchbookPage from '@/app/s/[publicId]/page';
import type { Drawing, Sketchbook } from '@/lib/domain/types';

const createdAt = new Date('2026-09-04T00:00:00.000Z');
const sketchbook: Sketchbook = {
  createdAt,
  entitlements: { watermarkFree: false },
  id: 'book-1',
  managePinEnabledAt: createdAt,
  managePinHash: 'scrypt$salt$hash',
  managePinHint: null,
  manageTokenHash: 'legacy-hash',
  moderatedAt: null,
  moderationStatus: 'ACTIVE',
  name: '해비',
  ownerDrawingPath: null,
  participantCount: 1,
  participantLimit: 20,
  publicId: 'public-1',
  status: 'PUBLIC',
  updatedAt: createdAt,
};
const drawing: Drawing = {
  authorName: '친구',
  bestRank: null,
  createdAt,
  id: 'drawing-1',
  imagePath: 'sketchbooks/book-1/drawings/drawing-1.webp',
  message: null,
  moderatedAt: null,
  moderationStatus: 'ACTIVE',
  publicImageVersion: 'version-1',
  sketchbookId: 'book-1',
  sketchbookName: '해비',
  sketchbookPublicId: 'public-1',
  status: 'VISIBLE',
  thumbnailPath: 'sketchbooks/book-1/drawings/drawing-1-thumbnail.webp',
  updatedAt: createdAt,
};

describe('공개 BEST 그림', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findSketchbookByPublicId.mockResolvedValue(sketchbook);
  });

  it('친구 그림은 있지만 BEST가 없으면 빈 BEST 슬롯을 표시하지 않는다', async () => {
    listVisibleDrawings.mockResolvedValue([{ ...drawing, bestRank: null }]);

    render(await PublicSketchbookPage({
      params: Promise.resolve({ publicId: 'public-1' }),
      searchParams: Promise.resolve({}),
    }));

    expect(screen.queryByRole('heading', { name: '♕ 베스트 그림' })).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: '친구님의 그림' })).toBeVisible();
  });

  it('선정된 BEST 카드만 순서대로 표시한다', async () => {
    listVisibleDrawings.mockResolvedValue([{ ...drawing, bestRank: 2, id: 'drawing-2' }]);

    render(await PublicSketchbookPage({
      params: Promise.resolve({ publicId: 'public-1' }),
      searchParams: Promise.resolve({}),
    }));

    expect(screen.getByText('BEST 2')).toBeVisible();
    expect(screen.queryByText('선정 전')).not.toBeInTheDocument();
    expect(screen.queryByText('BEST 1')).not.toBeInTheDocument();
  });
});
