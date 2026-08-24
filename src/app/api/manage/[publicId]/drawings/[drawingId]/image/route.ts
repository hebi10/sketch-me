import { NextResponse } from 'next/server';

import { getAdminStorage } from '@/lib/firebase/admin';
import { getManagedSketchbook } from '@/lib/sketchbooks/management';
import { findDrawing } from '@/lib/sketchbooks/repository';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ publicId: string; drawingId: string }> },
) {
  const { publicId, drawingId } = await params;
  const sketchbook = await getManagedSketchbook(publicId);
  if (!sketchbook) return new NextResponse(null, { status: 403 });

  const drawing = await findDrawing(sketchbook.id, drawingId);
  if (!drawing || drawing.status === 'DELETED') return new NextResponse(null, { status: 404 });

  const file = getAdminStorage().bucket().file(drawing.imagePath);
  const [[contents], [metadata]] = await Promise.all([file.download(), file.getMetadata()]);
  return new NextResponse(Uint8Array.from(contents), {
    headers: {
      'Cache-Control': 'private, max-age=300',
      'Content-Type': metadata.contentType ?? 'image/png',
    },
  });
}
