import { z } from 'zod';

export const sketchbookStatusSchema = z.enum(['PUBLIC', 'PRIVATE', 'DELETED']);
export const drawingStatusSchema = z.enum(['VISIBLE', 'HIDDEN', 'DELETED']);

export const createSketchbookInputSchema = z.object({
  name: z.string().trim().min(1, '이름 또는 애칭을 입력해 주세요.').max(24, '이름은 24자 이내로 입력해 주세요.'),
  managePin: z.string().regex(/^\d{4}$/, '관리 비밀번호는 숫자 4자리로 입력해 주세요.'),
  managePinHint: z.string().trim().max(40, '비밀번호 힌트는 40자 이내로 입력해 주세요.').optional(),
  ownerImageDataUrl: z
    .string()
    .regex(/^data:image\/(png|webp);base64,/, '본인 그림 데이터를 다시 확인해 주세요.')
    .max(2_800_000, '본인 그림은 2MB 이하로 저장해 주세요.')
    .optional(),
});

export const submitDrawingInputSchema = z.object({
  authorName: z.string().trim().min(1, '이름을 입력해 주세요.').max(24, '이름은 24자 이내로 입력해 주세요.'),
  message: z.string().trim().max(120, '한마디는 120자 이내로 입력해 주세요.').optional(),
  imagePath: z.string().startsWith('sketchbooks/'),
});

export const submitDrawingPayloadSchema = z.object({
  authorName: z.string().trim().min(1, '이름을 입력해 주세요.').max(24, '이름은 24자 이내로 입력해 주세요.'),
  message: z.string().trim().max(120, '한마디는 120자 이내로 입력해 주세요.').optional(),
  imageDataUrl: z
    .string()
    .regex(/^data:image\/(png|jpeg|webp);base64,/, '그림 데이터를 다시 확인해 주세요.')
    .max(2_800_000, '그림 파일은 2MB 이하로 올려주세요.'),
});

export const updateOwnerDrawingPayloadSchema = z.object({
  imageDataUrl: z
    .string()
    .regex(/^data:image\/(png|jpeg|webp);base64,/, '본인 그림 데이터를 다시 확인해 주세요.')
    .max(2_800_000, '본인 그림은 2MB 이하로 저장해 주세요.'),
});
