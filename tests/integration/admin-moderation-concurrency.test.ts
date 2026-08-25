// @vitest-environment node

import { afterAll, describe, expect, it } from 'vitest';
import { deleteApp } from 'firebase-admin/app';

import { setSketchbookModeration } from '@/lib/admin/moderation';
import { getAdminFirestore, getFirebaseAdminApp } from '@/lib/firebase/admin';

describe('admin moderation concurrency', () => {
  afterAll(async () => {
    await deleteApp(getFirebaseAdminApp());
  });

  it('소유자 공개 상태와 운영자 상태의 동시 변경을 모두 보존한다', async () => {
    const database = getAdminFirestore();
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
      }),
    ]);

    const result = await sketchbook.get();
    expect(result.data()?.status).toBe('PRIVATE');
    expect(result.data()?.moderationStatus).toBe('BLOCKED');
    expect(result.data()?.updatedAt.toDate()).toEqual(ownerUpdatedAt);
    expect(result.data()?.moderatedAt.toDate()).toBeInstanceOf(Date);
  });
});
