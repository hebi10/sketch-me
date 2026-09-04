'use client';

import {
  getToken,
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
  type AppCheck,
} from 'firebase/app-check';

import { getFirebaseClientApp } from '@/lib/firebase/client';

let publicMutationAppCheck: AppCheck | null = null;
const publicSecurityError = '보안 확인을 완료하지 못했어요. 페이지를 새로고침한 뒤 다시 시도해 주세요.';

function getPublicMutationAppCheck(siteKey: string) {
  if (!publicMutationAppCheck) {
    publicMutationAppCheck = initializeAppCheck(getFirebaseClientApp(), {
      isTokenAutoRefreshEnabled: true,
      provider: new ReCaptchaEnterpriseProvider(siteKey),
    });
  }
  return publicMutationAppCheck;
}

export async function getPublicMutationHeaders(): Promise<Record<string, string>> {
  const clientEnabled = process.env.NEXT_PUBLIC_FIREBASE_APP_CHECK_ENABLED === 'true';
  const siteKey = process.env.NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY?.trim() ?? '';
  if (!clientEnabled && !siteKey) return {};
  if (!clientEnabled || !siteKey) throw new Error(publicSecurityError);

  try {
    const { token } = await getToken(getPublicMutationAppCheck(siteKey));
    if (!token) throw new Error('App Check returned an empty token.');
    return { 'X-Firebase-AppCheck': token };
  } catch {
    throw new Error(publicSecurityError);
  }
}
