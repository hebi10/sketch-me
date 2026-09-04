# Maintainability Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 출시 하드닝의 검증된 동작을 유지하면서 관리 대시보드, 스케치북 저장소, 전역 CSS의 책임을 작은 파일로 분리한다.

**Architecture:** 공개 export와 API payload는 호환 배럴에서 유지하고 내부 구현만 책임별 모듈로 이동한다. UI는 네트워크와 상태를 소유하는 container와 이벤트를 전달하는 presentational component로 나누며, CSS는 기존 cascade 순서를 그대로 보존한다.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5.8, Firebase Admin, CSS, Vitest, Testing Library, Playwright

**Spec:** `docs/superpowers/specs/2026-09-04-project-hardening-design.md`

## Global Constraints

- 이 계획은 `docs/superpowers/plans/2026-09-04-release-hardening.md`가 완전히 통과한 뒤 실행한다.
- 사용자 문구, API 경로, request/response payload, Firestore 컬렉션 경로를 변경하지 않는다.
- 새 런타임 의존성을 추가하지 않는다.
- CSS 선택자, source order, specificity와 650px 모바일 레이아웃을 유지한다.
- 기존 테스트를 characterization test로 사용하고 분리 전후 DOM 역할·accessible name을 유지한다.

---

### Task 1: 관리 대시보드 표시 컴포넌트 분리

**Files:**
- Create: `src/app/m/[publicId]/ManageHeaderActions.tsx`
- Create: `src/app/m/[publicId]/ShareThumbnailSettings.tsx`
- Create: `src/app/m/[publicId]/ManageDrawingCard.tsx`
- Modify: `src/app/m/[publicId]/ManageDashboard.tsx`
- Modify: `tests/unit/ui/manage-dashboard.test.tsx`
- Create: `tests/unit/ui/manage-drawing-card.test.tsx`
- Create: `tests/unit/ui/share-thumbnail-settings.test.tsx`

**Interfaces:**
- Produces: `ManageHeaderActionsProps { name; publicId; previewVersion; onLogout; onOpenSecurity }`
- Produces: `ShareThumbnailSettingsProps { bestDrawing; disabled; message; mode; ownerDrawingPath; onChange }`
- Produces: `ManageDrawingCardProps { drawing; publicId; onDelete; onUpdate }`

- [ ] **Step 1: 현재 DOM 계약 characterization test 작성**

```tsx
it('그림 카드가 공개 상태, BEST 버튼, 삭제 진입을 전달한다', () => {
  const onUpdate = vi.fn();
  const onDelete = vi.fn();
  render(<ManageDrawingCard drawing={drawing} publicId="public-1" onDelete={onDelete} onUpdate={onUpdate} />);
  fireEvent.click(screen.getByText('순위 선택'));
  fireEvent.click(screen.getByRole('button', { name: '1위' }));
  expect(onUpdate).toHaveBeenCalledWith(drawing.id, { action: 'best', bestRank: 1 });
  fireEvent.click(screen.getByRole('button', { name: '그림 삭제' }));
  expect(onDelete).toHaveBeenCalledWith(drawing.id, expect.any(HTMLButtonElement));
});
```

- [ ] **Step 2: 컴포넌트가 없어 실패하는지 확인**

Run: `npx vitest run tests/unit/ui/manage-drawing-card.test.tsx tests/unit/ui/share-thumbnail-settings.test.tsx`

Expected: 모듈을 찾지 못해 FAIL

- [ ] **Step 3: 세 표시 컴포넌트 구현**

`ManageHeaderActions`는 기존 HeaderMenu 항목 순서와 accessible name을 그대로 사용한다. `ShareThumbnailSettings`는 현재 fieldset과 세 radio option을 이동하고 `onChange(mode)`만 호출한다. `ManageDrawingCard`는 drawing 표시와 details action을 이동하고 mutation은 props callback으로 전달한다.

```ts
export interface ManageDrawingCardProps {
  drawing: Drawing;
  publicId: string;
  onDelete: (drawingId: string, trigger: HTMLButtonElement) => void;
  onUpdate: (drawingId: string, body: Record<string, unknown>) => Promise<void>;
}
```

- [ ] **Step 4: ManageDashboard에서 새 컴포넌트 연결**

`ManageDashboard`의 fetch 함수와 최상위 state는 유지하고 JSX 블록만 props로 교체한다. owner drawing 카드는 별도 분리하지 않아 첫 단계의 변경 범위를 제한한다.

- [ ] **Step 5: 관련 테스트 통과 확인**

Run: `npx vitest run tests/unit/ui/manage-dashboard.test.tsx tests/unit/ui/manage-drawing-card.test.tsx tests/unit/ui/share-thumbnail-settings.test.tsx tests/unit/ui/header-menu.test.tsx`

Expected: 모든 테스트 PASS

- [ ] **Step 6: 변경 커밋**

```bash
git add src/app/m/[publicId]/ManageDashboard.tsx src/app/m/[publicId]/ManageHeaderActions.tsx src/app/m/[publicId]/ShareThumbnailSettings.tsx src/app/m/[publicId]/ManageDrawingCard.tsx tests/unit/ui/manage-dashboard.test.tsx tests/unit/ui/manage-drawing-card.test.tsx tests/unit/ui/share-thumbnail-settings.test.tsx
git commit -m "관리 대시보드 표시 책임 분리"
```

### Task 2: 관리 대시보드 다이얼로그 분리

**Files:**
- Create: `src/app/m/[publicId]/ManagePurchaseDialog.tsx`
- Create: `src/app/m/[publicId]/ManageSecurityDialog.tsx`
- Create: `src/app/m/[publicId]/DeleteDrawingDialog.tsx`
- Modify: `src/app/m/[publicId]/ManageDashboard.tsx`
- Modify: `tests/unit/ui/manage-dashboard.test.tsx`
- Create: `tests/unit/ui/manage-dialogs.test.tsx`

**Interfaces:**
- 각 다이얼로그는 `open`, `busy`, 현재 값, 오류, change/submit/close callback, trigger restore ref를 props로 받는다.
- 네트워크 요청과 request id ref는 `ManageDashboard`에 남긴다.

- [ ] **Step 1: 다이얼로그 포커스·이벤트 characterization test 작성**

```tsx
it('보안 다이얼로그가 닫힐 때 호출자에게 close를 전달한다', () => {
  const onClose = vi.fn();
  render(<ManageSecurityDialog busy={false} currentPin="" hint="" message={null} newPin="" onChangeCurrentPin={vi.fn()} onChangeHint={vi.fn()} onChangeNewPin={vi.fn()} onClose={onClose} onSubmit={vi.fn()} open />);
  fireEvent.click(screen.getByRole('button', { name: '비밀번호 변경 닫기' }));
  expect(onClose).toHaveBeenCalledOnce();
});
```

- [ ] **Step 2: 다이얼로그 모듈 부재로 실패 확인**

Run: `npx vitest run tests/unit/ui/manage-dialogs.test.tsx`

Expected: 모듈을 찾지 못해 FAIL

- [ ] **Step 3: 세 다이얼로그 JSX 이동과 명시적 props 구현**

native `<dialog>`의 `onCancel`, busy 중 닫기 방지, aria-labelledby, 기존 오류 role을 그대로 보존한다. `ManagePurchaseDialog`는 plan radio와 `BuyerPhoneField`, `PurchaseConsent`를 소유하지만 결제 fetch는 실행하지 않는다.

- [ ] **Step 4: ManageDashboard 연결과 중복 effect 정리**

각 dialog의 showModal/close와 trigger focus 복귀를 다이얼로그 내부 effect로 옮긴다. 최상위는 open state와 submit callback만 유지한다.

- [ ] **Step 5: 관련 테스트 통과 확인**

Run: `npx vitest run tests/unit/ui/manage-dashboard.test.tsx tests/unit/ui/manage-dialogs.test.tsx tests/unit/ui/payment-result.test.tsx`

Expected: 모든 테스트 PASS

- [ ] **Step 6: 변경 커밋**

```bash
git add src/app/m/[publicId]/ManageDashboard.tsx src/app/m/[publicId]/ManagePurchaseDialog.tsx src/app/m/[publicId]/ManageSecurityDialog.tsx src/app/m/[publicId]/DeleteDrawingDialog.tsx tests/unit/ui/manage-dashboard.test.tsx tests/unit/ui/manage-dialogs.test.tsx
git commit -m "관리 대시보드 다이얼로그 분리"
```

### Task 3: 스케치북 조회·그림 저장소 분리

**Files:**
- Create: `src/lib/sketchbooks/repository-read.ts`
- Create: `src/lib/sketchbooks/repository-drawings.ts`
- Modify: `src/lib/sketchbooks/repository.ts`
- Modify: `tests/unit/sketchbooks/repository.test.ts`
- Create: `tests/unit/sketchbooks/repository-exports.test.ts`

**Interfaces:**
- `repository-read.ts`: `findSketchbookByPublicId`, `listVisibleDrawings`, `listDrawings`, `findDrawing`, `findVisibleBestDrawing`
- `repository-drawings.ts`: `saveDrawingWithinLimit`, `updateDrawingForManagement`, `clearBestDrawing`, `deleteDrawingForManagement`, `setBestDrawing`, `setOwnerBestDrawing`, `clearOwnerBestDrawing`
- `repository.ts`는 기존 이름을 re-export한다.

- [ ] **Step 1: export 호환성 테스트 작성**

```ts
it('기존 repository 공개 함수를 유지한다', async () => {
  const repository = await import('@/lib/sketchbooks/repository');
  expect(repository.findSketchbookByPublicId).toBeTypeOf('function');
  expect(repository.saveDrawingWithinLimit).toBeTypeOf('function');
  expect(repository.setBestDrawing).toBeTypeOf('function');
});
```

- [ ] **Step 2: 현재 기준 테스트 통과 기록**

Run: `npx vitest run tests/unit/sketchbooks/repository.test.ts tests/unit/sketchbooks/repository-exports.test.ts`

Expected: 기존 repository 테스트 PASS. export test도 현재 단일 파일 기준 PASS.

- [ ] **Step 3: 공용 변환과 Firestore 참조 경계 정의**

`repository-read.ts`에 `toDate`, `toSketchbook`, `toDrawing`을 이동하고 필요한 변환 함수만 named export로 그림 모듈에 제공한다. Firebase Admin app 접근은 기존 `getFirestore(getFirebaseAdminApp())` 패턴을 유지한다.

- [ ] **Step 4: 조회와 그림 함수를 새 모듈로 이동**

함수 본문과 트랜잭션을 변경하지 않고 import만 정리한다. 오류 클래스 `DrawingPublicPromotionBlockedError`, `DrawingSubmissionLimitError`는 그림 모듈에 둔다.

- [ ] **Step 5: repository.ts를 호환 배럴로 변경**

```ts
export * from './repository-read';
export * from './repository-drawings';
export * from './repository-management';
export * from './repository-deletion';
```

아직 생성되지 않은 management/deletion 모듈은 Task 4 전까지 기존 `repository.ts`에 남기고, 해당 export 줄도 Task 4에서 추가한다.

- [ ] **Step 6: 관련 테스트 통과 확인**

Run: `npx vitest run tests/unit/sketchbooks/repository.test.ts tests/unit/sketchbooks/repository-exports.test.ts tests/unit/api/public-moderation.test.ts tests/unit/api/manage-drawing-moderation.test.ts`

Expected: 모든 테스트 PASS

- [ ] **Step 7: 변경 커밋**

```bash
git add src/lib/sketchbooks/repository.ts src/lib/sketchbooks/repository-read.ts src/lib/sketchbooks/repository-drawings.ts tests/unit/sketchbooks/repository.test.ts tests/unit/sketchbooks/repository-exports.test.ts
git commit -m "스케치북 조회 그림 저장소 분리"
```

### Task 4: 관리 세션·삭제 저장소 분리

**Files:**
- Create: `src/lib/sketchbooks/repository-management.ts`
- Create: `src/lib/sketchbooks/repository-deletion.ts`
- Modify: `src/lib/sketchbooks/repository.ts`
- Modify: `tests/unit/sketchbooks/repository.test.ts`
- Modify: `tests/unit/sketchbooks/repository-exports.test.ts`

**Interfaces:**
- `repository-management.ts`: purchase compatibility 함수, PIN session, PIN attempt, PIN update
- `repository-deletion.ts`: 영구 삭제, 삭제 대상 조회, 관리·운영자 deletion job 함수
- 기존 export 이름과 파라미터를 유지한다.

- [ ] **Step 1: 관리·삭제 export 계약 확장**

```ts
expect(repository.createManagePinSession).toBeTypeOf('function');
expect(repository.consumeManagePinAttempt).toBeTypeOf('function');
expect(repository.createSketchbookDeletionJob).toBeTypeOf('function');
expect(repository.findSketchbookDeletionTargetById).toBeTypeOf('function');
```

- [ ] **Step 2: 관리·삭제 함수 본문 이동**

`createManagePinSession`부터 `updateManagePin`까지는 management 모듈로, `deleteSketchbookPermanently`부터 deletion job 함수는 deletion 모듈로 이동한다. `addMockPurchase`는 기존 호환 동작이므로 management 모듈에 둔다.

- [ ] **Step 3: 배럴 export 완성**

```ts
export * from './repository-read';
export * from './repository-drawings';
export * from './repository-management';
export * from './repository-deletion';
```

- [ ] **Step 4: 저장소·API 회귀 테스트 실행**

Run: `npx vitest run tests/unit/sketchbooks/repository.test.ts tests/unit/sketchbooks/repository-exports.test.ts tests/unit/sketchbooks/manage-session.test.ts tests/unit/sketchbooks/manage-pin.test.ts tests/unit/api/manage-sketchbook-delete.test.ts tests/unit/api/admin-sketchbook-delete-route.test.ts`

Expected: 모든 테스트 PASS

- [ ] **Step 5: 변경 커밋**

```bash
git add src/lib/sketchbooks/repository.ts src/lib/sketchbooks/repository-management.ts src/lib/sketchbooks/repository-deletion.ts tests/unit/sketchbooks/repository.test.ts tests/unit/sketchbooks/repository-exports.test.ts
git commit -m "스케치북 관리 삭제 저장소 분리"
```

### Task 5: 전역 CSS 책임 분리

**Files:**
- Create: `src/app/styles/foundation.css`
- Create: `src/app/styles/marketing.css`
- Create: `src/app/styles/sketch.css`
- Create: `src/app/styles/public.css`
- Create: `src/app/styles/manage.css`
- Create: `src/app/styles/admin.css`
- Modify: `src/app/globals.css`
- Create: `tests/unit/ui/global-style-entry.test.ts`
- Modify: `tests/e2e/mobile-layout.spec.ts`
- Modify: `tests/e2e/typography.spec.ts`

**Interfaces:**
- `src/app/layout.tsx`는 계속 `./globals.css` 하나만 import한다.
- `globals.css`는 여섯 파일을 foundation → marketing → sketch → public → manage → admin 순으로 import한다.

- [ ] **Step 1: CSS 진입점 순서 테스트 작성**

```ts
it('전역 스타일을 안정된 cascade 순서로 불러온다', () => {
  const css = readFileSync('src/app/globals.css', 'utf8');
  expect(css).toBe([
    "@import './styles/foundation.css';",
    "@import './styles/marketing.css';",
    "@import './styles/sketch.css';",
    "@import './styles/public.css';",
    "@import './styles/manage.css';",
    "@import './styles/admin.css';",
    '',
  ].join('\n'));
});
```

- [ ] **Step 2: 테스트가 현재 단일 파일 구조에서 실패하는지 확인**

Run: `npx vitest run tests/unit/ui/global-style-entry.test.ts`

Expected: globals.css 내용이 예상 import 목록과 달라 FAIL

- [ ] **Step 3: selector block을 source order 기준으로 여섯 파일에 이동**

기계적 이동 원칙:

```text
foundation: :root, reset, button, card, dialog, status, wordmark, header-menu 공통
marketing: marketing-shell, landing, form-shell, create, policy, business disclosure
sketch: sketch-stage, drawing, editor, fullscreen, owner edit
public: public-sketchbook, gallery, BEST, empty state
manage: manage-shell, share, story, purchase, payment result
admin: admin-shell 이하 운영자 selector
```

동일 selector가 여러 위치에 있으면 원래 등장 순서를 유지하도록 같은 대상 파일에서도 순서를 보존한다. 매 이동 배치 후 `git diff --word-diff=porcelain`로 선언 값이 바뀌지 않았는지 확인한다.

- [ ] **Step 4: globals.css를 import 전용 진입점으로 교체**

```css
@import './styles/foundation.css';
@import './styles/marketing.css';
@import './styles/sketch.css';
@import './styles/public.css';
@import './styles/manage.css';
@import './styles/admin.css';
```

- [ ] **Step 5: CSS·레이아웃 검증**

Run: `npx vitest run tests/unit/ui/global-style-entry.test.ts tests/unit/ui/manage-ranking-typography.test.ts tests/unit/ui/manage-ranking-card-spacing.test.tsx`

Run: `npx playwright test tests/e2e/mobile-layout.spec.ts tests/e2e/typography.spec.ts --project=mobile-chrome`

Run: `npm run build`

Expected: 모든 명령 PASS, CSS import 순환 없음

- [ ] **Step 6: 변경 커밋**

```bash
git add src/app/globals.css src/app/styles tests/unit/ui/global-style-entry.test.ts tests/e2e/mobile-layout.spec.ts tests/e2e/typography.spec.ts
git commit -m "전역 스타일 화면 책임 분리"
```

### Task 6: 유지보수성 전체 회귀 검증

**Files:**
- Modify only if verification reveals a scoped regression in files from Tasks 1-5.

**Interfaces:**
- spec의 공개 API와 디자인 계약을 유지한다.

- [ ] **Step 1: 전체 단위 테스트 실행**

Run: `npm test`

Expected: 모든 비에뮬레이터 테스트 PASS

- [ ] **Step 2: 린트와 빌드 실행**

Run: `npm run lint`

Run: `npm run build`

Expected: 두 명령 exit 0

- [ ] **Step 3: 전체 모바일 E2E 실행**

Run: `npm run test:e2e -- --project=mobile-chrome`

Expected: 0 failures

- [ ] **Step 4: 변경 파일 detector 실행**

Run: `node C:\Users\박도영\.agents\skills\impeccable\scripts\detect.mjs --json src/app src/components/sketch`

Expected: 구조 분리로 새 기계적 결함이 추가되지 않음

- [ ] **Step 5: desktop·mobile 브라우저 배치 확인**

`/`, `/create`, 공개 갤러리, 관리 대시보드, 스토리 공유, 관리자 로그인을 desktop과 390×844에서 확인한다. 첫 배치에서 발견한 회귀만 한 번에 수정하고 한 번 더 확인한 뒤 종료한다.

- [ ] **Step 6: 회귀 보완 커밋**

검증 중 수정이 있었다면 관련 파일만 stage하고 다음 메시지로 커밋한다. 수정이 없으면 빈 커밋을 만들지 않는다.

```bash
git commit -m "구조 분리 회귀 검증 보완"
```
