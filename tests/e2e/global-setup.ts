import { getAdminAuth } from '../../src/lib/firebase/admin';
import { ADMIN_E2E, seedAdminScenario } from './admin-fixture';

export default async function globalSetup() {
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
