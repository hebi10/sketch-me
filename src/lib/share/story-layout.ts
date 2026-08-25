export const STORY_WIDTH = 1080;
export const STORY_HEIGHT = 1440;
export const STORY_SHARED_HEADING = '친구들이 그린 내 모습';
export const STORY_SHARED_HEADING_Y = 94;
export const STORY_BEST_TITLE_Y = 180;

export interface StorySlot {
  rank: 1 | 2 | 3 | 4;
  x: number;
  y: number;
  width: number;
  height: number;
}

export const storySlots: readonly StorySlot[] = [
  { rank: 1, x: 210, y: 308, width: 660, height: 660 },
  { rank: 2, x: 129, y: 999, width: 250, height: 250 },
  { rank: 3, x: 415, y: 999, width: 250, height: 250 },
  { rank: 4, x: 701, y: 999, width: 250, height: 250 },
];
