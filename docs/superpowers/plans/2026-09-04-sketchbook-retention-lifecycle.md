# Sketchbook Retention Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expire new free sketchbooks after six months, preserve paid sketchbooks during service operation with a one-year guarantee, and delete expired content safely.

**Architecture:** Retention metadata is stored on each new sketchbook and updated atomically with successful purchases. A protected daily cleanup Route Handler reuses retry-safe external deletion jobs to remove Storage objects and Firestore trees, while the management page displays the applicable retention promise.

**Tech Stack:** TypeScript, React 19, Next.js 16 Route Handlers, Firebase Admin Firestore and Storage, Vitest, Testing Library

**Spec:** `docs/superpowers/specs/2026-09-04-cost-safety-and-retention-design.md`

## Global Constraints

- Apply automatic expiry only to sketchbooks created after this implementation.
- Any successful paid product converts the sketchbook to paid retention.
- Preserve transaction records independently from deleted content.
- Use the existing visual system and Korean copy.

---

### Task 1: Retention metadata

**Files:**
- Create: `src/lib/sketchbooks/retention.ts`
- Modify: `src/lib/domain/types.ts`
- Modify: `src/lib/sketchbooks/create.ts`
- Modify: `src/lib/sketchbooks/repository.ts`
- Test: `tests/unit/sketchbooks/retention.test.ts`
- Modify: `tests/unit/sketchbooks/create.test.ts`
- Modify: `tests/unit/sketchbooks/repository.test.ts`

**Interfaces:**
- Produces: `addCalendarMonths(date, 6)` and `addCalendarYears(date, 1)`
- Produces: `retentionTier`, `retentionExpiresAt`, and `retentionGuaranteedUntil` on `Sketchbook`

- [ ] **Step 1: Write failing tests** for month-end calendar arithmetic, new free metadata, and legacy document defaults.
- [ ] **Step 2: Run the focused retention tests** and confirm the new fields and helpers are absent.
- [ ] **Step 3: Implement the calendar helpers and metadata mapping** with legacy documents defaulting to `LEGACY` and no automatic expiry.
- [ ] **Step 4: Re-run the focused tests** and confirm they pass.

### Task 2: Paid retention conversion

**Files:**
- Modify: `src/lib/purchases/orders.ts`
- Modify: `src/lib/sketchbooks/repository.ts`
- Modify: `tests/unit/lib/purchase-orders.test.ts`
- Modify: `tests/unit/lib/purchase-repository.test.ts`

**Interfaces:**
- Consumes: `addCalendarYears`
- Produces: paid updates `{ retentionTier: 'PAID', retentionExpiresAt: null, retentionGuaranteedUntil }`

- [ ] **Step 1: Add failing tests** proving capacity and watermark purchases both convert retention and duplicate callbacks do not extend it twice.
- [ ] **Step 2: Run the focused purchase tests** and confirm retention assertions fail.
- [ ] **Step 3: Add the paid retention fields** to real and mock purchase transactions.
- [ ] **Step 4: Re-run the purchase tests** and confirm they pass.

### Task 3: Retry-safe cleanup

**Files:**
- Create: `src/lib/sketchbooks/retention-cleanup.ts`
- Create: `src/app/api/internal/retention-cleanup/route.ts`
- Create: `tests/unit/sketchbooks/retention-cleanup.test.ts`
- Create: `tests/unit/api/retention-cleanup-route.test.ts`
- Modify: `src/lib/sketchbooks/repository.ts`
- Modify: `apphosting.yaml`

**Interfaces:**
- Produces: `cleanupExpiredSketchbooks(now?: Date, limit?: number)`
- Produces: authenticated `POST /api/internal/retention-cleanup`

- [ ] **Step 1: Add failing tests** for Bearer authentication, pending job retry, new expired target deletion order, and isolated per-target failure.
- [ ] **Step 2: Run the focused cleanup tests** and confirm the modules are missing.
- [ ] **Step 3: Implement repository queries and cleanup orchestration** using the existing system deletion job collection, Storage prefix deletion, and recursive Firestore deletion.
- [ ] **Step 4: Implement the protected Route Handler** and add `RETENTION_CLEANUP_SECRET` to App Hosting runtime secrets.
- [ ] **Step 5: Re-run cleanup tests** and confirm they pass.

### Task 4: Management notice and policy copy

**Files:**
- Modify: `src/app/m/[publicId]/page.tsx`
- Modify: `src/app/m/[publicId]/ManageDashboard.tsx`
- Modify: `src/app/globals.css`
- Modify: `src/app/terms/page.tsx`
- Modify: `src/app/privacy/page.tsx`
- Modify: `tests/unit/ui/manage-dashboard.test.tsx`
- Modify: `tests/unit/ui/terms-page.test.tsx`
- Modify: `tests/unit/ui/privacy-page.test.tsx`

**Interfaces:**
- Consumes: serialized retention dates from the server page
- Produces: accessible free expiry warning and paid guarantee notice

- [ ] **Step 1: Add failing UI tests** for normal free notice, 30-day warning, paid guarantee, and revised legal copy.
- [ ] **Step 2: Run the focused UI tests** and confirm the notices are missing.
- [ ] **Step 3: Pass retention props and render the notice** with Korean `Intl.DateTimeFormat`, semantic status text, existing paper-card styling, and no decorative motion.
- [ ] **Step 4: Update terms and privacy copy** to disclose six-month deletion, 72-hour hashed IP processing, and five-year transaction-record separation.
- [ ] **Step 5: Run focused UI tests and the Impeccable detector** for the changed management surface.

### Task 5: Verification and commit

**Files:**
- Modify only files required by failures attributable to this feature.

- [ ] **Step 1: Run focused tests** for security, retention, purchases, cleanup, and policy UI.
- [ ] **Step 2: Run `npm test`**, `npm run lint`, and `npm run build`.
- [ ] **Step 3: Inspect `git diff`** and confirm `next-env.d.ts` remains excluded from the feature changes.
- [ ] **Step 4: Commit the verified feature** with a concise Korean noun-phrase commit message.
