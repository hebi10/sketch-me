# Mobile Reference Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 스캐치북 전 화면을 제공된 시안과 유사한 최대 650px 모바일 전용 디자인으로 개편한다.

**Architecture:** 기존 Next.js 페이지와 Firebase 데이터 흐름은 유지하고 화면 마크업과 공통 CSS를 재구성한다. 정적 장식은 ImageGen으로 만든 랜딩 초상화 콜라주만 사용하며, 공개·관리·스토리에는 기존 Firebase 이미지를 그대로 사용한다.

**Tech Stack:** Next.js 15, React 19, TypeScript, CSS, Firebase Admin, Playwright, ImageGen

**Spec:** `docs/superpowers/specs/2026-08-24-reference-visual-redesign-design.md`

## Global Constraints

- 모든 화면의 최대 너비는 650px이며 넓은 브라우저에서 중앙 정렬한다.
- `html`과 `body`에 별도 배경색 또는 배경 이미지를 적용하지 않는다.
- 친구 그림과 관리 그림은 모바일 2열을 기본으로 한다.
- 기존 Firebase API, Storage 경로, 데이터 타입을 변경하지 않는다.
- 한국어 단어 중간 줄바꿈을 방지하고 모든 주요 터치 영역은 44px 이상으로 유지한다.
- 실제 사용자 그림을 AI로 생성하거나 변형하지 않는다.

---

### Task 1: 모바일 셸과 랜딩 이미지 자산

**Files:**
- Create: `public/brand/landing-sketch-collage.png`
- Modify: `src/app/(marketing)/page.tsx`
- Modify: `src/app/globals.css`
- Modify: `tests/e2e/mobile-layout.spec.ts`

**Interfaces:**
- Produces: 모든 페이지가 공유하는 650px 모바일 셸과 랜딩 콜라주 자산

- [ ] **Step 1: 모바일 셸 실패 E2E 작성**

  650px와 900px 뷰포트에서 모든 `main`의 너비가 650px 이하이고 가운데 정렬되며 `body`의 배경색이 투명한지 검증한다.

- [ ] **Step 2: 실패 확인**

  Run: `npx playwright test tests/e2e/mobile-layout.spec.ts --grep "모바일 셸"`

- [ ] **Step 3: ImageGen 자산 생성**

  제공된 시안을 스타일 레퍼런스로 사용해 글자 없는 네 장의 손그림 초상화 종이 카드와 연필·작은 낙서가 포함된 세로형 콜라주를 생성한다. 최종 파일을 `public/brand/landing-sketch-collage.png`에 저장한다.

- [ ] **Step 4: 랜딩과 공통 셸 구현**

  홈을 제목 → 콜라주 → 블루 CTA 순서의 단일 열로 바꾸고, 모든 화면의 최대 너비를 650px로 통일한다. 전역 배경색과 PC 전용 2열 랜딩 레이아웃을 제거한다.

- [ ] **Step 5: 테스트와 커밋**

  Run: `npx playwright test tests/e2e/mobile-layout.spec.ts`

  Commit: `feat: add mobile sketchbook visual shell`

### Task 2: 공개 스케치북 재구성

**Files:**
- Modify: `src/app/s/[publicId]/page.tsx`
- Modify: `src/app/globals.css`
- Modify: `tests/e2e/sketchbook-flow.spec.ts`

**Interfaces:**
- Consumes: `Drawing.bestRank`, `Drawing.createdAt`, 실제 이미지 API
- Produces: 전체 그림 보드, BEST 1–4, 최근 그림 구역

- [ ] **Step 1: 공개 화면 실패 E2E 작성**

  친구 그림 제출 후 공개 페이지에 `친구들이 그린 나`, `베스트 그림`, `최근 올라온 그림` 제목이 존재하고 390px에서 카드가 2열인지 검증한다.

- [ ] **Step 2: 실패 확인**

  Run: `npx playwright test tests/e2e/sketchbook-flow.spec.ts --project=mobile-chrome`

- [ ] **Step 3: 공개 페이지 마크업 구현**

  상단 중앙 워드마크, 소개 문구, 테이프가 붙은 본인 그림, 전체 그림 보드, BEST 4, 최근 그림 순서로 구성한다. BEST가 부족하면 빈 종이 슬롯을 표시한다.

- [ ] **Step 4: 모바일 시안 스타일 구현**

  흰 종이 카드, 블루 BEST 배지, 2열 갤러리, 전체 너비 블루 CTA를 적용한다.

- [ ] **Step 5: 테스트와 커밋**

  Run: `npx playwright test tests/e2e/sketchbook-flow.spec.ts --project=mobile-chrome`

  Commit: `feat: redesign public mobile sketchbook`

### Task 3: 생성·그림판·관리·스토리 스타일 통일

**Files:**
- Modify: `src/app/create/CreateSketchbookForm.tsx`
- Modify: `src/components/sketch/SketchEditor.tsx`
- Modify: `src/app/m/[publicId]/ManageDashboard.tsx`
- Modify: `src/app/m/[publicId]/share/page.tsx`
- Modify: `src/app/m/[publicId]/share/StoryImageMaker.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Preserves: 생성, 그림 저장, 관리, BEST, PNG 다운로드 동작
- Produces: 전 화면의 동일한 잉크·블루·종이 카드 시각 언어

- [ ] **Step 1: 공통 시각 컴포넌트 구조 적용**

  화면별 헤더, 섹션 제목, 안내 문구, CTA 클래스와 마크업을 시안의 모바일 구조에 맞게 정리한다.

- [ ] **Step 2: 편집기 스타일 적용**

  캔버스와 하단 탭·도구 패널을 시안처럼 흰 종이 면과 블루 활성 상태로 표현한다. 기존 Pointer Events와 기능은 변경하지 않는다.

- [ ] **Step 3: 관리와 스토리 스타일 적용**

  참여 현황 패널, 실제 그림 카드, BEST 배지, 스토리 미리보기와 다운로드 버튼을 동일한 블루 시스템으로 통일한다.

- [ ] **Step 4: 회귀 테스트와 커밋**

  Run: `npm run test`

  Run: `npm run lint`

  Commit: `feat: unify mobile sketchbook surfaces`

### Task 4: 모바일 시각 QA와 완료 검증

**Files:**
- Modify: `src/app/globals.css` only if the bounded inspection reveals defects
- Modify: `tests/e2e/mobile-layout.spec.ts` only for a discovered reproducible regression

**Interfaces:**
- Produces: 280–650px 범위에서 검증된 최종 모바일 디자인

- [ ] **Step 1: 전체 자동 검증**

  Run: `npm run test`

  Run: `npm run lint`

  Run: `npm run build`

  Run: Firebase 에뮬레이터 환경의 `npm run test:e2e`

- [ ] **Step 2: Chrome 배치 점검**

  280×700, 390×844, 650×900에서 홈·생성·공개·그림판·관리·스토리 화면의 가로 넘침, 줄바꿈, 이미지 비율, CTA와 터치 영역을 한 번에 확인한다.

- [ ] **Step 3: 발견 사항 일괄 보정 및 한 번 재확인**

  스크린샷에서 발견된 문제를 한 번의 수정 배치로 처리하고 같은 뷰포트에서 한 번만 재확인한다.

- [ ] **Step 4: Impeccable 검사와 커밋**

  Run: `node C:/Users/박도영/.agents/skills/impeccable/scripts/detect.mjs --json src/app src/components`

  Commit: `test: verify mobile visual redesign`
