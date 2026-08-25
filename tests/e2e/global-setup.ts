import { getAdminAuth } from '../../src/lib/firebase/admin';
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
