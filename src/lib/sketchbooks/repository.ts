import type { Drawing, Sketchbook } from '@/lib/domain/types';
import { getAdminFirestore } from '@/lib/firebase/admin';
import type { PurchasePlan } from '@/lib/purchases/plans';
import {
  nextManagePinAttempt,
  type ManagePinAttemptState,
} from '@/lib/security/manage-pin-attempt';
import { randomUUID } from 'node:crypto';
import { createManageSessionToken, hashManageSessionToken } from './manage-pin';
import {
  isValidManageToken,
  type LegacyManageSession,
  type PinManageSession,
} from './manage-session';
import { STORY_SHARED_HEADING } from '@/lib/share/story-layout';

const collectionName = 'sketchbooks';
const adminDeletionJobCollectionName = 'adminSketchbookDeletionJobs';
const deletionJobCollectionName = 'sketchbookDeletionJobs';
const bestRanks = [1, 2, 3, 4] as const;

type BestRank = (typeof bestRanks)[number];

function toBestRank(value: unknown): BestRank | null {
  const rank = Number(value);
  return bestRanks.includes(rank as BestRank) ? rank as BestRank : null;
}

function planBestRankUpdates(
  occupiedSlots: Map<BestRank, string>,
  targetKey: string,
  currentRank: BestRank | null,
  nextRank: BestRank,
) {
  const updates = new Map<string, BestRank | null>();

  if (currentRank === null) {
    const emptyRank = bestRanks.find((rank) => rank >= nextRank && !occupiedSlots.has(rank));
    const lastShiftRank = emptyRank ?? 4;

    if (emptyRank === undefined) {
      const lastEntry = occupiedSlots.get(4);
      if (lastEntry) updates.set(lastEntry, null);
    }

    for (let destination = lastShiftRank; destination > nextRank; destination -= 1) {
      const entry = occupiedSlots.get((destination - 1) as BestRank);
      if (entry) updates.set(entry, destination as BestRank);
    }
  } else if (currentRank > nextRank) {
    for (let destination = currentRank; destination > nextRank; destination -= 1) {
      const entry = occupiedSlots.get((destination - 1) as BestRank);
      if (entry) updates.set(entry, destination as BestRank);
    }
  } else if (currentRank < nextRank) {
    for (let destination = currentRank; destination < nextRank; destination += 1) {
      const entry = occupiedSlots.get((destination + 1) as BestRank);
      if (entry) updates.set(entry, destination as BestRank);
    }
  }

  updates.set(targetKey, nextRank);
  return updates;
}

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
    shareThumbnailMode: data.shareThumbnailMode === 'OWNER' || data.shareThumbnailMode === 'BEST_1'
      ? data.shareThumbnailMode
      : null,
    storyHeading: data.storyHeading ? String(data.storyHeading) : STORY_SHARED_HEADING,
    manageTokenHash: String(data.manageTokenHash),
    managePinHash: data.managePinHash ? String(data.managePinHash) : null,
    managePinHint: data.managePinHint ? String(data.managePinHint) : null,
    managePinEnabledAt: data.managePinEnabledAt ? toDate(data.managePinEnabledAt) : null,
    ownerBestRank: ([1, 2, 3, 4].includes(Number(data.ownerBestRank))
      ? Number(data.ownerBestRank)
      : null) as Sketchbook['ownerBestRank'],
    ownerDrawingPath: data.ownerDrawingPath ? String(data.ownerDrawingPath) : null,
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

export async function updateSketchbookStoryHeading(sketchbookId: string, storyHeading: string) {
  await getAdminFirestore().collection(collectionName).doc(sketchbookId).update({
    storyHeading,
    updatedAt: new Date(),
  });
}

export async function updateSketchbookShareThumbnailMode(
  sketchbookId: string,
  shareThumbnailMode: NonNullable<Sketchbook['shareThumbnailMode']>,
) {
  await getAdminFirestore().collection(collectionName).doc(sketchbookId).update({
    shareThumbnailMode,
    updatedAt: new Date(),
  });
}

export async function updateOwnerDrawingForManagement(sketchbookId: string, ownerDrawingPath: string) {
  await getAdminFirestore().collection(collectionName).doc(sketchbookId).update({
    ownerDrawingPath,
    updatedAt: new Date(),
  });
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

export async function findVisibleBestDrawing(sketchbookId: string, bestRank: BestRank) {
  const snapshot = await getAdminFirestore()
    .collection(collectionName)
    .doc(sketchbookId)
    .collection('drawings')
    .where('bestRank', '==', bestRank)
    .limit(1)
    .get();
  const document = snapshot.docs[0];
  if (!document) return null;

  const drawing = toDrawing(document.id, document.data());
  return drawing.status === 'VISIBLE' && drawing.moderationStatus === 'ACTIVE'
    ? drawing
    : null;
}

export async function saveDrawingWithinLimit(sketchbook: Sketchbook, drawing: Drawing) {
  const firestore = getAdminFirestore();
  const sketchbookReference = firestore.collection(collectionName).doc(sketchbook.id);
  const drawingsCollection = sketchbookReference.collection('drawings');
  const drawingReference = drawingsCollection.doc(drawing.id);
  let savedDrawing = drawing;

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

    let automaticBestRank: Drawing['bestRank'] = null;
    if (Number(currentData.participantCount) < 4) {
      const ranked = await transaction.get(drawingsCollection.where('bestRank', 'in', [1, 2, 3, 4]));
      const usedRanks = new Set(
        ranked.docs
          .map((document) => Number(document.data().bestRank))
          .filter((rank): rank is 1 | 2 | 3 | 4 => rank >= 1 && rank <= 4),
      );
      const ownerBestRank = Number(currentData.ownerBestRank);
      if (ownerBestRank >= 1 && ownerBestRank <= 4) usedRanks.add(ownerBestRank as 1 | 2 | 3 | 4);
      automaticBestRank = ([1, 2, 3, 4] as const).find((rank) => !usedRanks.has(rank)) ?? null;
    }
    savedDrawing = automaticBestRank ? { ...drawing, bestRank: automaticBestRank } : drawing;

    transaction.set(drawingReference, savedDrawing);
    transaction.update(sketchbookReference, {
      participantCount: Number(currentData.participantCount) + 1,
      updatedAt: new Date(),
    });
  });

  return savedDrawing;
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
    ...(update.status ? { publicImageVersion: randomUUID() } : {}),
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
    transaction.update(drawingReference, {
      status: 'DELETED',
      bestRank: null,
      publicImageVersion: randomUUID(),
      updatedAt: new Date(),
    });
    transaction.update(sketchbookReference, {
      participantCount: Math.max(0, Number(sketchbookDocument.data()?.participantCount) - 1),
      updatedAt: new Date(),
    });
    return {
      imagePath: String(drawing?.imagePath ?? ''),
      thumbnailPath: drawing?.thumbnailPath ? String(drawing.thumbnailPath) : null,
    };
  });
}

export async function setBestDrawing(sketchbookId: string, drawingId: string, bestRank: 1 | 2 | 3 | 4) {
  const firestore = getAdminFirestore();
  const sketchbookReference = firestore.collection(collectionName).doc(sketchbookId);
  const collection = sketchbookReference.collection('drawings');
  const target = collection.doc(drawingId);

  await firestore.runTransaction(async (transaction) => {
    const [sketchbookDocument, targetDocument, ranked] = await Promise.all([
      transaction.get(sketchbookReference),
      transaction.get(target),
      transaction.get(collection.where('bestRank', 'in', bestRanks)),
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

    const targetKey = `drawing:${drawingId}`;
    const references = new Map<string, typeof target>([[targetKey, target]]);
    const occupiedSlots = new Map<BestRank, string>();
    const ownerBestRank = toBestRank(sketchbookDocument.data()?.ownerBestRank);
    if (ownerBestRank !== null) occupiedSlots.set(ownerBestRank, 'owner');

    ranked.docs.forEach((document) => {
      if (document.id === drawingId) return;
      const rank = toBestRank(document.data().bestRank);
      if (rank === null) return;
      const key = `drawing:${document.id}`;
      occupiedSlots.set(rank, key);
      references.set(key, document.ref);
    });

    const updates = planBestRankUpdates(
      occupiedSlots,
      targetKey,
      toBestRank(targetDocument.data()?.bestRank),
      bestRank,
    );
    const updatedAt = new Date();
    updates.forEach((rank, key) => {
      if (key === 'owner') {
        transaction.update(sketchbookReference, { ownerBestRank: rank, updatedAt });
        return;
      }
      const reference = references.get(key);
      if (reference) transaction.update(reference, { bestRank: rank, updatedAt });
    });
  });
}

export async function setOwnerBestDrawing(sketchbookId: string, bestRank: 1 | 2 | 3 | 4) {
  const firestore = getAdminFirestore();
  const sketchbookReference = firestore.collection(collectionName).doc(sketchbookId);
  const drawingsCollection = sketchbookReference.collection('drawings');

  await firestore.runTransaction(async (transaction) => {
    const [sketchbookDocument, ranked] = await Promise.all([
      transaction.get(sketchbookReference),
      transaction.get(drawingsCollection.where('bestRank', 'in', bestRanks)),
    ]);
    if (!sketchbookDocument.exists || !sketchbookDocument.data()?.ownerDrawingPath) {
      throw new Error('순위를 지정할 내 그림을 찾을 수 없습니다.');
    }

    const references = new Map<string, (typeof ranked.docs)[number]['ref']>();
    const occupiedSlots = new Map<BestRank, string>();
    ranked.docs.forEach((document) => {
      const rank = toBestRank(document.data().bestRank);
      if (rank === null) return;
      const key = `drawing:${document.id}`;
      occupiedSlots.set(rank, key);
      references.set(key, document.ref);
    });
    const updates = planBestRankUpdates(
      occupiedSlots,
      'owner',
      toBestRank(sketchbookDocument.data()?.ownerBestRank),
      bestRank,
    );
    const updatedAt = new Date();
    updates.forEach((rank, key) => {
      if (key === 'owner') {
        transaction.update(sketchbookReference, { ownerBestRank: rank, updatedAt });
        return;
      }
      const reference = references.get(key);
      if (reference) transaction.update(reference, { bestRank: rank, updatedAt });
    });
  });
}

export async function clearOwnerBestDrawing(sketchbookId: string) {
  await getAdminFirestore().collection(collectionName).doc(sketchbookId).update({
    ownerBestRank: null,
    updatedAt: new Date(),
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
    const currentData = document.data() ?? {};
    const currentLimit = Number(currentData.participantLimit);
    const currentEntitlementsData = currentData.entitlements && typeof currentData.entitlements === 'object'
      ? currentData.entitlements as Record<string, unknown>
      : {};
    const currentEntitlements = { watermarkFree: currentEntitlementsData.watermarkFree === true };
    if (existingPurchase.exists) {
      return { entitlements: currentEntitlements, participantLimit: currentLimit };
    }
    const participantLimit = plan.kind === 'capacity'
      ? currentLimit + plan.additionalLimit
      : currentLimit;
    const entitlements = plan.kind === 'watermark'
      ? { ...currentEntitlements, watermarkFree: true }
      : currentEntitlements;
    transaction.update(reference, {
      ...(plan.kind === 'capacity' ? { participantLimit } : {}),
      ...(plan.kind === 'watermark' ? { entitlements } : {}),
      updatedAt: new Date(),
    });
    transaction.set(purchaseReference, {
      sketchbookId: sketchbook.id,
      sketchbookPublicId: sketchbook.publicId,
      sketchbookName: sketchbook.name,
      orderId: `order_${requestId}`,
      provider: 'MOCK',
      productType: plan.productId,
      amount: plan.amount,
      additionalLimit: plan.additionalLimit,
      paymentStatus: 'SUCCEEDED',
      paidAt: new Date(),
      createdAt: new Date(),
    });
    return { entitlements, participantLimit };
  });
}

export async function deleteSketchbookPermanently(sketchbookId: string) {
  const firestore = getAdminFirestore();
  await firestore.recursiveDelete(firestore.collection(collectionName).doc(sketchbookId));
}

export async function findSketchbookDeletionTargetById(sketchbookId: string) {
  const firestore = getAdminFirestore();
  const document = await firestore.collection(collectionName).doc(sketchbookId).get();
  const publicId = document.data()?.publicId;
  if (document.exists && typeof publicId === 'string' && publicId.trim()) {
    return { id: sketchbookId, publicId, source: 'sketchbook' as const };
  }

  const job = await firestore.collection(adminDeletionJobCollectionName).doc(sketchbookId).get();
  const jobData = job.data();
  const jobPublicId = jobData?.publicId;
  if (
    !job.exists
    || String(jobData?.sketchbookId ?? '') !== sketchbookId
    || typeof jobPublicId !== 'string'
    || !jobPublicId.trim()
  ) return null;
  return { id: sketchbookId, publicId: jobPublicId, source: 'admin-deletion-job' as const };
}

export async function createAdminSketchbookDeletionJob(input: {
  adminUid: string;
  publicId: string;
  sketchbookId: string;
}) {
  await getAdminFirestore()
    .collection(adminDeletionJobCollectionName)
    .doc(input.sketchbookId)
    .set({
      adminUid: input.adminUid,
      createdAt: new Date(),
      publicId: input.publicId,
      sketchbookId: input.sketchbookId,
    }, { merge: true });
}

export async function deleteAdminSketchbookDeletionJob(sketchbookId: string) {
  await getAdminFirestore()
    .collection(adminDeletionJobCollectionName)
    .doc(sketchbookId)
    .delete();
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

export async function consumeManagePinAttempt(
  sketchbookId: string,
  sourceHash: string,
  isCorrectPin: boolean,
  now = new Date(),
) {
  const firestore = getAdminFirestore();
  const reference = firestore
    .collection(collectionName)
    .doc(sketchbookId)
    .collection('managePinAttempts')
    .doc(sourceHash);

  return firestore.runTransaction(async (transaction) => {
    const document = await transaction.get(reference);
    const data = document.data();
    const current: ManagePinAttemptState | null = document.exists && data
      ? {
          failureCount: Number(data.failureCount) || 0,
          lockedUntil: data.lockedUntil ? toDate(data.lockedUntil) : null,
        }
      : null;
    const wasLocked = Boolean(current?.lockedUntil && current.lockedUntil > now);
    if (wasLocked && current) return { attempt: current, wasLocked: true };

    const attempt = nextManagePinAttempt(current, isCorrectPin, now);
    transaction.set(reference, { ...attempt, updatedAt: now });
    return { attempt, wasLocked: false };
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
