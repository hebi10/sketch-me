import { timingSafeEqual } from 'node:crypto';

import { OAuth2Client } from 'google-auth-library';
import { NextResponse } from 'next/server';

import { cleanupExpiredSketchbooks } from '@/lib/sketchbooks/retention-cleanup';

function matchesSecret(authorization: string | null, secret: string) {
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(authorization ?? '');
  return expected.length === actual.length && timingSafeEqual(actual, expected);
}

const oidcClient = new OAuth2Client();

async function matchesSchedulerOidc(
  authorization: string | null,
  audience: string,
  serviceAccountEmail: string,
) {
  const match = authorization?.match(/^Bearer (.+)$/);
  if (!match) return false;

  try {
    const ticket = await oidcClient.verifyIdToken({
      audience,
      idToken: match[1],
    });
    const payload = ticket.getPayload();
    return payload?.email_verified === true && payload.email === serviceAccountEmail;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const secret = process.env.RETENTION_CLEANUP_SECRET?.trim();
  const oidcAudience = process.env.RETENTION_CLEANUP_OIDC_AUDIENCE?.trim();
  const schedulerServiceAccount = process.env.RETENTION_CLEANUP_SCHEDULER_SERVICE_ACCOUNT?.trim();
  const hasOidcConfig = Boolean(oidcAudience && schedulerServiceAccount);

  if (!secret && !hasOidcConfig) {
    return NextResponse.json(
      { message: '보관 정리 설정을 확인하지 못했습니다.' },
      { status: 503 },
    );
  }

  const authorization = request.headers.get('authorization');
  const isSecretAuthorized = Boolean(secret && matchesSecret(authorization, secret));
  const isSchedulerAuthorized = Boolean(
    !isSecretAuthorized
    && hasOidcConfig
    && await matchesSchedulerOidc(
      authorization,
      oidcAudience as string,
      schedulerServiceAccount as string,
    ),
  );
  if (!isSecretAuthorized && !isSchedulerAuthorized) {
    return NextResponse.json({ message: '인증되지 않은 요청입니다.' }, { status: 401 });
  }

  try {
    return NextResponse.json(await cleanupExpiredSketchbooks());
  } catch (error) {
    console.error(
      'Retention cleanup failed',
      error instanceof Error ? error.name : 'UnknownError',
    );
    return NextResponse.json({ message: '보관 정리를 완료하지 못했습니다.' }, { status: 500 });
  }
}
