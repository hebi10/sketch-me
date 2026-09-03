# 관리 PIN 및 텍스트 메뉴 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** 새 스케치북을 4자리 관리 PIN으로 보호하고, 공개·관리 화면의 아이콘 행동을 텍스트 메뉴로 바꾼다.

**Architecture:** PIN은 salt가 포함된 scrypt 해시로 스케치북 문서에 저장한다. PIN 검증 뒤에는 고유한 난수 세션을 Firestore 하위 컬렉션에 해시로 저장하고, 원문 난수만 httpOnly 쿠키에 보관한다. 기존 관리 토큰 세션은 PIN이 없는 레거시 스케치북에서만 유지한다. 메뉴는 서버 페이지 데이터를 받는 작은 클라이언트 헤더 컴포넌트로 분리한다.

**Tech Stack:** Next.js App Router, React, TypeScript, Firebase Admin Firestore, Node.js crypto scrypt, Vitest, Playwright.

**Spec:** docs/superpowers/specs/2026-08-25-manage-pin-and-navigation-design.md

## Global Constraints

- 관리 PIN은 정확히 4자리 숫자이며, 평문·URL·localStorage·응답 본문에 저장하지 않는다.
- PIN 힌트는 선택이며 최대 40자다. PIN 분실 시 자동 복구, 운영자 문의, 재설정 기능은 제공하지 않는다.
- 올바른 PIN은 30일짜리 httpOnly, sameSite=lax, 운영 환경 secure 세션만 발급한다.
- 스케치북별·접속 출처별로 PIN 5회 실패 시 10분 잠금, 성공 시 실패 횟수 초기화가 필요하다.
- PIN 없는 기존 스케치북은 기존 토큰/복구 링크를 PIN 설정 전까지만 유지한다.
- 공개 그림 작성 페이지는 계속 공개이며, 메뉴와 PIN 입력에는 한국어 텍스트와 최소 44px 터치 영역을 쓴다.
- 새 UI는 기존 650px 모바일 폭, 종이 표면, 1px 연필선, 스케치 블루 CTA를 유지한다.

---

## File Structure

- src/lib/sketchbooks/manage-pin.ts: PIN 유효성, scrypt 해시/검증, 세션 난수와 만료 계산.
- src/lib/sketchbooks/manage-session.ts: 레거시 2단 토큰 쿠키와 새 3단 PIN 세션 쿠키 파싱 및 쿠키 옵션.
- src/lib/sketchbooks/repository.ts: PIN 보안 필드, manageSessions, managePinAttempts Firestore 경계.
- src/lib/sketchbooks/management.ts: 쿠키와 저장된 세션을 결합한 관리 권한 판단.
- src/app/api/manage/[publicId]/session/route.ts: PIN 로그인과 로그아웃.
- src/app/api/manage/[publicId]/security/route.ts: PIN·힌트 변경과 레거시 최초 설정.
- src/app/m/[publicId]/login/*: PIN 입력과 복구 불가 안내.
- src/components/navigation/SketchbookMenu.tsx: 공개·관리 화면 공유 텍스트 메뉴.

### Task 1: PIN 도메인 모델과 세션 형식

**Files:**
- Create: src/lib/sketchbooks/manage-pin.ts, tests/unit/sketchbooks/manage-pin.test.ts
- Modify: src/lib/domain/types.ts, src/lib/domain/schemas.ts, src/lib/sketchbooks/create.ts, src/lib/sketchbooks/manage-session.ts, tests/unit/domain/schemas.test.ts, tests/unit/sketchbooks/create.test.ts, tests/unit/sketchbooks/manage-session.test.ts

**Interfaces:**
- Produces hashManagePin(pin: string): Promise<string>, verifyManagePin(pin: string, encodedHash: string): Promise<boolean>, createManageSessionToken(): string, hashManageSessionToken(token: string): string.
- Extends Sketchbook with managePinHash: string | null, managePinHint: string | null, managePinEnabledAt: Date | null.
- Produces a 3-part PIN session cookie value: <publicId>.<sessionId>.<token>.

- [ ] **Step 1: Write the failing test**

~~~ts
expect(createSketchbookInputSchema.safeParse({ name: '해비', managePin: '1234' }).success).toBe(true);
expect(createSketchbookInputSchema.safeParse({ name: '해비', managePin: '123' }).success).toBe(false);
expect(createSketchbookInputSchema.safeParse({ name: '해비', managePin: '12ab' }).success).toBe(false);
const encoded = await hashManagePin('1234');
expect(encoded).not.toContain('1234');
await expect(verifyManagePin('1234', encoded)).resolves.toBe(true);
await expect(verifyManagePin('0000', encoded)).resolves.toBe(false);
~~~

- [ ] **Step 2: Run test to verify it fails**

Run: npm test -- tests/unit/domain/schemas.test.ts tests/unit/sketchbooks/manage-pin.test.ts

Expected: FAIL because managePin and manage-pin.ts do not exist.

- [ ] **Step 3: Write minimal implementation**

~~~ts
export async function hashManagePin(pin: string) {
  const salt = randomBytes(16).toString('base64url');
  const key = await scryptAsync(pin, salt, 64);
  return 'scrypt$' + salt + '$' + Buffer.from(key).toString('base64url');
}
export function createPinManageCookieValue(publicId: string, sessionId: string, token: string) {
  return publicId + '.' + sessionId + '.' + token;
}
~~~

Use z.string().regex(/^\d{4}$/) for managePin, z.string().trim().max(40).optional() for managePinHint, and initialize PIN fields in createSketchbookDraft. Preserve existing token functions for legacy documents.

- [ ] **Step 4: Run test to verify it passes**

Run: npm test -- tests/unit/domain/schemas.test.ts tests/unit/sketchbooks/manage-pin.test.ts tests/unit/sketchbooks/create.test.ts tests/unit/sketchbooks/manage-session.test.ts

Expected: PASS; only the original PIN validates and legacy 2-part cookies still parse.

- [ ] **Step 5: Commit**

Run: git add src/lib/domain/types.ts src/lib/domain/schemas.ts src/lib/sketchbooks/manage-pin.ts src/lib/sketchbooks/manage-session.ts src/lib/sketchbooks/create.ts tests/unit/domain/schemas.test.ts tests/unit/sketchbooks/manage-pin.test.ts tests/unit/sketchbooks/create.test.ts tests/unit/sketchbooks/manage-session.test.ts && git commit -m "feat: add sketchbook management PIN model"

### Task 2: Persist PIN sessions and attempt limits

**Files:**
- Modify: src/lib/sketchbooks/repository.ts, src/lib/sketchbooks/management.ts
- Create: src/lib/security/manage-pin-attempt.ts, tests/unit/sketchbooks/management.test.ts, tests/unit/security/manage-pin-attempt.test.ts

**Interfaces:**
- Produces createManagePinSession(sketchbookId, expiresAt): Promise<{ sessionId: string; token: string }>.
- Produces isManagePinSessionValid(sketchbookId, session): Promise<boolean>.
- Produces verifyManagePinAttempt(sketchbookId, sourceId, pin): Promise<{ ok: true } | { ok: false; lockedUntil?: Date }> and resetManagePinAttempts(sketchbookId, sourceId): Promise<void>.

- [ ] **Step 1: Write the failing test**

~~~ts
await expect(isManagePinSessionValid('book-1', { publicId: 'book-1', sessionId: 's1', token: 'wrong' })).resolves.toBe(false);
const fifthFailure = await attemptWrongPinFiveTimes('book-1', 'source-a');
expect(fifthFailure).toMatchObject({ ok: false, lockedUntil: expect.any(Date) });
~~~

Use a transaction fake that records manageSessions/<sessionId> and managePinAttempts/<sourceId> writes. Assert the session stores tokenHash and expiresAt, never the token or PIN.

- [ ] **Step 2: Run test to verify it fails**

Run: npm test -- tests/unit/sketchbooks/management.test.ts tests/unit/security/manage-pin-attempt.test.ts

Expected: FAIL because PIN sessions and attempt limits do not exist.

- [ ] **Step 3: Write minimal implementation**

~~~ts
await firestore.collection('sketchbooks').doc(sketchbookId)
  .collection('manageSessions').doc(sessionId)
  .set({ tokenHash: hashManageSessionToken(token), expiresAt, createdAt: new Date() });
await firestore.collection('sketchbooks').doc(sketchbookId)
  .collection('managePinAttempts').doc(sourceId)
  .set({ failureCount, lockedUntil, updatedAt: new Date() }, { merge: true });
~~~

Hash the first x-forwarded-for address as sourceId and use unknown when it is absent; never persist a raw IP address. Reject expired sessions. In getManagedSketchbook, accept PIN sessions only for a PIN-enabled book and legacy tokens only when managePinHash is null.

- [ ] **Step 4: Run test to verify it passes**

Run: npm test -- tests/unit/sketchbooks/management.test.ts tests/unit/security/manage-pin-attempt.test.ts tests/unit/sketchbooks/manage-session.test.ts

Expected: PASS; wrong/expired sessions and legacy tokens after PIN activation are rejected.

- [ ] **Step 5: Commit**

Run: git add src/lib/sketchbooks/repository.ts src/lib/sketchbooks/management.ts src/lib/security/manage-pin-attempt.ts tests/unit/sketchbooks/management.test.ts tests/unit/security/manage-pin-attempt.test.ts && git commit -m "feat: protect management with PIN sessions"

### Task 3: Secure server routes and page guards

**Files:**
- Create: src/app/api/manage/[publicId]/session/route.ts, src/app/api/manage/[publicId]/security/route.ts, src/app/m/[publicId]/login/page.tsx, tests/unit/api/manage-session-route.test.ts, tests/unit/api/manage-security-route.test.ts
- Modify: src/app/api/sketchbooks/route.ts, src/app/m/[publicId]/recover/route.ts, src/app/m/[publicId]/page.tsx, src/app/m/[publicId]/share/page.tsx, tests/e2e/sketchbook-flow.spec.ts

**Interfaces:**
- POST /api/manage/:publicId/session accepts { pin: string }, returns { ok: true } or { message: string, lockedUntil?: string }.
- DELETE /api/manage/:publicId/session removes the current session and clears the cookie.
- PATCH /api/manage/:publicId/security accepts { currentPin?: string, newPin: string, hint?: string }.

- [ ] **Step 1: Write the failing test**

~~~ts
const response = await POST(new Request('http://local/api/manage/book-1/session', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pin: '1234' }),
}), { params: Promise.resolve({ publicId: 'book-1' }) });
expect(response.status).toBe(200);
expect(response.headers.get('set-cookie')).toContain('HttpOnly');
~~~

Update E2E creation to enter PIN 1234, assert 스케치북이 완성됐어요, open /m/<publicId> in a new context, fail once with 0000, then access management with 1234. Assert no recovery link is rendered for the new book.

- [ ] **Step 2: Run test to verify it fails**

Run: npm test -- tests/unit/api/manage-session-route.test.ts tests/unit/api/manage-security-route.test.ts && npx playwright test tests/e2e/sketchbook-flow.spec.ts --project=mobile-chrome

Expected: FAIL because login/security routes and the PIN page do not exist.

- [ ] **Step 3: Write minimal implementation**

~~~ts
if (!sketchbook.managePinHash) {
  return NextResponse.json({ message: '관리용 비밀번호가 아직 설정되지 않았습니다.' }, { status: 409 });
}
const result = await verifyManagePinAttempt(sketchbook.id, sourceId, body.pin);
if (!result.ok) return NextResponse.json({ message: '관리용 비밀번호를 다시 확인해 주세요.', lockedUntil: result.lockedUntil?.toISOString() }, { status: 429 });
~~~

On creation, create the first PIN session and return only publicUrl and manageUrl. Redirect unauthenticated PIN users from management and story routes to /m/<publicId>/login. PIN-enabled recovery routes redirect to login without creating a cookie; legacy recovery remains unchanged.

- [ ] **Step 4: Run test to verify it passes**

Run: npm test -- tests/unit/api/manage-session-route.test.ts tests/unit/api/manage-security-route.test.ts && npx playwright test tests/e2e/sketchbook-flow.spec.ts --project=mobile-chrome

Expected: PASS; a second browser context needs the correct PIN and legacy recovery remains limited to legacy data.

- [ ] **Step 5: Commit**

Run: git add src/app/api/sketchbooks/route.ts src/app/api/manage/[publicId]/session/route.ts src/app/api/manage/[publicId]/security/route.ts src/app/m/[publicId]/recover/route.ts src/app/m/[publicId]/page.tsx src/app/m/[publicId]/share/page.tsx src/app/m/[publicId]/login/page.tsx tests/unit/api/manage-session-route.test.ts tests/unit/api/manage-security-route.test.ts tests/e2e/sketchbook-flow.spec.ts && git commit -m "feat: require PIN for sketchbook management"

### Task 4: PIN forms and text-first menus

**Files:**
- Create: src/app/m/[publicId]/login/ManagePinForm.tsx, src/app/m/[publicId]/ManageSecurityDialog.tsx, src/components/navigation/SketchbookMenu.tsx, src/app/s/[publicId]/PublicSketchbookHeader.tsx, tests/unit/ui/manage-pin-form.test.tsx, tests/unit/ui/sketchbook-menu.test.tsx
- Modify: src/app/create/CreateSketchbookForm.tsx, src/app/m/[publicId]/ManageDashboard.tsx, src/app/s/[publicId]/page.tsx, src/app/globals.css, tests/unit/ui/manage-dashboard.test.tsx

**Interfaces:**
- ManagePinForm({ publicId, hint, nextPath }) posts PIN then routes to nextPath on success.
- SketchbookMenu({ children }) exposes a 메뉴 trigger, closes on outside pointer press/Esc, and restores trigger focus.
- ManageSecurityDialog({ publicId, isLegacy }) changes a current PIN or sets the first legacy PIN.

- [ ] **Step 1: Write the failing test**

~~~tsx
render(<SketchbookMenu><a href="/m/book-1">내 스케치북 관리</a></SketchbookMenu>);
fireEvent.click(screen.getByRole('button', { name: '☰ 메뉴' }));
expect(screen.getByRole('link', { name: '내 스케치북 관리' })).toBeVisible();
fireEvent.keyDown(document, { key: 'Escape' });
expect(screen.queryByRole('link', { name: '내 스케치북 관리' })).toBeNull();

render(<ManagePinForm publicId="book-1" hint="생일 네 자리" nextPath="/m/book-1" />);
expect(screen.getByLabelText('관리용 비밀번호')).toHaveAttribute('inputmode', 'numeric');
expect(screen.getByText('힌트: 생일 네 자리')).toBeVisible();
~~~

- [ ] **Step 2: Run test to verify it fails**

Run: npm test -- tests/unit/ui/manage-pin-form.test.tsx tests/unit/ui/sketchbook-menu.test.tsx tests/unit/ui/manage-dashboard.test.tsx

Expected: FAIL because the new form and menu components do not exist.

- [ ] **Step 3: Write minimal implementation**

~~~tsx
<input aria-label="관리용 비밀번호" autoComplete="one-time-code" inputMode="numeric" maxLength={4} pattern="[0-9]*" type="password" />
<button aria-expanded={open} aria-haspopup="menu" type="button">☰ 메뉴</button>
~~~

Add PIN and optional hint before image sections. Replace the completion recovery link with 스케치북이 완성됐어요 and the unrecoverable-PIN notice. Public menu items are 내 스케치북 관리, 친구에게 공유하기, 새 스케치북 만들기; management items are 친구 페이지 보기, 스토리 이미지 만들기, 공유하기, 관리용 비밀번호 변경, 로그아웃. Use text rows, a 1px paper-panel border, no shadow, and 44px minimum rows.

- [ ] **Step 4: Run test to verify it passes**

Run: npm test -- tests/unit/ui/manage-pin-form.test.tsx tests/unit/ui/sketchbook-menu.test.tsx tests/unit/ui/manage-dashboard.test.tsx

Expected: PASS; menus are keyboard-operable and PIN UI renders hint, error, and recovery-impossible copy.

- [ ] **Step 5: Commit**

Run: git add src/app/create/CreateSketchbookForm.tsx src/app/m/[publicId]/login/ManagePinForm.tsx src/app/m/[publicId]/ManageSecurityDialog.tsx src/components/navigation/SketchbookMenu.tsx src/app/s/[publicId]/PublicSketchbookHeader.tsx src/app/s/[publicId]/page.tsx src/app/m/[publicId]/ManageDashboard.tsx src/app/globals.css tests/unit/ui/manage-pin-form.test.tsx tests/unit/ui/sketchbook-menu.test.tsx tests/unit/ui/manage-dashboard.test.tsx && git commit -m "feat: add PIN forms and text management menus"

### Task 5: Full regression verification

**Files:**
- Modify: tests/e2e/sketchbook-flow.spec.ts
- Modify: README.md only if it still documents the removed recovery link.

**Interfaces:**
- Consumes the complete creation, PIN session, menu, and management flows from Tasks 1–4.

- [ ] **Step 1: Add a failing E2E lockout/logout assertion**

~~~ts
for (let attempt = 0; attempt < 5; attempt += 1) {
  await loginPage.getByLabel('관리용 비밀번호').fill('0000');
  await loginPage.getByRole('button', { name: '관리하기' }).click();
}
await expect(loginPage.getByText(/10분 뒤 다시 시도/)).toBeVisible();
await loginPage.getByRole('button', { name: '로그아웃' }).click();
await expect(loginPage).toHaveURL(new RegExp('/m/' + publicId + '/login'));
~~~

Use an independent test sketchbook for the successful-login branch so the ten-minute lock never makes the suite wait.

- [ ] **Step 2: Run test to verify it fails**

Run: npx playwright test tests/e2e/sketchbook-flow.spec.ts --project=mobile-chrome

Expected: FAIL until lockout copy and logout behavior are present.

- [ ] **Step 3: Complete only the missing regression coverage**

Update README.md only if it calls the removed feature a recovery link. Do not change unrelated admin, payment, or story-image behavior.

- [ ] **Step 4: Run final verification**

Run: npm test -- tests/unit/domain/schemas.test.ts tests/unit/sketchbooks/manage-pin.test.ts tests/unit/sketchbooks/manage-session.test.ts tests/unit/sketchbooks/management.test.ts tests/unit/security/manage-pin-attempt.test.ts tests/unit/api/manage-session-route.test.ts tests/unit/api/manage-security-route.test.ts tests/unit/ui/manage-pin-form.test.tsx tests/unit/ui/sketchbook-menu.test.tsx tests/unit/ui/manage-dashboard.test.tsx && npx tsc --noEmit && npx eslint src/app/create/CreateSketchbookForm.tsx src/app/m/[publicId]/ManageDashboard.tsx src/app/m/[publicId]/login/ManagePinForm.tsx src/app/m/[publicId]/ManageSecurityDialog.tsx src/components/navigation/SketchbookMenu.tsx src/app/s/[publicId]/PublicSketchbookHeader.tsx src/lib/sketchbooks/manage-pin.ts src/lib/sketchbooks/manage-session.ts src/lib/sketchbooks/management.ts && npx playwright test tests/e2e/sketchbook-flow.spec.ts --project=mobile-chrome

Expected: all named unit tests, type check, lint, and mobile E2E pass.

- [ ] **Step 5: Commit**

Run: git add tests/e2e/sketchbook-flow.spec.ts README.md && git commit -m "test: cover protected sketchbook management flow"
