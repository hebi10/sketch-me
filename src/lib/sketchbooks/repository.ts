import type { Drawing, Sketchbook } from '@/lib/domain/types';
import { getAdminFirestore } from '@/lib/firebase/admin';

const collectionName = 'sketchbooks';

function toDate(value: unknown) {
  return value && typeof value === 'object' && 'toDate' in value
    ? (value as { toDate: () => Date }).toDate()
    : new Date(value as string | number | Date);
}

function toSketchbook(id: string, data: Record<string, unknown>): Sketchbook {
  return {
    id,
    publicId: String(data.publicId),
    name: String(data.name),
    manageTokenHash: String(data.manageTokenHash),
    referenceImagePath: data.referenceImagePath ? String(data.referenceImagePath) : null,
    referenceImageEnabled: Boolean(data.referenceImageEnabled),
    participantLimit: Number(data.participantLimit),
    participantCount: Number(data.participantCount),
    status: data.status as Sketchbook['status'],
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

export async function saveSketchbook(sketchbook: Sketchbook) {
  await getAdminFirestore().collection(collectionName).doc(sketchbook.id).set(sketchbook);
  return sketchbook;
}

export async function findSketchbookByPublicId(publicId: string) {
  const snapshot = await getAdminFirestore()
    .collection(collectionName)
    .where('publicId', '==', publicId)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  const document = snapshot.docs[0];
  return toSketchbook(document.id, document.data());
}

function toDrawing(id: string, data: Record<string, unknown>): Drawing {
  return {
    id,
    sketchbookId: String(data.sketchbookId),
    imagePath: String(data.imagePath),
    authorName: String(data.authorName),
    message: data.message ? String(data.message) : null,
    usedReferenceImage: Boolean(data.usedReferenceImage),
    bestRank: (data.bestRank as Drawing['bestRank']) ?? null,
    status: data.status as Drawing['status'],
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

export async function listVisibleDrawings(sketchbookId: string) {
  const snapshot = await getAdminFirestore()
    .collection(collectionName)
    .doc(sketchbookId)
    .collection('drawings')
    .where('status', '==', 'VISIBLE')
    .orderBy('createdAt', 'desc')
    .get();

  return snapshot.docs.map((document) => toDrawing(document.id, document.data()));
}

export async function findDrawing(sketchbookId: string, drawingId: string) {
  const document = await getAdminFirestore()
    .collection(collectionName)
    .doc(sketchbookId)
    .collection('drawings')
    .doc(drawingId)
    .get();

  if (!document.exists) {
    return null;
  }

  return toDrawing(document.id, document.data() ?? {});
}

export async function saveDrawingWithinLimit(sketchbook: Sketchbook, drawing: Drawing) {
  const firestore = getAdminFirestore();
  const sketchbookReference = firestore.collection(collectionName).doc(sketchbook.id);
  const drawingReference = sketchbookReference.collection('drawings').doc(drawing.id);

  await firestore.runTransaction(async (transaction) => {
    const current = await transaction.get(sketchbookReference);
    const currentData = current.data();

    if (!current.exists || currentData?.status !== 'PUBLIC') {
      throw new Error('스캐치북을 찾을 수 없거나 공개되어 있지 않습니다.');
    }

    if (Number(currentData.participantCount) >= Number(currentData.participantLimit)) {
      throw new Error('친구 그림을 더 받을 수 있는 인원이 모두 찼습니다.');
    }

    transaction.set(drawingReference, drawing);
    transaction.update(sketchbookReference, {
      participantCount: Number(currentData.participantCount) + 1,
      updatedAt: new Date(),
    });
  });

  return drawing;
}
