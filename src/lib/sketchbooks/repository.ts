import type { Drawing, Sketchbook } from '@/lib/domain/types';
import { getAdminFirestore } from '@/lib/firebase/admin';
import type { PurchasePlan } from '@/lib/purchases/plans';
import type { ManagePinAttemptState } from '@/lib/security/manage-pin-attempt';
import { randomUUID } from 'node:crypto';
import { createManageSessionToken, hashManageSessionToken } from './manage-pin';
import {
  isValidManageToken,
  type LegacyManageSession,
  type PinManageSession,
} from './manage-session';

const collectionName = 'sketchbooks';
const deletionJobCollectionName = 'sketchbookDeletionJobs';

export interface SketchbookDeletionJob {
  publicId: string;
  sessionId: string | null;
  sessionType: 'legacy' | 'pin';
  sketchbookId: string;
  tokenHash: string;
}

export class DrawingPublicPromotionBlockedError extends Error {
  constructor() {
    super('운영자가 차단한 그림은 공개할 수 없습니다.');
    this.name = 'DrawingPublicPromotionBlockedError';
  }
}

function toDate(value: unknown) {
  return value && typeof value === 'object' && 'toDate' in value
    ? (value as { toDate: () => Date }).toDate()
    : new Date(value as string | number | Date);
}

function toSketchbook(id: string, data: Record<string, unknown>): Sketchbook {
  const entitlements = data.entitlements && typeof data.entitlements === 'object'
    ? data.entitlements as Record<string, unknown>
    : {};
  return {
    id,
    publicId: String(data.publicId),
    name: String(data.name),
    manageTokenHash: String(data.manageTokenHash),
    managePinHash: data.managePinHash ? String(data.managePinHash) : null,
    managePinHint: data.managePinHint ? String(data.managePinHint) : null,
    managePinEnabledAt: data.managePinEnabledAt ? toDate(data.managePinEnabledAt) : null,
    ownerDrawingPath: data.ownerDrawingPath ? String(data.ownerDrawingPath) : null,
    referenceImagePath: data.referenceImagePath ? String(data.referenceImagePath) : null,
    referenceImageEnabled: Boolean(data.referenceImageEnabled),
    entitlements: { watermarkFree: entitlements.watermarkFree === true },
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
  const createdAt = toDate(data.createdAt);
  return {
    id,
    sketchbookId: String(data.sketchbookId),
    sketchbookPublicId: String(data.sketchbookPublicId ?? ''),
    sketchbookName: String(data.sketchbookName ?? ''),
    imagePath: String(data.imagePath),
    thumbnailPath: data.thumbnailPath ? String(data.thumbnailPath) : null,
    publicImageVersion: data.publicImageVersion
      ? String(data.publicImageVersion)
      : createdAt.getTime().toString(36),
    authorName: String(data.authorName),
    message: data.message ? String(data.message) : null,
    usedReferenceImage: Boolean(data.usedReferenceImage),
    bestRank: (data.bestRank as Drawing['bestRank']) ?? null,
    status: data.status as Drawing['status'],
    moderationStatus: data.moderationStatus === 'BLOCKED' ? 'BLOCKED' : 'ACTIVE',
    moderatedAt: data.moderatedAt ? toDate(data.moderatedAt) : null,
    createdAt,
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

  return snapshot.docs
    .map((document) => toDrawing(document.id, document.data()))
    .filter((drawing) => drawing.moderationStatus === 'ACTIVE');
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

    if (
      !current.exists
      || currentData?.status !== 'PUBLIC'
      || currentData?.moderationStatus === 'BLOCKED'
    ) {
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
  const firestore = getAdminFirestore();
  const reference = firestore.collection(collectionName).doc(sketchbookId).collection('drawings').doc(drawingId);
  const changes = {
    ...update,
    ...(update.status === 'HIDDEN' ? { bestRank: null } : {}),
    updatedAt: new Date(),
  };

  if (update.status === 'VISIBLE') {
    await firestore.runTransaction(async (transaction) => {
      const drawingDocument = await transaction.get(reference);
      if (!drawingDocument.exists) throw new Error('변경할 그림을 찾을 수 없습니다.');
      if (drawingDocument.data()?.moderationStatus === 'BLOCKED') {
        throw new DrawingPublicPromotionBlockedError();
      }
      transaction.update(reference, changes);
    });
    return;
  }

  await reference.update({
    ...changes,
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
    if (!targetDocument.exists) {
      throw new Error('공개 중인 그림만 BEST로 선정할 수 있습니다.');
    }
    if (targetDocument.data()?.moderationStatus === 'BLOCKED') {
      throw new DrawingPublicPromotionBlockedError();
    }
    if (targetDocument.data()?.status !== 'VISIBLE') {
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

export async function markSketchbookDeletionStarted(sketchbookId: string) {
  await getAdminFirestore().collection(collectionName).doc(sketchbookId).set(
    { status: 'DELETED', updatedAt: new Date() },
    { merge: true },
  );
}

export async function findSketchbookDeletionJob(publicId: string): Promise<SketchbookDeletionJob | null> {
  const document = await getAdminFirestore().collection(deletionJobCollectionName).doc(publicId).get();
  const data = document.data();
  if (!document.exists || !data) return null;

  return {
    publicId: String(data.publicId),
    sessionId: data.sessionId ? String(data.sessionId) : null,
    sessionType: data.sessionType === 'pin' ? 'pin' : 'legacy',
    sketchbookId: String(data.sketchbookId),
    tokenHash: String(data.tokenHash),
  };
}

export async function createSketchbookDeletionJob(
  sketchbook: Sketchbook,
  session: LegacyManageSession | PinManageSession,
) {
  let sessionId: string | null = null;
  let tokenHash: string;

  if (session.type === 'pin') {
    const sessionDocument = await getAdminFirestore()
      .collection(collectionName)
      .doc(sketchbook.id)
      .collection('manageSessions')
      .doc(session.sessionId)
      .get();
    const sessionData = sessionDocument.data();
    const expiresAt = sessionData?.expiresAt ? toDate(sessionData.expiresAt) : null;
    tokenHash = String(sessionData?.tokenHash ?? '');
    sessionId = session.sessionId;
    if (
      !sessionDocument.exists
      || !expiresAt
      || expiresAt <= new Date()
      || hashManageSessionToken(session.token) !== tokenHash
    ) {
      throw new Error('유효한 관리 세션을 찾을 수 없습니다.');
    }
  } else {
    tokenHash = sketchbook.manageTokenHash;
    if (!isValidManageToken(session.token, tokenHash)) {
      throw new Error('유효한 관리 세션을 찾을 수 없습니다.');
    }
  }

  await getAdminFirestore().collection(deletionJobCollectionName).doc(sketchbook.publicId).create({
    createdAt: new Date(),
    publicId: sketchbook.publicId,
    sessionId,
    sessionType: session.type,
    sketchbookId: sketchbook.id,
    tokenHash,
  });
}

export async function deleteSketchbookDeletionJob(publicId: string) {
  await getAdminFirestore().collection(deletionJobCollectionName).doc(publicId).delete();
}

export async function createManagePinSession(sketchbookId: string, expiresAt: Date) {
  const sessionId = randomUUID();
  const token = createManageSessionToken();
  await getAdminFirestore().collection(collectionName).doc(sketchbookId).collection('manageSessions').doc(sessionId).set({
    createdAt: new Date(),
    expiresAt,
    tokenHash: hashManageSessionToken(token),
  });
  return { sessionId, token };
}

export async function isManagePinSessionValid(sketchbookId: string, session: PinManageSession) {
  const document = await getAdminFirestore().collection(collectionName).doc(sketchbookId).collection('manageSessions').doc(session.sessionId).get();
  const data = document.data();
  if (!document.exists || !data?.expiresAt || toDate(data.expiresAt) <= new Date()) return false;
  return hashManageSessionToken(session.token) === String(data.tokenHash);
}

export async function deleteManagePinSession(sketchbookId: string, sessionId: string) {
  await getAdminFirestore().collection(collectionName).doc(sketchbookId).collection('manageSessions').doc(sessionId).delete();
}

export async function deleteManagePinSessions(sketchbookId: string) {
  const firestore = getAdminFirestore();
  const sessions = await firestore.collection(collectionName).doc(sketchbookId).collection('manageSessions').get();
  if (sessions.empty) return;
  const batch = firestore.batch();
  sessions.docs.forEach((document) => batch.delete(document.ref));
  await batch.commit();
}

export async function getManagePinAttempt(sketchbookId: string, sourceHash: string): Promise<ManagePinAttemptState | null> {
  const document = await getAdminFirestore().collection(collectionName).doc(sketchbookId).collection('managePinAttempts').doc(sourceHash).get();
  const data = document.data();
  if (!document.exists || !data) return null;
  return {
    failureCount: Number(data.failureCount) || 0,
    lockedUntil: data.lockedUntil ? toDate(data.lockedUntil) : null,
  };
}

export async function saveManagePinAttempt(
  sketchbookId: string,
  sourceHash: string,
  attempt: ManagePinAttemptState,
) {
  await getAdminFirestore().collection(collectionName).doc(sketchbookId).collection('managePinAttempts').doc(sourceHash).set({
    ...attempt,
    updatedAt: new Date(),
  });
}

export async function updateManagePin(sketchbookId: string, managePinHash: string, managePinHint: string | null) {
  await getAdminFirestore().collection(collectionName).doc(sketchbookId).update({
    managePinHash,
    managePinHint,
    managePinEnabledAt: new Date(),
    updatedAt: new Date(),
  });
}
