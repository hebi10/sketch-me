import type { Sketchbook } from '@/lib/domain/types';
import { SINGLE_IMAGE_DEFAULT_HEADING } from '@/lib/share/share-image';
import { STORY_SHARED_HEADING } from '@/lib/share/story-layout';
import { FREE_PARTICIPANT_LIMIT } from './capacity';
import { addCalendarMonths } from './retention';

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
    retentionExpiresAt: addCalendarMonths(createdAt, 6),
    retentionGuaranteedUntil: null,
    retentionTier: 'FREE',
    status: 'PUBLIC',
    shareThumbnailMode: 'DEFAULT',
    singleStoryHeading: SINGLE_IMAGE_DEFAULT_HEADING,
    storyHeading: STORY_SHARED_HEADING,
    moderationStatus: 'ACTIVE',
    moderatedAt: null,
    createdAt,
    updatedAt: createdAt,
  };
}
