import { NextResponse } from 'next/server';

import { getAdminStorage } from '@/lib/firebase/admin';
import { isOwnerDrawingPathFor } from '@/lib/firebase/storage';
import { findSketchbookByPublicId } from '@/lib/sketchbooks/repository';

const safeImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

function notFoundResponse() {
  return new NextResponse(null, {
    headers: {
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
    status: 404,
  });
}

function errorResponse() {
  return new NextResponse(null, {
    headers: {
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
    status: 500,
  });
}

export async function GET(_request: Request, { params }: { params: Promise<{ publicId: string }> }) {
  try {
    const { publicId } = await params;
    const sketchbook = await findSketchbookByPublicId(publicId);
    const imagePath = sketchbook?.ownerDrawingPath;
    if (
      !sketchbook
      || sketchbook.status !== 'PUBLIC'
      || sketchbook.moderationStatus === 'BLOCKED'
      || !imagePath
      || !isOwnerDrawingPathFor(imagePath, sketchbook.id)
    ) return notFoundResponse();

    const file = getAdminStorage().bucket().file(imagePath);
    const [[contents], [metadata]] = await Promise.all([file.download(), file.getMetadata()]);
    const contentType = metadata.contentType;
    if (!contentType || !safeImageTypes.has(contentType)) {
      throw new Error('UnsafePublicOwnerImageContentType');
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
      'Public owner image failed',
      error instanceof Error ? error.name : 'UnknownError',
    );
    return errorResponse();
  }
}
