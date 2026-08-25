import { z } from 'zod';

export const moderationPayloadSchema = z.object({
  moderationStatus: z.enum(['ACTIVE', 'BLOCKED']),
}).strict();
