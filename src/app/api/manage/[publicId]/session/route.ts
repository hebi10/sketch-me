import { NextResponse } from 'next/server';

import { verifyManagePin } from '@/lib/sketchbooks/manage-pin';
import { createPinManageCookieValue, MANAGE_COOKIE_NAME } from '@/lib/sketchbooks/manage-session';
import {
  createManagePinSession,
  findSketchbookByPublicId,
  getManagePinAttempt,
  saveManagePinAttempt,
} from '@/lib/sketchbooks/repository';
import { getManagePinAttemptSource, nextManagePinAttempt } from '@/lib/security/manage-pin-attempt';

const manageSessionMaxAge = 60 * 60 * 24 * 30;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ publicId: string }> },
) {
  const { publicId } = await params;
  const payload = await request.json().catch(() => null);
  const pin = typeof payload?.pin === 'string' ? payload.pin : '';
  const sketchbook = await findSketchbookByPublicId(publicId);
  if (!sketchbook?.managePinHash) {
    return NextResponse.json({ message: '관리 비밀번호가 설정된 스케치북을 찾지 못했어요.' }, { status: 404 });
  }

  const sourceHash = getManagePinAttemptSource(request);
  const currentAttempt = await getManagePinAttempt(sketchbook.id, sourceHash);
  const now = new Date();
  if (currentAttempt?.lockedUntil && currentAttempt.lockedUntil > now) {
    return NextResponse.json({ message: '입력을 여러 번 틀렸어요. 10분 뒤에 다시 시도해 주세요.' }, { status: 429 });
  }

  const isCorrectPin = /^\d{4}$/.test(pin) && await verifyManagePin(pin, sketchbook.managePinHash);
  const nextAttempt = nextManagePinAttempt(currentAttempt, isCorrectPin, now);
  await saveManagePinAttempt(sketchbook.id, sourceHash, nextAttempt);

  if (!isCorrectPin) {
    const message = nextAttempt.lockedUntil && nextAttempt.lockedUntil > now
      ? '입력을 여러 번 틀렸어요. 10분 뒤에 다시 시도해 주세요.'
      : '관리 비밀번호가 맞지 않아요.';
    return NextResponse.json({ message }, { status: nextAttempt.lockedUntil ? 429 : 401 });
  }

  const session = await createManagePinSession(
    sketchbook.id,
    new Date(Date.now() + manageSessionMaxAge * 1_000),
  );
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: MANAGE_COOKIE_NAME,
    value: createPinManageCookieValue(publicId, session.sessionId, session.token),
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: manageSessionMaxAge,
  });
  return response;
}
