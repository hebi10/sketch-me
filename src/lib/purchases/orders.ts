import { randomUUID } from 'node:crypto';

import type { Purchase, Sketchbook } from '@/lib/domain/types';
import { getAdminFirestore } from '@/lib/firebase/admin';
import type { PurchasePlan } from '@/lib/purchases/plans';

export interface PurchaseRecord extends Purchase {
  requestId: string;
}

export interface CreatePendingPurchaseInput {
  buyerPhone: string;
  orderId?: string;
  plan: PurchasePlan;
  requestId: string;
  sketchbook: Sketchbook;
}

export interface PendingPurchaseResult {
  isNew: boolean;
  orderId: string;
  paymentStatus: Purchase['paymentStatus'];
  payUrl: string | null;
  providerOrderId: string | null;
}

export interface PayAppFeedbackInput {
  amount: number;
  orderId: string;
  payState: string;
  payType?: string;
  providerOrderId: string;
}

export class PurchaseConflictError extends Error {
  constructor(message = '이미 다른 상품으로 시작된 결제 요청입니다.') {
    super(message);
    this.name = 'PurchaseConflictError';
  }
}

export class PurchaseNotFoundError extends Error {
  constructor() {
    super('결제 주문을 찾을 수 없습니다.');
    this.name = 'PurchaseNotFoundError';
  }
}

export class PurchaseVerificationError extends Error {
  constructor() {
    super('결제 통보 정보를 확인할 수 없습니다.');
    this.name = 'PurchaseVerificationError';
  }
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (typeof value === 'object' && 'toDate' in value) {
    return (value as { toDate: () => Date }).toDate();
  }
  const date = new Date(value as string | number | Date);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toPurchaseRecord(id: string, data: Record<string, unknown>): PurchaseRecord {
  return {
    additionalLimit: Number(data.additionalLimit) as Purchase['additionalLimit'],
    amount: Number(data.amount) as Purchase['amount'],
    benefitAppliedAt: toDate(data.benefitAppliedAt),
    buyerPhoneLast4: data.buyerPhoneLast4 ? String(data.buyerPhoneLast4) : null,
    cancelledAt: toDate(data.cancelledAt),
    createdAt: toDate(data.createdAt) ?? new Date(0),
    id,
    orderId: String(data.orderId),
    paidAt: toDate(data.paidAt),
    paymentStatus: data.paymentStatus as Purchase['paymentStatus'],
    productType: data.productType as Purchase['productType'],
    provider: data.provider as Purchase['provider'],
    providerOrderId: data.providerOrderId ? String(data.providerOrderId) : null,
    providerPayType: data.providerPayType ? String(data.providerPayType) : null,
    requestId: id,
    sketchbookId: String(data.sketchbookId),
    sketchbookName: String(data.sketchbookName),
    sketchbookPublicId: String(data.sketchbookPublicId),
    updatedAt: toDate(data.updatedAt) ?? undefined,
  };
}

async function findPurchaseDocumentByOrderId(orderId: string) {
  const snapshot = await getAdminFirestore()
    .collectionGroup('purchases')
    .where('orderId', '==', orderId)
    .limit(2)
    .get();
  if (snapshot.empty) return null;
  if (snapshot.docs.length !== 1) throw new PurchaseConflictError('중복된 결제 주문번호입니다.');
  return snapshot.docs[0];
}

export async function createPendingPurchase(
  input: CreatePendingPurchaseInput,
): Promise<PendingPurchaseResult> {
  const firestore = getAdminFirestore();
  const sketchbookReference = firestore.collection('sketchbooks').doc(input.sketchbook.id);
  const purchaseReference = sketchbookReference.collection('purchases').doc(input.requestId);
  const orderId = input.orderId ?? `order_${input.sketchbook.publicId}_${randomUUID()}`;

  return firestore.runTransaction(async (transaction) => {
    const [sketchbookDocument, purchaseDocument] = await Promise.all([
      transaction.get(sketchbookReference),
      transaction.get(purchaseReference),
    ]);
    if (!sketchbookDocument.exists) throw new PurchaseNotFoundError();

    if (purchaseDocument.exists) {
      const existing = purchaseDocument.data() ?? {};
      if (
        existing.productType !== input.plan.productId
        || Number(existing.amount) !== input.plan.amount
      ) {
        throw new PurchaseConflictError();
      }
      return {
        isNew: false,
        orderId: String(existing.orderId),
        paymentStatus: existing.paymentStatus as Purchase['paymentStatus'],
        payUrl: existing.providerPayUrl ? String(existing.providerPayUrl) : null,
        providerOrderId: existing.providerOrderId ? String(existing.providerOrderId) : null,
      };
    }

    const now = new Date();
    transaction.set(purchaseReference, {
      additionalLimit: input.plan.additionalLimit,
      amount: input.plan.amount,
      benefitAppliedAt: null,
      buyerPhoneLast4: input.buyerPhone.slice(-4),
      cancelledAt: null,
      createdAt: now,
      orderId,
      paidAt: null,
      paymentStatus: 'READY',
      productType: input.plan.productId,
      provider: 'PAYAPP',
      providerOrderId: null,
      providerPayType: null,
      sketchbookId: input.sketchbook.id,
      sketchbookName: input.sketchbook.name,
      sketchbookPublicId: input.sketchbook.publicId,
      updatedAt: now,
    });

    return {
      isNew: true,
      orderId,
      paymentStatus: 'READY',
      payUrl: null,
      providerOrderId: null,
    };
  });
}

export async function findPurchaseByOrderId(orderId: string): Promise<PurchaseRecord | null> {
  const document = await findPurchaseDocumentByOrderId(orderId);
  return document ? toPurchaseRecord(document.id, document.data()) : null;
}

export async function getManagedPurchase(
  publicId: string,
  orderId: string,
): Promise<PurchaseRecord | null> {
  const purchase = await findPurchaseByOrderId(orderId);
  return purchase?.sketchbookPublicId === publicId ? purchase : null;
}

export async function attachProviderPayment(input: {
  orderId: string;
  payUrl: string;
  providerOrderId: string;
}): Promise<void> {
  const document = await findPurchaseDocumentByOrderId(input.orderId);
  if (!document) throw new PurchaseNotFoundError();
  const firestore = getAdminFirestore();
  await firestore.runTransaction(async (transaction) => {
    const current = await transaction.get(document.ref);
    if (!current.exists) throw new PurchaseNotFoundError();
    const data = current.data() ?? {};
    if (data.providerOrderId && data.providerOrderId !== input.providerOrderId) {
      throw new PurchaseConflictError('이미 다른 페이앱 주문번호가 연결되어 있습니다.');
    }
    transaction.update(document.ref, {
      providerPayUrl: input.payUrl,
      providerOrderId: input.providerOrderId,
      updatedAt: new Date(),
    });
  });
}

export async function failPendingPurchase(orderId: string): Promise<void> {
  const document = await findPurchaseDocumentByOrderId(orderId);
  if (!document) return;
  const firestore = getAdminFirestore();
  await firestore.runTransaction(async (transaction) => {
    const current = await transaction.get(document.ref);
    if (!current.exists || current.data()?.paymentStatus !== 'READY') return;
    transaction.update(document.ref, { paymentStatus: 'FAILED', updatedAt: new Date() });
  });
}

export async function applyPayAppFeedback(
  input: PayAppFeedbackInput,
): Promise<'APPLIED' | 'DUPLICATE' | 'UPDATED'> {
  const document = await findPurchaseDocumentByOrderId(input.orderId);
  if (!document) throw new PurchaseVerificationError();
  const firestore = getAdminFirestore();
  const initial = document.data();
  const sketchbookReference = firestore.collection('sketchbooks').doc(String(initial.sketchbookId));

  return firestore.runTransaction(async (transaction) => {
    const [purchaseDocument, sketchbookDocument] = await Promise.all([
      transaction.get(document.ref),
      transaction.get(sketchbookReference),
    ]);
    const purchase = purchaseDocument.data() ?? {};
    if (
      !purchaseDocument.exists
      || !sketchbookDocument.exists
      || purchase.provider !== 'PAYAPP'
      || String(purchase.orderId) !== input.orderId
      || String(purchase.providerOrderId) !== input.providerOrderId
      || Number(purchase.amount) !== input.amount
    ) {
      throw new PurchaseVerificationError();
    }

    const now = new Date();
    if (input.payState === '4') {
      if (purchase.benefitAppliedAt) return 'DUPLICATE';
      const sketchbookData = sketchbookDocument.data() ?? {};
      if (Number(purchase.additionalLimit) > 0) {
        transaction.update(sketchbookReference, {
          participantLimit: Number(sketchbookData.participantLimit) + Number(purchase.additionalLimit),
          updatedAt: now,
        });
      } else if (purchase.productType === 'WATERMARK_FREE') {
        const entitlements = sketchbookData.entitlements && typeof sketchbookData.entitlements === 'object'
          ? sketchbookData.entitlements as Record<string, unknown>
          : {};
        transaction.update(sketchbookReference, {
          entitlements: { ...entitlements, watermarkFree: true },
          updatedAt: now,
        });
      } else {
        throw new PurchaseVerificationError();
      }
      transaction.update(document.ref, {
        benefitAppliedAt: now,
        paidAt: now,
        paymentStatus: 'SUCCEEDED',
        providerPayType: input.payType ?? null,
        updatedAt: now,
      });
      return 'APPLIED';
    }

    if (['8', '9', '32', '64', '70', '71'].includes(input.payState)) {
      transaction.update(document.ref, {
        cancelledAt: now,
        paymentStatus: 'CANCELLED',
        providerPayType: input.payType ?? purchase.providerPayType ?? null,
        updatedAt: now,
      });
      return 'UPDATED';
    }

    transaction.update(document.ref, {
      paymentStatus: input.payState === '10' ? 'READY' : 'FAILED',
      providerPayType: input.payType ?? purchase.providerPayType ?? null,
      updatedAt: now,
    });
    return 'UPDATED';
  });
}

export async function markPurchaseCancelRequested(orderId: string): Promise<void> {
  const document = await findPurchaseDocumentByOrderId(orderId);
  if (!document) throw new PurchaseNotFoundError();
  const firestore = getAdminFirestore();
  await firestore.runTransaction(async (transaction) => {
    const current = await transaction.get(document.ref);
    if (!current.exists) throw new PurchaseNotFoundError();
    transaction.update(document.ref, { cancelRequestedAt: new Date(), updatedAt: new Date() });
  });
}
