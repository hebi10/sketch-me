import { describe, expect, it } from 'vitest';
import { createSketchbookInputSchema, submitDrawingInputSchema } from '@/lib/domain/schemas';

describe('sketchbook input schemas', () => {
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
    expect(createSketchbookInputSchema.parse({ name: ' 도영 ' }).name).toBe('도영');
    expect(() => createSketchbookInputSchema.parse({ name: '가'.repeat(25) })).toThrow();
  });
});
