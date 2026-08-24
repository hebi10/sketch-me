export const STORY_WIDTH = 1080;
export const STORY_HEIGHT = 1440;

export interface StorySlot {
  rank: 1 | 2 | 3 | 4;
  x: number;
  y: number;
  width: number;
  height: number;
}

export const storySlots: readonly StorySlot[] = [
  { rank: 1, x: 210, y: 250, width: 660, height: 660 },
  { rank: 2, x: 75, y: 970, width: 250, height: 250 },
  { rank: 3, x: 415, y: 970, width: 250, height: 250 },
  { rank: 4, x: 755, y: 970, width: 250, height: 250 },
];
