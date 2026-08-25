import { NextResponse } from 'next/server';

import {
  createManageCookieValue,
  isValidManageToken,
  MANAGE_COOKIE_NAME,
} from '@/lib/sketchbooks/manage-session';
import { findSketchbookByPublicId } from '@/lib/sketchbooks/repository';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ publicId: string }> },
) {
  const { publicId } = await params;
  const token = new URL(request.url).searchParams.get('token');
  const sketchbook = await findSketchbookByPublicId(publicId);

  if (sketchbook?.managePinHash) {
    return new NextResponse(null, { status: 303, headers: { Location: `/m/${publicId}/login` } });
  }

  if (!token || !sketchbook || !isValidManageToken(token, sketchbook.manageTokenHash)) {
    return new NextResponse('유효하지 않은 관리 복구 링크입니다.', { status: 403 });
  }

  const response = new NextResponse(null, {
    status: 303,
    headers: { Location: `/m/${publicId}` },
  });
  response.cookies.set({
    name: MANAGE_COOKIE_NAME,
    value: createManageCookieValue(publicId, token),
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}
