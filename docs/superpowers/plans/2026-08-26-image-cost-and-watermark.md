# Image Cost and Watermark Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 공개 갤러리 트래픽을 320px WebP 썸네일과 5분 버전 캐시로 줄이고, 새 가격과 990원 워터마크 제거 모의 상품을 제공한다.

**Architecture:** 친구 그림 제출 시 720px 원본과 320px 썸네일을 함께 저장하고 기존 그림은 공개 썸네일 요청에서 결정적 경로로 한 번만 지연 생성한다. 공개 썸네일은 그림의 `publicImageVersion`을 URL에 포함해 5분 공유 캐시하며, 숨김·삭제·운영자 차단 전환은 버전을 교체한다. 워터마크 권한은 스케치북 문서에 비정규화하여 스토리 화면이 구매 컬렉션을 추가 조회하지 않도록 한다.

**Tech Stack:** Next.js 16.3.2 App Router, React 19, TypeScript, Firebase Admin/Firestore/Storage, Sharp, Vitest, Testing Library, Playwright, ImageGen

**Spec:** `docs/superpowers/specs/2026-08-26-image-cost-and-watermark-design.md`

## Global Constraints

- 자동 보관기간, 유료 테마, 이벤트·무제한·단체 상품은 구현하지 않는다.
- 기존 모의 결제를 유지하고 실제 결제나 카드정보 처리를 추가하지 않는다.
- 상품 가격과 효과는 서버의 `purchasePlans`만 신뢰한다.
- 공개 원본, 관리 이미지와 운영자 이미지는 기존 인증과 `private, no-store`를 유지한다.
- 성공한 공개 썸네일만 `public, max-age=300, s-maxage=300, stale-while-revalidate=60`을 사용한다.
- 모바일 화면은 너비 100%, 최대 650px와 기존 디자인 시스템을 유지한다.
- 워터마크 시각물은 ImageGen으로 생성하며 SVG를 직접 만들지 않는다.
- 기존 미커밋 변경 `next-env.d.ts`, `src/app/globals.css`의 전체 화면 패널 위치, `src/app/s/[publicId]/page.tsx`의 빈 상태 문구는 보존하고, 커밋에는 이번 작업의 변경만 선별한다.
- 운영 예산 알림의 실제 금액·수신자·임계값은 별도 승인 전에는 변경하지 않는다.

---

### Task 1: Thumbnail image primitives and compatible domain data

**Files:**
- Modify: `src/lib/images/optimize.ts`
- Modify: `src/lib/firebase/storage.ts`
- Modify: `src/lib/domain/types.ts`
- Modify: `src/lib/drawings/create.ts`
- Modify: `src/lib/sketchbooks/create.ts`
- Modify: `src/lib/sketchbooks/repository.ts`
- Test: `tests/unit/images/optimize.test.ts`
- Test: `tests/unit/firebase/storage.test.ts`
- Test: `tests/unit/drawings/create.test.ts`
- Test: `tests/unit/sketchbooks/create.test.ts`
- Test: `tests/unit/sketchbooks/repository.test.ts`

**Interfaces:**
- Produces: `optimizeDrawingImages(input: Buffer): Promise<{ original: OptimizedImage; thumbnail: OptimizedImage }>`
- Produces: `optimizeDrawingThumbnail(input: Buffer): Promise<OptimizedImage>` for legacy lazy generation.
- Produces: `getDrawingThumbnailPath(sketchbookId: string, drawingId: string): string` and `isDrawingThumbnailPathFor(...)`.
- Extends `Drawing` with `thumbnailPath: string | null` and `publicImageVersion: string`.
- Extends `Sketchbook` with `entitlements: { watermarkFree: boolean }` and legacy defaults.

- [ ] **Step 1: Write failing thumbnail optimization tests**

Add a generated high-resolution fixture test that decodes both outputs with Sharp and asserts the original is 720×720, the thumbnail is 320×320 WebP, and the thumbnail is at most 90,000 bytes.

```ts
const result = await optimizeDrawingImages(input);
expect(await sharp(result.original.buffer).metadata()).toMatchObject({ width: 720, height: 720, format: 'webp' });
expect(await sharp(result.thumbnail.buffer).metadata()).toMatchObject({ width: 320, height: 320, format: 'webp' });
expect(result.thumbnail.buffer.byteLength).toBeLessThanOrEqual(90_000);
```

- [ ] **Step 2: Run the optimization test and verify RED**

Run: `npx vitest run tests/unit/images/optimize.test.ts`

Expected: FAIL because `optimizeDrawingImages` and the thumbnail profile do not exist.

- [ ] **Step 3: Implement the two-output image optimizer**

Keep `optimizeImageForStorage` for owner/reference callers and add a thumbnail profile using contain-on-white semantics, WebP quality 68, fallback quality 50 and 90KB maximum.

```ts
export async function optimizeDrawingImages(input: Buffer) {
  const [original, thumbnail] = await Promise.all([
    optimizeImageForStorage(input, 'sketch'),
    optimizeDrawingThumbnail(input),
  ]);
  return { original, thumbnail };
}
```

- [ ] **Step 4: Add failing path and legacy-default tests**

Assert `getDrawingThumbnailPath('book-1', 'drawing-1')` returns `sketchbooks/book-1/drawings/drawing-1/thumbnail.webp`, traversal paths fail validation, missing drawing fields map to `thumbnailPath: null`, and missing sketchbook entitlements map to `{ watermarkFree: false }`.

- [ ] **Step 5: Run focused model/path tests and verify RED**

Run: `npx vitest run tests/unit/firebase/storage.test.ts tests/unit/drawings/create.test.ts tests/unit/sketchbooks/create.test.ts tests/unit/sketchbooks/repository.test.ts`

Expected: FAIL on the new properties and thumbnail helpers.

- [ ] **Step 6: Implement paths, types and backward-compatible mappers**

Use a reusable `createPublicImageVersion()` based on `randomUUID()` for new drawings. `toDrawing` must fall back to a stable version derived from `createdAt.getTime().toString(36)` for legacy documents. `toSketchbook` must never treat arbitrary truthy values as a paid entitlement.

```ts
entitlements: {
  watermarkFree: data.entitlements != null
    && typeof data.entitlements === 'object'
    && (data.entitlements as Record<string, unknown>).watermarkFree === true,
},
```

- [ ] **Step 7: Run all Task 1 tests and verify GREEN**

Run: `npx vitest run tests/unit/images/optimize.test.ts tests/unit/firebase/storage.test.ts tests/unit/drawings/create.test.ts tests/unit/sketchbooks/create.test.ts tests/unit/sketchbooks/repository.test.ts`

Expected: PASS.

- [ ] **Step 8: Commit Task 1**

Stage only Task 1 files and commit `feat: add drawing thumbnail primitives`.

---

### Task 2: Atomic original and thumbnail submission

**Files:**
- Modify: `src/app/api/sketchbooks/[publicId]/drawings/route.ts`
- Test: `tests/unit/api/public-app-check.test.ts`
- Test: `tests/unit/api/public-moderation.test.ts`

**Interfaces:**
- Consumes: `optimizeDrawingImages`, `getDrawingImagePath`, `getDrawingThumbnailPath` and extended `createDrawingDraft`.
- Produces: every new drawing document references a complete original/thumbnail pair.

- [ ] **Step 1: Write failing submission tests**

Mock `optimizeDrawingImages` with distinct buffers. Assert both deterministic Storage paths are saved with `image/webp`, the draft receives both paths, and a Firestore transaction failure deletes both files with `ignoreNotFound: true`.

```ts
expect(file).toHaveBeenCalledWith('sketchbooks/book-1/drawings/drawing-1/original.webp');
expect(file).toHaveBeenCalledWith('sketchbooks/book-1/drawings/drawing-1/thumbnail.webp');
expect(createDrawingDraft).toHaveBeenCalledWith(expect.objectContaining({
  imagePath: expect.stringContaining('/original.webp'),
  thumbnailPath: expect.stringContaining('/thumbnail.webp'),
}));
```

- [ ] **Step 2: Run the route tests and verify RED**

Run: `npx vitest run tests/unit/api/public-app-check.test.ts tests/unit/api/public-moderation.test.ts`

Expected: FAIL because only the original is optimized, saved and cleaned up.

- [ ] **Step 3: Implement paired storage and cleanup**

Optimize once, save the two files in parallel, then persist the drawing. Track attempted paths before saving so a partial Storage failure and a Firestore failure both call a shared `deleteUploadedDrawingFiles(paths)` cleanup helper.

- [ ] **Step 4: Run Task 2 tests and verify GREEN**

Run: `npx vitest run tests/unit/api/public-app-check.test.ts tests/unit/api/public-moderation.test.ts`

Expected: PASS with no App Check or moderation regression.

- [ ] **Step 5: Commit Task 2**

Commit `feat: save gallery thumbnails with drawings`.

---

### Task 3: Versioned public thumbnail delivery and moderation invalidation

**Files:**
- Create: `src/app/api/sketchbooks/[publicId]/drawings/[drawingId]/thumbnail/route.ts`
- Modify: `src/lib/sketchbooks/repository.ts`
- Modify: `src/lib/admin/moderation.ts`
- Modify: `src/app/api/manage/[publicId]/drawings/[drawingId]/route.ts`
- Modify: `src/proxy.ts`
- Modify: `src/app/s/[publicId]/page.tsx`
- Test: `tests/unit/api/public-thumbnail-route.test.ts`
- Test: `tests/unit/api/manage-drawing-moderation.test.ts`
- Test: `tests/unit/admin/moderation.test.ts`
- Test: `tests/unit/security/image-optimizer-guard.test.ts`
- Test: `tests/unit/ui/public-sketchbook-empty.test.tsx`

**Interfaces:**
- Produces: `getPublicDrawingImageVersion(drawing: Drawing): string` and `rotatePublicDrawingImageVersion()` updates.
- Public thumbnail contract: a matching `?v=` plus visible/active state returns WebP with five-minute shared caching; missing/mismatched/blocked requests return no-store 404.

- [ ] **Step 1: Write failing public thumbnail route tests**

Cover visible success, missing version, stale version, hidden drawing, blocked drawing, blocked sketchbook, existing thumbnail, legacy lazy generation, and fallback in-memory thumbnail. On success assert exact headers:

```ts
expect(response.headers.get('Cache-Control')).toBe('public, max-age=300, s-maxage=300, stale-while-revalidate=60');
expect(response.headers.get('ETag')).toBe('"drawing-1-version-1-thumb"');
```

- [ ] **Step 2: Run the thumbnail test and verify RED**

Run: `npx vitest run tests/unit/api/public-thumbnail-route.test.ts`

Expected: FAIL because the route does not exist.

- [ ] **Step 3: Implement guarded thumbnail delivery and legacy backfill**

Validate status and version before any Storage read. For legacy drawings without a stored thumbnail, read the scoped original, call `optimizeDrawingThumbnail`, save `thumbnail.webp` with Storage metadata `public, max-age=300`, and return the generated bytes. If the save fails after generation, still return the generated thumbnail for the current request and log only the error name.

- [ ] **Step 4: Write failing invalidation tests**

Assert owner hide/show/delete and operator block/unblock write a fresh `publicImageVersion`; BEST rank changes must not rotate it. Deletion must return both original and thumbnail paths for cleanup.

- [ ] **Step 5: Run invalidation tests and verify RED**

Run: `npx vitest run tests/unit/api/manage-drawing-moderation.test.ts tests/unit/admin/moderation.test.ts tests/unit/sketchbooks/repository.test.ts`

Expected: FAIL because status changes do not rotate a public version and deletion returns one path.

- [ ] **Step 6: Implement invalidation and two-file deletion**

Use `randomUUID()` only when public visibility or moderation changes. Return `{ imagePath, thumbnailPath } | null` from `deleteDrawingForManagement` and delete both paths in the management route. Do not rotate on BEST selection or message-independent metadata.

- [ ] **Step 7: Update gallery URLs and optimizer guard**

Replace all public gallery/BEST/recent image sources with:

```tsx
src={`/api/sketchbooks/${publicId}/drawings/${drawing.id}/thumbnail?v=${encodeURIComponent(drawing.publicImageVersion)}`}
```

Extend `src/proxy.ts` so Next Image cannot proxy either public original or thumbnail endpoints. Preserve the existing uncommitted empty-state arrow in `src/app/s/[publicId]/page.tsx` and stage only this task's URL hunks.

- [ ] **Step 8: Run all Task 3 tests and verify GREEN**

Run: `npx vitest run tests/unit/api/public-thumbnail-route.test.ts tests/unit/api/manage-drawing-moderation.test.ts tests/unit/admin/moderation.test.ts tests/unit/sketchbooks/repository.test.ts tests/unit/security/image-optimizer-guard.test.ts tests/unit/ui/public-sketchbook-empty.test.tsx`

Expected: PASS.

- [ ] **Step 9: Commit Task 3**

Commit `feat: serve versioned cached gallery thumbnails` without staging the pre-existing arrow-only hunk or `next-env.d.ts`.

---

### Task 4: Prices, watermark entitlement and mock purchase API

**Files:**
- Modify: `src/lib/domain/types.ts`
- Modify: `src/lib/purchases/plans.ts`
- Modify: `src/lib/sketchbooks/repository.ts`
- Modify: `src/app/api/manage/[publicId]/purchase/route.ts`
- Modify: `src/app/m/[publicId]/page.tsx`
- Modify: `src/app/m/[publicId]/ManageDashboard.tsx`
- Modify: `src/app/admin/(protected)/payments/AdminPaymentList.tsx`
- Test: `tests/unit/lib/purchase-repository.test.ts`
- Test: `tests/unit/api/purchase-route.test.ts`
- Test: `tests/unit/ui/manage-dashboard.test.tsx`
- Test: `tests/unit/ui/admin-payments.test.tsx`

**Interfaces:**
- `PurchaseProductId`: `'FRIENDS_10' | 'FRIENDS_50' | 'FRIENDS_100' | 'WATERMARK_FREE'`.
- `PurchasePlan`: discriminated union with `kind: 'capacity' | 'watermark'`.
- `addMockPurchase(...)`: returns `{ entitlements: SketchbookEntitlements; participantLimit: number }`.
- Purchase API returns the same object and never accepts a client amount.

- [ ] **Step 1: Write failing plan and repository tests**

Assert exact prices 990/4,490/8,490/990, additional limits 10/50/100/0, idempotent capacity updates, and `WATERMARK_FREE` transaction behavior:

```ts
expect(transaction.update).toHaveBeenCalledWith(sketchbookRef, expect.objectContaining({
  entitlements: { watermarkFree: true },
}));
expect(result.participantLimit).toBe(20);
expect(result.entitlements.watermarkFree).toBe(true);
```

- [ ] **Step 2: Run purchase tests and verify RED**

Run: `npx vitest run tests/unit/lib/purchase-repository.test.ts tests/unit/api/purchase-route.test.ts`

Expected: FAIL on the new prices, product and return contract.

- [ ] **Step 3: Implement server plans and entitlement transaction**

Make capacity and entitlement updates explicit by `plan.kind`. Existing successful request IDs return the current limit and current normalized entitlements without applying effects again.

- [ ] **Step 4: Write failing management/admin UI tests**

Pass `entitlements` from the management page. Assert the dialog groups capacity and result products, shows the exact Korean prices, reports `워터마크 제거가 적용됐어요.`, and disables an already owned watermark plan as `적용됨`. Assert the admin list renders `워터마크 제거` and `0명` is not presented as a capacity benefit.

- [ ] **Step 5: Run UI tests and verify RED**

Run: `npx vitest run tests/unit/ui/manage-dashboard.test.tsx tests/unit/ui/admin-payments.test.tsx`

Expected: FAIL because the UI only knows capacity products.

- [ ] **Step 6: Implement purchase UI and response handling**

Keep the existing accessible dialog lifecycle. On watermark success update local entitlements and keep `limit` unchanged; on capacity success update `limit`. Generate a new request ID when product selection changes after a completed request.

- [ ] **Step 7: Run all Task 4 tests and verify GREEN**

Run: `npx vitest run tests/unit/lib/purchase-repository.test.ts tests/unit/api/purchase-route.test.ts tests/unit/ui/manage-dashboard.test.tsx tests/unit/ui/admin-payments.test.tsx`

Expected: PASS.

- [ ] **Step 8: Commit Task 4**

Commit `feat: add watermark mock purchase`.

---

### Task 5: Generated watermark asset and story purchase experience

**Files:**
- Create: `public/brand/sketchbook-watermark-source.png`
- Create: `public/brand/sketchbook-watermark.webp`
- Create: `src/app/m/[publicId]/share/WatermarkPurchaseButton.tsx`
- Modify: `src/app/m/[publicId]/share/page.tsx`
- Modify: `src/app/m/[publicId]/share/StoryImageComposer.tsx`
- Modify: `src/app/m/[publicId]/share/StoryImageMaker.tsx`
- Modify: `src/app/globals.css`
- Test: `tests/unit/ui/story-image-composer.test.tsx`
- Test: `tests/unit/ui/story-image-maker.test.tsx`
- Test: `tests/unit/ui/watermark-purchase-button.test.tsx`

**Interfaces:**
- `StoryImageComposer` consumes `initialWatermarkFree: boolean` and `publicId: string`.
- `StoryImageMaker` consumes `watermarkFree: boolean` and draws `/brand/sketchbook-watermark.webp` plus Canvas text only when false.
- `WatermarkPurchaseButton` calls the existing purchase endpoint with `WATERMARK_FREE` and reports entitlement changes through `onPurchased(): void`.

- [ ] **Step 1: Read ImageGen and Impeccable skill instructions**

Read the complete ImageGen skill. Before editing UI, read the complete Impeccable skill, run its context collector for the share files, and read the routed UI references plus craft floor.

- [ ] **Step 2: Generate and optimize the watermark image**

Use ImageGen with this intent: transparent background, one-color graphite pencil line art, an open sketchbook with a pencil angled across its lower-right edge, no text, no border, no shadow, strong simple silhouette readable at 48px, centered with minimal transparent padding. Save the generated PNG source at the specified path, inspect it visually, then use Sharp to trim transparent padding and create a maximum 256×256 lossless WebP.

- [ ] **Step 3: Write failing story and purchase tests**

Mock image loading and Canvas operations. Assert the free preview has a visible watermark, free download draws the watermark asset and `스캐치북` text, entitled download omits both, and a successful 990원 mock purchase immediately changes the UI to `워터마크 제거 적용됨`.

- [ ] **Step 4: Run story tests and verify RED**

Run: `npx vitest run tests/unit/ui/story-image-composer.test.tsx tests/unit/ui/story-image-maker.test.tsx tests/unit/ui/watermark-purchase-button.test.tsx`

Expected: FAIL because the asset, props and purchase entry point do not exist.

- [ ] **Step 5: Implement story watermark and point-of-use purchase**

Position the preview watermark in the bottom safe area without covering the existing CTA. In the 1080×1440 Canvas, cap the mark at 54px high, draw the label at 22px and use global alpha 0.52; always restore Canvas state. Reuse the purchase API and Korean error messages, prevent duplicate clicks, and retain the current PNG output resolution.

- [ ] **Step 6: Apply responsive UI styles**

Use existing border, paper and accent tokens, 44px controls, no new shadow, font-weight at most 700, and a full-width layout capped by the existing 650px shell.

- [ ] **Step 7: Run tests and Impeccable detector**

Run the three Task 5 tests. Then run:

`node C:\Users\박도영\.agents\skills\impeccable\scripts\detect.mjs --json src/app/m/[publicId]/share src/app/globals.css`

Review only findings introduced by this task and fix material issues.

- [ ] **Step 8: Commit Task 5**

Commit `feat: add removable story watermark`.

---

### Task 6: Policies, cost operations and integrated verification

**Files:**
- Modify: `src/app/privacy/page.tsx`
- Modify: `src/app/terms/page.tsx`
- Modify: `README.md`
- Test: `tests/unit/ui/privacy-page.test.tsx`
- Test: `tests/unit/ui/terms-page.test.tsx`
- Modify only verified regressions in files from Tasks 1-5.

**Interfaces:**
- Policy documents state that thumbnails are generated and public thumbnails may remain cached for about five minutes.
- Terms list the exact four mock products and do not claim automatic retention or deletion.
- README distinguishes repository safeguards from later console budget-alert configuration.

- [ ] **Step 1: Write failing policy tests**

Assert the privacy page mentions separate gallery thumbnails, five-minute public cache and direct deletion; assert terms show 990원, 4,490원, 8,490원 and watermark removal while retaining the mock-payment disclosure.

- [ ] **Step 2: Run policy tests and verify RED**

Run: `npx vitest run tests/unit/ui/privacy-page.test.tsx tests/unit/ui/terms-page.test.tsx`

Expected: FAIL on the new disclosures and prices.

- [ ] **Step 3: Update policies and operational documentation**

Document App Hosting/Storage/Firestore usage checks, `maxInstances: 1`, and budget alerts at 70%, 90% and 100% as a recommended console setup. State clearly that alerts do not stop billing and leave the budget amount and recipient unset pending approval.

- [ ] **Step 4: Run targeted policy tests and verify GREEN**

Run: `npx vitest run tests/unit/ui/privacy-page.test.tsx tests/unit/ui/terms-page.test.tsx`

Expected: PASS.

- [ ] **Step 5: Run complete automated verification**

Run in order:

```powershell
npm test
npx tsc --noEmit
npm run lint
npm run build
```

Expected: all commands exit 0. Emulator-only integration suites may skip only through their existing safety guard.

- [ ] **Step 6: Run mobile browser QA**

At 320×568 and 390×844, verify public gallery thumbnails, no horizontal overflow, management product dialog, 990원 watermark purchase, free/paid preview state, and PNG download. Inspect a thumbnail response for 320×320 WebP and exact cache headers. Verify a stale or missing version returns 404 with `private, no-store`.

- [ ] **Step 7: Review the complete diff and preserve user changes**

Run `git diff --check`, inspect `git diff --stat`, confirm `next-env.d.ts`, the pre-existing full-screen panel position and empty-state arrow remain unstaged, and verify no secret or `.env` value appears in the diff.

- [ ] **Step 8: Commit Task 6**

Commit policy/docs and any verified regression fix as `docs: update image and mock purchase policies`.
