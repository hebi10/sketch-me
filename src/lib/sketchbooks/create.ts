import type { Sketchbook } from '@/lib/domain/types';

interface CreateSketchbookDraftParams {
  id: string;
  publicId: string;
  name: string;
  manageTokenHash: string;
  createdAt: Date;
}

export function createSketchbookDraft({
  id,
  publicId,
  name,
  manageTokenHash,
  createdAt,
}: CreateSketchbookDraftParams): Sketchbook {
  return {
    id,
    publicId,
    name: name.trim(),
    manageTokenHash,
    referenceImagePath: null,
    referenceImageEnabled: false,
    participantLimit: 20,
    participantCount: 0,
    status: 'PUBLIC',
    createdAt,
    updatedAt: createdAt,
  };
}
