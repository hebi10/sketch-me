import { describe, expect, it } from 'vitest';

import { isSketchbookFull } from '@/lib/sketchbooks/capacity';

describe('isSketchbookFull', () => {
  it('returns false while a participant slot remains', () => {
    expect(isSketchbookFull({ participantCount: 19, participantLimit: 20 })).toBe(false);
  });

  it('returns true at or above the participant limit', () => {
    expect(isSketchbookFull({ participantCount: 20, participantLimit: 20 })).toBe(true);
    expect(isSketchbookFull({ participantCount: 21, participantLimit: 20 })).toBe(true);
  });
});
