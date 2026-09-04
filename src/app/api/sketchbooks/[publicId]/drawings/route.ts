import { randomUUID } from 'node:crypto';

import { NextResponse } from 'next/server';

import { submitDrawingPayloadSchema } from '@/lib/domain/schemas';
import { createDrawingDraft } from '@/lib/drawings/create';
import { getAdminStorage } from '@/lib/firebase/admin';
import { getDrawingImagePath, getDrawingThumbnailPath } from '@/lib/firebase/storage';
import { ImageOptimizationError, optimizeDrawingImages } from '@/lib/images/optimize';
import { enforceAppCheck } from '@/lib/security/app-check-server';
import { getDrawingSubmissionSourceHash } from '@/lib/security/drawing-submission-source';
import { enforcePublicMutationLimit } from '@/lib/security/rate-limit';
import { findSketchbookByPublicId, saveDrawingWithinLimit } from '@/lib/sketchbooks/repository';

function dataUrlToBuffer(imageDataUrl: string) {
  const [header, encoded] = imageDataUrl.split(',', 2);
  const contentType = header.match(/^data:(image\/(?:png|jpeg|webp));base64$/)?.[1];

  if (!contentType || !encoded) {
    throw new Error('그림 데이터를 다시 확인해 주세요.');
  }

  return { buffer: Buffer.from(encoded, 'base64'), contentType };
}

async function deleteUploadedDrawingFiles(paths: string[]) {
  const bucket = getAdminStorage().bucket();
  await Promise.all(paths.map((path) => (
    bucket.file(path).delete({ ignoreNotFound: true })
  )));
}

export async function POST(request: Request, { params }: { params: Promise<{ publicId: string }> }) {
  const appCheckResponse = await enforceAppCheck(request);
  if (appCheckResponse) return appCheckResponse;

  const rateLimitResponse = await enforcePublicMutationLimit(request, 'submitDrawing');
  if (rateLimitResponse) return rateLimitResponse;

  const { publicId } = await params;
  const payload = await request.json().catch(() => null);
  const parsed = submitDrawingPayloadSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? '입력값을 다시 확인해 주세요.' },
      { status: 400 },
    );
  }

  const sketchbook = await findSketchbookByPublicId(publicId);
  if (
    !sketchbook
    || sketchbook.status !== 'PUBLIC'
    || sketchbook.moderationStatus === 'BLOCKED'
  ) {
    return NextResponse.json({ message: '스캐치북을 찾을 수 없어요.' }, { status: 404 });
  }

  if (sketchbook.participantCount >= sketchbook.participantLimit) {
    return NextResponse.json({ message: '친구 그림을 더 받을 수 있는 인원이 모두 찼습니다.' }, { status: 409 });
  }

  const drawingId = randomUUID();
  const imagePath = getDrawingImagePath(sketchbook.id, drawingId);
  const thumbnailPath = getDrawingThumbnailPath(sketchbook.id, drawingId);
  const uploadedPaths = [imagePath, thumbnailPath];
  try {
    const optimizedImages = await optimizeDrawingImages(dataUrlToBuffer(parsed.data.imageDataUrl).buffer);
    const bucket = getAdminStorage().bucket();
    const results = await Promise.allSettled([
      bucket.file(imagePath).save(optimizedImages.original.buffer, {
        metadata: { contentType: optimizedImages.original.contentType, cacheControl: 'private, max-age=0' },
      }),
      bucket.file(thumbnailPath).save(optimizedImages.thumbnail.buffer, {
        metadata: { contentType: optimizedImages.thumbnail.contentType, cacheControl: 'public, max-age=300' },
      }),
    ]);
    const failed = results.find((result) => result.status === 'rejected');
    if (failed?.status === 'rejected') throw failed.reason;
  } catch (error) {
    await deleteUploadedDrawingFiles(uploadedPaths);
    if (error instanceof ImageOptimizationError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    console.error('Drawing image processing failed', error instanceof Error ? error.name : 'UnknownError');
    return NextResponse.json(
      { message: '그림을 변환하지 못했어요. 잠시 후 다시 시도해 주세요.' },
      { status: 500 },
    );
  }

  const drawing = createDrawingDraft({
    id: drawingId,
    sketchbookId: sketchbook.id,
    sketchbookPublicId: sketchbook.publicId,
    sketchbookName: sketchbook.name,
    imagePath,
    thumbnailPath,
    authorName: parsed.data.authorName,
    message: parsed.data.message,
    createdAt: new Date(),
  });
  const submissionSourceHash = getDrawingSubmissionSourceHash(request, sketchbook.manageTokenHash);

  try {
    await saveDrawingWithinLimit(sketchbook, drawing, submissionSourceHash);
  } catch (error) {
    await deleteUploadedDrawingFiles(uploadedPaths);
    if (error instanceof Error && error.message === '친구 그림을 더 받을 수 있는 인원이 모두 찼습니다.') {
      return NextResponse.json({ message: error.message }, { status: 409 });
    }
    if (error instanceof Error && error.message === '스케치북을 찾을 수 없거나 공개되어 있지 않습니다.') {
      return NextResponse.json({ message: '스케치북을 찾을 수 없어요.' }, { status: 404 });
    }
    if (error instanceof Error && error.message === '한 친구는 같은 스캐치북에 그림을 2개까지만 남길 수 있어요.') {
      return NextResponse.json({ message: error.message }, { status: 429 });
    }
    console.error('Drawing persistence failed', error instanceof Error ? error.name : 'UnknownError');
    return NextResponse.json(
      { message: '그림을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.' },
      { status: 500 },
    );
  }

  return NextResponse.json({ drawingId }, { status: 201 });
}
