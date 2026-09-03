import { NextResponse } from 'next/server';

import { getAdminStorage } from '@/lib/firebase/admin';
import { isDrawingImagePathFor } from '@/lib/firebase/storage';
import { findDrawing, findSketchbookByPublicId } from '@/lib/sketchbooks/repository';

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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ publicId: string; drawingId: string }> },
) {
  try {
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
      || drawing.sketchbookId !== sketchbook.id
      || drawing.status !== 'VISIBLE'
      || drawing.moderationStatus === 'BLOCKED'
      || !isDrawingImagePathFor(drawing.imagePath, sketchbook.id, drawingId)
    ) {
      return notFoundResponse();
    }

    const file = getAdminStorage().bucket().file(drawing.imagePath);
    const [[contents], [metadata]] = await Promise.all([file.download(), file.getMetadata()]);
    const contentType = metadata.contentType;
    if (!contentType || !safeImageTypes.has(contentType)) {
      throw new Error('UnsafePublicDrawingImageContentType');
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
      'Public drawing image failed',
      error instanceof Error ? error.name : 'UnknownError',
    );
    return errorResponse();
  }
}
