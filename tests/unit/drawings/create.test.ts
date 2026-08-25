import { describe, expect, it } from 'vitest';

import { createDrawingDraft } from '@/lib/drawings/create';

describe('createDrawingDraft', () => {
  it('creates a visible unranked friend drawing', () => {
    const drawing = createDrawingDraft({
      id: 'drawing_123',
      sketchbookId: 'book_123',
      sketchbookPublicId: 'public-1',
      sketchbookName: '내 이름',
      imagePath: 'sketchbooks/book_123/drawings/drawing_123/original',
      authorName: '  수연 ',
      message: '  늘 응원해! ',
      usedReferenceImage: false,
      createdAt: new Date('2026-08-24T00:00:00.000Z'),
    });

    expect(drawing).toMatchObject({
      id: 'drawing_123',
      sketchbookPublicId: 'public-1',
      sketchbookName: '내 이름',
      authorName: '수연',
      message: '늘 응원해!',
      bestRank: null,
      moderationStatus: 'ACTIVE',
      moderatedAt: null,
      status: 'VISIBLE',
    });
  });
});
