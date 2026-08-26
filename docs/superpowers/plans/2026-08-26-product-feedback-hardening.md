# Product Feedback Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 승인된 전체 프로젝트 피드백을 반영해 모바일 핵심 흐름과 공개 베타 운영 안전성을 완성한다.

**Architecture:** 기존 App Router와 Firebase 서버 경유 구조를 유지한다. UI 개선은 기존 `SketchEditor`, 공개/생성/관리 화면에 국소적으로 반영하고, 운영 보호는 재사용 가능한 App Check 검증·클라이언트 토큰 모듈과 삭제 상태 전환으로 분리한다.

**Tech Stack:** Next.js 16.3.2, React 19, TypeScript, Firebase 12/Admin 14, Vitest, Testing Library, Playwright

**Spec:** `docs/superpowers/specs/2026-08-26-product-feedback-hardening-design.md`

## Global Constraints

- 한국어 모바일 웹이며 모든 주요 화면은 너비 100%, 최대 650px로 중앙 정렬한다.
- `word-break: keep-all`, 44px 이상 터치 영역, 최대 font-weight 700을 유지한다.
- Firestore와 Storage는 클라이언트에서 직접 읽거나 쓰지 않는다.
- 실제 결제는 추가하지 않고 기존 모의 결제를 유지한다.
- 새로운 외부 키가 없어도 개발·테스트·빌드가 동작해야 한다.
- App Check는 환경 변수로 명시적으로 켠 경우에만 강제한다.
- 서브 에이전트는 커밋·푸시·배포하지 않으며 메인 에이전트가 검토 후 커밋한다.

---

### Task 1: Accessible drawing and recoverable creation

**Files:**
- Modify: `src/components/sketch/SketchEditor.tsx`
- Modify: `src/app/create/CreateSketchbookForm.tsx`
- Modify: `src/app/globals.css`
- Test: `tests/unit/ui/sketch-editor-fullscreen.test.tsx`
- Test: `tests/unit/ui/sketch-editor-import.test.tsx`
- Test: `tests/unit/ui/create-sketchbook-form.test.tsx`

**Interfaces:**
- `SketchEditor` adds an optional `initialDrawingDataUrl?: string | null` and `onDrawingChange?: (dataUrl: string | null) => void`.
- Imported image files are validated as PNG/JPEG/WebP and at most 2 MiB, then drawn with contain semantics onto the existing 720×720 drawing layer.

- [ ] Add tests proving a visible mobile exit button exists, returns focus, and asks before discarding a non-empty drawing.
- [ ] Run the fullscreen test and confirm failure because the exit control is absent.
- [ ] Implement the exit flow using `/icons/fullscreen-back.webp`; route Escape through the same guarded function.
- [ ] Add tests proving a valid image can be imported, invalid type/size shows an inline error, and `onDrawingChange` receives confirmed output.
- [ ] Run the import tests and confirm failure because importing is absent.
- [ ] Implement the accessible labeled file input and contain draw operation without adding dependencies.
- [ ] Add tests proving name/PIN/hint restore from `sessionStorage`, invalid PIN uses product copy, and successful creation clears the draft.
- [ ] Run the create-form test and confirm failure because draft handling is absent.
- [ ] Implement versioned session draft storage and custom validation; keep images out of session storage except confirmed drawing output.
- [ ] Run all three targeted test files and confirm success.

### Task 2: Mobile conversion, empty states, and management clarity

**Files:**
- Modify: `src/app/(marketing)/page.tsx`
- Modify: `src/app/s/[publicId]/page.tsx`
- Modify: `src/app/m/[publicId]/ManageDashboard.tsx`
- Modify: `src/app/globals.css`
- Test: `tests/e2e/landing.spec.ts`
- Test: `tests/unit/ui/public-sketchbook-empty.test.tsx`
- Test: `tests/unit/ui/manage-dashboard.test.tsx`

**Interfaces:**
- Empty public sketchbooks render one invitation state and omit BEST/recent sections until at least one visible drawing exists.
- The security form uses a native `dialog` with the same focus containment and trigger restoration contract as the purchase dialog.

- [ ] Add a mobile E2E assertion that the home CTA intersects a 320×568 viewport without scrolling and that the footer link has at least 44px height.
- [ ] Run the landing E2E test and confirm the CTA assertion fails.
- [ ] Update the hero copy and short-viewport CSS while preserving the reference composition on taller phones.
- [ ] Add a public-page rendering test that asserts BEST/recent headings are absent at zero drawings and the first-participation CTA is present.
- [ ] Run it and confirm failure because empty feed sections are currently rendered.
- [ ] Implement the single empty state and retain current sections when drawings exist.
- [ ] Add management tests for semantic security dialog, Escape close, focus restoration, and admin typography class.
- [ ] Run and confirm failure, then implement native dialog behavior and scoped system-sans typography.
- [ ] Replace repeated font-size and status color literals touched by this task with named CSS variables; verify the detector count decreases without changing computed sizes.
- [ ] Run targeted unit and E2E tests.

### Task 3: Deletion safety, optional App Check, and truthful documentation

**Files:**
- Create: `src/lib/security/app-check-client.ts`
- Create: `src/lib/security/app-check-server.ts`
- Modify: `src/app/api/sketchbooks/route.ts`
- Modify: `src/app/api/sketchbooks/[publicId]/drawings/route.ts`
- Modify: `src/app/create/CreateSketchbookForm.tsx`
- Modify: `src/app/s/[publicId]/draw/SketchCanvas.tsx`
- Modify: `src/app/api/manage/[publicId]/sketchbook/route.ts`
- Modify: `src/lib/sketchbooks/repository.ts`
- Modify: `src/app/privacy/page.tsx`
- Modify: `.env.example`
- Modify: `README.md`
- Test: `tests/unit/security/app-check.test.ts`
- Test: `tests/unit/api/public-app-check.test.ts`
- Test: `tests/unit/api/manage-sketchbook-delete.test.ts`

**Interfaces:**
- `getPublicMutationHeaders(): Promise<Record<string,string>>` returns `{}` when no site key exists and `X-Firebase-AppCheck` when configured.
- `enforceAppCheck(request): Promise<NextResponse | null>` returns null when enforcement is disabled or verification succeeds, 401 for invalid/missing tokens, and 503 for server configuration failure.
- `markSketchbookDeletionStarted(id)` changes status to `DELETED` before binary deletion.

- [ ] Add unit tests for disabled, valid, invalid, and misconfigured App Check modes and confirm they fail before modules exist.
- [ ] Implement lazy client initialization and server verification without exposing secret values.
- [ ] Add route tests proving public create/submit call App Check before mutations; confirm failure then wire the guard and client headers.
- [ ] Add deletion tests proving status is hidden before Storage deletion and a failed deletion can be retried with the same session.
- [ ] Implement deletion-start state transition and idempotent cleanup ordering.
- [ ] Update privacy copy and operational setup for PIN management, App Check, admin variables, indexes, budgets, and real-login smoke testing.
- [ ] Run targeted security and API tests.

### Task 4: Repository and asset hygiene

**Files:**
- Modify: `.gitignore`
- Delete: `pnpm-lock.yaml`
- Delete: `pnpm-workspace.yaml`
- Delete: `{console.error(error)`
- Delete: `{const`
- Delete: `firebase-debug.log`
- Delete: `public/brand/landing-sketch-collage.png`
- Delete: `public/brand/sketchbook-favicon-source.png`

**Interfaces:**
- `package-lock.json` remains the only package lock and npm remains the documented package manager.
- Runtime continues to use `/brand/landing-sketch-collage.webp` and `src/app/icon.png`.

- [ ] Verify every deletion target resolves inside the repository and confirm the two PNG originals have no runtime references.
- [ ] Add `firebase-debug.log` and `firestore-debug.log` to `.gitignore`.
- [ ] Remove only the listed unused/untracked files; do not touch `node_modules`.
- [ ] Run `git status --short`, `rg` asset references, and `npm install --package-lock-only --ignore-scripts` to verify npm metadata without rewriting application dependencies.

### Task 5: Integrated verification and review

**Files:**
- Modify only files required by verified regressions.

**Interfaces:**
- All prior task contracts must coexist without changing Firebase public rules or mock-payment behavior.

- [ ] Run `npm test` and require zero failed tests; emulator-only integration tests may skip only when safety guards report the missing emulator environment.
- [ ] Run `npx tsc --noEmit` and `npm run lint`.
- [ ] Run `npm run build`.
- [ ] Run `npm run test:e2e -- --project=mobile-chrome` and require all mobile tests to pass.
- [ ] Run the Impeccable detector and compare the advisory count with the 81-finding baseline.
- [ ] Inspect 320×568 and 390×844 in a fresh browser tab for home, create, empty public page, drawing controls, and management dialogs.
- [ ] Dispatch a whole-change code review and fix all Critical/Important findings before the final commit.

