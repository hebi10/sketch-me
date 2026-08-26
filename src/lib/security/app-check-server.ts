import { getAppCheck } from 'firebase-admin/app-check';
import { NextResponse } from 'next/server';

import { getFirebaseAdminApp } from '@/lib/firebase/admin';

const invalidTokenCodes = new Set([
  'app-check/app-check-token-expired',
  'app-check/invalid-argument',
]);

function unauthorizedResponse() {
  return NextResponse.json(
    { message: '보안 확인에 실패했어요. 페이지를 새로고침한 뒤 다시 시도해 주세요.' },
    { status: 401 },
  );
}

function unavailableResponse() {
  return NextResponse.json(
    { message: '보안 확인을 준비하지 못했어요. 잠시 후 다시 시도해 주세요.' },
    { status: 503 },
  );
}

function isInvalidTokenError(error: unknown) {
  return Boolean(
    error
    && typeof error === 'object'
    && 'code' in error
    && invalidTokenCodes.has(String(error.code)),
  );
}

export async function enforceAppCheck(request: Request): Promise<NextResponse | null> {
  if (process.env.FIREBASE_APP_CHECK_ENFORCEMENT_ENABLED !== 'true') return null;
  if (!process.env.NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY) return unavailableResponse();

  const token = request.headers.get('X-Firebase-AppCheck')?.trim();
  if (!token) return unauthorizedResponse();

  try {
    await getAppCheck(getFirebaseAdminApp()).verifyToken(token);
    return null;
  } catch (error) {
    return isInvalidTokenError(error) ? unauthorizedResponse() : unavailableResponse();
  }
}
