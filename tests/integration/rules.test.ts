// @vitest-environment node

import { readFileSync } from 'node:fs';

import {
  assertFails,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { afterAll, beforeAll, describe, it } from 'vitest';

let testEnvironment: RulesTestEnvironment;

describe('Firebase security rules', () => {
  beforeAll(async () => {
    testEnvironment = await initializeTestEnvironment({
      projectId: 'sketch-me-local',
      firestore: {
        host: '127.0.0.1',
        port: 8080,
        rules: readFileSync('firestore.rules', 'utf8'),
      },
      storage: {
        host: '127.0.0.1',
        port: 9199,
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

  it('direct client uploads are denied for Storage', async () => {
    const bucket = testEnvironment.unauthenticatedContext().storage();

    await assertFails(
      bucket
        .ref('sketchbooks/public-book/drawings/a.png')
        .put(new Uint8Array([1, 2, 3]), { contentType: 'image/png' }),
    );
  });
});
