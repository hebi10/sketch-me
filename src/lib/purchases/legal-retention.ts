import type { Firestore } from 'firebase-admin/firestore';

import { addCalendarYears } from '@/lib/sketchbooks/retention';

const legalPurchaseCollectionName = 'legalPurchaseRecords';
const purchaseRetentionYears = 5;
const purchaseAttemptRetentionYears = 3;
const archiveBatchSize = 400;

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (typeof value === 'object' && 'toDate' in value) {
    return (value as { toDate: () => Date }).toDate();
  }
  const date = new Date(value as string | number | Date);
  return Number.isNaN(date.getTime()) ? null : date;
}

function latestDate(data: Record<string, unknown>, fallback: Date) {
  const dates = [
    data.cancelledAt,
    data.cancelRequestedAt,
    data.paidAt,
    data.createdAt,
  ]
    .map(toDate)
    .filter((date): date is Date => Boolean(date));
  return dates.length > 0
    ? new Date(Math.max(...dates.map((date) => date.getTime())))
    : fallback;
}

function optionalString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : null;
}

function retentionYears(data: Record<string, unknown>) {
  const paymentStatus = optionalString(data.paymentStatus);
  return data.paidAt
    || data.cancelRequestedAt
    || data.cancelledAt
    || paymentStatus === 'SUCCEEDED'
    || paymentStatus === 'CANCELLED'
    || paymentStatus === 'REVIEW_REQUIRED'
    ? purchaseRetentionYears
    : purchaseAttemptRetentionYears;
}

function toLegalPurchaseRecord(
  requestId: string,
  sketchbookId: string,
  data: Record<string, unknown>,
  archivedAt: Date,
) {
  const retentionReferenceAt = latestDate(data, archivedAt);
  return {
    additionalLimit: Number(data.additionalLimit ?? 0),
    amount: Number(data.amount ?? 0),
    archivedAt,
    buyerPhoneLast4: optionalString(data.buyerPhoneLast4),
    cancelRequestedAt: toDate(data.cancelRequestedAt),
    cancelledAt: toDate(data.cancelledAt),
    createdAt: toDate(data.createdAt),
    digitalContentConsentAt: toDate(data.digitalContentConsentAt),
    digitalContentConsentVersion: optionalString(data.digitalContentConsentVersion),
    orderId: optionalString(data.orderId) ?? `${sketchbookId}_${requestId}`,
    paidAt: toDate(data.paidAt),
    paymentStatus: optionalString(data.paymentStatus),
    productType: optionalString(data.productType),
    provider: optionalString(data.provider),
    providerOrderId: optionalString(data.providerOrderId),
    providerPayType: optionalString(data.providerPayType),
    requestId,
    retentionExpiresAt: addCalendarYears(retentionReferenceAt, retentionYears(data)),
    sketchbookId,
    sketchbookPublicId: optionalString(data.sketchbookPublicId),
  };
}

export async function preservePurchaseRecordsBeforeSketchbookDeletion(
  firestore: Firestore,
  sketchbookId: string,
  archivedAt = new Date(),
) {
  const purchases = await firestore
    .collection('sketchbooks')
    .doc(sketchbookId)
    .collection('purchases')
    .get();
  if (purchases.empty) return 0;

  const legalPurchases = firestore.collection(legalPurchaseCollectionName);
  for (let index = 0; index < purchases.docs.length; index += archiveBatchSize) {
    const batch = firestore.batch();
    purchases.docs.slice(index, index + archiveBatchSize).forEach((purchase) => {
      const record = toLegalPurchaseRecord(
        purchase.id,
        sketchbookId,
        purchase.data(),
        archivedAt,
      );
      batch.set(legalPurchases.doc(record.orderId), record, { merge: true });
    });
    await batch.commit();
  }
  return purchases.docs.length;
}

export async function deleteExpiredLegalPurchaseRecords(
  firestore: Firestore,
  now: Date,
  limit: number,
) {
  const snapshot = await firestore
    .collection(legalPurchaseCollectionName)
    .where('retentionExpiresAt', '<=', now)
    .limit(limit)
    .get();
  if (snapshot.empty) return 0;

  const batch = firestore.batch();
  snapshot.docs.forEach((document) => batch.delete(document.ref));
  await batch.commit();
  return snapshot.docs.length;
}
