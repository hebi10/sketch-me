import { NextResponse } from 'next/server';

import { getAdminStorage } from '@/lib/firebase/admin';
import { getManagedSketchbook } from '@/lib/sketchbooks/management';
import { MANAGE_COOKIE_NAME } from '@/lib/sketchbooks/manage-session';
import {
  deleteSketchbookPermanently,
  markSketchbookDeletionStarted,
} from '@/lib/sketchbooks/repository';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ publicId: string }> },
) {
  const { publicId } = await params;
  const sketchbook = await getManagedSketchbook(publicId);
  if (!sketchbook) return NextResponse.json({ message: '관리 권한이 없습니다.' }, { status: 403 });

  try {
    await markSketchbookDeletionStarted(sketchbook.id);
    await getAdminStorage().bucket().deleteFiles({ prefix: `sketchbooks/${sketchbook.id}/` });
    await deleteSketchbookPermanently(sketchbook.id);
  } catch {
    return NextResponse.json(
      { message: '스케치북을 모두 삭제하지 못했어요. 잠시 후 다시 시도해 주세요.' },
      { status: 500 },
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: MANAGE_COOKIE_NAME,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
  return response;
}
