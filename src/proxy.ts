import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

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
  matcher: '/_next/image',
};
