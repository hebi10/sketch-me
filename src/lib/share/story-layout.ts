export const STORY_WIDTH = 1080;
export const STORY_HEIGHT = 1920;

export interface StorySlot {
  rank: 1 | 2 | 3 | 4;
  x: number;
  y: number;
  width: number;
  height: number;
}

export const storySlots: readonly StorySlot[] = [
  { rank: 1, x: 130, y: 440, width: 820, height: 760 },
  { rank: 2, x: 105, y: 1270, width: 250, height: 330 },
  { rank: 3, x: 415, y: 1270, width: 250, height: 330 },
  { rank: 4, x: 725, y: 1270, width: 250, height: 330 },
];
