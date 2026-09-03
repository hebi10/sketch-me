import {
  AggregateField,
  FieldPath,
  type DocumentData,
  type DocumentReference,
  type Firestore,
  type Query,
  type QueryDocumentSnapshot,
  type QuerySnapshot,
} from 'firebase-admin/firestore';

import type { Drawing, Purchase, Sketchbook } from '@/lib/domain/types';
import { getAdminFirestore } from '@/lib/firebase/admin';
import {
  decodeAdminCursor,
  encodeAdminCursor,
  isAdminCursorForCollection,
  type AdminCursor,
  type AdminCursorCollection,
} from './cursor';
import { getCachedValue } from './stats-cache';
import type {
  AdminDashboardStats,
  AdminDrawingListItem,
  AdminListInput,
  AdminPage,
  AdminPurchaseListItem,
  AdminSketchbookDetail,
  AdminSketchbookListInput,
  AdminSketchbookListItem,
} from './types';

const PAGE_SIZE = 20;
const SEOUL_OFFSET_MS = 9 * 60 * 60 * 1_000;

function toDate(value: unknown) {
  return value && typeof value === 'object' && 'toDate' in value
    ? (value as { toDate: () => Date }).toDate()
    : new Date(value as string | number | Date);
}

function toOptionalDate(value: unknown) {
  return value ? toDate(value) : null;
}

function toAdminSketchbook(
  id: string,
  data: DocumentData,
): AdminSketchbookListItem {
  return {
    id,
    publicId: String(data.publicId ?? ''),
    name: String(data.name ?? ''),
    ownerBestRank: ([1, 2, 3, 4].includes(Number(data.ownerBestRank))
      ? Number(data.ownerBestRank)
      : null) as Sketchbook['ownerBestRank'],
    ownerDrawingPath: data.ownerDrawingPath ? String(data.ownerDrawingPath) : null,
    entitlements: {
      watermarkFree: data.entitlements?.watermarkFree === true,
    },
    participantLimit: Number(data.participantLimit),
    participantCount: Number(data.participantCount),
    status: data.status as Sketchbook['status'],
    moderationStatus: data.moderationStatus === 'BLOCKED' ? 'BLOCKED' : 'ACTIVE',
    moderatedAt: toOptionalDate(data.moderatedAt),
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

function toAdminDrawing(
  id: string,
  data: DocumentData,
): AdminDrawingListItem {
  return {
    id,
    sketchbookId: String(data.sketchbookId ?? ''),
    sketchbookPublicId: String(data.sketchbookPublicId ?? ''),
    sketchbookName: String(data.sketchbookName ?? ''),
    imagePath: String(data.imagePath ?? ''),
    thumbnailPath: data.thumbnailPath ? String(data.thumbnailPath) : null,
    publicImageVersion: data.publicImageVersion
      ? String(data.publicImageVersion)
      : toDate(data.createdAt).getTime().toString(36),
    authorName: String(data.authorName ?? ''),
    message: data.message ? String(data.message) : null,
    bestRank: (data.bestRank as Drawing['bestRank']) ?? null,
    status: data.status as Drawing['status'],
    moderationStatus: data.moderationStatus === 'BLOCKED' ? 'BLOCKED' : 'ACTIVE',
    moderatedAt: toOptionalDate(data.moderatedAt),
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

function toAdminPurchase(
  id: string,
  data: DocumentData,
): AdminPurchaseListItem {
  return {
    id,
    sketchbookId: String(data.sketchbookId ?? ''),
    sketchbookPublicId: String(data.sketchbookPublicId ?? ''),
    sketchbookName: String(data.sketchbookName ?? ''),
    orderId: String(data.orderId ?? ''),
    provider: data.provider === 'PAYAPP' || data.provider === 'TOSS' ? data.provider : 'MOCK',
    providerOrderId: data.providerOrderId ? String(data.providerOrderId) : null,
    providerPayType: data.providerPayType ? String(data.providerPayType) : null,
    buyerPhoneLast4: data.buyerPhoneLast4 ? String(data.buyerPhoneLast4) : null,
    productType: data.productType as Purchase['productType'],
    amount: Number(data.amount) as Purchase['amount'],
    additionalLimit: Number(data.additionalLimit) as Purchase['additionalLimit'],
    paymentStatus: data.paymentStatus as Purchase['paymentStatus'],
    paidAt: toOptionalDate(data.paidAt),
    benefitAppliedAt: toOptionalDate(data.benefitAppliedAt),
    cancelRequestedAt: toOptionalDate(data.cancelRequestedAt),
    cancelledAt: toOptionalDate(data.cancelledAt),
    createdAt: toDate(data.createdAt),
    updatedAt: toOptionalDate(data.updatedAt) ?? undefined,
  };
}

function readCursor(
  value: string | undefined,
  collectionId: AdminCursorCollection,
) {
  if (!value) return null;
  const cursor = decodeAdminCursor(value);
  if (!cursor || !isAdminCursorForCollection(cursor, collectionId)) {
    throw new Error('유효하지 않은 관리자 커서입니다.');
  }
  return cursor;
}

function withPagination(
  query: Query,
  firestore: Firestore,
  cursor: AdminCursor | null,
) {
  let ordered = query
    .orderBy('createdAt', 'desc')
    .orderBy(FieldPath.documentId(), 'desc');
  if (cursor) {
    ordered = ordered.startAfter(
      new Date(cursor.createdAt),
      firestore.doc(cursor.path),
    );
  }
  return ordered.limit(PAGE_SIZE + 1);
}

function toPage<T>(
  documents: QueryDocumentSnapshot[],
  map: (document: QueryDocumentSnapshot) => T,
): AdminPage<T> {
  const pageDocuments = documents.slice(0, PAGE_SIZE);
  const lastDocument = pageDocuments.at(-1);
  return {
    items: pageDocuments.map(map),
    nextCursor: documents.length > PAGE_SIZE && lastDocument
      ? encodeAdminCursor({
          createdAt: toDate(lastDocument.data().createdAt).toISOString(),
          path: lastDocument.ref.path,
        })
      : null,
  };
}

function hasParentMetadata(item: AdminDrawingListItem | AdminPurchaseListItem) {
  return item.sketchbookPublicId.trim().length > 0
    && item.sketchbookName.trim().length > 0;
}

function getSketchbookIdFromParentPath(path: string | undefined) {
  const segments = path?.split('/');
  return segments?.length === 2 && segments[0] === 'sketchbooks'
    ? segments[1]
    : '';
}

async function fillLegacyParentMetadata<T extends AdminDrawingListItem | AdminPurchaseListItem>(
  firestore: Firestore,
  documents: QueryDocumentSnapshot[],
  items: T[],
) {
  const itemsWithParentIds = items.map((item, index) => {
    if (item.sketchbookId.trim()) return item;
    return {
      ...item,
      sketchbookId: getSketchbookIdFromParentPath(
        documents[index]?.ref.parent.parent?.path,
      ),
    };
  });
  const parentReferences = new Map<string, DocumentReference>();
  itemsWithParentIds.forEach((item, index) => {
    if (hasParentMetadata(item)) return;
    const parentReference = documents[index]?.ref.parent.parent;
    if (parentReference) parentReferences.set(parentReference.path, parentReference);
  });

  if (parentReferences.size === 0) return itemsWithParentIds;

  const parents = await firestore.getAll(...parentReferences.values());
  const parentMetadata = new Map(parents
    .filter((document) => document.exists)
    .map((document) => [document.ref.path, {
      name: String(document.data()?.name ?? ''),
      publicId: String(document.data()?.publicId ?? ''),
    }]));

  return itemsWithParentIds.map((item, index) => {
    if (hasParentMetadata(item)) return item;
    const parentPath = documents[index]?.ref.parent.parent?.path;
    const metadata = parentPath ? parentMetadata.get(parentPath) : undefined;
    if (!metadata) return item;
    return {
      ...item,
      sketchbookName: item.sketchbookName.trim() || metadata.name,
      sketchbookPublicId: item.sketchbookPublicId.trim() || metadata.publicId,
    };
  });
}

export async function listAdminSketchbooks(
  input: AdminSketchbookListInput,
): Promise<AdminPage<AdminSketchbookListItem>> {
  const cursor = readCursor(input.cursor, 'sketchbooks');
  const firestore = getAdminFirestore();
  const baseQuery = firestore
    .collection('sketchbooks')
    .where('status', 'in', ['PUBLIC', 'PRIVATE']);
  const search = input.query?.trim();

  let snapshot: QuerySnapshot;
  if (search) {
    snapshot = await withPagination(
      baseQuery.where('publicId', '==', search),
      firestore,
      cursor,
    ).get();
    if (snapshot.empty) {
      snapshot = await withPagination(
        baseQuery.where('name', '==', search),
        firestore,
        cursor,
      ).get();
    }
  } else {
    snapshot = await withPagination(baseQuery, firestore, cursor).get();
  }

  return toPage(snapshot.docs, (document) => (
    toAdminSketchbook(document.id, document.data())
  ));
}

export async function getAdminSketchbookDetail(
  id: string,
): Promise<AdminSketchbookDetail | null> {
  const firestore = getAdminFirestore();
  const reference = firestore.collection('sketchbooks').doc(id);
  const document = await reference.get();
  if (!document.exists) return null;

  const drawingsQuery = reference
    .collection('drawings')
    .where('status', 'in', ['VISIBLE', 'HIDDEN'])
    .orderBy('createdAt', 'desc')
    .orderBy(FieldPath.documentId(), 'desc')
    .limit(5);
  const purchasesQuery = reference
    .collection('purchases')
    .where('paymentStatus', '==', 'SUCCEEDED');
  const [drawings, purchases] = await Promise.all([
    drawingsQuery.get(),
    purchasesQuery.aggregate({
      count: AggregateField.count(),
      amount: AggregateField.sum('amount'),
    }).get(),
  ]);

  return {
    ...toAdminSketchbook(document.id, document.data() ?? {}),
    recentDrawings: drawings.docs.map((drawing) => (
      toAdminDrawing(drawing.id, drawing.data())
    )),
    purchaseSummary: {
      count: Number(purchases.data().count),
      amount: Number(purchases.data().amount),
    },
  };
}

export async function listAdminDrawings(
  input: AdminListInput,
): Promise<AdminPage<AdminDrawingListItem>> {
  const cursor = readCursor(input.cursor, 'drawings');
  const firestore = getAdminFirestore();
  const snapshot = await withPagination(
    firestore
      .collectionGroup('drawings')
      .where('status', 'in', ['VISIBLE', 'HIDDEN']),
    firestore,
    cursor,
  ).get();
  const page = toPage(snapshot.docs, (document) => (
    toAdminDrawing(document.id, document.data())
  ));
  return {
    ...page,
    items: await fillLegacyParentMetadata(
      firestore,
      snapshot.docs.slice(0, PAGE_SIZE),
      page.items,
    ),
  };
}

export async function listAdminPurchases(
  input: AdminListInput,
): Promise<AdminPage<AdminPurchaseListItem>> {
  const cursor = readCursor(input.cursor, 'purchases');
  const firestore = getAdminFirestore();
  const snapshot = await withPagination(
    firestore
      .collectionGroup('purchases'),
    firestore,
    cursor,
  ).get();
  const page = toPage(snapshot.docs, (document) => (
    toAdminPurchase(document.id, document.data())
  ));
  return {
    ...page,
    items: await fillLegacyParentMetadata(
      firestore,
      snapshot.docs.slice(0, PAGE_SIZE),
      page.items,
    ),
  };
}

function getSeoulDayRange(now = new Date()) {
  const seoulNow = new Date(now.getTime() + SEOUL_OFFSET_MS);
  const startMs = Date.UTC(
    seoulNow.getUTCFullYear(),
    seoulNow.getUTCMonth(),
    seoulNow.getUTCDate(),
  ) - SEOUL_OFFSET_MS;
  return {
    start: new Date(startMs),
    end: new Date(startMs + 24 * 60 * 60 * 1_000),
  };
}

async function loadAdminStats(): Promise<AdminDashboardStats> {
  const firestore = getAdminFirestore();
  const { start, end } = getSeoulDayRange();
  const sketchbooks = firestore
    .collection('sketchbooks')
    .where('status', 'in', ['PUBLIC', 'PRIVATE']);
  const drawings = firestore
    .collectionGroup('drawings')
    .where('status', 'in', ['VISIBLE', 'HIDDEN']);
  const purchases = firestore
    .collectionGroup('purchases')
    .where('paymentStatus', '==', 'SUCCEEDED');
  const todaySketchbooks = sketchbooks
    .where('createdAt', '>=', start)
    .where('createdAt', '<', end);
  const todayDrawings = drawings
    .where('createdAt', '>=', start)
    .where('createdAt', '<', end);

  const [
    sketchbookCount,
    todaySketchbookCount,
    drawingCount,
    todayDrawingCount,
    purchaseAggregate,
  ] = await Promise.all([
    sketchbooks.count().get(),
    todaySketchbooks.count().get(),
    drawings.count().get(),
    todayDrawings.count().get(),
    purchases.aggregate({
      count: AggregateField.count(),
      amount: AggregateField.sum('amount'),
    }).get(),
  ]);

  return {
    totalSketchbooks: Number(sketchbookCount.data().count),
    todaySketchbooks: Number(todaySketchbookCount.data().count),
    totalDrawings: Number(drawingCount.data().count),
    todayDrawings: Number(todayDrawingCount.data().count),
    succeededPurchaseCount: Number(purchaseAggregate.data().count),
    succeededPurchaseAmount: Number(purchaseAggregate.data().amount),
  };
}

export function getCachedAdminStats(): Promise<AdminDashboardStats> {
  return getCachedValue(loadAdminStats, Date.now());
}
