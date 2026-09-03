import { NextResponse } from 'next/server';

import { updateOwnerDrawingPayloadSchema } from '@/lib/domain/schemas';
import { getAdminStorage } from '@/lib/firebase/admin';
import { getOwnerDrawingPath, isOwnerDrawingPathFor } from '@/lib/firebase/storage';
import { ImageOptimizationError, optimizeImageForStorage } from '@/lib/images/optimize';
import { getManagedSketchbook } from '@/lib/sketchbooks/management';
import { updateOwnerDrawingForManagement } from '@/lib/sketchbooks/repository';

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

function dataUrlToBuffer(imageDataUrl: string) {
  const [, encoded] = imageDataUrl.split(',', 2);
  return Buffer.from(encoded, 'base64');
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ publicId: string }> },
) {
  try {
    const { publicId } = await params;
    const sketchbook = await getManagedSketchbook(publicId);
    if (!sketchbook) return emptyResponse(401);
    if (
      !sketchbook.ownerDrawingPath
      || !isOwnerDrawingPathFor(sketchbook.ownerDrawingPath, sketchbook.id)
    ) {
      return emptyResponse(404);
    }

    const parsed = updateOwnerDrawingPayloadSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? '본인 그림 데이터를 다시 확인해 주세요.' },
        { status: 400 },
      );
    }

    const optimized = await optimizeImageForStorage(dataUrlToBuffer(parsed.data.imageDataUrl), 'sketch');
    const ownerDrawingPath = getOwnerDrawingPath(sketchbook.id);
    await getAdminStorage().bucket().file(ownerDrawingPath).save(optimized.buffer, {
      metadata: {
        cacheControl: 'private, max-age=0',
        contentType: optimized.contentType,
      },
    });
    await updateOwnerDrawingForManagement(sketchbook.id, ownerDrawingPath);

    return NextResponse.json(
      { ok: true },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: '요청 데이터를 다시 확인해 주세요.' }, { status: 400 });
    }
    if (error instanceof ImageOptimizationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error(
      'Manage owner image update failed',
      error instanceof Error ? error.name : 'UnknownError',
    );
    return NextResponse.json(
      { error: '그림을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.' },
      { status: 500 },
    );
  }
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
