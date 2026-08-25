// @vitest-environment node

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteApp, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

import { setSketchbookModeration } from '@/lib/admin/moderation';
import {
  hasSafeFirebaseEmulatorEnvironment,
  LOCAL_FIREBASE_PROJECT_ID,
  requireSafeFirebaseEmulatorEnvironment,
} from '../helpers/firebase-emulator-safety';

const hasSafeFirestoreEmulator = hasSafeFirebaseEmulatorEnvironment(['firestore']);

describe.skipIf(!hasSafeFirestoreEmulator)('admin moderation concurrency', () => {
  let app: App;
  let database: Firestore;

  beforeAll(() => {
    requireSafeFirebaseEmulatorEnvironment(['firestore']);
    app = initializeApp({ projectId: LOCAL_FIREBASE_PROJECT_ID }, 'admin-moderation-concurrency-test');
    database = getFirestore(app);
  });

  afterAll(async () => {
    await deleteApp(app);
  });

  it('소유자 공개 상태와 운영자 상태의 동시 변경을 모두 보존한다', async () => {
    const sketchbook = database.doc('sketchbooks/admin-concurrency-book');
    const originalUpdatedAt = new Date('2026-08-25T01:00:00.000Z');
    const ownerUpdatedAt = new Date('2026-08-25T01:01:00.000Z');

    await sketchbook.set({
      publicId: 'admin-concurrency-public',
      status: 'PUBLIC',
      moderationStatus: 'ACTIVE',
      moderatedAt: null,
      updatedAt: originalUpdatedAt,
    });

    await Promise.all([
      database.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(sketchbook);
        expect(snapshot.data()?.status).toBe('PUBLIC');
        transaction.update(sketchbook, {
          status: 'PRIVATE',
          updatedAt: ownerUpdatedAt,
        });
      }),
      setSketchbookModeration({
        adminUid: 'admin-e2e-uid',
        moderationStatus: 'BLOCKED',
        sketchbookId: 'admin-concurrency-book',
      }, database),
    ]);

    const result = await sketchbook.get();
    expect(result.data()?.status).toBe('PRIVATE');
    expect(result.data()?.moderationStatus).toBe('BLOCKED');
    expect(result.data()?.updatedAt.toDate()).toEqual(ownerUpdatedAt);
    expect(result.data()?.moderatedAt.toDate()).toBeInstanceOf(Date);
  });
});
