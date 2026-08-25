import { NextResponse } from 'next/server';

import { getAdminStorage } from '@/lib/firebase/admin';
import { findSketchbookByPublicId } from '@/lib/sketchbooks/repository';

function notFoundResponse() {
  return new NextResponse(null, {
    headers: { 'Cache-Control': 'private, no-store' },
    status: 404,
  });
}

export async function GET(_request: Request, { params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  const sketchbook = await findSketchbookByPublicId(publicId);
  if (
    !sketchbook
    || sketchbook.status !== 'PUBLIC'
    || sketchbook.moderationStatus === 'BLOCKED'
    || !sketchbook.ownerDrawingPath
  ) return notFoundResponse();

  const file = getAdminStorage().bucket().file(sketchbook.ownerDrawingPath);
  const [[contents], [metadata]] = await Promise.all([file.download(), file.getMetadata()]);
  return new NextResponse(Uint8Array.from(contents), {
    headers: { 'Cache-Control': 'private, no-store', 'Content-Type': metadata.contentType ?? 'image/png' },
  });
}
