import { describe, expect, it } from 'vitest';

import { createSketchbookInputSchema } from '@/lib/domain/schemas';
import { getOwnerDrawingPath } from '@/lib/firebase/storage';
import { createSketchbookDraft } from '@/lib/sketchbooks/create';

const ownerImageDataUrl = `data:image/png;base64,${Buffer.from('owner-image').toString('base64')}`;

describe('owner sketchbook creation', () => {
  it('allows the creator drawing to be skipped', () => {
    expect(createSketchbookInputSchema.safeParse({ name: '테스트사용자', managePin: '1234' }).success).toBe(true);
    expect(createSketchbookInputSchema.safeParse({ name: '테스트사용자', managePin: '1234', ownerImageDataUrl }).success).toBe(true);
  });

  it('stores the creator drawing in a stable sketchbook path', () => {
    expect(getOwnerDrawingPath('book-1')).toBe('sketchbooks/book-1/owner/original.webp');
  });

  it('records only the creator drawing', () => {
    const draft = createSketchbookDraft({
      id: 'book-1',
      publicId: 'public-1',
      name: ' 테스트사용자 ',
      manageTokenHash: 'hash',
      ownerDrawingPath: 'sketchbooks/book-1/owner/original.png',
      createdAt: new Date('2026-08-24T00:00:00.000Z'),
    });

    expect(draft).toMatchObject({
      ownerDrawingPath: 'sketchbooks/book-1/owner/original.png',
    });
    expect(draft).not.toHaveProperty('referenceImagePath');
    expect(draft).not.toHaveProperty('referenceImageEnabled');
  });
});
