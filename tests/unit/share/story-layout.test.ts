import { describe, expect, it } from 'vitest';

import { STORY_HEIGHT, STORY_WIDTH, storySlots } from '@/lib/share/story-layout';

function overlaps(a: (typeof storySlots)[number], b: (typeof storySlots)[number]) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

describe('story image layout', () => {
  it('keeps all four slots inside a 1080 by 1440 canvas without overlap', () => {
    expect(storySlots).toHaveLength(4);
    storySlots.forEach((slot) => {
      expect(slot.x).toBeGreaterThanOrEqual(0);
      expect(slot.y).toBeGreaterThanOrEqual(0);
      expect(slot.x + slot.width).toBeLessThanOrEqual(STORY_WIDTH);
      expect(slot.y + slot.height).toBeLessThanOrEqual(STORY_HEIGHT);
    });
    storySlots.forEach((slot, index) => storySlots.slice(index + 1).forEach((other) => {
      expect(overlaps(slot, other)).toBe(false);
    }));
  });

  it('uses the largest area for BEST 1', () => {
    const [bestOne, ...others] = storySlots;
    const bestOneArea = bestOne.width * bestOne.height;
    expect(others.every((slot) => bestOneArea > slot.width * slot.height)).toBe(true);
  });

  it('uses square artwork slots for every BEST drawing', () => {
    expect(storySlots.every((slot) => slot.width === slot.height)).toBe(true);
  });
});
