import type { ModerationStatus } from '@/lib/domain/types';
import { getAdminFirestore } from '@/lib/firebase/admin';
import type { Firestore } from 'firebase-admin/firestore';

type ModerationResult = {
  changed: boolean;
  status: ModerationStatus;
};

type SketchbookModerationInput = {
  adminUid: string;
  moderationStatus: ModerationStatus;
  sketchbookId: string;
};

type DrawingModerationInput = SketchbookModerationInput & {
  drawingId: string;
};

export class ModerationTargetNotFoundError extends Error {
  constructor() {
    super('운영 상태를 변경할 대상을 찾을 수 없습니다.');
    this.name = 'ModerationTargetNotFoundError';
  }
}

function readModerationStatus(value: unknown): ModerationStatus {
  return value === 'BLOCKED' ? 'BLOCKED' : 'ACTIVE';
}

export async function setSketchbookModeration(
  input: SketchbookModerationInput,
  firestore: Firestore = getAdminFirestore(),
): Promise<ModerationResult> {
  const sketchbookReference = firestore.collection('sketchbooks').doc(input.sketchbookId);

  return firestore.runTransaction(async (transaction) => {
    const sketchbook = await transaction.get(sketchbookReference);
    if (!sketchbook.exists) throw new ModerationTargetNotFoundError();

    const previous = readModerationStatus(sketchbook.data()?.moderationStatus);
    if (previous === input.moderationStatus) {
      return { changed: false, status: previous };
    }

    const now = new Date();
    transaction.update(sketchbookReference, {
      moderatedAt: now,
      moderationStatus: input.moderationStatus,
    });
    transaction.set(firestore.collection('adminAuditLogs').doc(), {
      action: input.moderationStatus === 'BLOCKED'
        ? 'BLOCK_SKETCHBOOK'
        : 'UNBLOCK_SKETCHBOOK',
      adminUid: input.adminUid,
      createdAt: now,
      nextModerationStatus: input.moderationStatus,
      previousModerationStatus: previous,
      publicId: String(sketchbook.data()?.publicId ?? ''),
      targetId: input.sketchbookId,
      targetType: 'SKETCHBOOK',
    });

    return { changed: true, status: input.moderationStatus };
  });
}

export async function setDrawingModeration(
  input: DrawingModerationInput,
): Promise<ModerationResult> {
  const firestore = getAdminFirestore();
  const sketchbookReference = firestore.collection('sketchbooks').doc(input.sketchbookId);
  const drawingReference = sketchbookReference.collection('drawings').doc(input.drawingId);

  return firestore.runTransaction(async (transaction) => {
    const [drawing, sketchbook] = await transaction.getAll(
      drawingReference,
      sketchbookReference,
    );
    if (!drawing.exists || !sketchbook.exists) {
      throw new ModerationTargetNotFoundError();
    }

    const previous = readModerationStatus(drawing.data()?.moderationStatus);
    if (previous === input.moderationStatus) {
      return { changed: false, status: previous };
    }

    const now = new Date();
    transaction.update(drawingReference, {
      moderatedAt: now,
      moderationStatus: input.moderationStatus,
    });
    transaction.set(firestore.collection('adminAuditLogs').doc(), {
      action: input.moderationStatus === 'BLOCKED'
        ? 'BLOCK_DRAWING'
        : 'UNBLOCK_DRAWING',
      adminUid: input.adminUid,
      createdAt: now,
      nextModerationStatus: input.moderationStatus,
      previousModerationStatus: previous,
      publicId: String(sketchbook.data()?.publicId ?? ''),
      targetId: input.drawingId,
      targetType: 'DRAWING',
    });

    return { changed: true, status: input.moderationStatus };
  });
}
