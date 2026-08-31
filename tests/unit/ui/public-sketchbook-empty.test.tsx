import { render, screen, within } from '@testing-library/react';
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
import type { Sketchbook } from '@/lib/domain/types';

const createdAt = new Date('2026-08-26T00:00:00.000Z');
const emptySketchbook: Sketchbook = {
  createdAt,
  id: 'book-1',
  managePinEnabledAt: createdAt,
  managePinHash: 'scrypt$salt$hash',
  managePinHint: null,
  manageTokenHash: 'legacy-hash',
  moderatedAt: null,
  moderationStatus: 'ACTIVE',
  name: '해비',
  ownerDrawingPath: null,
  participantCount: 0,
  participantLimit: 20,
  publicId: 'public-1',
  entitlements: { watermarkFree: false },
  status: 'PUBLIC',
  updatedAt: createdAt,
};

describe('빈 공개 스케치북', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findSketchbookByPublicId.mockResolvedValue(emptySketchbook);
    listVisibleDrawings.mockResolvedValue([]);
  });

  it('첫 참여를 유도하고 BEST와 최근 그림 영역은 보이지 않는다', async () => {
    render(await PublicSketchbookPage({
      params: Promise.resolve({ publicId: 'public-1' }),
      searchParams: Promise.resolve({}),
    }));

    expect(screen.getByRole('heading', { name: '첫 그림을 남겨주세요' })).toBeVisible();
    expect(screen.getByRole('link', { name: '첫 그림 남기기' })).toHaveAttribute('href', '/s/public-1/draw');
    expect(screen.queryByRole('heading', { name: '♕ 베스트 그림' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '◷ 최근 올라온 그림' })).not.toBeInTheDocument();
  });

  it('첫 그림 CTA 다음에 방문자용 스케치북 생성 CTA를 제공한다', async () => {
    render(await PublicSketchbookPage({
      params: Promise.resolve({ publicId: 'public-1' }),
      searchParams: Promise.resolve({}),
    }));

    const emptyState = screen.getByRole('region', { name: '첫 그림을 남겨주세요' });
    const drawLink = within(emptyState).getByRole('link', { name: '첫 그림 남기기' });
    const createLink = within(emptyState).getByRole('link', { name: '내 스케치북 만들기' });

    expect(createLink).toHaveAttribute('href', '/create');
    expect(drawLink.compareDocumentPosition(createLink) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
