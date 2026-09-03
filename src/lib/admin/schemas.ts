import { z } from 'zod';

const textEncoder = new TextEncoder();

const firestoreDocumentIdSchema = z.string()
  .min(1)
  .refine((value) => !value.includes('/'))
  .refine((value) => value !== '.' && value !== '..')
  .refine((value) => !(value.startsWith('__') && value.endsWith('__')))
  .refine((value) => textEncoder.encode(value).byteLength <= 1_500);

export const moderationPayloadSchema = z.object({
  moderationStatus: z.enum(['ACTIVE', 'BLOCKED']),
}).strict();

export const sketchbookDeletionPayloadSchema = z.object({
  confirmation: z.string().min(1).max(1_500),
}).strict();

export const sketchbookModerationParamsSchema = z.object({
  sketchbookId: firestoreDocumentIdSchema,
}).strict();

export const drawingModerationParamsSchema = z.object({
  drawingId: firestoreDocumentIdSchema,
  sketchbookId: firestoreDocumentIdSchema,
}).strict();
