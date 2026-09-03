import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import { ManageDashboard } from '@/app/m/[publicId]/ManageDashboard';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }),
}));
vi.mock('@/lib/purchases/mode', () => ({
  getPublicPaymentMode: () => 'MOCK',
}));

describe('관리 화면 순위 카드 간격', () => {
  it('공개 상태나 메시지가 없을 때 빈 줄을 유지한다', () => {
    const createdAt = new Date('2026-09-03T00:00:00.000Z');

    render(
      <ManageDashboard
        drawings={[{
          authorName: '친구',
          bestRank: 1,
          createdAt,
          id: 'drawing-1',
          imagePath: 'sketchbooks/book-1/drawings/drawing-1.webp',
          message: null,
          moderatedAt: null,
          moderationStatus: 'ACTIVE',
          publicImageVersion: 'version-1',
          sketchbookId: 'book-1',
          sketchbookName: '내 이름',
          sketchbookPublicId: 'public-1',
          status: 'VISIBLE',
          thumbnailPath: null,
          updatedAt: createdAt,
        }]}
        moderationStatus="ACTIVE"
        name="내 이름"
        ownerDrawingPath="sketchbooks/book-1/owner/original.webp"
        participantCount={1}
        participantLimit={20}
        publicId="public-1"
      />,
    );

    const ownerCard = screen.getByRole('img', { name: '직접 그린 내 모습' }).closest('article');
    const friendCard = screen.getByRole('img', { name: '친구님의 그림' }).closest('article');

    expect(ownerCard?.querySelector('.drawing-card-placeholder')).toHaveAttribute('aria-hidden', 'true');
    expect(ownerCard?.querySelector('.drawing-card-placeholder')?.textContent).toBe('\u00a0');
    expect(friendCard?.querySelector('.drawing-card-placeholder')).toHaveAttribute('aria-hidden', 'true');
    expect(friendCard?.querySelector('.drawing-card-placeholder')?.textContent).toBe('\u00a0');
  });
});
