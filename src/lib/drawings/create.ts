import type { Drawing } from '@/lib/domain/types';

interface CreateDrawingDraftParams {
  id: string;
  sketchbookId: string;
  imagePath: string;
  authorName: string;
  message?: string;
  usedReferenceImage: boolean;
  createdAt: Date;
}

export function createDrawingDraft({
  id,
  sketchbookId,
  imagePath,
  authorName,
  message,
  usedReferenceImage,
  createdAt,
}: CreateDrawingDraftParams): Drawing {
  const trimmedMessage = message?.trim();

  return {
    id,
    sketchbookId,
    imagePath,
    authorName: authorName.trim(),
    message: trimmedMessage || null,
    usedReferenceImage,
    bestRank: null,
    status: 'VISIBLE',
    createdAt,
    updatedAt: createdAt,
  };
}
