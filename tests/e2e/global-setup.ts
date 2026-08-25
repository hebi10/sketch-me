import { getAdminAuth } from '../../src/lib/firebase/admin';
import { resolvePlaywrightBaseUrl } from '../../src/lib/testing/e2e-readiness';
import { verifyE2EServerReadiness } from '../helpers/e2e-server-readiness';
import { waitForEmulatorReadiness } from '../helpers/emulator-readiness';
import {
  getFirebaseEmulatorAddress,
  normalizeFirebaseAdminStorageEmulatorEnvironment,
  requireSafeFirebaseEmulatorEnvironment,
} from '../helpers/firebase-emulator-safety';
import { ADMIN_E2E, seedAdminScenario } from './admin-fixture';

export default async function globalSetup() {
  requireSafeFirebaseEmulatorEnvironment(['auth', 'firestore', 'storage']);
  normalizeFirebaseAdminStorageEmulatorEnvironment();
  await verifyE2EServerReadiness(
    resolvePlaywrightBaseUrl(process.env.PLAYWRIGHT_BASE_URL),
    {
      auth: process.env.FIREBASE_AUTH_EMULATOR_HOST!,
      firestore: process.env.FIRESTORE_EMULATOR_HOST!,
      storage: process.env.FIREBASE_STORAGE_EMULATOR_HOST!,
    },
  );
  await waitForEmulatorReadiness([
    { name: 'Auth', ...getFirebaseEmulatorAddress('auth') },
    { name: 'Firestore', ...getFirebaseEmulatorAddress('firestore') },
    { name: 'Storage', ...getFirebaseEmulatorAddress('storage') },
  ]);

  try {
    await getAdminAuth().createUser({
      uid: ADMIN_E2E.uid,
      email: ADMIN_E2E.email,
      emailVerified: true,
      password: ADMIN_E2E.password,
    });
  } catch (error) {
    if ((error as { code?: string }).code !== 'auth/uid-already-exists') throw error;
  }

  await seedAdminScenario();
}
