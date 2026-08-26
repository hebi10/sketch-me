'use client';

import {
  getToken,
  initializeAppCheck,
  ReCaptchaV3Provider,
  type AppCheck,
} from 'firebase/app-check';

import { getFirebaseClientApp } from '@/lib/firebase/client';

let publicMutationAppCheck: AppCheck | null = null;

function getPublicMutationAppCheck(siteKey: string) {
  if (!publicMutationAppCheck) {
    publicMutationAppCheck = initializeAppCheck(getFirebaseClientApp(), {
      isTokenAutoRefreshEnabled: true,
      provider: new ReCaptchaV3Provider(siteKey),
    });
  }
  return publicMutationAppCheck;
}

export async function getPublicMutationHeaders(): Promise<Record<string, string>> {
  const siteKey = process.env.NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY;
  if (process.env.NEXT_PUBLIC_FIREBASE_APP_CHECK_ENABLED !== 'true' || !siteKey) return {};

  try {
    const { token } = await getToken(getPublicMutationAppCheck(siteKey));
    if (!token) throw new Error('App Check returned an empty token.');
    return { 'X-Firebase-AppCheck': token };
  } catch {
    throw new Error('보안 확인을 완료하지 못했어요. 페이지를 새로고침한 뒤 다시 시도해 주세요.');
  }
}
