import { NextResponse } from 'next/server';

import { getAdminStorage } from '@/lib/firebase/admin';
import { isOwnerDrawingPathFor } from '@/lib/firebase/storage';
import { getManagedSketchbook } from '@/lib/sketchbooks/management';

const safeImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

function emptyResponse(status: 401 | 404 | 500) {
  return new NextResponse(null, {
    headers: {
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
    status,
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ publicId: string }> },
) {
  try {
    const { publicId } = await params;
    const sketchbook = await getManagedSketchbook(publicId);
    if (!sketchbook) return emptyResponse(401);

    const imagePath = sketchbook.ownerDrawingPath;
    if (!imagePath || !isOwnerDrawingPathFor(imagePath, sketchbook.id)) {
      return emptyResponse(404);
    }

    const file = getAdminStorage().bucket().file(imagePath);
    const [[contents], [metadata]] = await Promise.all([
      file.download(),
      file.getMetadata(),
    ]);
    const contentType = metadata.contentType;
    if (!contentType || !safeImageTypes.has(contentType)) {
      throw new Error('UnsafeManageOwnerImageContentType');
    }

    return new NextResponse(Uint8Array.from(contents), {
      headers: {
        'Cache-Control': 'private, no-store',
        'Content-Disposition': 'inline',
        'Content-Type': contentType,
        'Cross-Origin-Resource-Policy': 'same-origin',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error(
      'Manage owner image failed',
      error instanceof Error ? error.name : 'UnknownError',
    );
    return emptyResponse(500);
  }
}
