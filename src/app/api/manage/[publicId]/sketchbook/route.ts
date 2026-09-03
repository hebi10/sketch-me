import { NextResponse } from 'next/server';

import { getAdminStorage } from '@/lib/firebase/admin';
import { STORY_SHARED_HEADING_MAX_LENGTH } from '@/lib/share/story-layout';
import { getManagedSketchbook, prepareSketchbookDeletion } from '@/lib/sketchbooks/management';
import { MANAGE_COOKIE_NAME } from '@/lib/sketchbooks/manage-session';
import {
  clearOwnerBestDrawing,
  deleteSketchbookDeletionJob,
  deleteSketchbookPermanently,
  markSketchbookDeletionStarted,
  findVisibleBestDrawing,
  setOwnerBestDrawing,
  updateSketchbookStoryHeading,
  updateSketchbookShareThumbnailMode,
} from '@/lib/sketchbooks/repository';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ publicId: string }> },
) {
  const { publicId } = await params;
  const sketchbook = await getManagedSketchbook(publicId);
  if (!sketchbook) return NextResponse.json({ message: '관리 권한이 없습니다.' }, { status: 403 });

  const payload = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (payload && Object.hasOwn(payload, 'shareThumbnailMode')) {
    const shareThumbnailMode = payload.shareThumbnailMode;
    if (shareThumbnailMode !== 'DEFAULT' && shareThumbnailMode !== 'OWNER' && shareThumbnailMode !== 'BEST_1') {
      return NextResponse.json({ message: '공유 썸네일을 다시 선택해 주세요.' }, { status: 400 });
    }
    if (shareThumbnailMode === 'OWNER' && !sketchbook.ownerDrawingPath) {
      return NextResponse.json({ message: '내가 그린 그림이 아직 없어요.' }, { status: 409 });
    }
    if (shareThumbnailMode === 'BEST_1' && !await findVisibleBestDrawing(sketchbook.id, 1)) {
      return NextResponse.json({ message: '공개 중인 1위 그림이 아직 없어요.' }, { status: 409 });
    }
    await updateSketchbookShareThumbnailMode(sketchbook.id, shareThumbnailMode);
    return NextResponse.json({ shareThumbnailMode });
  }
  if (payload && Object.hasOwn(payload, 'ownerBestRank')) {
    if (payload.ownerBestRank === null) {
      await clearOwnerBestDrawing(sketchbook.id);
      return NextResponse.json({ ownerBestRank: null });
    }
    const ownerBestRank = Number(payload.ownerBestRank);
    if (!Number.isInteger(ownerBestRank) || ![1, 2, 3, 4].includes(ownerBestRank)) {
      return NextResponse.json({ message: 'BEST 순위는 1부터 4까지 선택해 주세요.' }, { status: 400 });
    }
    await setOwnerBestDrawing(sketchbook.id, ownerBestRank as 1 | 2 | 3 | 4);
    return NextResponse.json({ ownerBestRank });
  }
  const storyHeading = typeof payload?.storyHeading === 'string' ? payload.storyHeading.trim() : '';
  if (!storyHeading || storyHeading.length > STORY_SHARED_HEADING_MAX_LENGTH) {
    return NextResponse.json(
      { message: `이미지 제목은 1자 이상 ${STORY_SHARED_HEADING_MAX_LENGTH}자 이내로 입력해 주세요.` },
      { status: 400 },
    );
  }

  await updateSketchbookStoryHeading(sketchbook.id, storyHeading);
  return NextResponse.json({ storyHeading });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ publicId: string }> },
) {
  const { publicId } = await params;
  let sketchbook: Awaited<ReturnType<typeof prepareSketchbookDeletion>>;
  try {
    sketchbook = await prepareSketchbookDeletion(publicId);
  } catch {
    return NextResponse.json(
      { message: '스케치북을 모두 삭제하지 못했어요. 잠시 후 다시 시도해 주세요.' },
      { status: 500 },
    );
  }
  if (!sketchbook) return NextResponse.json({ message: '관리 권한이 없습니다.' }, { status: 403 });

  try {
    await markSketchbookDeletionStarted(sketchbook.id);
    await getAdminStorage().bucket().deleteFiles({ prefix: `sketchbooks/${sketchbook.id}/` });
    await deleteSketchbookPermanently(sketchbook.id);
    await deleteSketchbookDeletionJob(publicId);
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
