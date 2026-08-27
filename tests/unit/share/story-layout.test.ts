import { describe, expect, it } from 'vitest';

import { STORY_HEIGHT, STORY_WIDTH, storySlots, storyWatermark } from '@/lib/share/story-layout';

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

  it('matches the preview positions used for the downloadable image', () => {
    expect(storySlots).toEqual([
      { rank: 1, x: 195, y: 275, width: 690, height: 690 },
      { rank: 2, x: 107, y: 1015, width: 270, height: 270 },
      { rank: 3, x: 405, y: 1015, width: 270, height: 270 },
      { rank: 4, x: 703, y: 1015, width: 270, height: 270 },
    ]);
  });

  it('places the centered watermark across BEST 1 and the lower BEST row', () => {
    const [bestOne, ...lowerSlots] = storySlots;
    const watermarkBottom = storyWatermark.y + storyWatermark.height;

    expect(storyWatermark.x + storyWatermark.width / 2).toBe(STORY_WIDTH / 2);
    expect(storyWatermark.y).toBeLessThan(bestOne.y + bestOne.height);
    lowerSlots.forEach((slot) => expect(watermarkBottom).toBeGreaterThan(slot.y));
  });
});
