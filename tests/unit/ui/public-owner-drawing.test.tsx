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
});
