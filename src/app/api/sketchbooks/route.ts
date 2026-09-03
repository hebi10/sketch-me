import { randomUUID } from 'node:crypto';

import { NextResponse } from 'next/server';

import { createSketchbookInputSchema } from '@/lib/domain/schemas';
import { getAdminStorage } from '@/lib/firebase/admin';
import { getOwnerDrawingPath } from '@/lib/firebase/storage';
import { ImageOptimizationError, optimizeImageForStorage } from '@/lib/images/optimize';
import { enforceAppCheck } from '@/lib/security/app-check-server';
import { enforcePublicMutationLimit } from '@/lib/security/rate-limit';
import {
  createPinManageCookieValue,
  createManageToken,
  hashManageToken,
  MANAGE_COOKIE_NAME,
} from '@/lib/sketchbooks/manage-session';
import { createSketchbookDraft } from '@/lib/sketchbooks/create';
import { hashManagePin } from '@/lib/sketchbooks/manage-pin';
import {
  createManagePinSession,
  deleteSketchbookPermanently,
  findSketchbookByPublicId,
  saveSketchbook,
} from '@/lib/sketchbooks/repository';

const manageSessionMaxAge = 60 * 60 * 24 * 30;

export async function createUniquePublicId(
  generate: () => string = randomUUID,
  findExisting: typeof findSketchbookByPublicId = findSketchbookByPublicId,
) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = generate().replaceAll('-', '');
    if (!await findExisting(candidate)) return candidate;
  }
  throw new Error('PublicIdCollisionLimitExceeded');
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
  const appCheckResponse = await enforceAppCheck(request);
  if (appCheckResponse) return appCheckResponse;

  const rateLimitResponse = enforcePublicMutationLimit(request, 'createSketchbook');
  if (rateLimitResponse) return rateLimitResponse;

  const payload = await request.json().catch(() => null);
  const parsed = createSketchbookInputSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? '입력값을 다시 확인해 주세요.' },
      { status: 400 },
    );
  }

  let publicId: string;
  try {
    publicId = await createUniquePublicId();
  } catch (error) {
    console.error('Sketchbook public ID allocation failed', error instanceof Error ? error.name : 'UnknownError');
    return NextResponse.json(
      { message: '스케치북을 만들지 못했어요. 잠시 후 다시 시도해 주세요.' },
      { status: 500 },
    );
  }

  const manageToken = createManageToken();
  const managePinHash = await hashManagePin(parsed.data.managePin);
  const sketchbookId = randomUUID();
  const ownerDrawingPath = parsed.data.ownerImageDataUrl ? getOwnerDrawingPath(sketchbookId) : null;
  const sketchbook = createSketchbookDraft({
    id: sketchbookId,
    publicId,
    name: parsed.data.name,
    manageTokenHash: hashManageToken(manageToken),
    managePinHash,
    managePinHint: parsed.data.managePinHint,
    ownerDrawingPath,
    createdAt: new Date(),
  });

  const bucket = getAdminStorage().bucket();
  const uploadedPaths: string[] = [];
  try {
    if (ownerDrawingPath && parsed.data.ownerImageDataUrl) {
      const ownerImage = await optimizeImageForStorage(decodeImageDataUrl(parsed.data.ownerImageDataUrl).buffer, 'sketch');
      await bucket.file(ownerDrawingPath).save(ownerImage.buffer, { metadata: { contentType: ownerImage.contentType, cacheControl: 'private, max-age=0' } });
      uploadedPaths.push(ownerDrawingPath);
    }
    await saveSketchbook(sketchbook);
  } catch (error) {
    await Promise.all(uploadedPaths.map((path) => bucket.file(path).delete({ ignoreNotFound: true })));
    if (error instanceof ImageOptimizationError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    console.error('Sketchbook creation failed', error instanceof Error ? error.name : 'UnknownError');
    return NextResponse.json(
      { message: '스케치북을 만들지 못했어요. 잠시 후 다시 시도해 주세요.' },
      { status: 500 },
    );
  }

  let session: { sessionId: string; token: string };
  try {
    session = await createManagePinSession(
      sketchbook.id,
      new Date(Date.now() + manageSessionMaxAge * 1_000),
    );
  } catch (error) {
    console.error('Sketchbook manage session creation failed', error instanceof Error ? error.name : 'UnknownError');
    await Promise.allSettled([
      deleteSketchbookPermanently(sketchbook.id),
      ...uploadedPaths.map((path) => bucket.file(path).delete({ ignoreNotFound: true })),
    ]);
    return NextResponse.json(
      { message: '스케치북을 만들지 못했어요. 잠시 후 다시 시도해 주세요.' },
      { status: 500 },
    );
  }

  const response = NextResponse.json({ publicUrl: `/s/${sketchbook.publicId}`, manageUrl: `/m/${sketchbook.publicId}` });

  response.cookies.set({
    name: MANAGE_COOKIE_NAME,
    value: createPinManageCookieValue(sketchbook.publicId, session.sessionId, session.token),
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: manageSessionMaxAge,
  });

  return response;
}
