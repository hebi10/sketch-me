// @vitest-environment node

import { readFileSync } from 'node:fs';

import {
  assertFails,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { deleteApp, initializeApp, type App } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  getFirebaseEmulatorAddress,
  hasSafeFirebaseEmulatorEnvironment,
  LOCAL_FIREBASE_PROJECT_ID,
  normalizeFirebaseAdminStorageEmulatorEnvironment,
  requireSafeFirebaseEmulatorEnvironment,
} from '../helpers/firebase-emulator-safety';

let testEnvironment: RulesTestEnvironment;
let adminApp: App;
type AdminStorage = ReturnType<typeof getStorage>;
type AdminBucket = ReturnType<AdminStorage['bucket']>;
let knownPrivateFile: ReturnType<AdminBucket['file']>;

const knownPrivatePath = 'sketchbooks/rules-public-book/drawings/rules-known/original.webp';
const hasSafeRulesEmulators = hasSafeFirebaseEmulatorEnvironment(['firestore', 'storage']);

describe.skipIf(!hasSafeRulesEmulators)('Firebase security rules', () => {
  beforeAll(async () => {
    requireSafeFirebaseEmulatorEnvironment(['firestore', 'storage']);
    normalizeFirebaseAdminStorageEmulatorEnvironment();
    const firestore = getFirebaseEmulatorAddress('firestore');
    const storage = getFirebaseEmulatorAddress('storage');
    testEnvironment = await initializeTestEnvironment({
      projectId: LOCAL_FIREBASE_PROJECT_ID,
      firestore: {
        host: firestore.host,
        port: firestore.port,
        rules: readFileSync('firestore.rules', 'utf8'),
      },
      storage: {
        host: storage.host,
        port: storage.port,
        rules: readFileSync('storage.rules', 'utf8'),
      },
    });
    adminApp = initializeApp({
      projectId: LOCAL_FIREBASE_PROJECT_ID,
      storageBucket: `${LOCAL_FIREBASE_PROJECT_ID}.appspot.com`,
    }, 'rules-test-admin');
    knownPrivateFile = getStorage(adminApp).bucket().file(knownPrivatePath);
    await knownPrivateFile.save(Buffer.from('known-private-object'), {
      contentType: 'image/webp',
    });
  });

  afterAll(async () => {
    await knownPrivateFile?.delete({ ignoreNotFound: true });
    await testEnvironment?.cleanup();
    if (adminApp) await deleteApp(adminApp);
  });

  it('direct client writes are denied for Firestore', async () => {
    const database = testEnvironment.unauthenticatedContext().firestore();

    await assertFails(database.doc('sketchbooks/public-book').set({ name: '테스트사용자' }));
  });

  it('direct client reads are denied for Firestore', async () => {
    const database = testEnvironment.unauthenticatedContext().firestore();

    await assertFails(database.doc('sketchbooks/public-book').get());
  });

  it('direct client uploads are denied for Storage', async () => {
    const bucket = testEnvironment.unauthenticatedContext().storage();

    const upload = bucket
      .ref('sketchbooks/public-book/drawings/a.png')
      .put(new Uint8Array([1, 2, 3]), { contentType: 'image/png' });

    await assertFails(Promise.resolve(upload));
  });

  it('direct client downloads are denied for Storage', async () => {
    const bucket = testEnvironment.unauthenticatedContext().storage();
    const [exists] = await knownPrivateFile.exists();

    expect(exists).toBe(true);
    await expect(
      bucket.ref(knownPrivatePath).getDownloadURL(),
    ).rejects.toMatchObject({ code: 'storage/unauthorized' });
  });
});
