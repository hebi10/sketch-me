import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { getAdminFirestore, getAdminStorage } from '../../src/lib/firebase/admin';
import { ADMIN_E2E_SERVER_IDENTITY } from '../../src/lib/testing/e2e-readiness';
import { normalizeFirebaseAdminStorageEmulatorEnvironment } from '../helpers/firebase-emulator-safety';

export const ADMIN_E2E = {
  drawingId: 'admin-e2e-drawing',
  drawingPath: 'sketchbooks/admin-e2e-book/drawings/admin-e2e-drawing/original.webp',
  email: ADMIN_E2E_SERVER_IDENTITY.email,
  googleSubject: 'admin-e2e-google-subject',
  ownerDrawingPath: 'sketchbooks/admin-e2e-book/owner/original.webp',
  password: 'admin-test-password',
  publicId: 'admin-e2e-public',
  purchaseId: 'admin-e2e-purchase',
  sketchbookId: 'admin-e2e-book',
  uid: ADMIN_E2E_SERVER_IDENTITY.uid,
} as const;

const FIXTURE_CREATED_AT = new Date('2026-08-25T00:00:00.000Z');

export async function seedAdminScenario() {
  normalizeFirebaseAdminStorageEmulatorEnvironment();
  const database = getAdminFirestore();
  const book = database.doc(`sketchbooks/${ADMIN_E2E.sketchbookId}`);

  await Promise.all([
    book.set({
      id: ADMIN_E2E.sketchbookId,
      publicId: ADMIN_E2E.publicId,
      name: '관리자 E2E',
      manageTokenHash: 'e2e-only',
      managePinHash: null,
      managePinHint: null,
      managePinEnabledAt: null,
      ownerDrawingPath: ADMIN_E2E.ownerDrawingPath,
      referenceImagePath: null,
      referenceImageEnabled: false,
      participantLimit: 70,
      participantCount: 1,
      status: 'PUBLIC',
      moderationStatus: 'ACTIVE',
      moderatedAt: null,
      createdAt: FIXTURE_CREATED_AT,
      updatedAt: FIXTURE_CREATED_AT,
    }),
    book.collection('drawings').doc(ADMIN_E2E.drawingId).set({
      id: ADMIN_E2E.drawingId,
      sketchbookId: ADMIN_E2E.sketchbookId,
      sketchbookPublicId: ADMIN_E2E.publicId,
      sketchbookName: '관리자 E2E',
      imagePath: ADMIN_E2E.drawingPath,
      authorName: '친구1',
      message: null,
      usedReferenceImage: false,
      bestRank: 1,
      status: 'VISIBLE',
      moderationStatus: 'ACTIVE',
      moderatedAt: null,
      createdAt: FIXTURE_CREATED_AT,
      updatedAt: FIXTURE_CREATED_AT,
    }),
    book.collection('purchases').doc(ADMIN_E2E.purchaseId).set({
      id: ADMIN_E2E.purchaseId,
      orderId: 'ADMIN-E2E-ORDER',
      sketchbookId: ADMIN_E2E.sketchbookId,
      sketchbookPublicId: ADMIN_E2E.publicId,
      sketchbookName: '관리자 E2E',
      provider: 'MOCK',
      productType: 'FRIENDS_50',
      amount: 3900,
      additionalLimit: 50,
      paymentStatus: 'SUCCEEDED',
      paidAt: FIXTURE_CREATED_AT,
      createdAt: FIXTURE_CREATED_AT,
    }),
  ]);

  const image = await readFile(path.resolve('public/brand/sketchbook-logo-mark.webp'));
  await Promise.all([
    getAdminStorage().bucket().file(ADMIN_E2E.ownerDrawingPath).save(image, {
      contentType: 'image/webp',
    }),
    getAdminStorage().bucket().file(ADMIN_E2E.drawingPath).save(image, {
      contentType: 'image/webp',
    }),
  ]);
}
