import { NextResponse } from 'next/server';

import { getManagedSketchbook } from '@/lib/sketchbooks/management';
import { hashManagePin, verifyManagePin } from '@/lib/sketchbooks/manage-pin';
import { createPinManageCookieValue, MANAGE_COOKIE_NAME } from '@/lib/sketchbooks/manage-session';
import {
  createManagePinSession,
  deleteManagePinSessions,
  updateManagePin,
} from '@/lib/sketchbooks/repository';

const manageSessionMaxAge = 60 * 60 * 24 * 30;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ publicId: string }> },
) {
  const { publicId } = await params;
  const sketchbook = await getManagedSketchbook(publicId);
  if (!sketchbook) return NextResponse.json({ message: '관리 권한이 없습니다.' }, { status: 403 });

  const payload = await request.json().catch(() => null);
  const currentPin = typeof payload?.currentPin === 'string' ? payload.currentPin : '';
  const newPin = typeof payload?.newPin === 'string' ? payload.newPin : '';
  const hint = typeof payload?.hint === 'string' ? payload.hint.trim() : '';
  if (!/^\d{4}$/.test(newPin)) {
    return NextResponse.json({ message: '새 관리 비밀번호는 숫자 4자리로 입력해 주세요.' }, { status: 400 });
  }
  if (hint.length > 40) {
    return NextResponse.json({ message: '비밀번호 힌트는 40자 이내로 입력해 주세요.' }, { status: 400 });
  }
  if (sketchbook.managePinHash && !(await verifyManagePin(currentPin, sketchbook.managePinHash))) {
    return NextResponse.json({ message: '현재 관리 비밀번호가 맞지 않아요.' }, { status: 401 });
  }

  await updateManagePin(sketchbook.id, await hashManagePin(newPin), hint || null);
  await deleteManagePinSessions(sketchbook.id);
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
