import { randomUUID } from 'node:crypto';

import { NextResponse } from 'next/server';

import { createSketchbookInputSchema } from '@/lib/domain/schemas';
import { createManageToken, hashManageToken, MANAGE_COOKIE_NAME } from '@/lib/sketchbooks/manage-session';
import { createSketchbookDraft } from '@/lib/sketchbooks/create';
import { saveSketchbook } from '@/lib/sketchbooks/repository';

function createPublicId() {
  return randomUUID().replaceAll('-', '').slice(0, 12);
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
  const sketchbook = createSketchbookDraft({
    id: randomUUID(),
    publicId: createPublicId(),
    name: parsed.data.name,
    manageTokenHash: hashManageToken(manageToken),
    createdAt: new Date(),
  });

  await saveSketchbook(sketchbook);

  const response = NextResponse.json({
    publicUrl: `/s/${sketchbook.publicId}`,
    manageUrl: `/m/${sketchbook.publicId}`,
  });

  response.cookies.set({
    name: MANAGE_COOKIE_NAME,
    value: `${sketchbook.publicId}.${manageToken}`,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: `/m/${sketchbook.publicId}`,
    maxAge: 60 * 60 * 24 * 365,
  });

  return response;
}
