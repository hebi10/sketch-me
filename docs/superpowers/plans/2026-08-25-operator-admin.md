# 스캐치북 운영자 관리자 Implementation Plan

> 상태: 2026-08-31 참고 사진 기능 제거 결정으로 관련 필드·API·표시 요구사항은 폐기되었습니다. 현재 구현 기준은 `PRODUCT.md`와 최신 코드를 따릅니다.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 해비님의 Google 계정 한 개만 접근할 수 있는 모바일 운영자 관리 화면을 추가하고, 스케치북·그림을 안전하게 비활성화하거나 숨기며 전체 현황과 모의 결제를 조회할 수 있게 한다.

**Architecture:** Firebase Google 로그인 ID 토큰을 Next.js 서버가 검증한 뒤 12시간 관리자 세션 쿠키로 교환한다. 관리자 페이지와 API는 매 요청에서 허용 UID·이메일·세션 폐기 여부를 검사하고, Firestore 관리자 전용 저장소가 페이지네이션·집계·감사 로그·운영 상태를 담당한다. 사용자 상태와 운영자 상태는 별도 필드로 유지하며 모든 공개 경로가 운영자 차단 상태를 확인한다.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Firebase Auth/Admin Auth, Firestore, Storage, Zod, Vitest, Testing Library, Playwright, Firebase Emulator Suite

**Spec:** `docs/superpowers/specs/2026-08-25-operator-admin-design.md`

## Global Constraints

- 운영자는 `ADMIN_UID`, `ADMIN_EMAIL`이 모두 일치하는 Google 계정 한 개만 허용한다.
- 관리자 Client Auth는 `inMemoryPersistence`를 사용하고 세션 쿠키 교환 성공 후 `signOut()`한다.
- 세션 발급은 ID 토큰의 `auth_time`이 현재 기준 5분 이내인 경우만 허용한다.
- 운영 세션 쿠키는 `__Host-admin_session`, `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/`, 최대 12시간이다. 로컬 HTTP에서는 별도 이름과 `Secure=false`를 사용한다.
- 변경 요청의 `Origin`은 `ADMIN_ALLOWED_ORIGIN`과 정확히 일치해야 한다.
- 운영자 영구 삭제, 실제 결제 취소·환불, 신고 기능, 행동 분석은 포함하지 않는다.
- `status`는 소유자 상태, `moderationStatus`는 운영자 상태이며 어느 작업도 상대 필드를 덮어쓰지 않는다.
- 운영 상태 변경은 `updatedAt`을 건드리지 않고 `moderatedAt`과 감사 로그에 같은 시각을 기록한다.
- 목록은 최신순 20개, 문서 커서 페이지네이션이며 실시간 리스너를 사용하지 않는다.
- 통계는 Firestore 집계 쿼리의 성공 결과만 5분 캐시하고 실패한 Promise는 즉시 제거한다.
- 관리자 UI는 너비 100%, 최대 650px, 모바일 카드 목록, 하단 고정 4개 내비게이션을 사용한다.
- 주요 터치 영역은 44px 이상이며 색상만으로 상태를 전달하지 않는다.
- 직접 Firestore·Storage 클라이언트 접근은 계속 거부한다.
- 모든 기능은 실패 테스트를 먼저 작성한 뒤 최소 구현으로 통과시킨다.
- 기존 사용자 변경인 `next-env.d.ts`, `src/app/globals.css`의 작업 범위 밖 변경, `firebase-debug.log`를 덮어쓰거나 커밋하지 않는다.

---

### Task 1: Firebase Admin Auth와 관리자 권한 기반

**Files:**
- Modify: `src/lib/firebase/admin.ts`
- Create: `src/lib/admin/auth.ts`
- Create: `src/lib/admin/origin.ts`
- Modify: `.env.example`
- Test: `tests/unit/admin/auth.test.ts`
- Test: `tests/unit/admin/origin.test.ts`
- Modify: `tests/unit/firebase/admin.test.ts`

**Interfaces:**
- Produces: `getAdminAuth(): Auth`
- Produces: `AdminIdentity = { uid: string; email: string }`
- Produces: `AdminAuthErrorCode = 'INVALID_TOKEN' | 'RECENT_LOGIN_REQUIRED' | 'FORBIDDEN' | 'CONFIGURATION' | 'SESSION_CREATION_FAILED'`
- Produces: `AdminAuthError extends Error` with `code: AdminAuthErrorCode`
- Produces: `createAdminSessionCookie(idToken: string): Promise<string>`
- Produces: `verifyAdminSessionCookie(cookieValue?: string): Promise<AdminIdentity | null>`
- Produces: `getAdminSessionCookieName(): string`
- Produces: `getAdminSessionCookieOptions(): { httpOnly: true; secure: boolean; sameSite: 'strict'; path: '/'; maxAge: number }`
- Produces: `isAllowedAdminOrigin(request: Request): boolean`

- [ ] **Step 1: 관리자 인증 실패 테스트 작성**

```ts
beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-08-25T00:05:00.000Z'));
  vi.stubEnv('ADMIN_UID', 'admin-uid');
  vi.stubEnv('ADMIN_EMAIL', 'owner@example.com');
});

afterEach(() => vi.useRealTimers());

it('UID와 이메일이 모두 일치하고 이메일이 인증된 계정만 세션을 발급한다', async () => {
  verifyIdToken.mockResolvedValue({ uid: 'admin-uid', email: 'owner@example.com', email_verified: true, auth_time: 1_787_616_240 });
  createSessionCookie.mockResolvedValue('session-cookie');

  await expect(createAdminSessionCookie('id-token')).resolves.toBe('session-cookie');
  expect(createSessionCookie).toHaveBeenCalledWith('id-token', { expiresIn: 43_200_000 });
});

it.each([
  { uid: 'other', email: 'owner@example.com', email_verified: true, auth_time: 1_787_616_240 },
  { uid: 'admin-uid', email: 'other@example.com', email_verified: true, auth_time: 1_787_616_240 },
  { uid: 'admin-uid', email: 'owner@example.com', email_verified: false, auth_time: 1_787_616_240 },
])('허용되지 않은 클레임은 거부한다', async (claims) => {
  verifyIdToken.mockResolvedValue(claims);
  await expect(createAdminSessionCookie('id-token')).rejects.toMatchObject({ code: 'FORBIDDEN' });
});

it.each([undefined, 1_787_615_900])('auth_time이 없거나 5분을 넘으면 재로그인을 요구한다', async (authTime) => {
  verifyIdToken.mockResolvedValue({ uid: 'admin-uid', email: 'owner@example.com', email_verified: true, auth_time: authTime });
  await expect(createAdminSessionCookie('id-token')).rejects.toMatchObject({ code: 'RECENT_LOGIN_REQUIRED' });
  expect(createSessionCookie).not.toHaveBeenCalled();
});

it('검증할 수 없는 ID 토큰은 INVALID_TOKEN으로 구분한다', async () => {
  verifyIdToken.mockRejectedValue(new Error('invalid token'));
  await expect(createAdminSessionCookie('bad-token')).rejects.toMatchObject({ code: 'INVALID_TOKEN' });
});

it('관리자 환경 변수가 없으면 Firebase 호출 전에 CONFIGURATION 오류를 낸다', async () => {
  vi.stubEnv('ADMIN_UID', '');
  await expect(createAdminSessionCookie('id-token')).rejects.toMatchObject({ code: 'CONFIGURATION' });
  expect(verifyIdToken).not.toHaveBeenCalled();
});

it('세션 검증 시 폐기 여부를 확인한다', async () => {
  verifySessionCookie.mockResolvedValue({ uid: 'admin-uid', email: 'owner@example.com', email_verified: true });
  await expect(verifyAdminSessionCookie('session-cookie')).resolves.toEqual({ uid: 'admin-uid', email: 'owner@example.com' });
  expect(verifySessionCookie).toHaveBeenCalledWith('session-cookie', true);
});
```

- [ ] **Step 2: Origin 검증 실패 테스트 작성**

```ts
it('설정된 관리자 Origin만 허용한다', () => {
  vi.stubEnv('ADMIN_ALLOWED_ORIGIN', 'https://sketch.example.com');
  expect(isAllowedAdminOrigin(new Request('https://internal/api/admin', { headers: { Origin: 'https://sketch.example.com' } }))).toBe(true);
  expect(isAllowedAdminOrigin(new Request('https://internal/api/admin', { headers: { Origin: 'https://evil.example' } }))).toBe(false);
});

it('로컬 Origin도 환경 변수와 정확히 같을 때만 허용한다', () => {
  vi.stubEnv('ADMIN_ALLOWED_ORIGIN', 'http://127.0.0.1:3000');
  expect(isAllowedAdminOrigin(new Request('http://internal/api/admin', { headers: { Origin: 'http://127.0.0.1:3000' } }))).toBe(true);
  expect(isAllowedAdminOrigin(new Request('http://internal/api/admin', { headers: { Origin: 'http://localhost:3000' } }))).toBe(false);
});
```

- [ ] **Step 3: 테스트를 실행해 실패 확인**

Run: `npm test -- tests/unit/admin/auth.test.ts tests/unit/admin/origin.test.ts tests/unit/firebase/admin.test.ts`

Expected: FAIL — `getAdminAuth`, `createAdminSessionCookie`, `isAllowedAdminOrigin`이 아직 없음

- [ ] **Step 4: Firebase Admin Auth와 권한 검증 최소 구현**

```ts
export function getAdminSessionCookieName() {
  return process.env.NODE_ENV === 'production' ? '__Host-admin_session' : 'admin_session';
}

export class AdminAuthError extends Error {
  constructor(public readonly code: AdminAuthErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'AdminAuthError';
  }
}

export function getAdminSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/' as const,
    maxAge: 12 * 60 * 60,
  };
}

function toAllowedIdentity(claims: DecodedIdToken): AdminIdentity | null {
  const email = claims.email?.toLowerCase();
  if (!claims.email_verified || claims.uid !== process.env.ADMIN_UID || email !== process.env.ADMIN_EMAIL?.toLowerCase()) return null;
  return { uid: claims.uid, email };
}

export async function createAdminSessionCookie(idToken: string) {
  const missingConfig = ['ADMIN_UID', 'ADMIN_EMAIL'].filter((key) => !process.env[key]);
  if (missingConfig.length > 0) {
    console.error(`Admin auth configuration missing: ${missingConfig.join(', ')}`);
    throw new AdminAuthError('CONFIGURATION', '관리자 인증 환경 변수가 설정되지 않았습니다.');
  }
  let claims: DecodedIdToken;
  try {
    claims = await getAdminAuth().verifyIdToken(idToken, true);
  } catch (cause) {
    throw new AdminAuthError('INVALID_TOKEN', '유효하지 않은 로그인 정보입니다.', { cause });
  }
  if (typeof claims.auth_time !== 'number' || Date.now() / 1000 - claims.auth_time > 5 * 60) {
    throw new AdminAuthError('RECENT_LOGIN_REQUIRED', '다시 로그인해 주세요.');
  }
  if (!toAllowedIdentity(claims)) {
    throw new AdminAuthError('FORBIDDEN', '관리자 권한이 없습니다.');
  }
  try {
    return await getAdminAuth().createSessionCookie(idToken, { expiresIn: 12 * 60 * 60 * 1000 });
  } catch (cause) {
    throw new AdminAuthError('SESSION_CREATION_FAILED', '관리자 세션을 만들지 못했습니다.', { cause });
  }
}

export async function verifyAdminSessionCookie(cookieValue?: string) {
  if (!cookieValue) return null;
  try {
    return toAllowedIdentity(await getAdminAuth().verifySessionCookie(cookieValue, true));
  } catch {
    return null;
  }
}
```

`.env.example`에는 값 없이 `ADMIN_UID`, `ADMIN_EMAIL`, `ADMIN_ALLOWED_ORIGIN`, `NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST` 이름만 추가한다.
필수 관리자 환경 변수가 없으면 세션 발급을 거부하고 서버 로그에는 누락된 변수 이름만 기록하며 값은 기록하지 않는다.

- [ ] **Step 5: 인증 테스트 통과 확인**

Run: `npm test -- tests/unit/admin/auth.test.ts tests/unit/admin/origin.test.ts tests/unit/firebase/admin.test.ts`

Expected: PASS

- [ ] **Step 6: 커밋**

```bash
git add src/lib/firebase/admin.ts src/lib/admin/auth.ts src/lib/admin/origin.ts .env.example tests/unit/admin/auth.test.ts tests/unit/admin/origin.test.ts tests/unit/firebase/admin.test.ts
git commit -m "feat: add single-account admin authentication"
```

---

### Task 2: 관리자 세션 API와 Google 로그인 화면

**Files:**
- Create: `src/lib/firebase/auth-client.ts`
- Create: `src/app/api/admin/session/route.ts`
- Create: `src/app/admin/login/AdminLogin.tsx`
- Create: `src/app/admin/login/page.tsx`
- Test: `tests/unit/api/admin-session-route.test.ts`
- Test: `tests/unit/ui/admin-login.test.tsx`

**Interfaces:**
- Consumes: `AdminAuthError`, `createAdminSessionCookie`, `verifyAdminSessionCookie`, `getAdminSessionCookieName`, `getAdminSessionCookieOptions`, `isAllowedAdminOrigin`
- Produces: `getFirebaseClientAuth(): Auth`
- Produces: `POST /api/admin/session` with `{ idToken: string }`
- Produces: `DELETE /api/admin/session`

- [ ] **Step 1: 세션 API 실패 테스트 작성**

```ts
it('허용된 ID 토큰을 세션 쿠키로 교환한다', async () => {
  createAdminSessionCookie.mockResolvedValue('firebase-session');
  const response = await POST(new Request('http://localhost/api/admin/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000' },
    body: JSON.stringify({ idToken: 'id-token' }),
  }));
  expect(response.status).toBe(204);
  expect(response.headers.get('set-cookie')).toContain('admin_session=firebase-session');
});

it('허용되지 않은 Origin은 토큰을 검증하지 않는다', async () => {
  isAllowedAdminOrigin.mockReturnValue(false);
  const response = await POST(new Request('http://localhost/api/admin/session', { method: 'POST', headers: { Origin: 'https://evil.example' } }));
  expect(response.status).toBe(403);
  expect(createAdminSessionCookie).not.toHaveBeenCalled();
});

it('로그아웃은 세션 쿠키를 즉시 만료한다', async () => {
  const response = await DELETE(new Request('http://localhost/api/admin/session', {
    method: 'DELETE',
    headers: { Origin: 'http://localhost:3000' },
  }));
  expect(response.status).toBe(204);
  expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
});

it.each([
  { code: 'INVALID_TOKEN', status: 401 },
  { code: 'RECENT_LOGIN_REQUIRED', status: 401 },
  { code: 'FORBIDDEN', status: 403 },
  { code: 'CONFIGURATION', status: 500 },
  { code: 'SESSION_CREATION_FAILED', status: 500 },
] as const)('$code 오류를 $status로 구분한다', async ({ code, status }) => {
  createAdminSessionCookie.mockRejectedValue(new AdminAuthError(code, 'test'));
  const response = await POST(validRequest);
  expect(response.status).toBe(status);
});

it('예상하지 못한 Firebase 오류는 비밀값 없이 기록하고 500을 반환한다', async () => {
  createAdminSessionCookie.mockRejectedValue(new Error('firebase unavailable'));
  const response = await POST(validRequest);
  expect(response.status).toBe(500);
  expect(response.json()).resolves.toEqual({ message: '로그인 처리 중 오류가 발생했습니다.' });
});
```

- [ ] **Step 2: 로그인 UI 실패 테스트 작성**

```tsx
it('Google 로그인 후 서버 세션을 만들고 관리자 홈으로 이동한다', async () => {
  const auth = {} as Auth;
  getFirebaseClientAuth.mockReturnValue(auth);
  signInWithPopup.mockResolvedValue({ user: { getIdToken: vi.fn().mockResolvedValue('id-token') } });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
  render(<AdminLogin />);
  fireEvent.click(screen.getByRole('button', { name: 'Google 계정으로 로그인' }));
  await waitFor(() => expect(setPersistence).toHaveBeenCalledWith(auth, inMemoryPersistence));
  await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/admin/session', expect.objectContaining({ method: 'POST' })));
  expect(signOut).toHaveBeenCalledWith(auth);
  expect(replace).toHaveBeenCalledWith('/admin');
  expect(setPersistence.mock.invocationCallOrder[0]).toBeLessThan(signInWithPopup.mock.invocationCallOrder[0]);
  expect(signOut.mock.invocationCallOrder[0]).toBeLessThan(replace.mock.invocationCallOrder[0]);
});
```

- [ ] **Step 3: 테스트를 실행해 실패 확인**

Run: `npm test -- tests/unit/api/admin-session-route.test.ts tests/unit/ui/admin-login.test.tsx`

Expected: FAIL — 세션 Route와 `AdminLogin`이 아직 없음

- [ ] **Step 4: Auth 클라이언트와 로그인 화면 구현**

```ts
export function getFirebaseClientAuth() {
  const auth = getAuth(getFirebaseClientApp());
  const emulatorHost = process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST;
  if (emulatorHost && !emulatorConnected) {
    connectAuthEmulator(auth, `http://${emulatorHost}`, { disableWarnings: true });
    emulatorConnected = true;
  }
  return auth;
}
```

`AdminLogin`은 로그인 전에 `setPersistence(auth, inMemoryPersistence)`를 실행하고 `GoogleAuthProvider`와 `signInWithPopup`을 사용한다. 세션 API 성공 후 `signOut(auth)`가 끝난 다음 `/admin`으로 이동한다. 팝업 취소는 `로그인이 취소됐습니다.`, 서버 `401`은 `로그인 시간이 지났습니다. 다시 시도해 주세요.`, `403`은 `허용된 관리자 계정이 아닙니다.`, `500`은 `로그인 처리 중 오류가 발생했습니다.`, 네트워크 실패는 `로그인 연결을 확인해 주세요.`로 구분한다.
`/admin/login/page.tsx`는 기존 세션을 서버에서 검증해 유효하면 `/admin`으로 redirect하고, 유효하지 않을 때만 `AdminLogin`을 렌더링한다.

- [ ] **Step 5: 세션 API 구현**

```ts
export async function POST(request: Request) {
  if (!isAllowedAdminOrigin(request)) return NextResponse.json({ message: '허용되지 않은 요청입니다.' }, { status: 403 });
  const body = await request.json().catch(() => null) as { idToken?: unknown } | null;
  if (typeof body?.idToken !== 'string') return NextResponse.json({ message: '로그인 정보를 확인해 주세요.' }, { status: 400 });
  try {
    const session = await createAdminSessionCookie(body.idToken);
    const response = new NextResponse(null, { status: 204 });
    response.cookies.set(getAdminSessionCookieName(), session, getAdminSessionCookieOptions());
    return response;
  } catch (error) {
    if (error instanceof AdminAuthError) {
      if (error.code === 'INVALID_TOKEN' || error.code === 'RECENT_LOGIN_REQUIRED') {
        return NextResponse.json({ message: '로그인 정보를 다시 확인해 주세요.' }, { status: 401 });
      }
      if (error.code === 'FORBIDDEN') {
        return NextResponse.json({ message: '허용된 관리자 계정이 아닙니다.' }, { status: 403 });
      }
    }
    console.error('Admin session creation failed', error instanceof Error ? error.name : 'UnknownError');
    return NextResponse.json({ message: '로그인 처리 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
```

`DELETE`는 Origin을 확인하고 `getAdminSessionCookieOptions()`를 펼친 뒤 `maxAge: 0`으로 덮어써 만료한다.

- [ ] **Step 6: 로그인 테스트 통과 확인**

Run: `npm test -- tests/unit/api/admin-session-route.test.ts tests/unit/ui/admin-login.test.tsx`

Expected: PASS

- [ ] **Step 7: 커밋**

```bash
git add src/lib/firebase/auth-client.ts src/app/api/admin/session/route.ts src/app/admin/login tests/unit/api/admin-session-route.test.ts tests/unit/ui/admin-login.test.tsx
git commit -m "feat: add admin Google login flow"
```

---

### Task 3: 운영 상태와 관리자 목록용 비정규화 데이터

**Files:**
- Modify: `src/lib/domain/types.ts`
- Modify: `src/lib/sketchbooks/create.ts`
- Modify: `src/lib/drawings/create.ts`
- Modify: `src/lib/sketchbooks/repository.ts`
- Modify: `src/app/api/sketchbooks/[publicId]/drawings/route.ts`
- Modify: `tests/unit/sketchbooks/create.test.ts`
- Modify: `tests/unit/drawings/create.test.ts`
- Modify: `tests/unit/lib/purchase-repository.test.ts`

**Interfaces:**
- Produces: `ModerationStatus = 'ACTIVE' | 'BLOCKED'`
- Extends: `Sketchbook.moderationStatus`, `Sketchbook.moderatedAt`
- Extends: `Drawing.sketchbookPublicId`, `Drawing.sketchbookName`, `Drawing.moderationStatus`, `Drawing.moderatedAt`
- Extends: `Purchase.sketchbookId`, `Purchase.sketchbookPublicId`, `Purchase.sketchbookName`

- [ ] **Step 1: 새 문서 기본값 실패 테스트 작성**

```ts
expect(createSketchbookDraft(params)).toMatchObject({ moderationStatus: 'ACTIVE', moderatedAt: null });
expect(createDrawingDraft({ ...params, sketchbookPublicId: 'public-1', sketchbookName: '내 이름' })).toMatchObject({
  sketchbookPublicId: 'public-1',
  sketchbookName: '내 이름',
  moderationStatus: 'ACTIVE',
  moderatedAt: null,
});
```

결제 저장 테스트에는 `sketchbookId`, `sketchbookPublicId`, `sketchbookName`이 purchase 문서에 기록되는 기대값을 추가한다.

- [ ] **Step 2: 테스트를 실행해 실패 확인**

Run: `npm test -- tests/unit/sketchbooks/create.test.ts tests/unit/drawings/create.test.ts tests/unit/lib/purchase-repository.test.ts`

Expected: FAIL — 운영 상태와 비정규화 필드가 없음

- [ ] **Step 3: 타입과 생성 함수 구현**

```ts
export type ModerationStatus = 'ACTIVE' | 'BLOCKED';

export interface Drawing {
  sketchbookId: string;
  sketchbookPublicId: string;
  sketchbookName: string;
  moderationStatus: ModerationStatus;
  moderatedAt: Date | null;
}

export interface Purchase {
  sketchbookId: string;
  sketchbookPublicId: string;
  sketchbookName: string;
}
```

`toSketchbook`과 `toDrawing`은 기존 문서 호환을 위해 `data.moderationStatus === 'BLOCKED' ? 'BLOCKED' : 'ACTIVE'`로 변환하고 누락된 `moderatedAt`은 `null`로 둔다.

- [ ] **Step 4: 신규 그림·결제 쓰기에 식별자 저장**

```ts
const drawing = createDrawingDraft({
  id: drawingId,
  sketchbookId: sketchbook.id,
  sketchbookPublicId: sketchbook.publicId,
  sketchbookName: sketchbook.name,
  imagePath,
  authorName: parsed.data.authorName,
  message: parsed.data.message,
  usedReferenceImage: parsed.data.usedReferenceImage,
  createdAt: new Date(),
});
```

`addMockPurchase`의 저장 데이터에도 동일한 세 필드를 추가한다.

- [ ] **Step 5: 데이터 모델 테스트 통과 확인**

Run: `npm test -- tests/unit/sketchbooks/create.test.ts tests/unit/drawings/create.test.ts tests/unit/lib/purchase-repository.test.ts`

Expected: PASS

- [ ] **Step 6: 커밋**

```bash
git add src/lib/domain/types.ts src/lib/sketchbooks/create.ts src/lib/drawings/create.ts src/lib/sketchbooks/repository.ts src/app/api/sketchbooks/[publicId]/drawings/route.ts tests/unit/sketchbooks/create.test.ts tests/unit/drawings/create.test.ts tests/unit/lib/purchase-repository.test.ts
git commit -m "feat: add moderation metadata to content"
```

---

### Task 4: 관리자 저장소, 집계 캐시, 커서 페이지네이션

**Files:**
- Create: `src/lib/admin/types.ts`
- Create: `src/lib/admin/cursor.ts`
- Create: `src/lib/admin/stats-cache.ts`
- Create: `src/lib/admin/repository.ts`
- Modify: `firestore.indexes.json`
- Test: `tests/unit/admin/cursor.test.ts`
- Test: `tests/unit/admin/stats-cache.test.ts`
- Test: `tests/unit/admin/repository.test.ts`

**Interfaces:**
- Produces: `AdminPage<T> = { items: T[]; nextCursor: string | null }`
- Produces: `AdminDashboardStats`
- Produces: `AdminAuditLog = { adminUid: string; action: string; targetType: 'SKETCHBOOK' | 'DRAWING'; targetId: string; publicId: string; previousModerationStatus: ModerationStatus; nextModerationStatus: ModerationStatus; createdAt: Date }`
- Produces: `getCachedValue(load: () => Promise<AdminDashboardStats>, nowMs: number): Promise<AdminDashboardStats>`
- Produces: `resetAdminStatsCacheForTests(): void`
- Produces: `listAdminSketchbooks(input): Promise<AdminPage<AdminSketchbookListItem>>`
- Produces: `getAdminSketchbookDetail(id: string): Promise<AdminSketchbookDetail | null>`
- Produces: `listAdminDrawings(input): Promise<AdminPage<AdminDrawingListItem>>`
- Produces: `listAdminPurchases(input): Promise<AdminPage<AdminPurchaseListItem>>`
- Produces: `getCachedAdminStats(): Promise<AdminDashboardStats>`

- [ ] **Step 1: 커서와 캐시 실패 테스트 작성**

```ts
beforeEach(() => resetAdminStatsCacheForTests());

it('createdAt과 전체 문서 경로를 불투명 커서로 왕복한다', () => {
  const cursor = encodeAdminCursor({ createdAt: '2026-08-25T00:00:00.000Z', path: 'sketchbooks/book-1/drawings/draw-1' });
  expect(decodeAdminCursor(cursor)).toEqual({ createdAt: '2026-08-25T00:00:00.000Z', path: 'sketchbooks/book-1/drawings/draw-1' });
  expect(decodeAdminCursor('invalid')).toBeNull();
});

it('5분 동안 같은 통계 Promise를 재사용한다', async () => {
  const load = vi.fn().mockResolvedValue(stats);
  await getCachedValue(load, 1_000);
  await getCachedValue(load, 299_999);
  expect(load).toHaveBeenCalledTimes(1);
});

it('집계가 실패하면 Promise를 제거해 다음 요청에서 다시 조회한다', async () => {
  const load = vi.fn()
    .mockRejectedValueOnce(new Error('temporary failure'))
    .mockResolvedValueOnce(stats);
  await expect(getCachedValue(load, 1_000)).rejects.toThrow('temporary failure');
  await expect(getCachedValue(load, 1_001)).resolves.toEqual(stats);
  expect(load).toHaveBeenCalledTimes(2);
});
```

- [ ] **Step 2: 관리자 목록 쿼리 실패 테스트 작성**

Firestore mock으로 다음 호출을 검증한다.

```ts
expect(drawingsQuery.where).toHaveBeenCalledWith('status', 'in', ['VISIBLE', 'HIDDEN']);
expect(drawingsQuery.orderBy).toHaveBeenCalledWith('createdAt', 'desc');
expect(drawingsQuery.orderBy).toHaveBeenCalledWith(FieldPath.documentId(), 'desc');
expect(drawingsQuery.limit).toHaveBeenCalledWith(21);
expect(result.items).toHaveLength(20);
expect(result.nextCursor).not.toBeNull();
```

누락된 `sketchbookPublicId`가 있는 기존 그림·결제 문서 두 개가 같은 부모를 가리킬 때 각각의 목록 요청에서 부모 읽기가 한 번만 수행되는지도 확인한다. 비정규화 필드가 있는 신규 문서는 부모 문서를 읽지 않는 기대값도 추가한다.

- [ ] **Step 3: 테스트를 실행해 실패 확인**

Run: `npm test -- tests/unit/admin/cursor.test.ts tests/unit/admin/stats-cache.test.ts tests/unit/admin/repository.test.ts`

Expected: FAIL — 관리자 저장소 모듈이 아직 없음

- [ ] **Step 4: 커서, 페이지 타입, 5분 캐시 구현**

```ts
export type AdminCursor = { createdAt: string; path: string };

export function encodeAdminCursor(value: AdminCursor) {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

export function decodeAdminCursor(value?: string): AdminCursor | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    return typeof parsed.createdAt === 'string' && typeof parsed.path === 'string' ? parsed : null;
  } catch {
    return null;
  }
}

let cachedStats: { promise: Promise<AdminDashboardStats>; createdAtMs: number } | null = null;

export function resetAdminStatsCacheForTests() {
  cachedStats = null;
}

export async function getCachedValue(load: () => Promise<AdminDashboardStats>, nowMs: number) {
  if (cachedStats && nowMs - cachedStats.createdAtMs < 5 * 60 * 1_000) return cachedStats.promise;
  const promise = load();
  cachedStats = { promise, createdAtMs: nowMs };
  try {
    return await promise;
  } catch (error) {
    if (cachedStats?.promise === promise) cachedStats = null;
    throw error;
  }
}
```

- [ ] **Step 5: Firestore 목록과 집계 구현**

모든 목록은 `orderBy('createdAt', 'desc')`, `orderBy(FieldPath.documentId(), 'desc')` 순서로 21개를 읽어 20개만 반환하고 마지막 항목의 `createdAt`과 `document.ref.path`로 다음 커서를 만든다. 커서가 있으면 `startAfter(new Date(cursor.createdAt), getAdminFirestore().doc(cursor.path))`를 적용한다. 그림과 결제는 각각 `collectionGroup('drawings')`, `collectionGroup('purchases')`로 조회한다. 누락된 부모 정보는 중복 경로를 제거한 뒤 `getAll(...parentRefs)` 한 번으로 보완한다. 검색어가 있으면 공개 ID 정확 일치 쿼리를 먼저 실행하고 결과가 없을 때 이름 정확 일치 쿼리를 실행한다. 오늘 범위는 `Asia/Seoul` 00:00을 UTC Date로 변환한다. 스케치북·그림 건수는 Firestore `count()`, `SUCCEEDED` 결제 건수와 금액은 `aggregate({ count: AggregateField.count(), amount: AggregateField.sum('amount') })`로 계산하고 성공한 통계만 5분간 유지한다.

- [ ] **Step 6: 컬렉션 그룹 인덱스 추가**

```json
{
  "collectionGroup": "drawings",
  "queryScope": "COLLECTION_GROUP",
  "fields": [
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" },
    { "fieldPath": "__name__", "order": "DESCENDING" }
  ]
}
```

`status in ['VISIBLE', 'HIDDEN']`와 두 정렬 조건을 지원하는 위 컬렉션 그룹 인덱스를 추가하고 Firestore Emulator 쿼리 테스트로 확인한다.

- [ ] **Step 7: 저장소 테스트 통과 확인**

Run: `npm test -- tests/unit/admin/cursor.test.ts tests/unit/admin/stats-cache.test.ts tests/unit/admin/repository.test.ts`

Expected: PASS

- [ ] **Step 8: 커밋**

```bash
git add src/lib/admin/types.ts src/lib/admin/cursor.ts src/lib/admin/stats-cache.ts src/lib/admin/repository.ts firestore.indexes.json tests/unit/admin/cursor.test.ts tests/unit/admin/stats-cache.test.ts tests/unit/admin/repository.test.ts
git commit -m "feat: add paginated admin data repository"
```

---

### Task 5: 운영 상태 트랜잭션, 감사 로그, 관리자 변경 API

**Files:**
- Create: `src/lib/admin/moderation.ts`
- Create: `src/lib/admin/schemas.ts`
- Create: `src/app/api/admin/sketchbooks/[sketchbookId]/moderation/route.ts`
- Create: `src/app/api/admin/sketchbooks/[sketchbookId]/drawings/[drawingId]/moderation/route.ts`
- Test: `tests/unit/admin/moderation.test.ts`
- Test: `tests/unit/api/admin-moderation-routes.test.ts`

**Interfaces:**
- Consumes: `verifyAdminSessionCookie`, `getAdminSessionCookieName`, `isAllowedAdminOrigin`
- Produces: `setSketchbookModeration(input): Promise<{ changed: boolean; status: ModerationStatus }>`
- Produces: `setDrawingModeration(input): Promise<{ changed: boolean; status: ModerationStatus }>`
- Produces: PATCH APIs accepting `{ moderationStatus: 'ACTIVE' | 'BLOCKED' }`

- [ ] **Step 1: 멱등 트랜잭션 실패 테스트 작성**

```ts
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

it('ACTIVE에서 BLOCKED로 바꾸며 같은 트랜잭션에 감사 로그를 기록한다', async () => {
  const now = new Date('2026-08-25T00:05:00.000Z');
  vi.setSystemTime(now);
  documentGet.mockResolvedValue({ exists: true, data: () => ({ moderationStatus: 'ACTIVE', publicId: 'public-1' }) });
  await expect(setSketchbookModeration({ sketchbookId: 'book-1', moderationStatus: 'BLOCKED', adminUid: 'admin-uid' }))
    .resolves.toEqual({ changed: true, status: 'BLOCKED' });
  expect(transaction.update).toHaveBeenCalledWith(sketchbookRef, { moderationStatus: 'BLOCKED', moderatedAt: now });
  expect(transaction.set).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'BLOCK_SKETCHBOOK', createdAt: now }));
  expect(transaction.update).not.toHaveBeenCalledWith(sketchbookRef, expect.objectContaining({ updatedAt: expect.anything() }));
});

it('이미 BLOCKED이면 업데이트와 감사 로그를 만들지 않는다', async () => {
  documentGet.mockResolvedValue({ exists: true, data: () => ({ moderationStatus: 'BLOCKED' }) });
  await expect(setSketchbookModeration(input)).resolves.toEqual({ changed: false, status: 'BLOCKED' });
  expect(transaction.update).not.toHaveBeenCalled();
  expect(transaction.set).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: API 권한·Origin 실패 테스트 작성**

```ts
it.each([
  { session: null, origin: true, status: 401 },
  { session: { uid: 'admin-uid' }, origin: false, status: 403 },
])('권한 없는 상태 변경을 거부한다', async ({ session, origin, status }) => {
  verifyAdminSessionCookie.mockResolvedValue(session);
  isAllowedAdminOrigin.mockReturnValue(origin);
  const response = await PATCH(request, context);
  expect(response.status).toBe(status);
  expect(setSketchbookModeration).not.toHaveBeenCalled();
});
```

- [ ] **Step 3: 테스트를 실행해 실패 확인**

Run: `npm test -- tests/unit/admin/moderation.test.ts tests/unit/api/admin-moderation-routes.test.ts`

Expected: FAIL — 트랜잭션과 Route가 아직 없음

- [ ] **Step 4: 운영 상태 트랜잭션 구현**

```ts
const previous = document.data()?.moderationStatus === 'BLOCKED' ? 'BLOCKED' : 'ACTIVE';
if (previous === input.moderationStatus) return { changed: false, status: previous };
const now = new Date();
transaction.update(reference, { moderationStatus: input.moderationStatus, moderatedAt: now });
transaction.set(auditReference, {
  adminUid: input.adminUid,
  action: input.moderationStatus === 'BLOCKED' ? 'BLOCK_SKETCHBOOK' : 'UNBLOCK_SKETCHBOOK',
  targetType: 'SKETCHBOOK',
  targetId: input.sketchbookId,
  publicId: String(document.data()?.publicId ?? ''),
  previousModerationStatus: previous,
  nextModerationStatus: input.moderationStatus,
  createdAt: now,
});
```

그림 트랜잭션은 그림 문서와 부모 스케치북 문서를 먼저 읽고 같은 구조로 `adminAuditLogs`를 작성한다. 두 트랜잭션 모두 `updatedAt`, `status`, `bestRank`는 변경하지 않는다.

- [ ] **Step 5: 변경 API 구현**

Route는 Origin → 세션 → Zod body → 트랜잭션 순으로 검증한다. 세션 없음 `401`, Origin 불일치 `403`, 잘못된 body `400`, 대상 없음 `404`, 성공은 `{ changed, moderationStatus }`를 반환한다.

- [ ] **Step 6: 운영 상태 테스트 통과 확인**

Run: `npm test -- tests/unit/admin/moderation.test.ts tests/unit/api/admin-moderation-routes.test.ts`

Expected: PASS

- [ ] **Step 7: 커밋**

```bash
git add src/lib/admin/moderation.ts src/lib/admin/schemas.ts src/app/api/admin/sketchbooks tests/unit/admin/moderation.test.ts tests/unit/api/admin-moderation-routes.test.ts
git commit -m "feat: add audited admin moderation actions"
```

---

### Task 6: 모든 공개 경로의 운영자 차단 적용

**Files:**
- Modify: `src/lib/sketchbooks/repository.ts`
- Modify: `src/app/s/[publicId]/page.tsx`
- Modify: `src/app/s/[publicId]/draw/page.tsx`
- Modify: `src/app/api/sketchbooks/[publicId]/drawings/route.ts`
- Modify: `src/app/api/sketchbooks/[publicId]/drawings/[drawingId]/image/route.ts`
- Modify: `src/app/api/sketchbooks/[publicId]/owner/image/route.ts`
- Modify: `src/app/api/sketchbooks/[publicId]/reference/image/route.ts`
- Modify: `src/app/m/[publicId]/ManageDashboard.tsx`
- Modify: `src/app/m/[publicId]/share/page.tsx`
- Test: `tests/unit/api/public-moderation.test.ts`
- Create: `tests/unit/sketchbooks/repository.test.ts`
- Modify: `tests/e2e/sketchbook-flow.spec.ts`

**Interfaces:**
- Consumes: `Sketchbook.moderationStatus`, `Drawing.moderationStatus`
- Changes: 공개 페이지·조회·제출·이미지 응답이 BLOCKED를 거부
- Changes: BEST와 Story 입력은 `status === 'VISIBLE' && moderationStatus === 'ACTIVE'`만 허용

- [ ] **Step 1: 공개 API 차단 실패 테스트 작성**

```ts
it('차단된 스케치북의 공개 그림 이미지는 Storage를 읽지 않는다', async () => {
  findSketchbookByPublicId.mockResolvedValue({ ...sketchbook, moderationStatus: 'BLOCKED' });
  const response = await GET(request, context);
  expect(response.status).toBe(404);
  expect(getAdminStorage).not.toHaveBeenCalled();
});

it('차단된 그림의 기존 공개 주소는 no-store 404를 반환한다', async () => {
  findDrawing.mockResolvedValue({ ...drawing, moderationStatus: 'BLOCKED' });
  const response = await GET(request, context);
  expect(response.status).toBe(404);
  expect(getAdminStorage).not.toHaveBeenCalled();
});
```

소유자 그림, 참고 사진, 제출 API에도 BLOCKED 스케치북 테스트를 각각 추가한다.

- [ ] **Step 2: 공개 UI와 Story 필터 실패 테스트 작성**

공개 페이지에 전달되는 그림 중 BLOCKED가 렌더링되지 않고, 관리 화면에는 `운영자 숨김` 문구가 보이며, Story 목록에는 BLOCKED BEST가 포함되지 않는 기대값을 작성한다. `listVisibleDrawings()` 저장소 테스트에는 BLOCKED 20개 뒤에 ACTIVE 그림이 있는 fixture를 넣고 현재 쿼리가 `limit()` 없이 전체 `VISIBLE` 결과를 받은 뒤 ACTIVE 그림을 누락 없이 반환하는지 검증한다.

- [ ] **Step 3: 테스트를 실행해 실패 확인**

Run: `npm test -- tests/unit/api/public-moderation.test.ts tests/unit/sketchbooks/repository.test.ts tests/unit/ui/manage-dashboard.test.tsx`

Expected: FAIL — 공개 경로가 운영 상태를 아직 확인하지 않음

- [ ] **Step 4: 저장소와 제출 트랜잭션에 운영 상태 적용**

```ts
if (!current.exists || currentData?.status !== 'PUBLIC' || currentData?.moderationStatus === 'BLOCKED') {
  throw new Error('스캐치북을 찾을 수 없거나 공개되어 있지 않습니다.');
}
```

`listVisibleDrawings`는 현재처럼 `limit()`을 추가하지 않고 스케치북의 전체 `status === 'VISIBLE'` 결과를 받은 뒤 `moderationStatus !== 'BLOCKED'`로 필터링한다. 따라서 선두에 BLOCKED 그림이 몰려 있어도 뒤의 ACTIVE 그림이 누락되지 않는다. 향후 공개 목록을 페이지네이션할 때만 ACTIVE 개수를 채울 때까지 커서를 이어 읽는 별도 구현을 추가한다. `setBestDrawing`도 대상 그림의 운영 상태가 ACTIVE인 경우만 허용한다.

- [ ] **Step 5: 페이지·이미지·소유자 관리·Story에 차단 적용**

모든 친구용 페이지와 API는 스케치북 BLOCKED를 `404` 또는 비활성화 안내로 처리한다. 공개 이미지 성공 응답은 `Cache-Control: private, no-store`를 사용하고 공개 페이지의 관련 `Image`에는 `unoptimized`를 지정한다. 소유자 관리 화면은 BLOCKED 그림에 `운영자 숨김`을 표시하고 소유자 삭제는 허용하되 공개 전환과 BEST 지정 버튼은 비활성화한다. Story는 ACTIVE BEST만 받는다. 이미 다운로드되었거나 브라우저 밖에 저장된 Story PNG는 회수할 수 없다는 제한을 README 운영 안내에 연결한다.

- [ ] **Step 6: 공개 차단 테스트와 기존 E2E 통과 확인**

Run: `npm test -- tests/unit/api/public-moderation.test.ts tests/unit/sketchbooks/repository.test.ts tests/unit/ui/manage-dashboard.test.tsx`

Run: `npx playwright test tests/e2e/sketchbook-flow.spec.ts --project=mobile-chrome`

Expected: PASS

- [ ] **Step 7: 커밋**

```bash
git add src/lib/sketchbooks/repository.ts src/app/s src/app/api/sketchbooks src/app/m tests/unit/api/public-moderation.test.ts tests/unit/sketchbooks/repository.test.ts tests/unit/ui/manage-dashboard.test.tsx tests/e2e/sketchbook-flow.spec.ts
git commit -m "feat: enforce moderation across public content"
```

---

### Task 7: 관리자 셸, 하단 내비게이션, 대시보드

**Files:**
- Create: `src/lib/admin/server-session.ts`
- Create: `src/app/admin/(protected)/AdminShell.tsx`
- Create: `src/app/admin/(protected)/AdminBottomNav.tsx`
- Create: `src/app/admin/(protected)/AdminLogoutButton.tsx`
- Create: `src/app/admin/(protected)/AdminDashboard.tsx`
- Create: `src/app/admin/(protected)/layout.tsx`
- Create: `src/app/admin/(protected)/page.tsx`
- Create: `src/app/admin/(protected)/loading.tsx`
- Create: `src/app/admin/(protected)/error.tsx`
- Modify: `src/app/globals.css`
- Test: `tests/unit/ui/admin-shell.test.tsx`
- Test: `tests/unit/ui/admin-dashboard.test.tsx`

**Interfaces:**
- Consumes: `verifyAdminSessionCookie`, `getCachedAdminStats`
- Produces: `getRequiredAdminIdentity(): Promise<AdminIdentity>`
- Produces: 공통 관리자 셸과 4개 하단 내비게이션
- Produces: `AdminDashboard({ stats }: { stats: AdminDashboardStats }): JSX.Element`

- [ ] **Step 1: 인증 보호와 셸 실패 테스트 작성**

```tsx
it('네 개의 관리자 내비게이션과 로그아웃을 표시한다', () => {
  render(<AdminShell><p>내용</p></AdminShell>);
  expect(screen.getByRole('navigation', { name: '관리자 메뉴' })).toBeVisible();
  expect(screen.getAllByRole('link')).toEqual(expect.arrayContaining([
    expect.objectContaining({ textContent: '대시보드' }),
    expect.objectContaining({ textContent: '스케치북' }),
    expect.objectContaining({ textContent: '그림' }),
    expect.objectContaining({ textContent: '결제' }),
  ]));
});
```

보호 route group의 서버 세션이 없으면 `/admin/login`으로 redirect하고 있으면 children을 렌더링하는 테스트를 추가한다. `/admin/login`은 `(protected)` 밖에 두어 인증 layout이 로그인 화면을 감싸지 않게 한다.

- [ ] **Step 2: 대시보드 실패 테스트 작성**

```tsx
expect(screen.getByText('전체 스케치북')).toBeVisible();
expect(screen.getByText('오늘 생성')).toBeVisible();
expect(screen.getByText('모의 결제 누적')).toBeVisible();
expect(screen.getByText('12,870원')).toBeVisible();
```

- [ ] **Step 3: 테스트를 실행해 실패 확인**

Run: `npm test -- tests/unit/ui/admin-shell.test.tsx tests/unit/ui/admin-dashboard.test.tsx`

Expected: FAIL — 관리자 셸과 대시보드가 아직 없음

- [ ] **Step 4: 서버 세션 보호와 대시보드 구현**

```ts
export async function getRequiredAdminIdentity() {
  const cookieStore = await cookies();
  const identity = await verifyAdminSessionCookie(cookieStore.get(getAdminSessionCookieName())?.value);
  if (!identity) redirect('/admin/login');
  return identity;
}
```

`/admin/(protected)/page.tsx`는 통계를 서버에서 읽어 순수 표시 컴포넌트 `AdminDashboard`에 전달한다. `AdminDashboard`는 여섯 개 카드와 모의 결제 문구를 표시한다. `loading.tsx`는 카드 크기를 유지하는 skeleton, `error.tsx`는 오류 설명과 재시도 버튼을 제공한다. route group을 사용하므로 실제 URL은 `/admin`을 유지한다.

- [ ] **Step 5: 모바일 관리자 스타일 구현**

`globals.css`에 `.admin-shell`, `.admin-header`, `.admin-stat-grid`, `.admin-bottom-nav`, `.admin-list-card`, `.admin-status`를 추가한다. 너비 650px, 그림자 없음, 기존 `--ink`, `--muted`, `--line`, `--accent`, `--canvas`를 재사용하고 본문 하단에 `calc(76px + env(safe-area-inset-bottom))` 여백을 둔다.

- [ ] **Step 6: 셸과 대시보드 테스트 통과 확인**

Run: `npm test -- tests/unit/ui/admin-shell.test.tsx tests/unit/ui/admin-dashboard.test.tsx`

Expected: PASS

- [ ] **Step 7: 커밋**

`globals.css`에 기존 사용자 변경이 함께 있다면 `git add -p`로 관리자 스타일 hunk만 선택한다.

```bash
git add src/lib/admin/server-session.ts 'src/app/admin/(protected)' tests/unit/ui/admin-shell.test.tsx tests/unit/ui/admin-dashboard.test.tsx
git add -p src/app/globals.css
git commit -m "feat: add mobile admin dashboard shell"
```

---

### Task 8: 스케치북 관리 목록과 상세

**Files:**
- Create: `src/app/admin/(protected)/sketchbooks/AdminSketchbookList.tsx`
- Create: `src/app/admin/(protected)/sketchbooks/page.tsx`
- Create: `src/app/admin/(protected)/sketchbooks/[sketchbookId]/page.tsx`
- Create: `src/app/admin/(protected)/sketchbooks/[sketchbookId]/SketchbookModerationButton.tsx`
- Test: `tests/unit/ui/admin-sketchbooks.test.tsx`
- Test: `tests/unit/ui/sketchbook-moderation-button.test.tsx`

**Interfaces:**
- Consumes: `listAdminSketchbooks`, `getAdminSketchbookDetail`, PATCH sketchbook moderation API
- Produces: 이름·공개 ID 정확 검색, 다음 20개 링크, 상세 상태 변경 UI
- Produces: `AdminSketchbookList({ page, query }: { page: AdminPage<AdminSketchbookListItem>; query: string }): JSX.Element`

- [ ] **Step 1: 목록·검색·페이지네이션 실패 테스트 작성**

```tsx
expect(screen.getByRole('searchbox', { name: '스케치북 검색' })).toBeVisible();
expect(screen.getByText('내 이름')).toBeVisible();
expect(screen.getByText('13 / 70')).toBeVisible();
expect(screen.getByRole('link', { name: '다음 20개' })).toHaveAttribute('href', expect.stringContaining('cursor='));
```

- [ ] **Step 2: 상태 변경 UI 실패 테스트 작성**

```tsx
fireEvent.click(screen.getByRole('button', { name: '서비스에서 비활성화' }));
expect(screen.getByRole('dialog', { name: '스케치북을 비활성화할까요?' })).toBeVisible();
fireEvent.click(screen.getByRole('button', { name: '비활성화하기' }));
await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/admin/sketchbooks/book-1/moderation', expect.objectContaining({ method: 'PATCH' })));
```

- [ ] **Step 3: 테스트를 실행해 실패 확인**

Run: `npm test -- tests/unit/ui/admin-sketchbooks.test.tsx tests/unit/ui/sketchbook-moderation-button.test.tsx`

Expected: FAIL — 화면과 상태 변경 컴포넌트가 없음

- [ ] **Step 4: 목록과 상세 서버 화면 구현**

서버 `page.tsx`는 `searchParams`의 `q`, `cursor`만 허용하고 저장소 결과를 `AdminSketchbookList`에 전달한다. 잘못된 커서는 첫 페이지가 아니라 명시적 오류 안내로 처리한다. 순수 표시 컴포넌트의 목록 카드는 이름, 공개 ID, 생성일, 참여 인원/한도, 정상·비활성화 문구를 표시한다. 상세에는 기본 정보, 참여 현황, 생성자 그림·참고 사진 존재 여부, 최근 그림, 결제 요약, 공개 페이지 링크와 상태 변경 버튼을 둔다. route group을 사용하므로 URL은 `/admin/sketchbooks`를 유지한다.

- [ ] **Step 5: 접근 가능한 확인 dialog와 오류 복구 구현**

상태 변경은 네이티브 `<dialog>` 또는 기존 결제 dialog의 포커스 패턴을 재사용한다. 팝업 내부에 서버 오류를 `role="alert"`로 표시하고 성공 후 `router.refresh()`를 호출한다. 처리 중에는 닫기·확인 중복 클릭을 막는다.

- [ ] **Step 6: 스케치북 관리 UI 테스트 통과 확인**

Run: `npm test -- tests/unit/ui/admin-sketchbooks.test.tsx tests/unit/ui/sketchbook-moderation-button.test.tsx`

Expected: PASS

- [ ] **Step 7: 커밋**

```bash
git add 'src/app/admin/(protected)/sketchbooks' tests/unit/ui/admin-sketchbooks.test.tsx tests/unit/ui/sketchbook-moderation-button.test.tsx
git commit -m "feat: add admin sketchbook management"
```

---

### Task 9: 그림 관리와 모의 결제 목록

**Files:**
- Create: `src/app/api/admin/sketchbooks/[sketchbookId]/drawings/[drawingId]/image/route.ts`
- Create: `src/app/admin/(protected)/drawings/AdminDrawingList.tsx`
- Create: `src/app/admin/(protected)/drawings/page.tsx`
- Create: `src/app/admin/(protected)/drawings/DrawingModerationButton.tsx`
- Create: `src/app/admin/(protected)/payments/AdminPaymentList.tsx`
- Create: `src/app/admin/(protected)/payments/page.tsx`
- Test: `tests/unit/api/admin-drawing-image-route.test.ts`
- Test: `tests/unit/ui/admin-drawings.test.tsx`
- Test: `tests/unit/ui/admin-payments.test.tsx`

**Interfaces:**
- Consumes: `listAdminDrawings`, `listAdminPurchases`, PATCH drawing moderation API
- Produces: 인증된 관리자 전용 그림 이미지 API
- Produces: 그림 숨김·복구 목록과 조회 전용 결제 목록
- Produces: `AdminDrawingList({ page }: { page: AdminPage<AdminDrawingListItem> }): JSX.Element`
- Produces: `AdminPaymentList({ page }: { page: AdminPage<AdminPurchaseListItem> }): JSX.Element`

- [ ] **Step 1: 관리자 이미지 권한 실패 테스트 작성**

```ts
it('관리자 세션이 없으면 Storage 파일을 읽지 않는다', async () => {
  verifyAdminSessionCookie.mockResolvedValue(null);
  const response = await GET(request, context);
  expect(response.status).toBe(401);
  expect(getAdminStorage).not.toHaveBeenCalled();
});

it('관리자는 BLOCKED 그림도 검토할 수 있다', async () => {
  verifyAdminSessionCookie.mockResolvedValue({ uid: 'admin-uid', email: 'owner@example.com' });
  findDrawing.mockResolvedValue({ ...drawing, moderationStatus: 'BLOCKED' });
  const response = await GET(request, context);
  expect(response.status).toBe(200);
});
```

- [ ] **Step 2: 그림과 결제 UI 실패 테스트 작성**

```tsx
expect(screen.getByRole('img', { name: '친구1님의 그림' })).toHaveAttribute('src', '/api/admin/sketchbooks/book-1/drawings/draw-1/image');
expect(screen.getByText('운영자 숨김')).toBeVisible();
expect(screen.getByText('FRIENDS_50')).toBeVisible();
expect(screen.getByText('3,900원')).toBeVisible();
expect(screen.getByText('모의 결제')).toBeVisible();
```

- [ ] **Step 3: 테스트를 실행해 실패 확인**

Run: `npm test -- tests/unit/api/admin-drawing-image-route.test.ts tests/unit/ui/admin-drawings.test.tsx tests/unit/ui/admin-payments.test.tsx`

Expected: FAIL — 관리자 그림·결제 화면이 없음

- [ ] **Step 4: 관리자 이미지 API와 그림 목록 구현**

관리자 이미지 API는 세션을 먼저 확인하고 `sketchbookId`, `drawingId`가 일치하는 문서만 Storage에서 내려준다. 서버 `page.tsx`는 저장소 결과를 `AdminDrawingList`에 전달하고, 순수 표시 컴포넌트의 그림 카드는 정사각형 contain 미리보기, 작성자, 스케치북 이름·공개 ID, 제출일, 소유자 상태, 운영자 상태를 표시한다. `DrawingModerationButton`은 Task 8의 확인 dialog 패턴을 같은 컴포넌트 어휘로 사용한다.

- [ ] **Step 5: 결제 목록 구현**

서버 `page.tsx`는 저장소 결과를 `AdminPaymentList`에 전달한다. 순수 표시 컴포넌트의 결제 카드는 주문번호, 스케치북 이름·공개 ID, 상품 ID, 추가 인원, 금액, `성공` 상태, 결제 시각을 표시한다. 화면 제목과 각 카드에 `모의 결제`를 표시하고 변경 버튼은 만들지 않는다. route group을 사용하므로 URL은 `/admin/drawings`, `/admin/payments`를 유지한다.

- [ ] **Step 6: 그림·결제 테스트 통과 확인**

Run: `npm test -- tests/unit/api/admin-drawing-image-route.test.ts tests/unit/ui/admin-drawings.test.tsx tests/unit/ui/admin-payments.test.tsx`

Expected: PASS

- [ ] **Step 7: 커밋**

```bash
git add src/app/api/admin/sketchbooks 'src/app/admin/(protected)/drawings' 'src/app/admin/(protected)/payments' tests/unit/api/admin-drawing-image-route.test.ts tests/unit/ui/admin-drawings.test.tsx tests/unit/ui/admin-payments.test.tsx
git commit -m "feat: add admin drawing and payment views"
```

---

### Task 10: Emulator E2E, 모바일 검증, 운영 문서

**Files:**
- Modify: `package.json`
- Modify: `playwright.config.ts`
- Create: `tests/e2e/global-setup.ts`
- Create: `tests/e2e/admin-auth-helper.ts`
- Create: `tests/e2e/admin-fixture.ts`
- Create: `tests/e2e/admin-flow.spec.ts`
- Modify: `tests/e2e/mobile-layout.spec.ts`
- Create: `tests/integration/admin-moderation-concurrency.test.ts`
- Modify: `tests/integration/rules.test.ts`
- Modify: `README.md`

**Interfaces:**
- Consumes: 전체 관리자 인증·조회·상태 변경 흐름
- Produces: Auth·Firestore·Storage Emulator 기반 관리자 E2E와 운영 설정 문서

- [ ] **Step 1: Emulator 실행 설정과 E2E 실패 시나리오 작성**

`package.json`의 emulator 명령을 다음처럼 바꾼다.

```json
"emulators": "firebase emulators:start --only auth,firestore,storage"
```

`tests/e2e/global-setup.ts`는 아래처럼 고정 관리자를 만들고 `auth/uid-already-exists`만 무시한다.

```ts
export default async function globalSetup() {
  try {
    await getAdminAuth().createUser({
      uid: 'admin-e2e-uid',
      email: 'admin@example.com',
      emailVerified: true,
      password: 'admin-test-password',
    });
  } catch (error) {
    if ((error as { code?: string }).code !== 'auth/uid-already-exists') throw error;
  }
  await seedAdminScenario();
}
```

`tests/e2e/admin-fixture.ts`의 `seedAdminScenario()`는 다음 고정 데이터를 덮어쓴다. 매 실행이 같은 ID를 사용하므로 재시도해도 문서 수가 늘지 않는다.

```ts
export async function seedAdminScenario() {
  const database = getAdminFirestore();
  const book = database.doc('sketchbooks/admin-e2e-book');
  const createdAt = new Date();
  const ownerDrawingPath = 'sketchbooks/admin-e2e-book/owner/owner.webp';
  const drawingPath = 'sketchbooks/admin-e2e-book/drawings/admin-e2e-drawing.webp';

  await Promise.all([
    book.set({ id: 'admin-e2e-book', publicId: 'admin-e2e-public', name: '관리자 E2E', manageTokenHash: 'e2e-only', ownerDrawingPath, referenceImagePath: null, referenceImageEnabled: false, participantLimit: 70, participantCount: 1, status: 'PUBLIC', moderationStatus: 'ACTIVE', moderatedAt: null, createdAt, updatedAt: createdAt }),
    book.collection('drawings').doc('admin-e2e-drawing').set({ id: 'admin-e2e-drawing', sketchbookId: 'admin-e2e-book', sketchbookPublicId: 'admin-e2e-public', sketchbookName: '관리자 E2E', imagePath: drawingPath, authorName: '친구1', message: null, usedReferenceImage: false, bestRank: 1, status: 'VISIBLE', moderationStatus: 'ACTIVE', moderatedAt: null, createdAt, updatedAt: createdAt }),
    book.collection('purchases').doc('admin-e2e-purchase').set({ id: 'admin-e2e-purchase', orderId: 'ADMIN-E2E-ORDER', sketchbookId: 'admin-e2e-book', sketchbookPublicId: 'admin-e2e-public', sketchbookName: '관리자 E2E', provider: 'MOCK', productType: 'FRIENDS_50', amount: 3900, additionalLimit: 50, paymentStatus: 'SUCCEEDED', paidAt: createdAt, createdAt }),
  ]);

  const image = readFileSync('public/brand/sketchbook-logo-mark.webp');
  await Promise.all([
    getAdminStorage().bucket().file(ownerDrawingPath).save(image, { contentType: 'image/webp' }),
    getAdminStorage().bucket().file(drawingPath).save(image, { contentType: 'image/webp' }),
  ]);
}
```

`admin-flow.spec.ts`는 Auth Emulator의 `accounts:signInWithPassword` REST API로 ID 토큰을 발급해 세션 API로 교환한 뒤 다음을 검증한다.

```ts
test('관리자가 스케치북과 그림을 차단하고 복구한다', async ({ page }) => {
  await createAdminEmulatorSession(page);
  await page.goto('/admin');
  await expect(page.getByText('전체 스케치북')).toBeVisible();
  await page.getByRole('link', { name: '스케치북' }).click();
  await page.getByRole('link', { name: '상세 보기' }).first().click();
  await page.getByRole('button', { name: '서비스에서 비활성화' }).click();
  await page.getByRole('button', { name: '비활성화하기' }).click();
  await expect(page.getByText('비활성화')).toBeVisible();
});
```

같은 테스트에서 공개 페이지·제출 API·이미지 API가 차단되고 복구 후 다시 접근되는지 확인한다. `tests/integration/admin-moderation-concurrency.test.ts`는 소유자 `status` 변경 트랜잭션과 운영자 `moderationStatus` 변경 트랜잭션을 `Promise.all`로 동시에 실행한 뒤 Firestore Emulator 문서의 두 필드가 모두 각 요청 결과를 보존하는지 확인한다.

- [ ] **Step 2: 모바일 레이아웃 실패 테스트 추가**

```ts
for (const width of [320, 390, 650]) {
  await page.setViewportSize({ width, height: 844 });
  await page.goto('/admin');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  await expect(page.getByRole('navigation', { name: '관리자 메뉴' })).toBeVisible();
}
```

`tests/integration/rules.test.ts`에는 다음 검증을 추가해 기존 쓰기 거부와 함께 직접 읽기 거부를 고정한다.

```ts
await assertFails(database.doc('sketchbooks/public-book').get());
await assertFails(bucket.ref('sketchbooks/public-book/drawings/a.webp').getDownloadURL());
```

- [ ] **Step 3: E2E를 실행해 실패 확인**

Run: `npx playwright test tests/e2e/admin-flow.spec.ts tests/e2e/mobile-layout.spec.ts --project=mobile-chrome`

Expected: FAIL — E2E 인증 도우미·일부 최종 연결이 아직 없음

- [ ] **Step 4: Auth Emulator 테스트 도우미와 환경 연결**

`playwright.config.ts`의 `globalSetup`을 `./tests/e2e/global-setup.ts`로 지정하고 `webServer`를 Firebase Emulator와 Next.js 두 프로세스 배열로 구성한다. 공통 `adminTestEnv`에는 `FIREBASE_PROJECT_ID=sketch-me-local`, `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099`, `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080`, `FIREBASE_STORAGE_EMULATOR_HOST=127.0.0.1:9199`, `ADMIN_UID=admin-e2e-uid`, `ADMIN_EMAIL=admin@example.com`, `ADMIN_ALLOWED_ORIGIN=http://127.0.0.1:3000`, `NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099`를 넣는다. 운영 환경 변수와 섞이지 않도록 Playwright와 해당 web server 프로세스에서만 설정한다.

```ts
const adminTestEnv = {
  FIREBASE_PROJECT_ID: 'sketch-me-local',
  FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
  FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
  FIREBASE_STORAGE_EMULATOR_HOST: '127.0.0.1:9199',
  ADMIN_UID: 'admin-e2e-uid',
  ADMIN_EMAIL: 'admin@example.com',
  ADMIN_ALLOWED_ORIGIN: 'http://127.0.0.1:3000',
  NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
};

Object.assign(process.env, adminTestEnv);

export default defineConfig({
  globalSetup: './tests/e2e/global-setup.ts',
  webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER ? undefined : [
    { command: 'npm run emulators', port: 9099, reuseExistingServer: !process.env.CI },
    { command: 'npm run dev', url: 'http://127.0.0.1:3000', reuseExistingServer: !process.env.CI, env: { ...process.env, ...adminTestEnv } },
  ],
});
```

```ts
export async function createAdminEmulatorSession(page: Page) {
  const signIn = await page.request.post(
    'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key',
    { data: { email: 'admin@example.com', password: 'admin-test-password', returnSecureToken: true } },
  );
  expect(signIn.ok()).toBe(true);
  const { idToken } = await signIn.json() as { idToken: string };
  const session = await page.request.post('/api/admin/session', {
    headers: { Origin: 'http://127.0.0.1:3000' },
    data: { idToken },
  });
  expect(session.status()).toBe(204);
}
```

`page.request`를 사용해 발급된 HttpOnly 쿠키가 같은 브라우저 context의 이후 `/admin` 탐색에 자동으로 공유되게 한다.

- [ ] **Step 5: README 운영 설정 작성**

README에 다음 순서를 기록한다.

1. Firebase Authentication Google 공급자 활성화
2. 최초 Google 로그인 후 Authentication 사용자 UID 확인
3. `ADMIN_UID`, `ADMIN_EMAIL`, `ADMIN_ALLOWED_ORIGIN` 설정
4. 승인 도메인에 App Hosting 도메인 추가
5. 로컬 Auth Emulator 실행과 관리자 E2E 명령
6. 운영 세션 쿠키, 12시간 만료, 로그아웃, 폐기 검증 방식
7. Firestore 컬렉션 그룹 인덱스 배포 전 확인 명령
8. 운영자 차단은 이후 공개 응답을 막지만 이미 다운로드되었거나 외부에 저장된 Story PNG는 회수할 수 없다는 제한

- [ ] **Step 6: 전체 자동 검증**

Run: `npm test`

Expected: 전체 Vitest PASS

Run: `npx tsc --noEmit`

Expected: exit 0

Run: `npm run lint`

Expected: exit 0

Run: `npm run build`

Expected: 모든 `/admin`과 `/api/admin` Route 컴파일 성공

Run: `npx playwright test --project=mobile-chrome`

Expected: 기존 사용자 흐름과 관리자 흐름 모두 PASS

Run: `npx firebase emulators:exec --only auth,firestore,storage "npm test -- tests/integration/rules.test.ts tests/integration/admin-moderation-concurrency.test.ts"`

Expected: 클라이언트의 Firestore·Storage 직접 읽기와 쓰기가 계속 거부됨

Run: `git diff --check`

Expected: whitespace 오류 없음

- [ ] **Step 7: 실제 Chrome과 Firebase 설정 검증**

해비님의 Google 계정 정보 전송과 Google 공급자 활성화 직전에 브라우저 작업 내용을 다시 확인받는다. 승인 후 Firebase Console에서 Google 공급자와 승인 도메인을 설정하고, 개발 프로젝트에 컬렉션 그룹 인덱스를 배포해 실제 목록·커서 쿼리를 확인한 뒤 Chrome에서 로그인 → 대시보드 → 스케치북 비활성화·복구 → 그림 숨김·복구 → 로그아웃을 확인한다. 실제 운영 데이터는 만들거나 변경하지 않고 테스트용 스케치북만 사용한다.

- [ ] **Step 8: 최종 커밋**

```bash
git add package.json playwright.config.ts tests/e2e/global-setup.ts tests/e2e/admin-auth-helper.ts tests/e2e/admin-fixture.ts tests/e2e/admin-flow.spec.ts tests/e2e/mobile-layout.spec.ts tests/integration/admin-moderation-concurrency.test.ts tests/integration/rules.test.ts README.md
git commit -m "test: verify operator admin workflow"
```

---

## Final Review Gate

- [ ] 각 Task 커밋을 순서대로 검토하고 설계 문서의 모든 포함 범위가 구현됐는지 대조한다.
- [ ] `git status --short`에서 사용자 소유 변경만 남았는지 확인한다.
- [ ] 실제 Firebase 프로젝트에 인덱스나 인증 설정을 적용하기 전 해비님의 승인을 받는다.
- [ ] 푸시와 배포는 해비님이 명시적으로 요청한 경우에만 실행한다.
