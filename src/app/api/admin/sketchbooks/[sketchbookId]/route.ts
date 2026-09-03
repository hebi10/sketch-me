import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import {
  getAdminSessionCookieName,
  verifyAdminSessionCookie,
} from '@/lib/admin/auth';
import { isAllowedAdminOrigin } from '@/lib/admin/origin';
import {
  sketchbookDeletionPayloadSchema,
  sketchbookModerationParamsSchema,
} from '@/lib/admin/schemas';
import { getAdminStorage } from '@/lib/firebase/admin';
import {
  createAdminSketchbookDeletionJob,
  deleteAdminSketchbookDeletionJob,
  deleteSketchbookDeletionJob,
  deleteSketchbookPermanently,
  findSketchbookDeletionTargetById,
  markSketchbookDeletionStarted,
} from '@/lib/sketchbooks/repository';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ sketchbookId: string }> },
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
  const parsedPayload = sketchbookDeletionPayloadSchema.safeParse(payload);
  if (!parsedPayload.success) {
    return NextResponse.json({ message: '공개 ID 확인값을 입력해 주세요.' }, { status: 400 });
  }

  const parsedParams = sketchbookModerationParamsSchema.safeParse(await params);
  if (!parsedParams.success) {
    return NextResponse.json({ message: '요청을 확인해 주세요.' }, { status: 400 });
  }

  try {
    const target = await findSketchbookDeletionTargetById(parsedParams.data.sketchbookId);
    if (!target) {
      return NextResponse.json({ message: '대상을 찾을 수 없습니다.' }, { status: 404 });
    }
    if (parsedPayload.data.confirmation !== target.publicId) {
      return NextResponse.json(
        { message: '공개 ID 확인값이 일치하지 않습니다.' },
        { status: 400 },
      );
    }

    if (target.source === 'sketchbook') {
      await createAdminSketchbookDeletionJob({
        adminUid: identity.uid,
        publicId: target.publicId,
        sketchbookId: target.id,
      });
      await markSketchbookDeletionStarted(target.id);
    }
    await getAdminStorage().bucket().deleteFiles({ prefix: `sketchbooks/${target.id}/` });
    await deleteSketchbookPermanently(target.id);
    await deleteSketchbookDeletionJob(target.publicId);
    await deleteAdminSketchbookDeletionJob(target.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(
      'Admin sketchbook deletion failed',
      error instanceof Error ? error.name : 'UnknownError',
    );
    return NextResponse.json(
      { message: '스케치북을 완전히 삭제하지 못했습니다.' },
      { status: 500 },
    );
  }
}
