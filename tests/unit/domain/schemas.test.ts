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
    expect(createSketchbookInputSchema.parse({ name: ' 테스트사용자 ', managePin: '1234', ownerImageDataUrl }).name).toBe('테스트사용자');
    expect(() =>
      createSketchbookInputSchema.parse({ name: '가'.repeat(25), managePin: '1234', ownerImageDataUrl }),
    ).toThrow();
  });

  it('requires a four-digit management PIN and limits its optional hint', () => {
    expect(createSketchbookInputSchema.safeParse({ name: '해비', managePin: '1234' }).success).toBe(true);
    expect(createSketchbookInputSchema.safeParse({ name: '해비', managePin: '123' }).success).toBe(false);
    expect(createSketchbookInputSchema.safeParse({ name: '해비', managePin: '12ab' }).success).toBe(false);
    expect(createSketchbookInputSchema.safeParse({ name: '해비' }).success).toBe(false);
    expect(createSketchbookInputSchema.safeParse({ name: '해비', managePin: '1234', managePinHint: '가'.repeat(41) }).success).toBe(false);
  });
});
