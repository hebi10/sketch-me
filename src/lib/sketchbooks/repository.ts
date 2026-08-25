import type { Drawing, Sketchbook } from '@/lib/domain/types';
import { getAdminFirestore } from '@/lib/firebase/admin';
import type { PurchasePlan } from '@/lib/purchases/plans';

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
    ownerDrawingPath: data.ownerDrawingPath ? String(data.ownerDrawingPath) : null,
    referenceImagePath: data.referenceImagePath ? String(data.referenceImagePath) : null,
    referenceImageEnabled: Boolean(data.referenceImageEnabled),
    participantLimit: Number(data.participantLimit),
    participantCount: Number(data.participantCount),
    status: data.status as Sketchbook['status'],
    moderationStatus: data.moderationStatus === 'BLOCKED' ? 'BLOCKED' : 'ACTIVE',
    moderatedAt: data.moderatedAt ? toDate(data.moderatedAt) : null,
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
    sketchbookPublicId: String(data.sketchbookPublicId ?? ''),
    sketchbookName: String(data.sketchbookName ?? ''),
    imagePath: String(data.imagePath),
    authorName: String(data.authorName),
    message: data.message ? String(data.message) : null,
    usedReferenceImage: Boolean(data.usedReferenceImage),
    bestRank: (data.bestRank as Drawing['bestRank']) ?? null,
    status: data.status as Drawing['status'],
    moderationStatus: data.moderationStatus === 'BLOCKED' ? 'BLOCKED' : 'ACTIVE',
    moderatedAt: data.moderatedAt ? toDate(data.moderatedAt) : null,
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

export async function listDrawings(sketchbookId: string) {
  const snapshot = await getAdminFirestore()
    .collection(collectionName)
    .doc(sketchbookId)
    .collection('drawings')
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

export async function updateDrawingForManagement(
  sketchbookId: string,
  drawingId: string,
  update: { status?: Drawing['status']; bestRank?: Drawing['bestRank'] },
) {
  const reference = getAdminFirestore().collection(collectionName).doc(sketchbookId).collection('drawings').doc(drawingId);
  await reference.update({
    ...update,
    ...(update.status === 'HIDDEN' ? { bestRank: null } : {}),
    updatedAt: new Date(),
  });
}

export async function clearBestDrawing(sketchbookId: string, drawingId: string) {
  const reference = getAdminFirestore().collection(collectionName).doc(sketchbookId).collection('drawings').doc(drawingId);
  await reference.update({ bestRank: null, updatedAt: new Date() });
}

export async function deleteDrawingForManagement(sketchbookId: string, drawingId: string) {
  const firestore = getAdminFirestore();
  const sketchbookReference = firestore.collection(collectionName).doc(sketchbookId);
  const drawingReference = sketchbookReference.collection('drawings').doc(drawingId);

  return firestore.runTransaction(async (transaction) => {
    const [sketchbookDocument, drawingDocument] = await Promise.all([
      transaction.get(sketchbookReference),
      transaction.get(drawingReference),
    ]);
    if (!sketchbookDocument.exists || !drawingDocument.exists) {
      throw new Error('삭제할 그림을 찾을 수 없습니다.');
    }
    const drawing = drawingDocument.data();
    if (drawing?.status === 'DELETED') return null;
    transaction.update(drawingReference, { status: 'DELETED', bestRank: null, updatedAt: new Date() });
    transaction.update(sketchbookReference, {
      participantCount: Math.max(0, Number(sketchbookDocument.data()?.participantCount) - 1),
      updatedAt: new Date(),
    });
    return String(drawing?.imagePath ?? '');
  });
}

export async function setBestDrawing(sketchbookId: string, drawingId: string, bestRank: 1 | 2 | 3 | 4) {
  const firestore = getAdminFirestore();
  const collection = firestore.collection(collectionName).doc(sketchbookId).collection('drawings');
  const target = collection.doc(drawingId);

  await firestore.runTransaction(async (transaction) => {
    const [targetDocument, ranked] = await Promise.all([
      transaction.get(target),
      transaction.get(collection.where('bestRank', '==', bestRank)),
    ]);
    if (!targetDocument.exists || targetDocument.data()?.status !== 'VISIBLE') {
      throw new Error('공개 중인 그림만 BEST로 선정할 수 있습니다.');
    }
    ranked.docs.forEach((document) => transaction.update(document.ref, { bestRank: null, updatedAt: new Date() }));
    transaction.update(target, { bestRank, updatedAt: new Date() });
  });
}

export async function addMockPurchase(sketchbook: Sketchbook, plan: PurchasePlan, requestId: string) {
  const firestore = getAdminFirestore();
  const reference = firestore.collection(collectionName).doc(sketchbook.id);
  const purchaseReference = reference.collection('purchases').doc(requestId);
  return firestore.runTransaction(async (transaction) => {
    const [document, existingPurchase] = await Promise.all([
      transaction.get(reference),
      transaction.get(purchaseReference),
    ]);
    if (!document.exists) throw new Error('스캐치북을 찾을 수 없습니다.');
    const currentLimit = Number(document.data()?.participantLimit);
    if (existingPurchase.exists) return currentLimit;
    const participantLimit = currentLimit + plan.additionalLimit;
    transaction.update(reference, { participantLimit, updatedAt: new Date() });
    transaction.set(purchaseReference, {
      sketchbookId: sketchbook.id,
      sketchbookPublicId: sketchbook.publicId,
      sketchbookName: sketchbook.name,
      orderId: `mock_${requestId}`,
      provider: 'MOCK',
      productType: plan.productId,
      amount: plan.amount,
      additionalLimit: plan.additionalLimit,
      paymentStatus: 'SUCCEEDED',
      paidAt: new Date(),
      createdAt: new Date(),
    });
    return participantLimit;
  });
}

export async function deleteSketchbookPermanently(sketchbookId: string) {
  const firestore = getAdminFirestore();
  await firestore.recursiveDelete(firestore.collection(collectionName).doc(sketchbookId));
}
