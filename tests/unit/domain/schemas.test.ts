import { describe, expect, it } from 'vitest';
import {
  createSketchbookInputSchema,
  submitDrawingInputSchema,
  submitDrawingPayloadSchema,
} from '@/lib/domain/schemas';

describe('sketchbook input schemas', () => {
  const ownerImageDataUrl = `data:image/png;base64,${Buffer.from('image').toString('base64')}`;

  it('rejects a blank drawing author name', () => {
    expect(() =>
      submitDrawingInputSchema.parse({
        authorName: ' ',
        imagePath: 'sketchbooks/abc/drawings/drawing.png',
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

  it('legacy reference-photo fields are discarded from create and drawing payloads', () => {
    const created = createSketchbookInputSchema.parse({
      managePin: '1234',
      name: '해비',
      referenceImageDataUrl: 'data:image/png;base64,bGVnYWN5',
    });
    const submitted = submitDrawingPayloadSchema.parse({
      authorName: '친구',
      imageDataUrl: ownerImageDataUrl,
      usedReferenceImage: true,
    });

    expect(created).not.toHaveProperty('referenceImageDataUrl');
    expect(submitted).not.toHaveProperty('usedReferenceImage');
  });
});
