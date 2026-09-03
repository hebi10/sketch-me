import type { Sketchbook } from '@/lib/domain/types';
import { STORY_SHARED_HEADING } from '@/lib/share/story-layout';
import { FREE_PARTICIPANT_LIMIT } from './capacity';

interface CreateSketchbookDraftParams {
  id: string;
  publicId: string;
  name: string;
  manageTokenHash: string;
  managePinHash?: string | null;
  managePinHint?: string | null;
  ownerDrawingPath?: string | null;
  createdAt: Date;
}

export function createSketchbookDraft({
  id,
  publicId,
  name,
  manageTokenHash,
  managePinHash = null,
  managePinHint = null,
  ownerDrawingPath = null,
  createdAt,
}: CreateSketchbookDraftParams): Sketchbook {
  return {
    id,
    publicId,
    name: name.trim(),
    manageTokenHash,
    managePinHash,
    managePinHint: managePinHint?.trim() || null,
    managePinEnabledAt: managePinHash ? createdAt : null,
    ownerBestRank: null,
    ownerDrawingPath,
    entitlements: { watermarkFree: false },
    participantLimit: FREE_PARTICIPANT_LIMIT,
    participantCount: 0,
    status: 'PUBLIC',
    shareThumbnailMode: 'DEFAULT',
    storyHeading: STORY_SHARED_HEADING,
    moderationStatus: 'ACTIVE',
    moderatedAt: null,
    createdAt,
    updatedAt: createdAt,
  };
}
