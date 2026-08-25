import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import {
  getAdminSessionCookieName,
  verifyAdminSessionCookie,
} from '@/lib/admin/auth';
import { drawingModerationParamsSchema } from '@/lib/admin/schemas';
import { getAdminStorage } from '@/lib/firebase/admin';
import { findDrawing } from '@/lib/sketchbooks/repository';

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
  { params }: {
    params: Promise<{ drawingId: string; sketchbookId: string }>;
  },
) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(getAdminSessionCookieName())?.value;
    const identity = await verifyAdminSessionCookie(sessionCookie);
    if (!identity) return emptyResponse(401);

    const parsedParams = drawingModerationParamsSchema.safeParse(await params);
    if (!parsedParams.success) return emptyResponse(404);

    const { drawingId, sketchbookId } = parsedParams.data;
    const drawing = await findDrawing(sketchbookId, drawingId);
    if (
      !drawing
      || drawing.sketchbookId !== sketchbookId
      || drawing.status === 'DELETED'
    ) {
      return emptyResponse(404);
    }

    const file = getAdminStorage().bucket().file(drawing.imagePath);
    const [[contents], [metadata]] = await Promise.all([
      file.download(),
      file.getMetadata(),
    ]);
    const contentType = metadata.contentType;
    if (!contentType || !safeImageTypes.has(contentType)) {
      throw new Error('UnsafeAdminDrawingImageContentType');
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
      'Admin drawing image failed',
      error instanceof Error ? error.name : 'UnknownError',
    );
    return emptyResponse(500);
  }
}
