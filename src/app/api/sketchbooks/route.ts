import { randomUUID } from 'node:crypto';

import { NextResponse } from 'next/server';

import { createSketchbookInputSchema } from '@/lib/domain/schemas';
import { getAdminStorage } from '@/lib/firebase/admin';
import { getOwnerDrawingPath, getReferenceImagePath } from '@/lib/firebase/storage';
import { createManageToken, hashManageToken, MANAGE_COOKIE_NAME } from '@/lib/sketchbooks/manage-session';
import { createSketchbookDraft } from '@/lib/sketchbooks/create';
import { saveSketchbook } from '@/lib/sketchbooks/repository';

function createPublicId() {
  return randomUUID().replaceAll('-', '').slice(0, 12);
}

function decodeImageDataUrl(imageDataUrl: string) {
  const [header, encoded] = imageDataUrl.split(',', 2);
  const contentType = header.match(/^data:(image\/(?:png|jpeg|webp));base64$/)?.[1];
  if (!contentType || !encoded) throw new Error('이미지 데이터를 다시 확인해 주세요.');
  const buffer = Buffer.from(encoded, 'base64');
  if (buffer.byteLength > 2 * 1024 * 1024) throw new Error('이미지는 2MB 이하로 저장해 주세요.');
  return { buffer, contentType };
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const parsed = createSketchbookInputSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? '입력값을 다시 확인해 주세요.' },
      { status: 400 },
    );
  }

  const manageToken = createManageToken();
  const sketchbookId = randomUUID();
  const ownerDrawingPath = getOwnerDrawingPath(sketchbookId);
  const referenceImagePath = parsed.data.referenceImageDataUrl ? getReferenceImagePath(sketchbookId) : null;
  const sketchbook = createSketchbookDraft({
    id: sketchbookId,
    publicId: createPublicId(),
    name: parsed.data.name,
    manageTokenHash: hashManageToken(manageToken),
    ownerDrawingPath,
    referenceImagePath,
    createdAt: new Date(),
  });

  const bucket = getAdminStorage().bucket();
  const uploadedPaths: string[] = [];
  try {
    const ownerImage = decodeImageDataUrl(parsed.data.ownerImageDataUrl);
    await bucket.file(ownerDrawingPath).save(ownerImage.buffer, { metadata: { contentType: ownerImage.contentType, cacheControl: 'private, max-age=0' } });
    uploadedPaths.push(ownerDrawingPath);
    if (referenceImagePath && parsed.data.referenceImageDataUrl) {
      const referenceImage = decodeImageDataUrl(parsed.data.referenceImageDataUrl);
      await bucket.file(referenceImagePath).save(referenceImage.buffer, { metadata: { contentType: referenceImage.contentType, cacheControl: 'private, max-age=0' } });
      uploadedPaths.push(referenceImagePath);
    }
    await saveSketchbook(sketchbook);
  } catch (error) {
    await Promise.all(uploadedPaths.map((path) => bucket.file(path).delete({ ignoreNotFound: true })));
    const message = error instanceof Error ? error.message : '스캐치북을 만들지 못했습니다.';
    return NextResponse.json({ message }, { status: 500 });
  }

  const response = NextResponse.json({
    publicUrl: `/s/${sketchbook.publicId}`,
    manageUrl: `/m/${sketchbook.publicId}`,
    recoveryUrl: `/m/${sketchbook.publicId}/recover?token=${manageToken}`,
  });

  response.cookies.set({
    name: MANAGE_COOKIE_NAME,
    value: `${sketchbook.publicId}.${manageToken}`,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });

  return response;
}
