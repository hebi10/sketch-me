import type { Sketchbook } from '@/lib/domain/types';

interface CreateSketchbookDraftParams {
  id: string;
  publicId: string;
  name: string;
  manageTokenHash: string;
  ownerDrawingPath: string;
  referenceImagePath?: string | null;
  createdAt: Date;
}

export function createSketchbookDraft({
  id,
  publicId,
  name,
  manageTokenHash,
  ownerDrawingPath,
  referenceImagePath = null,
  createdAt,
}: CreateSketchbookDraftParams): Sketchbook {
  return {
    id,
    publicId,
    name: name.trim(),
    manageTokenHash,
    ownerDrawingPath,
    referenceImagePath,
    referenceImageEnabled: Boolean(referenceImagePath),
    participantLimit: 20,
    participantCount: 0,
    status: 'PUBLIC',
    createdAt,
    updatedAt: createdAt,
  };
}
