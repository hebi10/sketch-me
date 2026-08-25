import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { getManagedSketchbook } from '@/lib/sketchbooks/management';
import { MANAGE_COOKIE_NAME, parseManageSession } from '@/lib/sketchbooks/manage-session';
import { deleteManagePinSession } from '@/lib/sketchbooks/repository';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ publicId: string }> },
) {
  const { publicId } = await params;
  const sketchbook = await getManagedSketchbook(publicId);
  if (!sketchbook) return NextResponse.json({ message: '관리 권한이 없습니다.' }, { status: 403 });

  const session = parseManageSession((await cookies()).get(MANAGE_COOKIE_NAME)?.value);
  if (session?.type === 'pin') await deleteManagePinSession(sketchbook.id, session.sessionId);
  const response = NextResponse.json({ ok: true });
  response.cookies.set({ name: MANAGE_COOKIE_NAME, value: '', httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 0 });
  return response;
}
