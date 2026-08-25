import { z } from 'zod';

const firestoreDocumentIdSchema = z.string()
  .min(1)
  .refine((value) => !value.includes('/'));

export const moderationPayloadSchema = z.object({
  moderationStatus: z.enum(['ACTIVE', 'BLOCKED']),
}).strict();

export const sketchbookModerationParamsSchema = z.object({
  sketchbookId: firestoreDocumentIdSchema,
}).strict();

export const drawingModerationParamsSchema = z.object({
  drawingId: firestoreDocumentIdSchema,
  sketchbookId: firestoreDocumentIdSchema,
}).strict();
