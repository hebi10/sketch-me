// @vitest-environment node

import { afterEach, describe, expect, it } from 'vitest';

import type { Drawing, Sketchbook } from '@/lib/domain/types';
import { getAdminFirestore } from '@/lib/firebase/admin';
import {
  DrawingSubmissionLimitError,
  saveDrawingWithinLimit,
} from '@/lib/sketchbooks/repository';
import {
  hasSafeFirebaseEmulatorEnvironment,
  requireSafeFirebaseEmulatorEnvironment,
} from '../helpers/firebase-emulator-safety';

const hasSafeFirestoreEmulator = hasSafeFirebaseEmulatorEnvironment(['firestore']);
const createdAt = new Date('2026-09-03T00:00:00.000Z');

function sketchbook(id: string): Sketchbook {
  return {
    createdAt,
    entitlements: { watermarkFree: false },
    id,
    manageTokenHash: `${id}-secret`,
    moderatedAt: null,
    moderationStatus: 'ACTIVE',
    name: '해비',
    ownerDrawingPath: null,
    participantCount: 0,
    participantLimit: 20,
    publicId: `${id}-public`,
    status: 'PUBLIC',
    updatedAt: createdAt,
  };
}

function drawing(book: Sketchbook, id: string): Drawing {
  return {
    authorName: '친구',
    bestRank: null,
    createdAt,
    id,
    imagePath: `sketchbooks/${book.id}/drawings/${id}/original.webp`,
    message: null,
    moderatedAt: null,
    moderationStatus: 'ACTIVE',
    publicImageVersion: `${id}-version`,
    sketchbookId: book.id,
    sketchbookName: book.name,
    sketchbookPublicId: book.publicId,
    status: 'VISIBLE',
    thumbnailPath: `sketchbooks/${book.id}/drawings/${id}/thumbnail.webp`,
    updatedAt: createdAt,
  };
}

describe.skipIf(!hasSafeFirestoreEmulator)('친구 그림 IP 제출 한도 동시성', () => {
  const createdSketchbookIds: string[] = [];

  afterEach(async () => {
    const firestore = getAdminFirestore();
    await Promise.all(createdSketchbookIds.splice(0).map((id) => (
      firestore.recursiveDelete(firestore.collection('sketchbooks').doc(id))
    )));
  });

  it('같은 스케치북에 세 그림을 동시에 제출해도 같은 출처는 두 개만 저장한다', async () => {
    requireSafeFirebaseEmulatorEnvironment(['firestore']);
    const book = sketchbook('submission-concurrency-book');
    createdSketchbookIds.push(book.id);
    const firestore = getAdminFirestore();
    await firestore.collection('sketchbooks').doc(book.id).set(book);

    const results = await Promise.allSettled([
      saveDrawingWithinLimit(book, drawing(book, 'drawing-1'), 'same-source'),
      saveDrawingWithinLimit(book, drawing(book, 'drawing-2'), 'same-source'),
      saveDrawingWithinLimit(book, drawing(book, 'drawing-3'), 'same-source'),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(2);
    const rejection = results.find((result) => result.status === 'rejected');
    expect(rejection).toMatchObject({ reason: expect.any(DrawingSubmissionLimitError) });

    const [savedBook, savedDrawings, source] = await Promise.all([
      firestore.collection('sketchbooks').doc(book.id).get(),
      firestore.collection('sketchbooks').doc(book.id).collection('drawings').get(),
      firestore.collection('sketchbooks').doc(book.id).collection('submissionSources').doc('same-source').get(),
    ]);
    expect(savedBook.data()?.participantCount).toBe(2);
    expect(savedDrawings.size).toBe(2);
    expect(source.data()?.submissionCount).toBe(2);
  }, 15_000);

  it('같은 출처라도 다른 스케치북에서는 각각 두 개씩 저장한다', async () => {
    requireSafeFirebaseEmulatorEnvironment(['firestore']);
    const firstBook = sketchbook('submission-first-book');
    const secondBook = sketchbook('submission-second-book');
    createdSketchbookIds.push(firstBook.id, secondBook.id);
    const firestore = getAdminFirestore();
    await Promise.all([
      firestore.collection('sketchbooks').doc(firstBook.id).set(firstBook),
      firestore.collection('sketchbooks').doc(secondBook.id).set(secondBook),
    ]);

    const results = await Promise.all([
      saveDrawingWithinLimit(firstBook, drawing(firstBook, 'drawing-1'), 'same-source'),
      saveDrawingWithinLimit(firstBook, drawing(firstBook, 'drawing-2'), 'same-source'),
      saveDrawingWithinLimit(secondBook, drawing(secondBook, 'drawing-1'), 'same-source'),
      saveDrawingWithinLimit(secondBook, drawing(secondBook, 'drawing-2'), 'same-source'),
    ]);

    expect(results).toHaveLength(4);
  }, 15_000);
});
