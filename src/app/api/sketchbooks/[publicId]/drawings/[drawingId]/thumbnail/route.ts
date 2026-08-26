import { NextResponse } from 'next/server';

import { getAdminStorage } from '@/lib/firebase/admin';
import {
  getDrawingThumbnailPath,
  isDrawingImagePathFor,
  isDrawingThumbnailPathFor,
} from '@/lib/firebase/storage';
import { optimizeDrawingThumbnail } from '@/lib/images/optimize';
import { findDrawing, findSketchbookByPublicId } from '@/lib/sketchbooks/repository';

const publicThumbnailCache = 'public, max-age=300, s-maxage=300, stale-while-revalidate=60';

function notFoundResponse() {
  return new NextResponse(null, {
    headers: { 'Cache-Control': 'private, no-store' },
    status: 404,
  });
}

function thumbnailResponse(contents: Buffer, drawingId: string, version: string) {
  return new NextResponse(Uint8Array.from(contents), {
    headers: {
      'Cache-Control': publicThumbnailCache,
      'Content-Type': 'image/webp',
      ETag: `"${drawingId}-${version}-thumb"`,
    },
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ publicId: string; drawingId: string }> },
) {
  const { publicId, drawingId } = await params;
  const requestedVersion = new URL(request.url).searchParams.get('v');
  if (!requestedVersion || !/^[a-zA-Z0-9_-]{1,100}$/.test(requestedVersion)) {
    return notFoundResponse();
  }

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
    || drawing.publicImageVersion !== requestedVersion
    || !isDrawingImagePathFor(drawing.imagePath, sketchbook.id, drawingId)
  ) {
    return notFoundResponse();
  }

  const thumbnailPath = drawing.thumbnailPath
    ?? getDrawingThumbnailPath(sketchbook.id, drawingId);
  if (!isDrawingThumbnailPathFor(thumbnailPath, sketchbook.id, drawingId)) {
    return notFoundResponse();
  }

  const bucket = getAdminStorage().bucket();
  const thumbnailFile = bucket.file(thumbnailPath);
  try {
    const [contents] = await thumbnailFile.download();
    return thumbnailResponse(contents, drawingId, requestedVersion);
  } catch {
    // Legacy drawings predate thumbnails and are generated once on demand.
  }

  try {
    const [source] = await bucket.file(drawing.imagePath).download();
    const optimized = await optimizeDrawingThumbnail(source);
    try {
      await thumbnailFile.save(optimized.buffer, {
        metadata: { cacheControl: 'public, max-age=300', contentType: optimized.contentType },
      });
    } catch (error) {
      console.error(
        'Thumbnail backfill failed',
        error instanceof Error ? error.name : 'UnknownError',
      );
    }
    return thumbnailResponse(optimized.buffer, drawingId, requestedVersion);
  } catch {
    return notFoundResponse();
  }
}
