import { NextResponse } from 'next/server';

import { getAdminStorage } from '@/lib/firebase/admin';
import { findSketchbookByPublicId } from '@/lib/sketchbooks/repository';

export async function GET(_request: Request, { params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  const sketchbook = await findSketchbookByPublicId(publicId);
  if (!sketchbook || sketchbook.status !== 'PUBLIC' || !sketchbook.ownerDrawingPath) return new NextResponse(null, { status: 404 });

  const file = getAdminStorage().bucket().file(sketchbook.ownerDrawingPath);
  const [[contents], [metadata]] = await Promise.all([file.download(), file.getMetadata()]);
  return new NextResponse(Uint8Array.from(contents), {
    headers: { 'Cache-Control': 'public, max-age=3600', 'Content-Type': metadata.contentType ?? 'image/png' },
  });
}
