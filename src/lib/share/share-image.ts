export type ShareImageMode = 'single' | 'best';
export type ShareDrawingSource = 'owner' | 'friend';

export const SINGLE_IMAGE_DEFAULT_HEADING = '친구가 그린 나';

export interface ShareDrawingOption {
  authorName: string;
  bestRank: 1 | 2 | 3 | 4 | null;
  createdAt: string | null;
  id: string;
  imageUrl: string;
  source: ShareDrawingSource;
}

export function parseShareImageMode(value: unknown): ShareImageMode | null {
  return value === 'single' || value === 'best' ? value : null;
}
