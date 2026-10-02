import { NextResponse } from 'next/server';

import { getAdminStorage } from '@/lib/firebase/admin';
import { getManagedSketchbook } from '@/lib/sketchbooks/management';
import {
  clearBestDrawing,
  deleteDrawingForManagement,
  DrawingDeletedError,
  DrawingPublicPromotionBlockedError,
  setBestDrawing,
  updateDrawingForManagement,
} from '@/lib/sketchbooks/repository';

export async function PATCH(request: Request, { params }: { params: Promise<{ publicId: string; drawingId: string }> }) {
  const { publicId, drawingId } = await params;
  const sketchbook = await getManagedSketchbook(publicId);
  if (!sketchbook) return NextResponse.json({ message: '관리 권한이 없습니다.' }, { status: 403 });

  const payload = await request.json().catch(() => null) as { action?: string; bestRank?: number } | null;
  try {
    if (payload?.action === 'hide' || payload?.action === 'show') {
      await updateDrawingForManagement(sketchbook.id, drawingId, { status: payload.action === 'hide' ? 'HIDDEN' : 'VISIBLE' });
      return NextResponse.json({ ok: true });
    }
    if (payload?.action === 'best' && [1, 2, 3, 4].includes(Number(payload.bestRank))) {
      await setBestDrawing(sketchbook.id, drawingId, Number(payload.bestRank) as 1 | 2 | 3 | 4);
      return NextResponse.json({ ok: true });
    }
    if (payload?.action === 'clearBest') {
      await clearBestDrawing(sketchbook.id, drawingId);
      return NextResponse.json({ ok: true });
    }
  } catch (error) {
    if (error instanceof DrawingPublicPromotionBlockedError || error instanceof DrawingDeletedError) {
      return NextResponse.json({ message: error.message }, { status: 409 });
    }
    throw error;
  }
  return NextResponse.json({ message: '요청을 확인해 주세요.' }, { status: 400 });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ publicId: string; drawingId: string }> },
) {
  const { publicId, drawingId } = await params;
  const sketchbook = await getManagedSketchbook(publicId);
  if (!sketchbook) return NextResponse.json({ message: '관리 권한이 없습니다.' }, { status: 403 });

  const payload = await request.json().catch(() => null) as { restoreSubmissionQuota?: unknown } | null;
  const imagePaths = await deleteDrawingForManagement(sketchbook.id, drawingId, {
    restoreSubmissionQuota: payload?.restoreSubmissionQuota === true,
  });
  if (imagePaths) {
    const paths = [imagePaths.imagePath, imagePaths.thumbnailPath].filter((path): path is string => Boolean(path));
    const results = await Promise.allSettled(paths.map(async (path) => (
      getAdminStorage().bucket().file(path).delete({ ignoreNotFound: true })
    )));
    if (results.some((result) => result.status === 'rejected')) {
      return NextResponse.json({
        message: '그림 파일을 모두 정리하지 못했습니다. 삭제를 다시 시도해 주세요.',
      }, { status: 503 });
    }
  }
  return NextResponse.json({ ok: true });
}
