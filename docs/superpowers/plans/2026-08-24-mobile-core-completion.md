# 스캐치북 모바일 핵심 완성 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 생성자와 친구가 모바일에서 스케치북을 만들고, 참고 사진을 보며 그림을 제출하고, 관리·BEST·스토리 PNG까지 완료할 수 있게 한다.

**Architecture:** 기존 Next.js Route Handler와 Firebase Admin 서버 경계를 유지한다. 그림판 상태는 재사용 가능한 Canvas 컴포넌트로 분리하고, 생성자·친구 제출은 각 서버 엔드포인트에서 Storage 저장과 Firestore Transaction을 수행한다. 시각 검증은 Firebase Emulator 기반 Playwright 흐름과 Chrome 모바일 뷰포트로 수행한다.

**Tech Stack:** Next.js 15, React 19, TypeScript, Firebase Admin/Firestore/Storage, Vitest, Playwright, Canvas 2D API

**Spec:** `docs/superpowers/specs/2026-08-24-mobile-core-completion-design.md`

## Global Constraints

- 모든 Firestore·Storage 쓰기는 Next.js 서버를 통과한다.
- 이미지 입력은 PNG/JPEG/WEBP, 디코딩 후 최대 2MB다.
- 모바일 터치 대상은 최소 44×44px이며 320px에서 가로 스크롤이 없어야 한다.
- 참고 사진은 그림 레이어와 분리하고 저장 PNG에 포함하지 않는다.
- UI는 아이보리 종이톤과 잉크·블루그레이 디자인을 유지한다.
- 운영 Firebase 사용량 대신 에뮬레이터를 우선한다.

---

### Task 1: 프로젝트 파비콘

**Files:**
- Create: `src/app/icon.png`
- Create: `public/brand/sketchbook-favicon-source.png`

**Interfaces:**
- Consumes: PRODUCT.md 색상과 사용자 디자인 레퍼런스
- Produces: Next.js App Router가 자동 인식하는 `icon.png`

- [ ] **Step 1: 이미지 생성 기능으로 원본 생성**

  정사각형 래스터 이미지로 펼친 스케치북과 연필을 중앙 배치하고, 글자·워터마크·복잡한 배경을 제외한다.

- [ ] **Step 2: 생성 이미지 검수**

  32px 축소 상태에서도 책과 연필 실루엣이 구분되고 배경이 아이보리인지 확인한다.

- [ ] **Step 3: 프로젝트 경로에 저장**

  원본을 `public/brand/sketchbook-favicon-source.png`, 앱용 정사각형을 `src/app/icon.png`에 저장한다.

- [ ] **Step 4: 빌드 검증 후 커밋**

  Run: `npm run build`

  Commit: `feat: add sketchbook favicon`

### Task 2: 재사용 가능한 모바일 Canvas 엔진

**Files:**
- Create: `src/components/sketch/SketchEditor.tsx`
- Create: `src/components/sketch/canvas-history.ts`
- Create: `tests/unit/sketch/canvas-history.test.ts`
- Modify: `src/app/s/[publicId]/draw/SketchCanvas.tsx`

**Interfaces:**
- Produces: `SketchEditor({ referenceImageUrl?, onExport })`, `createCanvasHistory(initial)`, `pushSnapshot`, `undoSnapshot`, `redoSnapshot`

- [ ] **Step 1: 히스토리 실패 테스트 작성**

  빈 상태, 새 스냅샷 추가, undo, redo, undo 후 새 입력 시 redo 폐기를 각각 검증한다.

- [ ] **Step 2: 실패 확인**

  Run: `npm run test -- tests/unit/sketch/canvas-history.test.ts`

- [ ] **Step 3: 최소 히스토리 구현**

  순수 함수로 스냅샷 배열과 현재 인덱스를 관리한다.

- [ ] **Step 4: Canvas UI 교체**

  그림/참고사진/편집 탭, 펜·지우개·색상·굵기·undo·redo·전체 삭제를 제공한다. Pointer Events로 한 손가락 그림을 처리하고 참고 사진 탭에서 두 포인터 거리·중심점으로 확대와 이동을 계산한다.

- [ ] **Step 5: 모바일 입력 검증**

  44px 터치 영역, `touch-action`, safe area, 세로·가로 레이아웃을 확인한다.

- [ ] **Step 6: 테스트와 커밋**

  Run: `npm run test -- tests/unit/sketch/canvas-history.test.ts`

  Commit: `feat: add mobile sketch editor`

### Task 3: 생성자 그림과 참고 사진 저장

**Files:**
- Modify: `src/lib/domain/types.ts`
- Modify: `src/lib/domain/schemas.ts`
- Modify: `src/lib/firebase/storage.ts`
- Modify: `src/lib/sketchbooks/create.ts`
- Modify: `src/lib/sketchbooks/repository.ts`
- Modify: `src/app/create/page.tsx`
- Replace: `src/app/create/CreateSketchbookForm.tsx`
- Modify: `src/app/api/sketchbooks/route.ts`
- Create: `tests/unit/sketchbooks/create-owner-drawing.test.ts`

**Interfaces:**
- Consumes: `SketchEditor`의 PNG data URL과 선택적 참고 사진 data URL
- Produces: `ownerDrawingPath`, `referenceImagePath`, `referenceImageEnabled`가 포함된 Sketchbook

- [ ] **Step 1: 생성 입력과 저장 초안 실패 테스트 작성**

  이름, 본인 그림 필수, 선택 참고 사진, Storage 경로와 기본 상태를 검증한다.

- [ ] **Step 2: 실패 확인**

  Run: `npm run test -- tests/unit/sketchbooks/create-owner-drawing.test.ts`

- [ ] **Step 3: 도메인과 Storage 경로 구현**

  본인 그림 경로 `sketchbooks/{id}/owner/original.png`와 참고 사진 경로를 생성한다.

- [ ] **Step 4: 생성 API 구현**

  data URL을 검증·디코딩하고 파일을 저장한 뒤 Firestore 문서를 생성한다. 실패 시 이미 저장된 파일을 정리한다.

- [ ] **Step 5: 모바일 생성 화면 구현**

  이름 → 참고 사진 선택 → 본인 그림 → 완료의 단일 모바일 흐름으로 구성한다.

- [ ] **Step 6: 테스트와 커밋**

  Run: `npm run test -- tests/unit/sketchbooks/create-owner-drawing.test.ts`

  Commit: `feat: save owner sketch and reference image`

### Task 4: 관리 복구 링크와 실제 그림 관리

**Files:**
- Modify: `src/lib/sketchbooks/manage-session.ts`
- Modify: `src/lib/sketchbooks/management.ts`
- Modify: `src/lib/sketchbooks/repository.ts`
- Create: `src/app/m/[publicId]/recover/route.ts`
- Create: `src/app/api/manage/[publicId]/drawings/[drawingId]/image/route.ts`
- Modify: `src/app/api/manage/[publicId]/drawings/[drawingId]/route.ts`
- Modify: `src/app/m/[publicId]/ManageDashboard.tsx`
- Modify: `tests/unit/sketchbooks/manage-session.test.ts`

**Interfaces:**
- Produces: 일회성 `?token=` 복구 URL을 관리 쿠키로 교환하는 route, 관리 전용 이미지 응답, `hide|show|delete|best|clearBest` 작업

- [ ] **Step 1: 복구 토큰과 관리 작업 실패 테스트 작성**

  올바른 publicId/token만 세션이 되고 잘못된 토큰은 거부되는지 검증한다.

- [ ] **Step 2: 실패 확인 후 최소 구현**

  Run: `npm run test -- tests/unit/sketchbooks/manage-session.test.ts`

- [ ] **Step 3: 관리 이미지와 작업 API 구현**

  권한 확인 후 숨긴 그림도 관리 화면에서 읽고, 삭제와 BEST 해제를 Transaction으로 처리한다.

- [ ] **Step 4: 모바일 관리 카드 구현**

  실제 이미지, 이름·메시지·상태·BEST를 표시하고 작업은 과밀하지 않은 메뉴로 제공한다.

- [ ] **Step 5: 테스트와 커밋**

  Run: `npm run test -- tests/unit/sketchbooks/manage-session.test.ts`

  Commit: `feat: complete mobile sketchbook management`

### Task 5: 실제 BEST 스토리 PNG

**Files:**
- Modify: `src/app/m/[publicId]/share/page.tsx`
- Modify: `src/app/m/[publicId]/share/StoryImageMaker.tsx`
- Create: `src/lib/share/story-layout.ts`
- Create: `tests/unit/share/story-layout.test.ts`

**Interfaces:**
- Produces: BEST 1 큰 영역과 BEST 2~4 하단 영역 좌표, 실제 이미지 로딩과 1080×1440(3:4) PNG 다운로드

- [ ] **Step 1: 레이아웃 실패 테스트 작성**

  네 슬롯 좌표가 캔버스 안에 있고 서로 겹치지 않으며 BEST 1 영역이 가장 큰지 검증한다.

- [ ] **Step 2: 실패 확인과 레이아웃 구현**

  Run: `npm run test -- tests/unit/share/story-layout.test.ts`

- [ ] **Step 3: 이미지 합성 구현**

  관리 권한이 있는 이미지 API에서 BEST 파일을 불러와 Canvas에 배치하고 부족한 슬롯은 빈 상태로 렌더링한다.

- [ ] **Step 4: PNG 크기 검증과 커밋**

  다운로드 이벤트와 1080×1440 크기를 Playwright에서 확인한다.

  Commit: `feat: render best drawings in story image`

### Task 6: 공개 화면과 모바일 반응형 정리

**Files:**
- Modify: `src/app/s/[publicId]/page.tsx`
- Modify: `src/app/globals.css`
- Modify: `src/app/layout.tsx`
- Modify: `src/components/ui/*`

**Interfaces:**
- Consumes: 본인 그림과 공개 친구 그림 이미지 API
- Produces: 320px부터 동작하는 공개·생성·그림·관리·스토리 화면

- [ ] **Step 1: 모바일 레이아웃 실패 E2E 작성**

  각 화면에서 `document.documentElement.scrollWidth <= innerWidth`, 주요 버튼 44px 이상, 고정 CTA 가시성을 검증한다.

- [ ] **Step 2: 실패 확인**

  Run: `npx playwright test tests/e2e/mobile-layout.spec.ts`

- [ ] **Step 3: 모바일 우선 CSS 구현**

  기본 스타일을 단일 열로 두고 640px 이상에서만 확장한다. safe area, 가상 키보드 인접 여백, 가로 모드를 보정한다.

- [ ] **Step 4: E2E 통과와 커밋**

  Commit: `fix: harden mobile sketchbook layouts`

### Task 7: 전체 흐름과 Chrome 검증

**Files:**
- Create: `tests/e2e/sketchbook-flow.spec.ts`
- Modify: `playwright.config.ts`

**Interfaces:**
- Produces: 에뮬레이터 기반 생성 → 제출 → 관리 → BEST → 다운로드 회귀 테스트

- [ ] **Step 1: Firebase 에뮬레이터 E2E 작성**

  실제 Route Handler를 거쳐 Storage·Firestore에 저장되는 흐름을 검증한다.

- [ ] **Step 2: 자동 검증 실행**

  Run: `npm run test`

  Run: `npm run lint`

  Run: `npm run build`

  Run: `npx firebase emulators:exec --only firestore,storage "npm run test:e2e"`

- [ ] **Step 3: Chrome 모바일 시각 검증**

  320×700, 390×844, 844×390에서 생성·그림·관리·스토리를 한 번의 검증 패스로 확인하고 발견된 문제를 한 번에 수정한다.

- [ ] **Step 4: Impeccable detector 실행**

  Run: `node "$env:USERPROFILE/.agents/skills/impeccable/scripts/detect.mjs" --json src/app src/components`

- [ ] **Step 5: 최종 확인과 커밋**

  Commit: `test: verify mobile sketchbook flow`
