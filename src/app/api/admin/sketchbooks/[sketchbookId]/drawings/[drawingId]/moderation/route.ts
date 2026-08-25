import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import {
  getAdminSessionCookieName,
  verifyAdminSessionCookie,
} from '@/lib/admin/auth';
import {
  ModerationTargetNotFoundError,
  setDrawingModeration,
} from '@/lib/admin/moderation';
import { isAllowedAdminOrigin } from '@/lib/admin/origin';
import { moderationPayloadSchema } from '@/lib/admin/schemas';

export async function PATCH(
  request: Request,
  { params }: {
    params: Promise<{ drawingId: string; sketchbookId: string }>;
  },
) {
  if (!isAllowedAdminOrigin(request)) {
    return NextResponse.json({ message: '허용되지 않은 요청입니다.' }, { status: 403 });
  }

  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(getAdminSessionCookieName())?.value;
  const identity = await verifyAdminSessionCookie(sessionCookie);
  if (!identity) {
    return NextResponse.json({ message: '관리자 로그인이 필요합니다.' }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = moderationPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ message: '운영 상태를 확인해 주세요.' }, { status: 400 });
  }

  const { drawingId, sketchbookId } = await params;
  try {
    const result = await setDrawingModeration({
      adminUid: identity.uid,
      drawingId,
      moderationStatus: parsed.data.moderationStatus,
      sketchbookId,
    });
    return NextResponse.json({
      changed: result.changed,
      moderationStatus: result.status,
    });
  } catch (error) {
    if (error instanceof ModerationTargetNotFoundError) {
      return NextResponse.json({ message: '대상을 찾을 수 없습니다.' }, { status: 404 });
    }
    console.error(
      'Admin drawing moderation failed',
      error instanceof Error ? error.name : 'UnknownError',
    );
    return NextResponse.json(
      { message: '운영 상태를 변경하지 못했습니다.' },
      { status: 500 },
    );
  }
}
