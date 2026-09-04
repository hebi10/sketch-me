import { timingSafeEqual } from 'node:crypto';

import { NextResponse } from 'next/server';

import { cleanupExpiredSketchbooks } from '@/lib/sketchbooks/retention-cleanup';

function matchesSecret(authorization: string | null, secret: string) {
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(authorization ?? '');
  return expected.length === actual.length && timingSafeEqual(actual, expected);
}

export async function POST(request: Request) {
  const secret = process.env.RETENTION_CLEANUP_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { message: '보관 정리 설정을 확인하지 못했습니다.' },
      { status: 503 },
    );
  }
  if (!matchesSecret(request.headers.get('authorization'), secret)) {
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
