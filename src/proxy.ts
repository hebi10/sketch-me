import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import {
  createDrawingParticipantToken,
  DRAWING_PARTICIPANT_COOKIE,
  DRAWING_PARTICIPANT_MAX_AGE,
  readDrawingParticipantId,
} from '@/lib/security/drawing-submission-source';

const publicSketchbookImagePath = /^\/api\/sketchbooks\/[^/]+\/(?:drawings\/[^/]+\/(?:image|thumbnail)|owner\/image)\/?$/;

function decodeImageSource(value: string) {
  let decoded = value;

  for (let pass = 0; pass < 4; pass += 1) {
    try {
      const nextValue = decodeURIComponent(decoded);
      if (nextValue === decoded) break;
      decoded = nextValue;
    } catch {
      break;
    }
  }

  return decoded;
}

function targetsPublicSketchbookImage(source: string, requestUrl: string) {
  try {
    const pathname = new URL(decodeImageSource(source), requestUrl).pathname;
    return publicSketchbookImagePath.test(pathname);
  } catch {
    return false;
  }
}

export function proxy(request: NextRequest) {
  if (request.method === 'GET' && request.nextUrl.pathname.startsWith('/s/')) {
    const response = NextResponse.next();
    const secret = process.env.PUBLIC_MUTATION_RATE_LIMIT_SECRET ?? '';
    const existing = request.cookies.get(DRAWING_PARTICIPANT_COOKIE)?.value;
    if (secret.trim() && !readDrawingParticipantId(existing, secret)) {
      response.cookies.set(DRAWING_PARTICIPANT_COOKIE, createDrawingParticipantToken(secret), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: DRAWING_PARTICIPANT_MAX_AGE,
      });
      response.headers.set('Cache-Control', 'private, no-store');
    }
    return response;
  }

  const source = request.nextUrl.searchParams.get('url');

  if (source && targetsPublicSketchbookImage(source, request.url)) {
    return new NextResponse(null, {
      headers: { 'Cache-Control': 'private, no-store' },
      status: 404,
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/_next/image', '/s/:path*'],
};
