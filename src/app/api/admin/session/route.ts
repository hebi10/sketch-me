import { NextResponse } from 'next/server';

import {
  AdminAuthError,
  createAdminSessionCookie,
  getAdminSessionCookieName,
  getAdminSessionCookieOptions,
} from '@/lib/admin/auth';
import { isAllowedAdminOrigin } from '@/lib/admin/origin';

const INVALID_REQUEST_MESSAGE = '로그인 정보를 확인해 주세요.';

function forbiddenOriginResponse() {
  return NextResponse.json({ message: '허용되지 않은 요청입니다.' }, { status: 403 });
}

export async function POST(request: Request) {
  if (!isAllowedAdminOrigin(request)) {
    return forbiddenOriginResponse();
  }

  const body = await request.json().catch(() => null) as { idToken?: unknown } | null;
  if (typeof body?.idToken !== 'string') {
    return NextResponse.json({ message: INVALID_REQUEST_MESSAGE }, { status: 400 });
  }

  try {
    const sessionCookie = await createAdminSessionCookie(body.idToken);
    const response = new NextResponse(null, { status: 204 });
    response.cookies.set(
      getAdminSessionCookieName(),
      sessionCookie,
      getAdminSessionCookieOptions(),
    );
    return response;
  } catch (error) {
    if (error instanceof AdminAuthError) {
      if (error.code === 'INVALID_TOKEN' || error.code === 'RECENT_LOGIN_REQUIRED') {
        return NextResponse.json(
          { message: '로그인 정보를 다시 확인해 주세요.' },
          { status: 401 },
        );
      }

      if (error.code === 'FORBIDDEN') {
        return NextResponse.json(
          { message: '허용된 관리자 계정이 아닙니다.' },
          { status: 403 },
        );
      }
    }

    console.error(
      'Admin session creation failed',
      error instanceof Error ? error.name : 'UnknownError',
    );
    return NextResponse.json(
      { message: '로그인 처리 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  if (!isAllowedAdminOrigin(request)) {
    return forbiddenOriginResponse();
  }

  const response = new NextResponse(null, { status: 204 });
  response.cookies.set(getAdminSessionCookieName(), '', {
    ...getAdminSessionCookieOptions(),
    maxAge: 0,
  });
  return response;
}
