import { describe, expect, it } from 'vitest';

import { createSketchbookDraft } from '@/lib/sketchbooks/create';

describe('createSketchbookDraft', () => {
  it('creates a public sketchbook with the free participant limit', () => {
    const draft = createSketchbookDraft({
      id: 'book_123',
      publicId: 'doyoung-abc123',
      name: '  도영  ',
      manageTokenHash: 'hashed-token',
      ownerDrawingPath: 'sketchbooks/book_123/owner/original.png',
      createdAt: new Date('2026-08-24T00:00:00.000Z'),
    });

    expect(draft).toMatchObject({
      id: 'book_123',
      publicId: 'doyoung-abc123',
      name: '도영',
      manageTokenHash: 'hashed-token',
      participantLimit: 20,
      participantCount: 0,
      referenceImagePath: null,
      referenceImageEnabled: false,
      status: 'PUBLIC',
    });
  });
});
