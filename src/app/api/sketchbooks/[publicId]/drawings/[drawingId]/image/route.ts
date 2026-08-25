import { NextResponse } from 'next/server';

import { getAdminStorage } from '@/lib/firebase/admin';
import { findDrawing, findSketchbookByPublicId } from '@/lib/sketchbooks/repository';

function notFoundResponse() {
  return new NextResponse(null, {
    headers: { 'Cache-Control': 'private, no-store' },
    status: 404,
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ publicId: string; drawingId: string }> },
) {
  const { publicId, drawingId } = await params;
  const sketchbook = await findSketchbookByPublicId(publicId);

  if (
    !sketchbook
    || sketchbook.status !== 'PUBLIC'
    || sketchbook.moderationStatus === 'BLOCKED'
  ) {
    return notFoundResponse();
  }

  const drawing = await findDrawing(sketchbook.id, drawingId);
  if (
    !drawing
    || drawing.status !== 'VISIBLE'
    || drawing.moderationStatus === 'BLOCKED'
  ) {
    return notFoundResponse();
  }

  const file = getAdminStorage().bucket().file(drawing.imagePath);
  const [[contents], [metadata]] = await Promise.all([file.download(), file.getMetadata()]);
  return new NextResponse(Uint8Array.from(contents), {
    headers: {
      'Cache-Control': 'private, no-store',
      'Content-Type': metadata.contentType ?? 'image/png',
    },
  });
}
