export const STORY_WIDTH = 1080;
export const STORY_HEIGHT = 1440;
export const STORY_SHARED_HEADING = '친구들이 그린 내 모습';
export const STORY_SHARED_HEADING_Y = 94;
export const STORY_BEST_TITLE_Y = 180;
export const STORY_CTA_Y = 1305;
export const STORY_PUBLIC_URL_Y = 1418;

export interface StorySlot {
  rank: 1 | 2 | 3 | 4;
  x: number;
  y: number;
  width: number;
  height: number;
}

export const storySlots: readonly StorySlot[] = [
  { rank: 1, x: 195, y: 275, width: 690, height: 690 },
  { rank: 2, x: 107, y: 1015, width: 270, height: 270 },
  { rank: 3, x: 405, y: 1015, width: 270, height: 270 },
  { rank: 4, x: 703, y: 1015, width: 270, height: 270 },
];

export const storyWatermark = {
  height: 110,
  iconSize: 96,
  opacity: 0.42,
  width: 324,
  x: 378,
  y: 935,
} as const;
