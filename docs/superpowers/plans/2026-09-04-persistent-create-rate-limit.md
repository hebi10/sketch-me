# Persistent Create Rate Limit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce 3 sketchbook creations per IP per hour, 9 per IP per 72 hours, and 60 globally per hour across App Hosting instances.

**Architecture:** A Firestore transaction reads the HMAC-keyed IP bucket and global bucket, evaluates all fixed windows before any write, and updates both documents atomically. Drawing submission continues to use the existing in-memory limiter.

**Tech Stack:** TypeScript, Next.js Route Handlers, Firebase Admin Firestore, Vitest

**Spec:** `docs/superpowers/specs/2026-09-04-cost-safety-and-retention-design.md`

## Global Constraints

- Never store a raw IP address.
- Fail closed when persistent rate limiting is unavailable.
- Preserve the existing drawing submission limits.
- Keep the user-facing 429 response and `Retry-After` header.

---

### Task 1: Persistent policy and repository

**Files:**
- Create: `src/lib/security/create-sketchbook-rate-limit.ts`
- Test: `tests/unit/security/create-sketchbook-rate-limit.test.ts`
- Modify: `firestore.indexes.json`

**Interfaces:**
- Produces: `consumeCreateSketchbookRateLimit(request: Request, now?: Date): Promise<RateLimitResult>`
- Produces: `CreateSketchbookRateLimitState` with one-hour, 72-hour, and global window fields

- [ ] **Step 1: Write failing policy tests** for the third allowed request, fourth blocked request, ninth allowed request, tenth blocked request, 72-hour reset, global sixtieth boundary, HMAC document IDs, and transaction failure.
- [ ] **Step 2: Run `npm test -- tests/unit/security/create-sketchbook-rate-limit.test.ts`** and confirm failures are caused by the missing module.
- [ ] **Step 3: Implement the transaction** using `PUBLIC_MUTATION_RATE_LIMIT_SECRET`, HMAC-SHA256, Firestore timestamps represented as `Date`, and `expiresAt` for TTL cleanup.
- [ ] **Step 4: Add a TTL field override** for `publicMutationRateLimits.expiresAt` in `firestore.indexes.json`.
- [ ] **Step 5: Re-run the focused test** and confirm all policy cases pass.

### Task 2: Async route boundary

**Files:**
- Modify: `src/lib/security/public-mutation-rate-limiter.ts`
- Modify: `src/app/api/sketchbooks/route.ts`
- Modify: `src/app/api/sketchbooks/[publicId]/drawings/route.ts`
- Modify: `tests/unit/security/public-mutation-rate-limiter.test.ts`
- Modify: `apphosting.yaml`

**Interfaces:**
- Consumes: `consumeCreateSketchbookRateLimit`
- Produces: `enforcePublicMutationLimit(...): Promise<NextResponse | null>`

- [ ] **Step 1: Update tests first** so sketchbook creation expects the persistent dependency while drawing submission retains the memory limiter and dependency failures return 503.
- [ ] **Step 2: Run the focused security tests** and confirm the async expectations fail against the current synchronous implementation.
- [ ] **Step 3: Make the public limiter async**, route create actions to Firestore, keep drawing actions in memory, and map unavailable persistence to a generic 503 response.
- [ ] **Step 4: Await the boundary in both POST Route Handlers** and declare `PUBLIC_MUTATION_RATE_LIMIT_SECRET` as an App Hosting runtime secret.
- [ ] **Step 5: Run the focused security and public API tests** and confirm they pass.
