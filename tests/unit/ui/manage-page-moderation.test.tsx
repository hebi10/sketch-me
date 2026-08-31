import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

const {
  findSketchbookByPublicId,
  getManagedSketchbook,
  listDrawings,
  notFound,
  redirect,
} = vi.hoisted(() => ({
  findSketchbookByPublicId: vi.fn(),
  getManagedSketchbook: vi.fn(),
  listDrawings: vi.fn(),
  notFound: vi.fn(() => { throw new Error('NEXT_NOT_FOUND'); }),
  redirect: vi.fn(() => { throw new Error('NEXT_REDIRECT'); }),
}));

vi.mock('next/navigation', () => ({
  notFound,
  redirect,
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }),
}));
vi.mock('@/lib/sketchbooks/management', () => ({ getManagedSketchbook }));
vi.mock('@/lib/sketchbooks/repository', () => ({
  findSketchbookByPublicId,
  listDrawings,
}));

import ManagePage from '@/app/m/[publicId]/page';
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

describe('BLOCKED 스케치북 관리 페이지', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getManagedSketchbook.mockResolvedValue(blockedSketchbook);
    listDrawings.mockResolvedValue([]);
  });

  it('인증된 소유자에게 이유를 노출하지 않는 운영자 제한·숨김 안내와 보호된 원본을 보여준다', async () => {
    render(await ManagePage({ params: Promise.resolve({ publicId: 'public-1' }) }));

    const notice = screen.getByText('운영자 제한').closest('[role="status"]');
    expect(notice).not.toBeNull();
    expect(notice).toHaveTextContent('운영자 제한');
    expect(notice).toHaveTextContent('친구 페이지에서 숨김');
    expect(notice).not.toHaveTextContent(/admin|UID|사유/i);
    expect(screen.getByRole('img', { name: '직접 그린 내 모습' })).toHaveAttribute(
      'src',
      expect.stringContaining('/api/manage/public-1/owner/image'),
    );
  });
});
