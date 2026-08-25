import {
  connectAuthEmulator,
  getAuth,
  type Auth,
} from 'firebase/auth';

import { getFirebaseClientApp } from '@/lib/firebase/client';

let emulatorConnected = false;

export function getFirebaseClientAuth(): Auth {
  const auth = getAuth(getFirebaseClientApp());
  const emulatorHost = process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST;

  if (emulatorHost && !emulatorConnected) {
    connectAuthEmulator(auth, `http://${emulatorHost}`, { disableWarnings: true });
    emulatorConnected = true;
  }

  return auth;
}
