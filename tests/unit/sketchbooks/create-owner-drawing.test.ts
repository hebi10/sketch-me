import { describe, expect, it } from 'vitest';

import { createSketchbookInputSchema } from '@/lib/domain/schemas';
import { getOwnerDrawingPath, getReferenceImagePath } from '@/lib/firebase/storage';
import { createSketchbookDraft } from '@/lib/sketchbooks/create';

const ownerImageDataUrl = `data:image/png;base64,${Buffer.from('owner-image').toString('base64')}`;

describe('owner sketchbook creation', () => {
  it('requires the creator drawing and accepts an optional reference image', () => {
    expect(createSketchbookInputSchema.safeParse({ name: '테스트사용자' }).success).toBe(false);
    expect(createSketchbookInputSchema.safeParse({ name: '테스트사용자', ownerImageDataUrl }).success).toBe(true);
    expect(createSketchbookInputSchema.safeParse({
      name: '테스트사용자',
      ownerImageDataUrl,
      referenceImageDataUrl: `data:image/jpeg;base64,${Buffer.from('reference').toString('base64')}`,
    }).success).toBe(true);
  });

  it('stores creator assets in stable sketchbook paths', () => {
    expect(getOwnerDrawingPath('book-1')).toBe('sketchbooks/book-1/owner/original.webp');
    expect(getReferenceImagePath('book-1')).toBe('sketchbooks/book-1/reference/source.webp');
  });

  it('records the creator drawing and enabled reference image', () => {
    const draft = createSketchbookDraft({
      id: 'book-1',
      publicId: 'public-1',
      name: ' 테스트사용자 ',
      manageTokenHash: 'hash',
      ownerDrawingPath: 'sketchbooks/book-1/owner/original.png',
      referenceImagePath: 'sketchbooks/book-1/reference/source',
      createdAt: new Date('2026-08-24T00:00:00.000Z'),
    });

    expect(draft).toMatchObject({
      ownerDrawingPath: 'sketchbooks/book-1/owner/original.png',
      referenceImagePath: 'sketchbooks/book-1/reference/source',
      referenceImageEnabled: true,
    });
  });
});
