import { FieldPath } from 'firebase-admin/firestore';
import { vi } from 'vitest';

import firestoreIndexes from '../../../firestore.indexes.json';

const { getAdminFirestore } = vi.hoisted(() => ({ getAdminFirestore: vi.fn() }));

vi.mock('@/lib/firebase/admin', () => ({ getAdminFirestore }));

import { decodeAdminCursor, encodeAdminCursor } from '@/lib/admin/cursor';
import {
  getAdminSketchbookDetail,
  getCachedAdminStats,
  listAdminDrawings,
  listAdminPurchases,
  listAdminSketchbooks,
} from '@/lib/admin/repository';

type RequiredIndex = {
  name: string;
  collectionGroup: string;
  queryScope: 'COLLECTION' | 'COLLECTION_GROUP';
  fields: Array<{ fieldPath: string; order: 'ASCENDING' | 'DESCENDING' }>;
};

const requiredIndexes: RequiredIndex[] = [
  {
    name: '기존 스케치북 상세 그림',
    collectionGroup: 'drawings',
    queryScope: 'COLLECTION',
    fields: [
      { fieldPath: 'status', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' },
    ],
  },
  {
    name: '스케치북 목록',
    collectionGroup: 'sketchbooks',
    queryScope: 'COLLECTION',
    fields: [
      { fieldPath: 'status', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' },
      { fieldPath: '__name__', order: 'DESCENDING' },
    ],
  },
  {
    name: '스케치북 공개 ID 검색',
    collectionGroup: 'sketchbooks',
    queryScope: 'COLLECTION',
    fields: [
      { fieldPath: 'status', order: 'ASCENDING' },
      { fieldPath: 'publicId', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' },
      { fieldPath: '__name__', order: 'DESCENDING' },
    ],
  },
  {
    name: '스케치북 이름 검색',
    collectionGroup: 'sketchbooks',
    queryScope: 'COLLECTION',
    fields: [
      { fieldPath: 'status', order: 'ASCENDING' },
      { fieldPath: 'name', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' },
      { fieldPath: '__name__', order: 'DESCENDING' },
    ],
  },
  {
    name: '오늘 생성 스케치북 count',
    collectionGroup: 'sketchbooks',
    queryScope: 'COLLECTION',
    fields: [
      { fieldPath: 'status', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'ASCENDING' },
      { fieldPath: '__name__', order: 'ASCENDING' },
    ],
  },
  {
    name: '그림 목록',
    collectionGroup: 'drawings',
    queryScope: 'COLLECTION_GROUP',
    fields: [
      { fieldPath: 'status', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' },
      { fieldPath: '__name__', order: 'DESCENDING' },
    ],
  },
  {
    name: '오늘 제출 그림 count',
    collectionGroup: 'drawings',
    queryScope: 'COLLECTION_GROUP',
    fields: [
      { fieldPath: 'status', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'ASCENDING' },
      { fieldPath: '__name__', order: 'ASCENDING' },
    ],
  },
  {
    name: '결제 목록',
    collectionGroup: 'purchases',
    queryScope: 'COLLECTION_GROUP',
    fields: [
      { fieldPath: 'createdAt', order: 'DESCENDING' },
      { fieldPath: '__name__', order: 'DESCENDING' },
    ],
  },
  {
    name: '성공 결제 대시보드 aggregate',
    collectionGroup: 'purchases',
    queryScope: 'COLLECTION_GROUP',
    fields: [
      { fieldPath: 'paymentStatus', order: 'ASCENDING' },
      { fieldPath: 'amount', order: 'ASCENDING' },
    ],
  },
  {
    name: '스케치북 상세 성공 결제 aggregate',
    collectionGroup: 'purchases',
    queryScope: 'COLLECTION',
    fields: [
      { fieldPath: 'paymentStatus', order: 'ASCENDING' },
      { fieldPath: 'amount', order: 'ASCENDING' },
    ],
  },
];

describe('admin repository Firestore indexes', () => {
  it.each(requiredIndexes)('$name 쿼리에 대응하는 인덱스가 있다', ({
    collectionGroup,
    fields,
    queryScope,
  }) => {
    expect(firestoreIndexes.indexes).toEqual(expect.arrayContaining([
      { collectionGroup, fields, queryScope },
    ]));
  });

  it('전체 그림 count의 status-only collection-group 단일 필드 인덱스가 있다', () => {
    expect(firestoreIndexes.fieldOverrides).toEqual(expect.arrayContaining([
      {
        collectionGroup: 'drawings',
        fieldPath: 'status',
        indexes: [
          { order: 'ASCENDING', queryScope: 'COLLECTION_GROUP' },
          { order: 'DESCENDING', queryScope: 'COLLECTION_GROUP' },
        ],
      },
    ]));
  });
});

type FakeReference = {
  path: string;
  parent?: { parent?: FakeReference };
};

function createQuery(docs: unknown[]) {
  const query = {
    get: vi.fn().mockResolvedValue({ docs, empty: docs.length === 0 }),
    limit: vi.fn(),
    orderBy: vi.fn(),
    startAfter: vi.fn(),
    where: vi.fn(),
  };
  query.limit.mockReturnValue(query);
  query.orderBy.mockReturnValue(query);
  query.startAfter.mockReturnValue(query);
  query.where.mockReturnValue(query);
  return query;
}

function createDrawingDocument(
  index: number,
  parent: FakeReference,
  metadata: { sketchbookName?: string; sketchbookPublicId?: string } = {
    sketchbookName: '내 이름',
    sketchbookPublicId: 'public-1',
  },
) {
  const id = `draw-${String(index).padStart(2, '0')}`;
  return {
    data: () => ({
      authorName: `친구${index}`,
      bestRank: null,
      createdAt: new Date(`2026-08-25T00:${String(index).padStart(2, '0')}:00.000Z`),
      imagePath: `${id}.webp`,
      message: null,
      moderationStatus: 'ACTIVE',
      sketchbookId: 'book-1',
      status: 'VISIBLE',
      updatedAt: new Date('2026-08-25T01:00:00.000Z'),
      usedReferenceImage: false,
      ...metadata,
    }),
    id,
    ref: {
      parent: { parent },
      path: `${parent.path}/drawings/${id}`,
    },
  };
}

function createPurchaseDocument(
  index: number,
  parent: FakeReference,
  metadata: { sketchbookName?: string; sketchbookPublicId?: string } = {
    sketchbookName: '내 이름',
    sketchbookPublicId: 'public-1',
  },
  includeSketchbookId = true,
) {
  const id = `purchase-${index}`;
  return {
    data: () => ({
      additionalLimit: 50,
      amount: 3_900,
      createdAt: new Date(`2026-08-25T00:0${index}:00.000Z`),
      orderId: `ORDER-${index}`,
      paidAt: new Date(`2026-08-25T00:0${index}:00.000Z`),
      paymentStatus: 'SUCCEEDED',
      productType: 'FRIENDS_50',
      provider: 'MOCK',
      ...(includeSketchbookId ? { sketchbookId: 'book-1' } : {}),
      ...metadata,
    }),
    id,
    ref: {
      parent: { parent },
      path: `${parent.path}/purchases/${id}`,
    },
  };
}

function createSketchbookDocument(id = 'book-1') {
  return {
    data: () => ({
      createdAt: new Date('2026-08-25T00:00:00.000Z'),
      manageTokenHash: 'secret-hash',
      moderationStatus: 'ACTIVE',
      name: '내 이름',
      ownerDrawingPath: 'sketchbooks/book-1/owner/original.webp',
      participantCount: 13,
      participantLimit: 70,
      publicId: 'public-1',
      referenceImageEnabled: true,
      referenceImagePath: 'sketchbooks/book-1/reference/original.webp',
      status: 'PUBLIC',
      updatedAt: new Date('2026-08-25T01:00:00.000Z'),
    }),
    id,
    ref: { path: `sketchbooks/${id}` },
  };
}

describe('admin repository pagination and search', () => {
  beforeEach(() => {
    getAdminFirestore.mockReset();
  });

  it('삭제되지 않은 그림을 21개 조회하고 20개와 전체 경로 커서를 반환한다', async () => {
    const parent = { path: 'sketchbooks/book-1' };
    const docs = Array.from({ length: 21 }, (_, index) => createDrawingDocument(index, parent));
    const drawingsQuery = createQuery(docs);
    const cursorReference = { path: 'sketchbooks/book-0/drawings/draw-previous' };
    const firestore = {
      collectionGroup: vi.fn(() => drawingsQuery),
      doc: vi.fn(() => cursorReference),
      getAll: vi.fn(),
    };
    getAdminFirestore.mockReturnValue(firestore);
    const cursor = encodeAdminCursor({
      createdAt: '2026-08-24T00:00:00.000Z',
      path: cursorReference.path,
    });

    const result = await listAdminDrawings({ cursor });

    expect(firestore.collectionGroup).toHaveBeenCalledWith('drawings');
    expect(drawingsQuery.where).toHaveBeenCalledWith('status', 'in', ['VISIBLE', 'HIDDEN']);
    expect(drawingsQuery.orderBy).toHaveBeenNthCalledWith(1, 'createdAt', 'desc');
    expect(drawingsQuery.orderBy).toHaveBeenNthCalledWith(2, FieldPath.documentId(), 'desc');
    expect(drawingsQuery.startAfter).toHaveBeenCalledWith(
      new Date('2026-08-24T00:00:00.000Z'),
      cursorReference,
    );
    expect(drawingsQuery.limit).toHaveBeenCalledWith(21);
    expect(result.items).toHaveLength(20);
    expect(decodeAdminCursor(result.nextCursor ?? undefined)).toEqual({
      createdAt: '2026-08-25T00:19:00.000Z',
      path: 'sketchbooks/book-1/drawings/draw-19',
    });
    expect(firestore.getAll).not.toHaveBeenCalled();
  });

  it('공개 ID 정확 일치 결과가 없을 때 이름 정확 일치로 검색한다', async () => {
    const publicIdQuery = createQuery([]);
    const nameQuery = createQuery([createSketchbookDocument()]);
    const baseQuery = createQuery([]);
    baseQuery.where.mockImplementation((field: string) => field === 'publicId' ? publicIdQuery : nameQuery);
    const collection = { where: vi.fn(() => baseQuery) };
    getAdminFirestore.mockReturnValue({ collection: vi.fn(() => collection) });

    const result = await listAdminSketchbooks({ query: '내 이름' });

    expect(collection.where).toHaveBeenCalledWith('status', 'in', ['PUBLIC', 'PRIVATE']);
    expect(baseQuery.where).toHaveBeenNthCalledWith(1, 'publicId', '==', '내 이름');
    expect(baseQuery.where).toHaveBeenNthCalledWith(2, 'name', '==', '내 이름');
    expect(publicIdQuery.get).toHaveBeenCalledTimes(1);
    expect(nameQuery.get).toHaveBeenCalledTimes(1);
    expect(result.items[0]).toMatchObject({
      id: 'book-1',
      moderationStatus: 'ACTIVE',
      name: '내 이름',
      publicId: 'public-1',
    });
    expect(result.items[0]).not.toHaveProperty('manageTokenHash');
  });

  it('공개 ID 검색 결과가 있으면 이름 쿼리를 실행하지 않는다', async () => {
    const publicIdQuery = createQuery([createSketchbookDocument()]);
    const nameQuery = createQuery([]);
    const baseQuery = createQuery([]);
    baseQuery.where.mockImplementation((field: string) => field === 'publicId' ? publicIdQuery : nameQuery);
    const collection = { where: vi.fn(() => baseQuery) };
    getAdminFirestore.mockReturnValue({ collection: vi.fn(() => collection) });

    await listAdminSketchbooks({ query: 'public-1' });

    expect(publicIdQuery.get).toHaveBeenCalledTimes(1);
    expect(nameQuery.get).not.toHaveBeenCalled();
  });

  it('잘못된 커서를 첫 페이지로 무시하지 않고 거부한다', async () => {
    getAdminFirestore.mockReturnValue({ collectionGroup: vi.fn() });

    await expect(listAdminDrawings({ cursor: 'invalid' })).rejects.toThrow('유효하지 않은 관리자 커서입니다.');
  });
});

describe('admin repository legacy parent metadata', () => {
  beforeEach(() => {
    getAdminFirestore.mockReset();
  });

  it('빈 문자열을 포함해 메타데이터가 없는 legacy 그림의 고유 부모를 getAll 한 번으로 보완한다', async () => {
    const parent = { path: 'sketchbooks/book-1' };
    const drawingsQuery = createQuery([
      createDrawingDocument(1, parent, {}),
      createDrawingDocument(2, parent, { sketchbookName: '', sketchbookPublicId: '' }),
    ]);
    const getAll = vi.fn().mockResolvedValue([{
      data: () => ({ name: '부모 이름', publicId: 'parent-public' }),
      exists: true,
      ref: parent,
    }]);
    getAdminFirestore.mockReturnValue({
      collectionGroup: vi.fn(() => drawingsQuery),
      getAll,
    });

    const result = await listAdminDrawings({});

    expect(getAll).toHaveBeenCalledTimes(1);
    expect(getAll).toHaveBeenCalledWith(parent);
    expect(result.items).toEqual([
      expect.objectContaining({ sketchbookName: '부모 이름', sketchbookPublicId: 'parent-public' }),
      expect.objectContaining({ sketchbookName: '부모 이름', sketchbookPublicId: 'parent-public' }),
    ]);
  });

  it('메타데이터가 있는 신규 그림은 부모 문서를 읽지 않는다', async () => {
    const parent = { path: 'sketchbooks/book-1' };
    const drawingsQuery = createQuery([createDrawingDocument(1, parent)]);
    const getAll = vi.fn();
    getAdminFirestore.mockReturnValue({
      collectionGroup: vi.fn(() => drawingsQuery),
      getAll,
    });

    await listAdminDrawings({});

    expect(getAll).not.toHaveBeenCalled();
  });

  it('ID와 부모 메타데이터가 누락되거나 빈 문자열인 legacy 결제를 한 번의 getAll로 보완한다', async () => {
    const parent = { path: 'sketchbooks/book-1' };
    const purchasesQuery = createQuery([
      createPurchaseDocument(1, parent, {}, false),
      createPurchaseDocument(2, parent, { sketchbookName: '', sketchbookPublicId: '' }),
    ]);
    const getAll = vi.fn().mockResolvedValue([{
      data: () => ({ name: '부모 이름', publicId: 'parent-public' }),
      exists: true,
      ref: parent,
    }]);
    const firestore = {
      collectionGroup: vi.fn(() => purchasesQuery),
      getAll,
    };
    getAdminFirestore.mockReturnValue(firestore);

    const result = await listAdminPurchases({});

    expect(firestore.collectionGroup).toHaveBeenCalledWith('purchases');
    expect(purchasesQuery.orderBy).toHaveBeenNthCalledWith(1, 'createdAt', 'desc');
    expect(purchasesQuery.orderBy).toHaveBeenNthCalledWith(2, FieldPath.documentId(), 'desc');
    expect(purchasesQuery.limit).toHaveBeenCalledWith(21);
    expect(getAll).toHaveBeenCalledTimes(1);
    expect(getAll).toHaveBeenCalledWith(parent);
    expect(result.items).toEqual([
      expect.objectContaining({
        sketchbookId: 'book-1',
        sketchbookName: '부모 이름',
        sketchbookPublicId: 'parent-public',
      }),
      expect.objectContaining({ sketchbookName: '부모 이름', sketchbookPublicId: 'parent-public' }),
    ]);
  });

  it('메타데이터가 있는 신규 결제는 부모 문서를 읽지 않는다', async () => {
    const parent = { path: 'sketchbooks/book-1' };
    const purchasesQuery = createQuery([createPurchaseDocument(1, parent)]);
    const getAll = vi.fn();
    getAdminFirestore.mockReturnValue({
      collectionGroup: vi.fn(() => purchasesQuery),
      getAll,
    });

    await listAdminPurchases({});

    expect(getAll).not.toHaveBeenCalled();
  });
});

describe('admin repository detail and stats', () => {
  beforeEach(() => {
    getAdminFirestore.mockReset();
    vi.useRealTimers();
  });

  it('스케치북 상세에 최근 그림과 성공 결제 요약을 포함한다', async () => {
    const parent = { path: 'sketchbooks/book-1' };
    const drawingQuery = createQuery([createDrawingDocument(1, parent)]);
    const purchaseQuery = {
      aggregate: vi.fn(() => ({
        get: vi.fn().mockResolvedValue({ data: () => ({ amount: 3_900, count: 1 }) }),
      })),
      where: vi.fn(),
    };
    purchaseQuery.where.mockReturnValue(purchaseQuery);
    const sketchbookReference = {
      collection: vi.fn((name: string) => name === 'drawings' ? drawingQuery : purchaseQuery),
      get: vi.fn().mockResolvedValue({ ...createSketchbookDocument(), exists: true }),
      path: 'sketchbooks/book-1',
    };
    getAdminFirestore.mockReturnValue({
      collection: vi.fn(() => ({ doc: vi.fn(() => sketchbookReference) })),
    });

    const result = await getAdminSketchbookDetail('book-1');

    expect(drawingQuery.where).toHaveBeenCalledWith('status', 'in', ['VISIBLE', 'HIDDEN']);
    expect(drawingQuery.limit).toHaveBeenCalledWith(5);
    expect(purchaseQuery.where).toHaveBeenCalledWith('paymentStatus', '==', 'SUCCEEDED');
    expect(result).toMatchObject({
      id: 'book-1',
      purchaseSummary: { amount: 3_900, count: 1 },
      recentDrawings: [expect.objectContaining({ id: 'draw-01' })],
    });
  });

  it('Asia/Seoul의 오늘 경계로 count와 성공 결제 aggregate 통계를 조회한다', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-25T15:30:00.000Z'));

    function createCountQueries(total: number, today: number) {
      const rangeQuery = {
        count: vi.fn(() => ({
          get: vi.fn().mockResolvedValue({ data: () => ({ count: today }) }),
        })),
      };
      const startQuery = { where: vi.fn(() => rangeQuery) };
      const baseQuery = {
        count: vi.fn(() => ({
          get: vi.fn().mockResolvedValue({ data: () => ({ count: total }) }),
        })),
        where: vi.fn(() => startQuery),
      };
      return { baseQuery, rangeQuery, startQuery };
    }

    const sketchbookCounts = createCountQueries(10, 2);
    const drawingCounts = createCountQueries(20, 4);
    const purchasesQuery = {
      aggregate: vi.fn(() => ({
        get: vi.fn().mockResolvedValue({ data: () => ({ amount: 12_870, count: 3 }) }),
      })),
    };
    const sketchbooksCollection = { where: vi.fn(() => sketchbookCounts.baseQuery) };
    const drawingsCollection = { where: vi.fn(() => drawingCounts.baseQuery) };
    const purchasesCollection = { where: vi.fn(() => purchasesQuery) };
    getAdminFirestore.mockReturnValue({
      collection: vi.fn(() => sketchbooksCollection),
      collectionGroup: vi.fn((name: string) => name === 'drawings' ? drawingsCollection : purchasesCollection),
    });

    await expect(getCachedAdminStats()).resolves.toEqual({
      succeededPurchaseAmount: 12_870,
      succeededPurchaseCount: 3,
      todayDrawings: 4,
      todaySketchbooks: 2,
      totalDrawings: 20,
      totalSketchbooks: 10,
    });

    expect(sketchbooksCollection.where).toHaveBeenCalledWith('status', 'in', ['PUBLIC', 'PRIVATE']);
    expect(drawingsCollection.where).toHaveBeenCalledWith('status', 'in', ['VISIBLE', 'HIDDEN']);
    expect(purchasesCollection.where).toHaveBeenCalledWith('paymentStatus', '==', 'SUCCEEDED');
    expect(sketchbookCounts.baseQuery.where).toHaveBeenCalledWith(
      'createdAt',
      '>=',
      new Date('2026-08-25T15:00:00.000Z'),
    );
    expect(sketchbookCounts.startQuery.where).toHaveBeenCalledWith(
      'createdAt',
      '<',
      new Date('2026-08-26T15:00:00.000Z'),
    );
    expect(drawingCounts.baseQuery.where).toHaveBeenCalledWith(
      'createdAt',
      '>=',
      new Date('2026-08-25T15:00:00.000Z'),
    );
    expect(drawingCounts.startQuery.where).toHaveBeenCalledWith(
      'createdAt',
      '<',
      new Date('2026-08-26T15:00:00.000Z'),
    );
    expect(purchasesQuery.aggregate).toHaveBeenCalledTimes(1);
  });
});
