import { NextResponse } from 'next/server';

import { getManagedSketchbook } from '@/lib/sketchbooks/management';
import { setBestDrawing, updateDrawingForManagement } from '@/lib/sketchbooks/repository';

export async function PATCH(request: Request, { params }: { params: Promise<{ publicId: string; drawingId: string }> }) {
  const { publicId, drawingId } = await params;
  const sketchbook = await getManagedSketchbook(publicId);
  if (!sketchbook) return NextResponse.json({ message: '관리 권한이 없습니다.' }, { status: 403 });

  const payload = await request.json().catch(() => null) as { action?: string; bestRank?: number } | null;
  if (payload?.action === 'hide' || payload?.action === 'show') {
    await updateDrawingForManagement(sketchbook.id, drawingId, { status: payload.action === 'hide' ? 'HIDDEN' : 'VISIBLE' });
    return NextResponse.json({ ok: true });
  }
  if (payload?.action === 'best' && [1, 2, 3, 4].includes(Number(payload.bestRank))) {
    await setBestDrawing(sketchbook.id, drawingId, Number(payload.bestRank) as 1 | 2 | 3 | 4);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ message: '요청을 확인해 주세요.' }, { status: 400 });
}
