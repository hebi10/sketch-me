import { describe, expect, it } from 'vitest';
import { createSketchbookInputSchema, submitDrawingInputSchema } from '@/lib/domain/schemas';

describe('sketchbook input schemas', () => {
  const ownerImageDataUrl = `data:image/png;base64,${Buffer.from('image').toString('base64')}`;

  it('rejects a blank drawing author name', () => {
    expect(() =>
      submitDrawingInputSchema.parse({
        authorName: ' ',
        imagePath: 'sketchbooks/abc/drawings/drawing.png',
        usedReferenceImage: false,
      }),
    ).toThrow();
  });

  it('trims valid creator names and rejects names longer than 24 characters', () => {
    expect(createSketchbookInputSchema.parse({ name: ' 도영 ', ownerImageDataUrl }).name).toBe('도영');
    expect(() =>
      createSketchbookInputSchema.parse({ name: '가'.repeat(25), ownerImageDataUrl }),
    ).toThrow();
  });
});
