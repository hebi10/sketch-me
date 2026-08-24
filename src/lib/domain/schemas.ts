import { z } from 'zod';

export const sketchbookStatusSchema = z.enum(['PUBLIC', 'PRIVATE', 'DELETED']);
export const drawingStatusSchema = z.enum(['VISIBLE', 'HIDDEN', 'DELETED']);

export const createSketchbookInputSchema = z.object({
  name: z.string().trim().min(1, '이름 또는 애칭을 입력해 주세요.').max(24, '이름은 24자 이내로 입력해 주세요.'),
});

export const submitDrawingInputSchema = z.object({
  authorName: z.string().trim().min(1, '이름을 입력해 주세요.').max(24, '이름은 24자 이내로 입력해 주세요.'),
  message: z.string().trim().max(120, '한마디는 120자 이내로 입력해 주세요.').optional(),
  imagePath: z.string().startsWith('sketchbooks/'),
  usedReferenceImage: z.boolean(),
});
