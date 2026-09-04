import type { Drawing, Sketchbook } from '@/lib/domain/types';

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

export function normalizeDrawingAuthorQuery(value: string): string {
  return value.trim().toLocaleLowerCase('ko-KR');
}

export function filterShareDrawings(
  drawings: ShareDrawingOption[],
  query: string,
): ShareDrawingOption[] {
  const normalized = normalizeDrawingAuthorQuery(query);
  if (!normalized) return [];
  return drawings.filter((drawing) => (
    drawing.source === 'friend'
    && normalizeDrawingAuthorQuery(drawing.authorName).includes(normalized)
  ));
}

export function buildFriendShareDrawingOptions(
  publicId: string,
  drawings: Drawing[],
): ShareDrawingOption[] {
  return drawings
    .filter((drawing) => drawing.status === 'VISIBLE' && drawing.moderationStatus === 'ACTIVE')
    .map((drawing) => ({
      authorName: drawing.authorName,
      bestRank: drawing.bestRank,
      createdAt: drawing.createdAt.toISOString(),
      id: drawing.id,
      imageUrl: `/api/manage/${publicId}/drawings/${drawing.id}/image`,
      source: 'friend' as const,
    }));
}

export function buildOwnerShareDrawingOption(
  publicId: string,
  sketchbook: Pick<Sketchbook, 'name' | 'ownerBestRank' | 'ownerDrawingPath'>,
): ShareDrawingOption | null {
  if (!sketchbook.ownerDrawingPath) return null;
  return {
    authorName: sketchbook.name,
    bestRank: sketchbook.ownerBestRank ?? null,
    createdAt: null,
    id: 'owner',
    imageUrl: `/api/manage/${publicId}/owner/image`,
    source: 'owner',
  };
}
