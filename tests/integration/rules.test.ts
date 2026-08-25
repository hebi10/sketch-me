// @vitest-environment node

import { readFileSync } from 'node:fs';

import {
  assertFails,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { afterAll, beforeAll, describe, it } from 'vitest';

let testEnvironment: RulesTestEnvironment;

function emulatorAddress(value: string | undefined, defaultPort: number) {
  const [host = '127.0.0.1', port = String(defaultPort)] = value?.split(':') ?? [];
  return { host, port: Number(port) };
}

describe('Firebase security rules', () => {
  beforeAll(async () => {
    const firestore = emulatorAddress(process.env.FIRESTORE_EMULATOR_HOST, 8080);
    const storage = emulatorAddress(process.env.FIREBASE_STORAGE_EMULATOR_HOST, 9199);
    testEnvironment = await initializeTestEnvironment({
      projectId: 'sketch-me-local',
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
  });

  afterAll(async () => {
    await testEnvironment?.cleanup();
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

    await assertFails(
      bucket.ref('sketchbooks/public-book/drawings/a.webp').getDownloadURL(),
    );
  });
});
