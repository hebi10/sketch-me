import type { Sketchbook } from '@/lib/domain/types';
import { FREE_PARTICIPANT_LIMIT } from './capacity';

interface CreateSketchbookDraftParams {
  id: string;
  publicId: string;
  name: string;
  manageTokenHash: string;
  managePinHash?: string | null;
  managePinHint?: string | null;
  ownerDrawingPath?: string | null;
  referenceImagePath?: string | null;
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
  referenceImagePath = null,
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
    ownerDrawingPath,
    referenceImagePath,
    referenceImageEnabled: Boolean(referenceImagePath),
    entitlements: { watermarkFree: false },
    participantLimit: FREE_PARTICIPANT_LIMIT,
    participantCount: 0,
    status: 'PUBLIC',
    moderationStatus: 'ACTIVE',
    moderatedAt: null,
    createdAt,
    updatedAt: createdAt,
  };
}
