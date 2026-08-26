import type { Drawing } from '@/lib/domain/types';
import { randomUUID } from 'node:crypto';

interface CreateDrawingDraftParams {
  id: string;
  sketchbookId: string;
  sketchbookPublicId: string;
  sketchbookName: string;
  imagePath: string;
  thumbnailPath: string;
  authorName: string;
  message?: string;
  usedReferenceImage: boolean;
  createdAt: Date;
}

export function createDrawingDraft({
  id,
  sketchbookId,
  sketchbookPublicId,
  sketchbookName,
  imagePath,
  thumbnailPath,
  authorName,
  message,
  usedReferenceImage,
  createdAt,
}: CreateDrawingDraftParams): Drawing {
  const trimmedMessage = message?.trim();

  return {
    id,
    sketchbookId,
    sketchbookPublicId,
    sketchbookName,
    imagePath,
    thumbnailPath,
    publicImageVersion: randomUUID(),
    authorName: authorName.trim(),
    message: trimmedMessage || null,
    usedReferenceImage,
    bestRank: null,
    status: 'VISIBLE',
    moderationStatus: 'ACTIVE',
    moderatedAt: null,
    createdAt,
    updatedAt: createdAt,
  };
}
