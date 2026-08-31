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
      thumbnailPath: 'sketchbooks/book_123/drawings/drawing_123/thumbnail.webp',
      authorName: '  수연 ',
      message: '  늘 응원해! ',
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
      thumbnailPath: 'sketchbooks/book_123/drawings/drawing_123/thumbnail.webp',
      publicImageVersion: expect.stringMatching(/^[0-9a-f-]{36}$/),
      status: 'VISIBLE',
    });
    expect(drawing).not.toHaveProperty('usedReferenceImage');
  });
});
