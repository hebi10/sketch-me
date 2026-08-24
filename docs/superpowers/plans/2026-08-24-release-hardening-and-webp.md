# Release Hardening and WebP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 신규 이미지를 WebP로 작게 저장하고 모바일 공개 베타에 필요한 요청 보호, 공유, 마감, 삭제, 개인정보, 오류·접근성 보완을 완료한다.

**Architecture:** 이미지 형식과 용량은 신뢰할 수 없는 클라이언트가 아니라 Route Handler가 `sharp`로 강제한다. 요청 제한은 App Hosting 단일 인스턴스에 맞춘 메모리 고정 윈도 계층으로 API 진입점에서 처리하고, 사용자 흐름은 기존 서버 권한·한도 트랜잭션을 유지한 채 UI에서 먼저 상태를 설명한다.

**Tech Stack:** Next.js 15 App Router, React 19, Firebase Admin/Firestore/Storage, Sharp, Vitest, Playwright

**Spec:** `docs/superpowers/specs/2026-08-24-release-hardening-and-webp-design.md`

## Global Constraints

- 모든 주요 화면은 최대 650px 중앙 정렬 모바일 흐름을 유지한다.
- Firebase 클라이언트 직접 읽기·쓰기는 계속 차단한다.
- 신규 저장 이미지의 최종 형식은 서버가 만든 WebP다.
- 실제 결제, 외부 CAPTCHA, 외부 모니터링 SDK는 추가하지 않는다.
- 기존 PNG/JPEG 데이터의 저장 경로는 계속 읽을 수 있어야 한다.
- 기존 `firebase-debug.log` 삭제 상태는 건드리지 않는다.

---

### Task 1: Server-side WebP optimization

**Files:**
- Create: `src/lib/images/optimize.ts`
- Modify: `src/lib/firebase/storage.ts`
- Modify: `src/app/api/sketchbooks/route.ts`
- Modify: `src/app/api/sketchbooks/[publicId]/drawings/route.ts`
- Modify: `src/lib/domain/schemas.ts`
- Modify: `src/components/sketch/SketchEditor.tsx`
- Test: `tests/unit/images/optimize.test.ts`
- Test: `tests/unit/sketchbooks/create-owner-drawing.test.ts`

**Interfaces:**
- Produces: `optimizeImageForStorage(input: Buffer, profile: 'sketch' | 'reference'): Promise<{ buffer: Buffer; contentType: 'image/webp' }>`
- Produces: storage paths ending in `.webp` for new records.

- [ ] **Step 1: Write failing optimizer tests**

```ts
const result = await optimizeImageForStorage(pngBuffer, 'sketch');
expect((await sharp(result.buffer).metadata()).format).toBe('webp');
expect((await sharp(result.buffer).metadata()).width).toBeLessThanOrEqual(720);
expect(result.buffer.byteLength).toBeLessThanOrEqual(350_000);
```

- [ ] **Step 2: Run the optimizer test and verify module-not-found failure**

Run: `npx vitest run tests/unit/images/optimize.test.ts`

- [ ] **Step 3: Add Sharp as a direct dependency and implement profile-based conversion**

```ts
const profiles = {
  sketch: { width: 720, height: 960, quality: 76, fallbackQuality: 58, maxBytes: 350_000 },
  reference: { width: 1280, height: 1280, quality: 72, fallbackQuality: 52, maxBytes: 600_000 },
} as const;
```

- [ ] **Step 4: Route all uploads through the optimizer and save WebP metadata**

```ts
const optimized = await optimizeImageForStorage(decoded.buffer, 'sketch');
await bucket.file(path).save(optimized.buffer, { metadata: { contentType: optimized.contentType } });
```

- [ ] **Step 5: Export sketch canvases as WebP and run affected tests**

Run: `npx vitest run tests/unit/images/optimize.test.ts tests/unit/sketchbooks/create-owner-drawing.test.ts`

### Task 2: Request throttling

**Files:**
- Create: `src/lib/security/rate-limit.ts`
- Modify: `src/app/api/sketchbooks/route.ts`
- Modify: `src/app/api/sketchbooks/[publicId]/drawings/route.ts`
- Test: `tests/unit/security/rate-limit.test.ts`

**Interfaces:**
- Produces: `createFixedWindowRateLimiter()` and `enforcePublicMutationLimit(request, action)` returning a `NextResponse | null`.

- [ ] **Step 1: Write failing tests for allow, block and window reset**

```ts
expect(limiter.consume('ip', 1_000).allowed).toBe(true);
expect(limiter.consume('ip', 1_001).allowed).toBe(false);
expect(limiter.consume('ip', 61_001).allowed).toBe(true);
```

- [ ] **Step 2: Run the rate-limit test and verify failure**

Run: `npx vitest run tests/unit/security/rate-limit.test.ts`

- [ ] **Step 3: Implement bounded fixed-window maps and 429 responses**

```ts
return NextResponse.json(
  { message: `요청이 많아요. ${retryAfter}초 뒤 다시 시도해 주세요.` },
  { status: 429, headers: { 'Retry-After': String(retryAfter) } },
);
```

- [ ] **Step 4: Guard both anonymous POST routes before parsing image bodies**

- [ ] **Step 5: Run security and API-related tests**

Run: `npx vitest run tests/unit/security/rate-limit.test.ts tests/unit/drawings/create.test.ts tests/unit/sketchbooks/create.test.ts`

### Task 3: Share and capacity UX

**Files:**
- Create: `src/app/m/[publicId]/ShareSketchbookButton.tsx`
- Create: `src/lib/sketchbooks/capacity.ts`
- Modify: `src/app/m/[publicId]/ManageDashboard.tsx`
- Modify: `src/app/s/[publicId]/page.tsx`
- Modify: `src/app/s/[publicId]/draw/page.tsx`
- Modify: `src/app/globals.css`
- Test: `tests/unit/sketchbooks/capacity.test.ts`
- Test: `tests/unit/ui/share-sketchbook-button.test.tsx`

**Interfaces:**
- Produces: `isSketchbookFull({ participantCount, participantLimit }): boolean`.
- Produces: share button using Web Share with clipboard fallback and live status.

- [ ] **Step 1: Write failing capacity and share fallback tests**

- [ ] **Step 2: Verify the tests fail because helpers/components are absent**

Run: `npx vitest run tests/unit/sketchbooks/capacity.test.ts tests/unit/ui/share-sketchbook-button.test.tsx`

- [ ] **Step 3: Implement capacity helper and replace full-book CTAs with a disabled notice**

- [ ] **Step 4: Implement Web Share and clipboard fallback**

```ts
if (navigator.share) await navigator.share({ title, text, url });
else await navigator.clipboard.writeText(url);
```

- [ ] **Step 5: Add the post-submit create CTA and run UI tests**

### Task 4: Privacy and permanent deletion

**Files:**
- Create: `src/app/privacy/page.tsx`
- Create: `src/app/api/manage/[publicId]/sketchbook/route.ts`
- Modify: `src/lib/sketchbooks/repository.ts`
- Modify: `src/app/m/[publicId]/ManageDashboard.tsx`
- Modify: `src/app/(marketing)/page.tsx`
- Modify: `src/app/globals.css`
- Modify: `tests/e2e/sketchbook-flow.spec.ts`

**Interfaces:**
- Produces: `deleteSketchbookPermanently(sketchbookId): Promise<void>`.
- DELETE route clears `sketchbook_manage_token` after Storage prefix and Firestore recursive deletion succeed.

- [ ] **Step 1: Extend the E2E flow with a final delete and 404 assertion**

```ts
await recoveredPage.getByRole('button', { name: '스케치북 전체 삭제' }).click();
await recoveredPage.getByRole('button', { name: '정말 삭제하기' }).click();
await expect(recoveredPage).toHaveURL('/');
await friendPage.goto(publicPath!);
await expect(friendPage.getByRole('heading', { name: '페이지를 찾을 수 없어요' })).toBeVisible();
```

- [ ] **Step 2: Run the E2E test and verify the missing control failure**

- [ ] **Step 3: Implement the protected DELETE route and repository cleanup**

- [ ] **Step 4: Add privacy copy, footer link and two-step deletion UI**

- [ ] **Step 5: Run the emulator E2E flow through deletion**

### Task 5: Metadata, error states, accessibility and story consistency

**Files:**
- Create: `src/app/loading.tsx`
- Create: `src/app/error.tsx`
- Create: `src/app/not-found.tsx`
- Modify: `src/app/layout.tsx`
- Modify: `src/app/s/[publicId]/page.tsx`
- Modify: `src/components/sketch/SketchEditor.tsx`
- Modify: `src/app/m/[publicId]/share/StoryImageMaker.tsx`
- Modify: `src/app/globals.css`
- Create: `README.md`
- Modify: `.env.example`
- Modify: `src/app/(marketing)/page.tsx`

**Interfaces:**
- `NEXT_PUBLIC_APP_URL` supplies absolute metadata URLs.
- Color swatches use Korean labels rather than hexadecimal values.

- [ ] **Step 1: Add assertions for metadata-visible copy, privacy link and Korean swatch labels**

- [ ] **Step 2: Verify the assertions fail for the missing behavior**

- [ ] **Step 3: Add dynamic public metadata and global loading/error/not-found states**

- [ ] **Step 4: Align Story canvas colors/fonts and raise secondary text to at least 12px**

- [ ] **Step 5: Convert the landing asset to WebP and reference the optimized file**

- [ ] **Step 6: Document environment, quota alarms and external protection upgrade path**

### Task 6: Final verification

**Files:**
- Modify only files required by verified failures.

- [ ] **Step 1: Run focused tests**

Run: `npm run test`

- [ ] **Step 2: Run static verification**

Run: `npm run lint`

Run: `npm run build`

- [ ] **Step 3: Run Firebase emulator mobile E2E**

Run: `npx firebase emulators:exec --only firestore,storage "npm run test:e2e"`

- [ ] **Step 4: Inspect 280, 390 and 650px browser renders and verify no horizontal overflow**

- [ ] **Step 5: Commit the verified implementation without staging `firebase-debug.log`**

