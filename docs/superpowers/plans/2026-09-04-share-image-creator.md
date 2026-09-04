# 공유 이미지 제작 기능 확장 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 관리자가 한 장짜리 정사각형 이미지와 기존 BEST 4 이미지 중 하나를 선택하고, 유형별 제목·그림·테마·워터마크 상태를 반영한 PNG를 제작하도록 확장한다.

**Architecture:** `/m/[publicId]/share` 경로와 공통 편집기를 유지하고 `single | best` 모드로 화면과 Canvas 출력을 분기한다. 서버는 공개 가능한 그림 메타데이터만 전달하고 이름 검색은 클라이언트의 순수 함수로 처리한다. 기존 `storyHeading`은 BEST 제목으로 유지하며 `singleStoryHeading`만 추가해 데이터 마이그레이션을 피한다.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Firebase Admin/Firestore, Canvas 2D, Vitest, Testing Library, Playwright

**Spec:** `docs/superpowers/specs/2026-09-04-share-image-creator-design.md`

## Global Constraints

- 한국어 모바일 웹과 최대 650px 단일 책 폭을 우선한다.
- `single` 출력은 정확히 1080×1080 PNG이며 제목, 선택 그림, 작성자, 선택적 워터마크만 포함한다.
- `best` 출력은 기존 1080×1440, BEST 배지, 공개 URL, 참여 CTA를 유지한다.
- 그림은 자르지 않고 `contain`으로 전부 표시한다.
- 친구 그림 선택 대상은 `VISIBLE`이면서 `ACTIVE`인 그림뿐이다.
- 기존 `WATERMARK_FREE` 1,000원 상품과 서버 권한 모델을 변경하지 않는다.
- `storyHeading`은 BEST 제목으로 유지하고 `singleStoryHeading`만 새로 저장한다.
- 새 의존성을 추가하지 않는다.
- UI 편집 직전 Impeccable `craft-floor.md`를 읽고 기존 `PRODUCT.md`, `DESIGN.md`를 따른다.
- 기존 `next-env.d.ts` 미커밋 변경을 스테이징하거나 덮어쓰지 않는다.

---

## 파일 구조

### 새 파일

- `src/lib/share/share-image.ts`: 모드, 기본 제목, 편집기에 전달할 그림 DTO, 이름 검색 정규화
- `src/lib/share/single-image-layout.ts`: 1080×1080 레이아웃 상수와 `contain` 계산
- `src/app/m/[publicId]/share/ImageModeChooser.tsx`: 접근 가능한 제작 유형 선택 모달
- `src/app/m/[publicId]/share/ImageCreationEntry.tsx`: 관리 화면용 모달 트리거
- `src/app/m/[publicId]/share/DrawingPicker.tsx`: 내 그림, 이름 검색, 결과, 단일 선택
- `src/app/m/[publicId]/share/SingleImagePreview.tsx`: 정사각형 미리보기
- `src/app/m/[publicId]/share/BestImagePreview.tsx`: 기존 BEST 미리보기 분리
- `src/app/m/[publicId]/share/ShareImageComposer.tsx`: 모드별 편집 상태와 제목 저장 조정
- `src/app/m/[publicId]/share/ShareImageMaker.tsx`: 모드별 Canvas PNG 생성
- `tests/unit/share/share-image.test.ts`: 모드 파싱과 이름 검색
- `tests/unit/share/single-image-layout.test.ts`: 정사각형 레이아웃과 contain 계산
- `tests/unit/ui/image-mode-chooser.test.tsx`: 모달 접근성 및 링크
- `tests/unit/ui/drawing-picker.test.tsx`: 검색과 선택 동작
- `tests/unit/ui/share-image-composer.test.tsx`: 두 모드 편집 흐름
- `tests/unit/ui/share-image-maker.test.tsx`: 두 출력 크기와 파일명

### 수정 파일

- `src/lib/domain/types.ts`: `singleStoryHeading` 추가
- `src/lib/sketchbooks/create.ts`: 한 장 이미지 기본 제목 저장
- `src/lib/sketchbooks/repository.ts`: 새 필드 역직렬화 및 업데이트 함수
- `src/app/api/manage/[publicId]/sketchbook/route.ts`: 한 장 제목 PATCH 분기
- `src/app/m/[publicId]/ManageDashboard.tsx`: `이미지 제작` 모달 진입
- `src/app/m/[publicId]/share/page.tsx`: 모드 검증, 공개 가능 그림 DTO 구성, 공통 제작기 연결
- `src/app/m/[publicId]/share/WatermarkPurchaseButton.tsx`: 공유 이미지 일반 문구
- `src/app/globals.css`: 모달, 검색 결과, 정사각형 미리보기, 반응형 스타일
- 기존 생성·저장·대시보드·스토리 이미지 단위 테스트
- `tests/e2e/sketchbook-flow.spec.ts`: 모드 선택과 한 장/BEST 흐름
- `tests/e2e/mobile-layout.spec.ts`: 새 화면 모바일 넘침 검증

### 이동 후 제거되는 기존 파일

- `src/app/m/[publicId]/share/StoryImageComposer.tsx` → `ShareImageComposer.tsx`
- `src/app/m/[publicId]/share/StoryImageMaker.tsx` → `ShareImageMaker.tsx`
- `tests/unit/ui/story-image-composer.test.tsx` → `share-image-composer.test.tsx`
- `tests/unit/ui/story-image-maker.test.tsx` → `share-image-maker.test.tsx`

---

### Task 1: 공유 이미지 모드와 유형별 제목 저장

**Files:**
- Create: `src/lib/share/share-image.ts`
- Create: `tests/unit/share/share-image.test.ts`
- Modify: `src/lib/domain/types.ts`
- Modify: `src/lib/sketchbooks/create.ts`
- Modify: `src/lib/sketchbooks/repository.ts`
- Modify: `src/app/api/manage/[publicId]/sketchbook/route.ts`
- Modify: `tests/unit/sketchbooks/create.test.ts`
- Modify: `tests/unit/sketchbooks/repository.test.ts`
- Modify: `tests/unit/api/manage-sketchbook-delete.test.ts`

**Interfaces:**
- Produces: `ShareImageMode = 'single' | 'best'`
- Produces: `parseShareImageMode(value: unknown): ShareImageMode | null`
- Produces: `SINGLE_IMAGE_DEFAULT_HEADING = '친구가 그린 나'`
- Produces: `ShareDrawingOption`
- Produces: `updateSketchbookSingleStoryHeading(sketchbookId: string, singleStoryHeading: string): Promise<void>`
- Preserves: `updateSketchbookStoryHeading` and `storyHeading` as BEST-only storage

- [ ] **Step 1: 모드 파싱과 새 기본 제목의 실패 테스트 작성**

```ts
import { describe, expect, it } from 'vitest';

import {
  parseShareImageMode,
  SINGLE_IMAGE_DEFAULT_HEADING,
} from '@/lib/share/share-image';

describe('share image model', () => {
  it.each([
    ['single', 'single'],
    ['best', 'best'],
    ['BEST', null],
    ['', null],
    [undefined, null],
  ])('모드 %p를 %p로 해석한다', (value, expected) => {
    expect(parseShareImageMode(value)).toBe(expected);
  });

  it('한 장 이미지의 기본 제목을 고정한다', () => {
    expect(SINGLE_IMAGE_DEFAULT_HEADING).toBe('친구가 그린 나');
  });
});
```

- [ ] **Step 2: 새 테스트가 모듈 부재로 실패하는지 확인**

Run: `npx vitest run tests/unit/share/share-image.test.ts`

Expected: FAIL with `Failed to resolve import "@/lib/share/share-image"`

- [ ] **Step 3: 공유 이미지 모델 최소 구현**

```ts
export type ShareImageMode = 'single' | 'best';
export type ShareDrawingSource = 'owner' | 'friend';

export const SINGLE_IMAGE_DEFAULT_HEADING = '친구가 그린 나';

export interface ShareDrawingOption {
  authorName: string;
  bestRank: 1 | 2 | 3 | 4 | null;
  createdAt: string | null;
  id: string;
  imageUrl: string;
  source: ShareDrawingSource;
}

export function parseShareImageMode(value: unknown): ShareImageMode | null {
  return value === 'single' || value === 'best' ? value : null;
}
```

- [ ] **Step 4: 스케치북 생성·조회 실패 테스트에 새 제목 필드 추가**

`tests/unit/sketchbooks/create.test.ts`의 생성 결과에 아래 기대값을 추가한다.

```ts
expect.objectContaining({
  singleStoryHeading: '친구가 그린 나',
  storyHeading: '친구들이 그린 내 모습',
});
```

`tests/unit/sketchbooks/repository.test.ts`에는 Firestore 문서에 필드가 없을 때 기본값을 복원하는 사례를 추가한다.

```ts
expect(result?.singleStoryHeading).toBe('친구가 그린 나');
```

- [ ] **Step 5: 생성·조회 테스트가 새 필드 누락으로 실패하는지 확인**

Run: `npx vitest run tests/unit/sketchbooks/create.test.ts tests/unit/sketchbooks/repository.test.ts`

Expected: FAIL because `singleStoryHeading` is absent

- [ ] **Step 6: 타입·생성·저장소에 새 필드 구현**

`Sketchbook`에 다음 속성을 추가한다.

```ts
singleStoryHeading?: string;
```

생성 데이터에는 다음 값을 넣는다.

```ts
singleStoryHeading: SINGLE_IMAGE_DEFAULT_HEADING,
```

저장소 역직렬화와 업데이트 함수는 다음 계약을 사용한다.

```ts
singleStoryHeading: data.singleStoryHeading
  ? String(data.singleStoryHeading)
  : SINGLE_IMAGE_DEFAULT_HEADING,

export async function updateSketchbookSingleStoryHeading(
  sketchbookId: string,
  singleStoryHeading: string,
) {
  await getAdminFirestore().collection('sketchbooks').doc(sketchbookId).update({
    singleStoryHeading,
    updatedAt: new Date(),
  });
}
```

- [ ] **Step 7: API가 두 제목을 독립적으로 저장하는 실패 테스트 작성**

API 테스트의 hoisted mock과 repository mock에 `updateSketchbookSingleStoryHeading`을 추가하고 다음 사례를 작성한다.

```ts
it('한 장 이미지 제목만 별도로 저장한다', async () => {
  const response = await PATCH(new Request(
    'http://localhost/api/manage/public-1/sketchbook',
    {
      body: JSON.stringify({ singleStoryHeading: '  한 장의 추억  ' }),
      headers: { 'Content-Type': 'application/json' },
      method: 'PATCH',
    },
  ), context);

  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toEqual({ singleStoryHeading: '한 장의 추억' });
  expect(updateSketchbookSingleStoryHeading).toHaveBeenCalledWith('book-1', '한 장의 추억');
  expect(updateSketchbookStoryHeading).not.toHaveBeenCalled();
});
```

- [ ] **Step 8: API 테스트 실패 확인**

Run: `npx vitest run tests/unit/api/manage-sketchbook-delete.test.ts`

Expected: FAIL because the route treats `singleStoryHeading` as a missing BEST heading

- [ ] **Step 9: PATCH 요청을 명시적인 두 제목 분기로 구현**

```ts
if (payload && Object.hasOwn(payload, 'singleStoryHeading')) {
  const singleStoryHeading = typeof payload.singleStoryHeading === 'string'
    ? payload.singleStoryHeading.trim()
    : '';
  if (!singleStoryHeading || singleStoryHeading.length > STORY_SHARED_HEADING_MAX_LENGTH) {
    return NextResponse.json(
      { message: `이미지 제목은 1자 이상 ${STORY_SHARED_HEADING_MAX_LENGTH}자 이내로 입력해 주세요.` },
      { status: 400 },
    );
  }
  await updateSketchbookSingleStoryHeading(sketchbook.id, singleStoryHeading);
  return NextResponse.json({ singleStoryHeading });
}
```

기존 `storyHeading` 분기는 그대로 두며 두 속성이 한 요청에 함께 들어오면 `singleStoryHeading`만 처리한다. 클라이언트는 한 번에 한 제목만 전송한다.

- [ ] **Step 10: Task 1 관련 테스트와 타입 검사 통과 확인**

Run: `npx vitest run tests/unit/share/share-image.test.ts tests/unit/sketchbooks/create.test.ts tests/unit/sketchbooks/repository.test.ts tests/unit/api/manage-sketchbook-delete.test.ts`

Run: `npx tsc --noEmit`

Expected: all PASS

- [ ] **Step 11: Task 1 커밋**

```powershell
git add -- src/lib/share/share-image.ts src/lib/domain/types.ts src/lib/sketchbooks/create.ts src/lib/sketchbooks/repository.ts 'src/app/api/manage/[publicId]/sketchbook/route.ts' tests/unit/share/share-image.test.ts tests/unit/sketchbooks/create.test.ts tests/unit/sketchbooks/repository.test.ts tests/unit/api/manage-sketchbook-delete.test.ts
git commit -m "공유 이미지 모드와 제목 저장 분리"
```

---

### Task 2: 이미지 제작 진입 모달과 모드 라우팅

**Files:**
- Create: `src/app/m/[publicId]/share/ImageModeChooser.tsx`
- Create: `src/app/m/[publicId]/share/ImageCreationEntry.tsx`
- Create: `tests/unit/ui/image-mode-chooser.test.tsx`
- Modify: `src/app/m/[publicId]/ManageDashboard.tsx`
- Modify: `src/app/m/[publicId]/share/page.tsx`
- Modify: `src/app/globals.css`
- Modify: `tests/unit/ui/manage-dashboard.test.tsx`

**Interfaces:**
- Consumes: `ShareImageMode`, `parseShareImageMode`
- Produces: `ImageModeChooser({ open, publicId, onClose, triggerRef })`
- Produces: `ImageCreationEntry({ className, publicId, shortLabel })`
- Produces: canonical query links `/m/${publicId}/share?mode=single|best`

- [ ] **Step 1: 모드 선택 모달 실패 테스트 작성**

```tsx
render(<ImageModeChooser onClose={onClose} open publicId="book-1" />);

const dialog = screen.getByRole('dialog', { name: '이미지 제작 방식 선택' });
expect(dialog).toBeVisible();
expect(within(dialog).getByRole('link', { name: /그림 하나 제작하기/ }))
  .toHaveAttribute('href', '/m/book-1/share?mode=single');
expect(within(dialog).getByRole('link', { name: /BEST 이미지 제작하기/ }))
  .toHaveAttribute('href', '/m/book-1/share?mode=best');
fireEvent.keyDown(dialog, { key: 'Escape' });
expect(onClose).toHaveBeenCalledOnce();
```

- [ ] **Step 2: 새 테스트의 컴포넌트 부재 실패 확인**

Run: `npx vitest run tests/unit/ui/image-mode-chooser.test.tsx`

Expected: FAIL with unresolved import

- [ ] **Step 3: 접근 가능한 모달과 트리거 구현**

`ImageModeChooser`는 네이티브 `<dialog>`를 사용하고 기존 결제 모달과 같은 포커스 규칙을 적용한다.

```tsx
interface ImageModeChooserProps {
  dismissHref?: string;
  onClose?: () => void;
  open: boolean;
  publicId: string;
  triggerRef?: RefObject<HTMLElement | null>;
}

const modes = [
  {
    description: '그림 한 장을 정사각형 공유 이미지로 만들어요.',
    href: (publicId: string) => `/m/${publicId}/share?mode=single`,
    label: '그림 하나 제작하기',
    ratio: '1080 × 1080',
  },
  {
    description: '선정한 BEST 그림을 한 장에 모아 만들어요.',
    href: (publicId: string) => `/m/${publicId}/share?mode=best`,
    label: 'BEST 이미지 제작하기',
    ratio: '1080 × 1440',
  },
] as const;
```

열릴 때 첫 링크에 포커스를 두고, Tab 순환, Escape 닫기, 닫힌 뒤 트리거 포커스 복귀를 구현한다. 모달 뒤 관리 `<main>`에는 기존 패턴대로 `inert`를 적용한다.

`ImageCreationEntry`는 `이미지 제작` 버튼과 `ImageModeChooser`의 열림 상태만 관리한다.

- [ ] **Step 4: 관리 화면 문구와 버튼 계약 실패 테스트 작성**

`manage-dashboard.test.tsx`의 메뉴 기대값을 다음처럼 변경하고 팝업 열림을 검증한다.

```ts
expect(within(menu).getByRole('button', { name: '이미지 제작' })).toHaveTextContent('스토리');
fireEvent.click(within(menu).getByRole('button', { name: '이미지 제작' }));
expect(screen.getByRole('dialog', { name: '이미지 제작 방식 선택' })).toBeVisible();
```

본문 CTA도 `이미지 제작` 버튼으로 찾고 같은 모달이 열리는지 별도 테스트한다.

- [ ] **Step 5: 관리 화면 테스트 실패 확인**

Run: `npx vitest run tests/unit/ui/manage-dashboard.test.tsx tests/unit/ui/image-mode-chooser.test.tsx`

Expected: FAIL because existing controls are direct links named `베스트 이미지 제작`

- [ ] **Step 6: 관리 화면의 두 진입점을 `ImageCreationEntry`로 교체**

메뉴의 짧은 표시는 `스토리`를 유지하고 접근 가능한 이름만 `이미지 제작`으로 변경한다. 본문 CTA 문구도 `이미지 제작`으로 변경한다.

- [ ] **Step 7: 공유 페이지의 모드 검증과 직접 접근 선택 화면 구현**

```tsx
export default async function SharePage({ params, searchParams }: {
  params: Promise<{ publicId: string }>;
  searchParams: Promise<{ mode?: string }>;
}) {
  const [{ publicId }, { mode: rawMode }] = await Promise.all([params, searchParams]);
  const mode = parseShareImageMode(rawMode);
  // 기존 관리 세션 검증 유지
  if (!mode) {
    return (
      <main className="share-shell">
        <header className="simple-header share-header">
          <Link aria-label="내 스케치북으로 돌아가기" className="header-icon-link" href={`/m/${publicId}`}>←</Link>
          <span className="header-title">이미지 제작</span>
          <span aria-hidden="true" className="header-balance" />
        </header>
        <ImageModeChooser dismissHref={`/m/${publicId}`} open publicId={publicId} />
      </main>
    );
  }
  // Task 5에서 ShareImageComposer 연결
}
```

`onClose`와 `triggerRef`는 관리 화면 트리거에서 사용한다. 직접 접근 모달은 `dismissHref`를 받아 닫기 동작을 관리 화면 링크로 렌더링한다. `onClose`와 `dismissHref`가 모두 없으면 개발 오류를 즉시 찾도록 닫기 버튼을 렌더링하지 않는다.

- [ ] **Step 8: 모달 스타일 구현**

`.image-mode-dialog`는 최대 650px 책 폭 안에서 너비 `min(100% - 32px, 520px)`를 사용한다. 두 모드 링크는 그림자 없이 1px 연필선, 8px 모서리, 최소 64px 터치 높이로 구성한다. 319px 이하에서도 텍스트가 가로로 넘치지 않게 한다.

- [ ] **Step 9: Task 2 테스트·린트 통과 확인**

Run: `npx vitest run tests/unit/ui/image-mode-chooser.test.tsx tests/unit/ui/manage-dashboard.test.tsx`

Run: `npx eslint 'src/app/m/[publicId]/ManageDashboard.tsx' 'src/app/m/[publicId]/share/ImageModeChooser.tsx' 'src/app/m/[publicId]/share/ImageCreationEntry.tsx' 'src/app/m/[publicId]/share/page.tsx'`

Expected: all PASS

- [ ] **Step 10: Task 2 커밋**

```powershell
git add -- 'src/app/m/[publicId]/ManageDashboard.tsx' 'src/app/m/[publicId]/share/ImageModeChooser.tsx' 'src/app/m/[publicId]/share/ImageCreationEntry.tsx' 'src/app/m/[publicId]/share/page.tsx' src/app/globals.css tests/unit/ui/image-mode-chooser.test.tsx tests/unit/ui/manage-dashboard.test.tsx
git commit -m "이미지 제작 유형 선택 진입 추가"
```

---

### Task 3: 공개 가능 그림 검색과 단일 선택

**Files:**
- Modify: `src/lib/share/share-image.ts`
- Create: `src/app/m/[publicId]/share/DrawingPicker.tsx`
- Create: `tests/unit/ui/drawing-picker.test.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Produces: `normalizeDrawingAuthorQuery(value: string): string`
- Produces: `filterShareDrawings(drawings: ShareDrawingOption[], query: string): ShareDrawingOption[]`
- Produces: controlled `DrawingPicker({ drawings, onSelect, selectedId })`
- Page contract: owner first, then only `VISIBLE && ACTIVE` friend drawings

- [ ] **Step 1: 이름 검색 순수 함수 실패 테스트 작성**

```ts
const drawings: ShareDrawingOption[] = [
  { authorName: '해비', bestRank: 1, createdAt: '2026-09-01T00:00:00.000Z', id: 'a', imageUrl: '/a', source: 'friend' },
  { authorName: '해비', bestRank: null, createdAt: '2026-09-02T00:00:00.000Z', id: 'b', imageUrl: '/b', source: 'friend' },
  { authorName: '다른 친구', bestRank: null, createdAt: '2026-09-03T00:00:00.000Z', id: 'c', imageUrl: '/c', source: 'friend' },
];

expect(filterShareDrawings(drawings, '  해비 ')).toEqual(drawings.slice(0, 2));
expect(filterShareDrawings(drawings, '')).toEqual([]);
expect(filterShareDrawings(drawings, '없는 이름')).toEqual([]);
```

- [ ] **Step 2: 검색 함수 부재 실패 확인**

Run: `npx vitest run tests/unit/share/share-image.test.ts`

Expected: FAIL because search functions are not exported

- [ ] **Step 3: 이름 정규화와 부분 검색 구현**

```ts
export function normalizeDrawingAuthorQuery(value: string): string {
  return value.trim().toLocaleLowerCase('ko-KR');
}

export function filterShareDrawings(
  drawings: ShareDrawingOption[],
  query: string,
): ShareDrawingOption[] {
  const normalized = normalizeDrawingAuthorQuery(query);
  if (!normalized) return [];
  return drawings.filter((drawing) => (
    drawing.source === 'friend'
    && normalizeDrawingAuthorQuery(drawing.authorName).includes(normalized)
  ));
}
```

- [ ] **Step 4: 그림 선택 컴포넌트 실패 테스트 작성**

```tsx
render(<DrawingPicker drawings={drawingsWithOwnerAndDuplicates} onSelect={onSelect} selectedId={null} />);

expect(screen.getByRole('button', { name: /내 그림 선택/ })).toBeVisible();
expect(screen.queryByRole('img', { name: /해비님의 그림/ })).not.toBeInTheDocument();
fireEvent.change(screen.getByRole('searchbox', { name: '그린 사람 이름' }), {
  target: { value: '해비' },
});
expect(screen.getAllByRole('button', { name: /해비님의 그림 선택/ })).toHaveLength(2);
fireEvent.click(screen.getAllByRole('button', { name: /해비님의 그림 선택/ })[1]);
expect(onSelect).toHaveBeenCalledWith('friend-b');
```

선택된 ID로 다시 렌더링해 `aria-pressed="true"`, `선택됨`, 검색어 변경 후 선택 요약 유지도 검증한다.

- [ ] **Step 5: 컴포넌트 부재 실패 확인**

Run: `npx vitest run tests/unit/ui/drawing-picker.test.tsx`

Expected: FAIL with unresolved component

- [ ] **Step 6: `DrawingPicker` 구현**

```tsx
interface DrawingPickerProps {
  drawings: ShareDrawingOption[];
  onSelect: (drawingId: string) => void;
  selectedId: string | null;
}
```

- 입력은 `type="search"`, 라벨은 `그린 사람 이름`, placeholder는 `그린 사람 이름을 입력해 주세요`로 한다.
- owner 카드는 query와 무관하게 맨 위에 둔다.
- query가 비면 `이름을 입력하면 공개된 그림을 찾아드려요.`를 표시한다.
- 결과가 0개면 `{query} 이름으로 공개된 그림을 찾지 못했어요.`를 표시한다.
- 결과 버튼은 `aria-pressed`, 이미지, 이름, `formatTimeAgo(new Date(createdAt))`, 선택됨 텍스트를 가진다.
- selected ID가 현재 결과에 없으면 `현재 선택` 영역에 해당 카드 한 장을 유지한다.

- [ ] **Step 7: 서버 페이지의 DTO 필터 실패 테스트 추가**

페이지 데이터 조립을 독립적으로 검증하도록 `buildFriendShareDrawingOptions` 순수 함수를 `share-image.ts`에 둔다.

```ts
export function buildFriendShareDrawingOptions(
  publicId: string,
  drawings: Drawing[],
): ShareDrawingOption[] {
  return drawings
    .filter((drawing) => drawing.status === 'VISIBLE' && drawing.moderationStatus === 'ACTIVE')
    .map((drawing) => ({
      authorName: drawing.authorName,
      bestRank: drawing.bestRank,
      createdAt: drawing.createdAt.toISOString(),
      id: drawing.id,
      imageUrl: `/api/manage/${publicId}/drawings/${drawing.id}/image`,
      source: 'friend' as const,
    }));
}
```

테스트 데이터에 VISIBLE/ACTIVE, HIDDEN/ACTIVE, VISIBLE/BLOCKED를 넣고 첫 항목만 반환되는지 검증한다.

- [ ] **Step 8: owner DTO 계약을 순수 함수 테스트에 고정**

owner DTO는 Task 5의 페이지 연결에서 다음 값을 사용한다. Task 3에서는 이 객체를 `buildOwnerShareDrawingOption` 함수로 만들고 owner path가 없으면 `null`을 반환하는 테스트를 작성한다.

```ts
export function buildOwnerShareDrawingOption(
  publicId: string,
  sketchbook: Pick<Sketchbook, 'name' | 'ownerBestRank' | 'ownerDrawingPath'>,
): ShareDrawingOption | null {
  return sketchbook.ownerDrawingPath ? {
    authorName: sketchbook.name,
    bestRank: sketchbook.ownerBestRank ?? null,
    createdAt: null,
    id: 'owner',
    imageUrl: `/api/manage/${publicId}/owner/image`,
    source: 'owner',
  } : null;
}
```

- [ ] **Step 9: Task 3 테스트·린트 통과 확인**

Run: `npx vitest run tests/unit/share/share-image.test.ts tests/unit/ui/drawing-picker.test.tsx`

Run: `npx eslint 'src/app/m/[publicId]/share/DrawingPicker.tsx' src/lib/share/share-image.ts`

Expected: all PASS

- [ ] **Step 10: Task 3 커밋**

```powershell
git add -- src/lib/share/share-image.ts 'src/app/m/[publicId]/share/DrawingPicker.tsx' src/app/globals.css tests/unit/share/share-image.test.ts tests/unit/ui/drawing-picker.test.tsx
git commit -m "공유 그림 이름 검색과 단일 선택 추가"
```

---

### Task 4: 정사각형 출력 레이아웃과 contain 계산

**Files:**
- Create: `src/lib/share/single-image-layout.ts`
- Create: `tests/unit/share/single-image-layout.test.ts`

**Interfaces:**
- Produces: `SINGLE_IMAGE_WIDTH = 1080`, `SINGLE_IMAGE_HEIGHT = 1080`
- Produces: `singleImageLayout` with exact title, frame, author, watermark positions
- Produces: `fitContainedRect(sourceWidth, sourceHeight, target): Rect`

- [ ] **Step 1: contain 계산 실패 테스트 작성**

```ts
it('세로 그림을 정사각형 프레임 안에 자르지 않고 맞춘다', () => {
  expect(fitContainedRect(800, 1200, { x: 150, y: 180, width: 780, height: 720 }))
    .toEqual({ x: 300, y: 180, width: 480, height: 720 });
});

it('가로 그림을 프레임 중앙에 맞춘다', () => {
  expect(fitContainedRect(1200, 800, { x: 150, y: 180, width: 780, height: 720 }))
    .toEqual({ x: 150, y: 280, width: 780, height: 520 });
});
```

- [ ] **Step 2: 모듈 부재 실패 확인**

Run: `npx vitest run tests/unit/share/single-image-layout.test.ts`

Expected: FAIL with unresolved import

- [ ] **Step 3: 레이아웃 상수와 계산 구현**

```ts
export const SINGLE_IMAGE_WIDTH = 1080;
export const SINGLE_IMAGE_HEIGHT = 1080;

export interface Rect {
  height: number;
  width: number;
  x: number;
  y: number;
}

export const singleImageLayout = {
  authorY: 946,
  frame: { height: 720, width: 780, x: 150, y: 180 },
  titleY: 112,
  watermark: { height: 60, width: 360, x: 360, y: 994 },
} as const;

export function fitContainedRect(
  sourceWidth: number,
  sourceHeight: number,
  target: Rect,
): Rect {
  const scale = Math.min(target.width / sourceWidth, target.height / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  return {
    height,
    width,
    x: target.x + (target.width - width) / 2,
    y: target.y + (target.height - height) / 2,
  };
}
```

- [ ] **Step 4: 유효하지 않은 이미지 크기 방어 테스트와 구현**

```ts
expect(() => fitContainedRect(0, 1200, singleImageLayout.frame))
  .toThrow('이미지 크기를 확인하지 못했습니다.');
```

두 source 값 중 하나라도 0 이하이거나 유한수가 아니면 동일 오류를 던진다.

- [ ] **Step 5: Task 4 테스트·타입 검사 통과 확인**

Run: `npx vitest run tests/unit/share/single-image-layout.test.ts`

Run: `npx tsc --noEmit`

Expected: all PASS

- [ ] **Step 6: Task 4 커밋**

```powershell
git add -- src/lib/share/single-image-layout.ts tests/unit/share/single-image-layout.test.ts
git commit -m "정사각형 공유 이미지 레이아웃 추가"
```

---

### Task 5: 공통 제작기와 두 모드 미리보기·PNG 출력

**Files:**
- Move: `src/app/m/[publicId]/share/StoryImageComposer.tsx` → `src/app/m/[publicId]/share/ShareImageComposer.tsx`
- Move: `src/app/m/[publicId]/share/StoryImageMaker.tsx` → `src/app/m/[publicId]/share/ShareImageMaker.tsx`
- Create: `src/app/m/[publicId]/share/SingleImagePreview.tsx`
- Create: `src/app/m/[publicId]/share/BestImagePreview.tsx`
- Move: `tests/unit/ui/story-image-composer.test.tsx` → `tests/unit/ui/share-image-composer.test.tsx`
- Move: `tests/unit/ui/story-image-maker.test.tsx` → `tests/unit/ui/share-image-maker.test.tsx`
- Modify: `src/app/m/[publicId]/share/page.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Consumes: `ShareImageMode`, `ShareDrawingOption`, `singleImageLayout`, existing `storySlots`
- Produces: `ShareImageComposerProps`
- Produces: `ShareImageMakerProps`
- Preserves: BEST Canvas text, slots, CTA, URL, watermark behavior

- [ ] **Step 1: Composer의 한 장 모드 실패 테스트 작성**

```tsx
render(
  <ShareImageComposer
    bestHeading="친구들이 그린 내 모습"
    drawings={drawings}
    initialWatermarkFree={false}
    mode="single"
    name="내 이름"
    publicId="book-1"
    publicUrl="/s/book-1"
    singleHeading="친구가 그린 나"
  />,
);

expect(screen.getByRole('textbox', { name: '이미지 제목' })).toHaveValue('친구가 그린 나');
expect(screen.getByLabelText('정사각형 공유 이미지 미리보기')).toHaveTextContent('그림을 선택해 주세요');
expect(screen.getByRole('button', { name: 'PNG로 저장하기' })).toBeDisabled();
fireEvent.change(screen.getByRole('searchbox', { name: '그린 사람 이름' }), { target: { value: '해비' } });
fireEvent.click(screen.getByRole('button', { name: /해비님의 그림 선택/ }));
expect(screen.getByLabelText('정사각형 공유 이미지 미리보기')).toHaveTextContent('그린 사람 · 해비');
expect(screen.getByRole('button', { name: 'PNG로 저장하기' })).toBeEnabled();
```

- [ ] **Step 2: BEST 모드 회귀와 제목 요청 필드 테스트 작성**

BEST 모드는 기존 `BEST 4`, `순위 정하러 가기`, CTA, URL, 비어 있는 순위 표시를 유지한다. 제목 저장 요청은 모드별로 아래 body를 사용한다.

```ts
expect(fetchMock).toHaveBeenCalledWith('/api/manage/book-1/sketchbook', expect.objectContaining({
  body: JSON.stringify({ singleStoryHeading: '한 장의 추억' }),
}));

expect(fetchMock).toHaveBeenCalledWith('/api/manage/book-1/sketchbook', expect.objectContaining({
  body: JSON.stringify({ storyHeading: '우리들의 베스트' }),
}));
```

- [ ] **Step 3: 이동 전 테스트가 새 인터페이스 부재로 실패하는지 확인**

Run: `npx vitest run tests/unit/ui/share-image-composer.test.tsx`

Expected: FAIL with unresolved `ShareImageComposer`

- [ ] **Step 4: BEST 미리보기를 독립 컴포넌트로 이동**

```tsx
interface BestImagePreviewProps {
  drawings: ShareDrawingOption[];
  heading: string;
  publicUrl: string;
  themeBackgroundImage: string;
  watermarkFree: boolean;
}
```

기존 JSX와 백분율 위치 계산을 그대로 옮긴다. BEST 배열은 `bestRank !== null`인 owner/friend DTO에서 rank로 찾는다. 접근 가능한 이름은 `BEST 공유 이미지 미리보기`로 변경한다.

- [ ] **Step 5: 한 장 이미지 미리보기 구현**

```tsx
interface SingleImagePreviewProps {
  drawing: ShareDrawingOption | null;
  heading: string;
  name: string;
  themeBackgroundImage: string;
  watermarkFree: boolean;
}
```

- wrapper는 `aspect-ratio: 1`, `aria-label="정사각형 공유 이미지 미리보기"`
- heading, 흰 종이 frame, 선택 이미지, author copy, 선택적 watermark를 순서대로 렌더링한다.
- owner author copy는 `${name} · 내 그림`, friend는 `그린 사람 · ${drawing.authorName}`이다.
- 선택 전 frame에 `그림을 선택해 주세요`를 표시한다.

- [ ] **Step 6: `ShareImageComposer` 구현**

```ts
interface ShareImageComposerProps {
  bestHeading?: string;
  drawings: ShareDrawingOption[];
  initialWatermarkFree: boolean;
  mode: ShareImageMode;
  name: string;
  publicId: string;
  publicUrl: string;
  singleHeading?: string;
}
```

- 초기 heading은 mode에 맞는 prop과 기본 상수에서 결정한다.
- single 선택 ID는 `string | null` state로 관리한다.
- mode가 best일 때는 DrawingPicker를 렌더링하지 않고 순위 관리 링크를 표시한다.
- title fetch payload와 응답 key는 `mode === 'single' ? 'singleStoryHeading' : 'storyHeading'`으로 결정한다.
- theme picker는 두 모드에서 공통으로 유지한다.
- 미리보기 아래 출력 메타는 각각 `1080 × 1080 · 1:1 공유 이미지`, `1080 × 1440 · 3:4 공유 이미지`다.

- [ ] **Step 7: Maker의 두 Canvas 출력 실패 테스트 작성**

Maker 인터페이스를 다음으로 고정한다.

```ts
interface ShareImageMakerProps {
  backgroundImage: string;
  drawing: ShareDrawingOption | null;
  drawings: ShareDrawingOption[];
  heading: string;
  mode: ShareImageMode;
  name: string;
  publicUrl: string;
  watermarkFree: boolean;
}
```

```tsx
render(<ShareImageMaker
  backgroundImage="/story/background.webp"
  drawing={friendDrawing}
  drawings={drawings}
  heading="한 장의 추억"
  mode="single"
  name="내 이름"
  publicUrl="/s/book-1"
  watermarkFree
/>);

fireEvent.click(screen.getByRole('button', { name: 'PNG로 저장하기' }));
await screen.findByText('1080 × 1080 PNG를 저장했어요.');
expect(createdCanvas.width).toBe(1080);
expect(createdCanvas.height).toBe(1080);
expect(downloadAnchor.download).toBe('내 이름-sketchbook-single.png');
expect(context.fillText).toHaveBeenCalledWith('그린 사람 · 해비', 540, 946);
```

BEST 사례는 1080×1440, `내 이름-sketchbook-best.png`, 기존 CTA와 URL draw call을 검증한다.

- [ ] **Step 8: `ShareImageMaker` 구현**

공통 단계는 canvas 생성, font ready, 배경 테마, 제목, 워터마크, 다운로드다. 모드별 그림 영역만 함수로 분리한다.

```ts
function drawSingleComposition(
  context: CanvasRenderingContext2D,
  drawing: ShareDrawingOption,
  image: HTMLImageElement,
  name: string,
) {
  const fitted = fitContainedRect(
    image.naturalWidth,
    image.naturalHeight,
    singleImageLayout.frame,
  );
  context.fillStyle = '#ffffff';
  context.fillRect(
    singleImageLayout.frame.x,
    singleImageLayout.frame.y,
    singleImageLayout.frame.width,
    singleImageLayout.frame.height,
  );
  context.drawImage(image, fitted.x, fitted.y, fitted.width, fitted.height);
  const author = drawing.source === 'owner'
    ? `${name} · 내 그림`
    : `그린 사람 · ${drawing.authorName}`;
  context.fillText(author, 540, singleImageLayout.authorY);
}
```

single인데 drawing이 없으면 버튼을 disabled로 렌더링하고 `download` 함수도 즉시 return한다. 이미지 로드 오류 문구는 `그림을 불러오지 못했습니다.`로 일반화한다.

- [ ] **Step 9: 페이지에서 모드와 두 제목·DTO 연결**

페이지에서 공개 가능한 friend와 owner DTO를 조합한다.

```ts
const drawingOptions = [
  buildOwnerShareDrawingOption(publicId, sketchbook),
  ...buildFriendShareDrawingOptions(publicId, drawings),
].filter((drawing): drawing is ShareDrawingOption => drawing !== null);
```

```tsx
<ShareImageComposer
  bestHeading={sketchbook.storyHeading}
  drawings={drawingOptions}
  initialWatermarkFree={sketchbook.entitlements.watermarkFree}
  mode={mode}
  name={sketchbook.name}
  publicId={publicId}
  publicUrl={publicPath}
  singleHeading={sketchbook.singleStoryHeading}
/>
```

`mode=best`에서만 `순위 정하러 가기`를 표시하고, 두 모드 모두 `제작 유형 바꾸기` 버튼으로 chooser를 연다.

- [ ] **Step 10: 한 장 미리보기·검색·출력 스타일 구현**

- page section 간격은 20–24px로 유지한다.
- `.single-image-preview`는 1:1, 흰 frame은 전체 폭의 약 72%, 이미지는 `object-fit: contain`이다.
- picker 결과는 320px 이상 2열, 319px 이하 1열이다.
- 선택 상태는 1px accent 테두리, check icon, `선택됨` 텍스트를 함께 쓴다.
- 새 스타일에 box-shadow, 8px 초과 radius, 700 초과 font-weight를 사용하지 않는다.

- [ ] **Step 11: Task 5 관련 테스트·타입·린트 통과 확인**

Run: `npx vitest run tests/unit/ui/share-image-composer.test.tsx tests/unit/ui/share-image-maker.test.tsx tests/unit/ui/drawing-picker.test.tsx tests/unit/share/single-image-layout.test.ts`

Run: `npx tsc --noEmit`

Run: `npm run lint`

Expected: all PASS

- [ ] **Step 12: Task 5 커밋**

```powershell
git add -- 'src/app/m/[publicId]/share' src/app/globals.css tests/unit/ui/share-image-composer.test.tsx tests/unit/ui/share-image-maker.test.tsx tests/unit/ui/drawing-picker.test.tsx
git commit -m "단일 그림과 BEST 공유 이미지 제작 통합"
```

---

### Task 6: 결제 문구 일반화와 모바일 전체 흐름 검증

**Files:**
- Modify: `src/app/m/[publicId]/share/WatermarkPurchaseButton.tsx`
- Modify: `tests/unit/ui/watermark-purchase-button.test.tsx`
- Modify: `tests/e2e/sketchbook-flow.spec.ts`
- Modify: `tests/e2e/mobile-layout.spec.ts`
- Modify: `README.md`

**Interfaces:**
- Consumes: existing `WATERMARK_FREE`, purchase route, PayApp redirect
- Produces: both modes use the same entitlement and purchase dialog
- E2E contract: management → chooser → single export preparation → best regression

- [ ] **Step 1: 결제 문구와 상태 유지 실패 테스트 작성**

```tsx
render(<WatermarkPurchaseButton publicId="book-1" />);
fireEvent.click(screen.getByRole('button', { name: '워터마크 없이 저장하기 · 1,000원' }));
expect(screen.getByRole('dialog', { name: '워터마크 없이 저장하기' }))
  .toHaveTextContent('공유 이미지에서 워터마크가 빠져요.');
expect(screen.queryByText('스토리 이미지')).not.toBeInTheDocument();
```

Composer 테스트에서는 제목·검색·선택·테마를 바꾼 뒤 결제 모달을 열고 닫아 네 상태가 유지되는지 검증한다.

- [ ] **Step 2: 기존 문구로 인한 실패 확인**

Run: `npx vitest run tests/unit/ui/watermark-purchase-button.test.tsx tests/unit/ui/share-image-composer.test.tsx`

Expected: FAIL because the dialog still says `스토리 이미지`

- [ ] **Step 3: 결제 설명을 공유 이미지로 일반화**

문구를 다음으로 고정한다.

```tsx
<p className="purchase-dialog-copy">
  공유 이미지를 워터마크 없이 저장하고 싶나요? 1,000원으로 모든 이미지 제작에서 워터마크가 빠져요.
</p>
```

상품 ID, 금액, 동의, 요청 ID, 오류 처리, PayApp 이동 코드는 변경하지 않는다.

- [ ] **Step 4: 단일 이미지 E2E 시나리오 작성**

기존 전체 모바일 흐름에서 친구 그림을 만든 뒤 다음 단계를 추가한다.

```ts
await managerPage.getByRole('button', { name: '이미지 제작' }).click();
const chooser = managerPage.getByRole('dialog', { name: '이미지 제작 방식 선택' });
await chooser.getByRole('link', { name: /그림 하나 제작하기/ }).click();
await expect(managerPage).toHaveURL(/\/share\?mode=single$/);
await managerPage.getByRole('textbox', { name: '이미지 제목' }).fill('한 장의 소중한 기억');
await managerPage.getByRole('button', { name: '제목 저장하기' }).click();
await managerPage.getByRole('searchbox', { name: '그린 사람 이름' }).fill('모바일 친구');
await managerPage.getByRole('button', { name: /모바일 친구님의 그림 선택/ }).click();
const singlePreview = managerPage.getByLabel('정사각형 공유 이미지 미리보기');
await expect(singlePreview).toContainText('한 장의 소중한 기억');
await expect(singlePreview).toContainText('그린 사람 · 모바일 친구');
await expect(managerPage.getByText('1080 × 1080 · 1:1 공유 이미지')).toBeVisible();
await expect(managerPage.getByRole('button', { name: 'PNG로 저장하기' })).toBeEnabled();
```

다운로드 클릭은 Playwright `page.waitForEvent('download')`로 받고 파일명이 `-sketchbook-single.png`로 끝나는지 검증한다.

- [ ] **Step 5: 동일 이름 복수 결과 E2E 데이터 추가**

같은 스케치북에 `모바일 친구` 이름으로 그림을 두 장 제출하고 검색 결과 버튼이 2개인지 검증한다. 두 번째 항목을 선택한 뒤 미리보기의 이미지 URL이 두 번째 drawing ID를 포함하는지 확인한다. 제출 제한 때문에 동일 IP를 사용할 수 없으면 각 context에 서로 다른 `x-forwarded-for` 값을 사용한다.

- [ ] **Step 6: BEST 기존 흐름을 새 진입 계약으로 수정**

기존 직접 `베스트 이미지 제작` 링크 클릭을 다음으로 교체한다.

```ts
await managerPage.getByRole('button', { name: '이미지 제작' }).click();
await managerPage.getByRole('dialog', { name: '이미지 제작 방식 선택' })
  .getByRole('link', { name: /BEST 이미지 제작하기/ })
  .click();
await expect(managerPage).toHaveURL(/\/share\?mode=best$/);
```

기존 BEST 1 이미지, 제목 저장, 워터마크, 결제 팝업, PNG 버튼 검증은 유지한다.

- [ ] **Step 7: 모바일 레이아웃 검증 추가**

`mobile-layout.spec.ts`의 320×568, 390×667 반복 대상에 다음 URL을 추가한다.

- `/m/{fixturePublicId}/share?mode=single`
- `/m/{fixturePublicId}/share?mode=best`

관리 세션 fixture를 재사용하고 `document.documentElement.scrollWidth <= viewport.width`를 검증한다. chooser dialog가 열린 상태에서도 동일 검증을 수행한다.

- [ ] **Step 8: README 기능 설명 갱신**

기존 BEST 이미지 설명을 다음 계약으로 바꾼다.

- 관리자는 한 장짜리 1:1 공유 이미지와 BEST 4 공유 이미지를 제작할 수 있음
- 유형별 제목 저장, 이름 검색, 공통 워터마크 제거 권한
- 실제 결제 후 제작 페이지 재진입 시 제목과 권한 복원, 그림 선택과 테마는 초기화

- [ ] **Step 9: 변경 범위 단위 테스트 통과 확인**

Run: `npx vitest run tests/unit/share/share-image.test.ts tests/unit/share/single-image-layout.test.ts tests/unit/ui/image-mode-chooser.test.tsx tests/unit/ui/drawing-picker.test.tsx tests/unit/ui/share-image-composer.test.tsx tests/unit/ui/share-image-maker.test.tsx tests/unit/ui/watermark-purchase-button.test.tsx tests/unit/ui/manage-dashboard.test.tsx tests/unit/api/manage-sketchbook-delete.test.ts`

Expected: all PASS

- [ ] **Step 10: 전체 정적·단위 검증**

Run: `npm test`

Expected: all non-emulator tests PASS; emulator-only tests may remain explicitly skipped

Run: `npm run lint`

Expected: exit 0

Run: `npx tsc --noEmit`

Expected: exit 0

Run: `npm run build`

Expected: Next.js production build exit 0

- [ ] **Step 11: 전체 모바일 E2E 검증**

기존 3000 포트가 사용자 개발 서버에 사용 중이면 종료하지 않고 다음 명령으로 분리한다.

```powershell
$env:PLAYWRIGHT_BASE_URL='http://127.0.0.1:3002'
npm run test:e2e -- --project=mobile-chrome
```

Expected: all mobile-chrome tests PASS, including single and BEST image creation

- [ ] **Step 12: Impeccable 정적 감사 1회 실행**

```powershell
node 'C:\Users\박도영\.agents\skills\impeccable\scripts\detect.mjs' --json 'src/app/m/[publicId]/share' 'src/app/m/[publicId]/ManageDashboard.tsx' src/app/globals.css
```

Expected: 새 차단급 finding 0개. 기존 디자인 시스템 advisory는 규칙·파일별로 집계해 보고한다.

- [ ] **Step 13: 자동 생성 설정 흔적 복원**

`git diff -- next-env.d.ts tsconfig.json`을 확인한다. 테스트가 추가한 `.superpowers/.../.next-task10` include만 `apply_patch`로 제거하고, 작업 시작 전 존재한 `next-env.d.ts`의 `.next/dev/types` 변경은 그대로 남긴다.

- [ ] **Step 14: Task 6 커밋**

```powershell
git add -- 'src/app/m/[publicId]/share/WatermarkPurchaseButton.tsx' tests/unit/ui/watermark-purchase-button.test.tsx tests/unit/ui/share-image-composer.test.tsx tests/e2e/sketchbook-flow.spec.ts tests/e2e/mobile-layout.spec.ts README.md
git commit -m "공유 이미지 결제 문구와 모바일 흐름 정비"
```

- [ ] **Step 15: 최종 Git 상태 확인**

Run: `git diff --check`

Run: `git status --short`

Expected: 구현 파일은 모두 커밋됨. 작업 시작 전부터 존재한 `M next-env.d.ts`만 남음.
