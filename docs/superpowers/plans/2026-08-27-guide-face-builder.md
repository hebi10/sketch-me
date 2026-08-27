# Guide Face Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 모바일 그림판의 `가이드` 탭에서 얼굴 파츠를 조합하고, 저장되지 않는 연한 십자선을 보면서 그린 뒤 얼굴 조합과 손그림만 720×720 WebP로 저장할 수 있게 한다.

**Architecture:** 얼굴 파츠 목록과 선택 상태 계산은 순수 TypeScript 모듈로, 파츠 선택 UI는 별도 React 컴포넌트로 분리한다. `SketchEditor`는 참고 사진·얼굴 바탕·자유 그리기·십자선의 네 DOM 레이어를 조정하고, 전용 합성 함수가 흰 배경·얼굴 바탕·자유 그리기만 오프스크린 캔버스에 그려 기존 제출 API로 전달한다.

**Tech Stack:** Next.js 16.3.2, React 19.2.4, TypeScript 5.8, Canvas 2D, Vitest, Testing Library, Playwright, Sharp, built-in image generation

**Spec:** `docs/superpowers/specs/2026-08-27-guide-face-builder-design.md`

## Global Constraints

- 모든 편집 화면은 모바일 전용이며 너비 320px부터 최대 650px까지 가로 스크롤 없이 동작해야 한다.
- 얼굴 파츠와 자유 그리기만 최종 720×720 WebP에 포함하고 참고 사진과 십자선은 포함하지 않는다.
- 얼굴 선택과 십자선 설정은 현재 편집 세션에서만 유지하며 Firebase 스키마와 API는 변경하지 않는다.
- 얼굴 파츠를 바꿔도 자유 그리기 캔버스와 실행 취소·다시 실행 기록을 변경하지 않는다.
- `전체 삭제`는 손그림만 지우고 `얼굴 초기화`는 얼굴 조합만 지운다.
- 모든 터치 컨트롤은 최소 44×44px이며 선택 상태를 색상에만 의존해 표시하지 않는다.
- 새 이미지 파츠는 SVG로 만들지 않고 built-in image generation으로 제작한 투명 래스터 자산을 사용한다.
- 기존 미커밋 파일 `next-env.d.ts`, `src/app/create/CreateSketchbookForm.tsx`의 사용자 변경을 보존하고 이번 작업 커밋에 포함하지 않는다.

---

## File Structure

- Create: `src/components/sketch/face-parts.ts` — 카테고리, 선택 타입, 자산 manifest, 랜덤 조합과 선택 자산 순서를 담당한다.
- Create: `src/components/sketch/canvas-composition.ts` — 선택된 파츠를 로드하고 흰 배경·얼굴·손그림 순서로 WebP를 합성한다.
- Create: `src/components/sketch/FaceBuilderControls.tsx` — 얼굴 카테고리와 파츠 선택, 랜덤, 초기화, 십자선 토글 UI를 담당한다.
- Modify: `src/components/sketch/SketchEditor.tsx` — 네 레이어 상태, `가이드` 탭, 얼굴 조합, 저장·나가기 흐름을 연결한다.
- Modify: `src/app/globals.css` — 얼굴 바탕, 십자선, 가이드 하위 탭과 파츠 선택기의 모바일 스타일을 정의한다.
- Create: `scripts/normalize-face-part.mjs` — 생성된 투명 이미지를 720×720 WebP로 정규화한다.
- Create: `public/guides/face-parts/{face,hair,eyes,mouth,accessory}/*.webp` — 최종 파츠 29개를 저장한다.
- Create: `tests/unit/sketch/face-parts.test.ts` — 선택 순서와 랜덤 조합을 검증한다.
- Create: `tests/unit/sketch/face-part-assets.test.ts` — 모든 manifest 자산의 존재, WebP, 720×720, 알파 채널을 검증한다.
- Create: `tests/unit/sketch/canvas-composition.test.ts` — 최종 합성 순서와 제외 레이어를 검증한다.
- Create: `tests/unit/ui/sketch-editor-guide.test.tsx` — 가이드 탭, 얼굴 선택, 십자선, 독립 초기화를 검증한다.
- Modify: `tests/unit/ui/sketch-editor-opacity.test.tsx` — `참고사진`에서 `가이드 > 사진 참고`로 바뀐 경로를 검증한다.
- Modify: `tests/unit/ui/sketch-editor-fullscreen.test.tsx` — 얼굴만 있는 상태의 확인 및 나가기 경고를 검증한다.
- Modify: `tests/e2e/sketchbook-flow.spec.ts` — 모바일 생성·친구 참여 흐름에서 새 가이드와 얼굴 저장을 검증한다.

---

### Task 1: 얼굴 파츠 도메인 모델

**Files:**
- Create: `src/components/sketch/face-parts.ts`
- Create: `tests/unit/sketch/face-parts.test.ts`

**Interfaces:**
- Produces: `FacePartCategory`, `FaceSelection`, `FacePartOption`, `EMPTY_FACE_SELECTION`, `FACE_PARTS`, `selectFacePart`, `selectedFacePartSources`, `hasFaceSelection`, `randomFaceSelection`.
- Consumes: 없음.

- [ ] **Step 1: 선택 상태와 합성 순서를 고정하는 실패 테스트 작성**

```ts
import {
  EMPTY_FACE_SELECTION,
  FACE_PARTS,
  hasFaceSelection,
  randomFaceSelection,
  selectFacePart,
  selectedFacePartSources,
} from '@/components/sketch/face-parts';

describe('얼굴 파츠 모델', () => {
  it('얼굴형, 머리, 눈, 입, 소품 순서로 선택 자산을 반환한다', () => {
    const selection = {
      face: FACE_PARTS.face[0].id,
      hair: FACE_PARTS.hair[0].id,
      eyes: FACE_PARTS.eyes[0].id,
      mouth: FACE_PARTS.mouth[0].id,
      accessory: FACE_PARTS.accessory[0].id,
    };
    expect(selectedFacePartSources(selection)).toEqual([
      FACE_PARTS.face[0].src,
      FACE_PARTS.hair[0].src,
      FACE_PARTS.eyes[0].src,
      FACE_PARTS.mouth[0].src,
      FACE_PARTS.accessory[0].src,
    ]);
  });

  it('비어 있는 선택과 단일 선택을 구분한다', () => {
    expect(hasFaceSelection(EMPTY_FACE_SELECTION)).toBe(false);
    expect(hasFaceSelection(selectFacePart(EMPTY_FACE_SELECTION, 'eyes', FACE_PARTS.eyes[0].id))).toBe(true);
  });

  it('주입한 난수로 모든 카테고리를 재현 가능하게 조합한다', () => {
    const selection = randomFaceSelection(() => 0);
    expect(selection).toEqual({
      face: FACE_PARTS.face[0].id,
      hair: FACE_PARTS.hair[0].id,
      eyes: FACE_PARTS.eyes[0].id,
      mouth: FACE_PARTS.mouth[0].id,
      accessory: FACE_PARTS.accessory[0].id,
    });
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- tests/unit/sketch/face-parts.test.ts`

Expected: FAIL because `@/components/sketch/face-parts` does not exist.

- [ ] **Step 3: 타입과 manifest, 순수 선택 함수 구현**

```ts
export const FACE_PART_CATEGORIES = ['face', 'hair', 'eyes', 'mouth', 'accessory'] as const;
export type FacePartCategory = (typeof FACE_PART_CATEGORIES)[number];
export type FaceSelection = Record<FacePartCategory, string | null>;
export interface FacePartOption { id: string; label: string; src: string }

export const EMPTY_FACE_SELECTION: FaceSelection = {
  face: null, hair: null, eyes: null, mouth: null, accessory: null,
};

export const FACE_PARTS: Record<FacePartCategory, readonly FacePartOption[]> = {
  face: [
    { id: 'oval', label: '갸름한 얼굴', src: '/guides/face-parts/face/oval.webp' },
    { id: 'round', label: '둥근 얼굴', src: '/guides/face-parts/face/round.webp' },
    { id: 'angular', label: '각진 얼굴', src: '/guides/face-parts/face/angular.webp' },
  ],
  hair: [
    { id: 'short', label: '짧은 머리', src: '/guides/face-parts/hair/short.webp' },
    { id: 'side-part', label: '가르마 머리', src: '/guides/face-parts/hair/side-part.webp' },
    { id: 'wavy', label: '웨이브 머리', src: '/guides/face-parts/hair/wavy.webp' },
    { id: 'curly', label: '곱슬머리', src: '/guides/face-parts/hair/curly.webp' },
    { id: 'buzz', label: '아주 짧은 머리', src: '/guides/face-parts/hair/buzz.webp' },
    { id: 'bob', label: '단발머리', src: '/guides/face-parts/hair/bob.webp' },
    { id: 'long', label: '긴 머리', src: '/guides/face-parts/hair/long.webp' },
    { id: 'tied', label: '묶은 머리', src: '/guides/face-parts/hair/tied.webp' },
  ],
  eyes: [
    { id: 'gentle', label: '부드러운 눈', src: '/guides/face-parts/eyes/gentle.webp' },
    { id: 'round', label: '동그란 눈', src: '/guides/face-parts/eyes/round.webp' },
    { id: 'smile', label: '웃는 눈', src: '/guides/face-parts/eyes/smile.webp' },
    { id: 'sharp', label: '또렷한 눈', src: '/guides/face-parts/eyes/sharp.webp' },
    { id: 'sleepy', label: '편안한 눈', src: '/guides/face-parts/eyes/sleepy.webp' },
    { id: 'bright', label: '반짝이는 눈', src: '/guides/face-parts/eyes/bright.webp' },
  ],
  mouth: [
    { id: 'soft-smile', label: '잔잔한 미소', src: '/guides/face-parts/mouth/soft-smile.webp' },
    { id: 'wide-smile', label: '활짝 웃는 입', src: '/guides/face-parts/mouth/wide-smile.webp' },
    { id: 'small-smile', label: '작은 미소', src: '/guides/face-parts/mouth/small-smile.webp' },
    { id: 'neutral', label: '다문 입', src: '/guides/face-parts/mouth/neutral.webp' },
    { id: 'open-smile', label: '살짝 열린 입', src: '/guides/face-parts/mouth/open-smile.webp' },
    { id: 'pout', label: '새침한 입', src: '/guides/face-parts/mouth/pout.webp' },
  ],
  accessory: [
    { id: 'round-glasses', label: '동그란 안경', src: '/guides/face-parts/accessory/round-glasses.webp' },
    { id: 'square-glasses', label: '네모 안경', src: '/guides/face-parts/accessory/square-glasses.webp' },
    { id: 'freckles', label: '주근깨', src: '/guides/face-parts/accessory/freckles.webp' },
    { id: 'bandage', label: '작은 반창고', src: '/guides/face-parts/accessory/bandage.webp' },
    { id: 'earrings', label: '귀걸이', src: '/guides/face-parts/accessory/earrings.webp' },
    { id: 'hairpin', label: '머리핀', src: '/guides/face-parts/accessory/hairpin.webp' },
  ],
};
```

Implement `selectFacePart` as an immutable category replacement, `hasFaceSelection` with `FACE_PART_CATEGORIES.some`, `selectedFacePartSources` in category order, and `randomFaceSelection(random = Math.random)` with `Math.floor(random() * options.length)`.

- [ ] **Step 4: 단위 테스트 통과 확인**

Run: `npm test -- tests/unit/sketch/face-parts.test.ts`

Expected: PASS, 3 tests.

- [ ] **Step 5: 커밋**

```bash
git add src/components/sketch/face-parts.ts tests/unit/sketch/face-parts.test.ts
git commit -m "feat: define sketch face parts"
```

---

### Task 2: 투명 얼굴 파츠 이미지 제작과 검증

**Files:**
- Create: `scripts/normalize-face-part.mjs`
- Create: `public/guides/face-parts/face/*.webp`
- Create: `public/guides/face-parts/hair/*.webp`
- Create: `public/guides/face-parts/eyes/*.webp`
- Create: `public/guides/face-parts/mouth/*.webp`
- Create: `public/guides/face-parts/accessory/*.webp`
- Create: `tests/unit/sketch/face-part-assets.test.ts`

**Interfaces:**
- Consumes: `FACE_PARTS` from Task 1.
- Produces: 각 `FacePartOption.src`에서 읽을 수 있는 720×720 transparent WebP 29개.

- [ ] **Step 1: manifest의 모든 자산을 검사하는 실패 테스트 작성**

```ts
import path from 'node:path';
import { access, stat } from 'node:fs/promises';
import sharp from 'sharp';
import { FACE_PARTS } from '@/components/sketch/face-parts';

describe('얼굴 파츠 이미지', () => {
  it('모든 자산이 720 정사각형 투명 WebP다', async () => {
    for (const option of Object.values(FACE_PARTS).flat()) {
      const file = path.join(process.cwd(), 'public', option.src.replace(/^\//, ''));
      await access(file);
      const metadata = await sharp(file).metadata();
      expect(metadata).toMatchObject({ format: 'webp', width: 720, height: 720, hasAlpha: true });
      expect((await sharp(file).stats()).isOpaque).toBe(false);
      expect((await stat(file)).size).toBeLessThan(250 * 1024);
    }
  });
});
```

- [ ] **Step 2: 자산 부재로 실패하는지 확인**

Run: `npm test -- tests/unit/sketch/face-part-assets.test.ts`

Expected: FAIL with an `ENOENT` path under `public/guides/face-parts`.

- [ ] **Step 3: 생성물을 720×720 transparent WebP로 변환하는 스크립트 작성**

```js
import path from 'node:path';
import process from 'node:process';
import { mkdir } from 'node:fs/promises';
import sharp from 'sharp';

const [source, destination] = process.argv.slice(2);
if (!source || !destination) throw new Error('source와 destination 경로가 필요합니다.');
await mkdir(path.dirname(destination), { recursive: true });
await sharp(source)
  .resize(720, 720, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .webp({ quality: 82, alphaQuality: 100 })
  .toFile(destination);
```

- [ ] **Step 4: built-in image generation으로 얼굴형과 머리 파츠 제작**

각 항목마다 built-in image generation을 한 번씩 호출한다. 공통 프롬프트는 다음과 같다.

```text
Use case: stylized-concept
Asset type: transparent mobile drawing-guide overlay
Primary request: Create only the requested face part as a standalone overlay for a centered front-facing portrait.
Style/medium: clean black graphite pencil line art matching a warm Korean sketchbook portrait; consistent medium-thin hand-drawn stroke.
Composition/framing: square 1024 canvas; align to a centered portrait whose face occupies x=28%..72%, y=19%..78%; keep all other pixels transparent.
Color palette: charcoal black only.
Constraints: actual transparent background; requested part only; no text, no watermark, no paper texture, no border, no unrelated facial features; front view; consistent scale and anchor across the whole set.
```

호출별 `Primary request`의 requested part는 다음 11개를 정확히 사용한다.

- `oval face outline with two simple ears; no hair, eyes, nose, or mouth`
- `round face outline with two simple ears; no hair, eyes, nose, or mouth`
- `angular face outline with two simple ears; no hair, eyes, nose, or mouth`
- `short straight hairstyle only`
- `neat side-part hairstyle only`
- `soft wavy hairstyle only`
- `short curly hairstyle only`
- `very short buzz hairstyle only`
- `chin-length bob hairstyle only`
- `long straight hairstyle only`
- `tied-back ponytail hairstyle only`

각 결과를 먼저 눈으로 확인한 뒤, image generation 결과가 알려 준 절대 파일 경로와 해당 `FACE_PARTS` 항목의 목적지 경로를 `node scripts/normalize-face-part.mjs`의 첫째·둘째 인수로 전달해 정규화한다. 결과에 배경, 글자, 얼굴의 다른 부위가 섞인 경우 해당 항목만 한 번 수정 생성한다.

- [ ] **Step 5: built-in image generation으로 눈·입·소품 파츠 제작**

Step 4의 공통 프롬프트를 그대로 쓰고 requested part만 다음 18개로 바꿔 각각 한 번 호출한다.

- Eyes: `gentle almond-shaped eye pair only`, `round eye pair only`, `smiling closed eye pair only`, `sharp clear eye pair only`, `relaxed sleepy eye pair only`, `bright sparkling eye pair only`
- Mouth: `soft closed smile only`, `wide cheerful smile only`, `small subtle smile only`, `neutral closed mouth only`, `slightly open smile only`, `small playful pout only`
- Accessory: `round eyeglasses only`, `square eyeglasses only`, `light freckles across both cheeks only`, `small cheek bandage only`, `simple pair of earrings only`, `small hairpin on the portrait's upper right hair area only`

각 결과는 눈으로 확인하고 manifest 경로에 정규화한다. 소품도 정해진 얼굴 좌표를 유지하며 다른 얼굴선이나 머리카락이 섞이면 해당 항목만 수정 생성한다.

- [ ] **Step 6: 모든 자산 검증**

Run: `npm test -- tests/unit/sketch/face-part-assets.test.ts`

Expected: PASS for all 29 manifest assets.

- [ ] **Step 7: 커밋**

```bash
git add scripts/normalize-face-part.mjs public/guides/face-parts tests/unit/sketch/face-part-assets.test.ts
git commit -m "feat: add generated face guide assets"
```

---

### Task 3: 캔버스 합성 모듈

**Files:**
- Create: `src/components/sketch/canvas-composition.ts`
- Create: `tests/unit/sketch/canvas-composition.test.ts`

**Interfaces:**
- Consumes: `selectedFacePartSources(selection)`가 반환한 순서 있는 문자열 배열.
- Produces: `hasDrawingContent(drawingCanvas, facePartSources): boolean`, `createCompositeDrawing({ drawingCanvas, facePartSources, loadImage? }): Promise<string>`.

- [ ] **Step 1: 합성 순서와 WebP 형식을 검증하는 실패 테스트 작성**

```ts
import { createCompositeDrawing, hasDrawingContent } from '@/components/sketch/canvas-composition';
import { vi } from 'vitest';

it('흰 배경, 선택 파츠, 자유 그리기 순서로 WebP를 만든다', async () => {
  const outputContext = { fillRect: vi.fn(), drawImage: vi.fn(), fillStyle: '' };
  const outputCanvas = {
    width: 0,
    height: 0,
    getContext: () => outputContext,
    toDataURL: vi.fn(() => 'data:image/webp;base64,result'),
  } as unknown as HTMLCanvasElement;
  const drawingCanvas = document.createElement('canvas');
  const faceImage = {} as HTMLImageElement;

  const result = await createCompositeDrawing({
    drawingCanvas,
    facePartSources: ['/face.webp'],
    createCanvas: () => outputCanvas,
    loadImage: async () => faceImage,
  });

  expect(outputCanvas.width).toBe(720);
  expect(outputCanvas.height).toBe(720);
  expect(outputContext.fillRect).toHaveBeenCalledWith(0, 0, 720, 720);
  expect(outputContext.drawImage.mock.calls).toEqual([
    [faceImage, 0, 0, 720, 720],
    [drawingCanvas, 0, 0],
  ]);
  expect(outputCanvas.toDataURL).toHaveBeenCalledWith('image/webp', 0.76);
  expect(result).toBe('data:image/webp;base64,result');
});

it('얼굴 파츠만 있어도 저장 가능한 그림으로 판단한다', () => {
  const drawingCanvas = document.createElement('canvas');
  vi.spyOn(drawingCanvas, 'getContext').mockReturnValue({
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
  } as unknown as CanvasRenderingContext2D);
  expect(hasDrawingContent(drawingCanvas, ['/face.webp'])).toBe(true);
  expect(hasDrawingContent(drawingCanvas, [])).toBe(false);
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- tests/unit/sketch/canvas-composition.test.ts`

Expected: FAIL because the composition module does not exist.

- [ ] **Step 3: 합성 함수 구현**

```ts
export interface CompositeDrawingOptions {
  drawingCanvas: HTMLCanvasElement;
  facePartSources: string[];
  createCanvas?: () => HTMLCanvasElement;
  loadImage?: (src: string) => Promise<HTMLImageElement>;
}

export async function createCompositeDrawing({
  drawingCanvas,
  facePartSources,
  createCanvas = () => document.createElement('canvas'),
  loadImage = loadCanvasImage,
}: CompositeDrawingOptions): Promise<string> {
  const output = createCanvas();
  output.width = 720;
  output.height = 720;
  const context = output.getContext('2d');
  if (!context) throw new Error('그림을 합성할 수 없습니다.');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, 720, 720);
  for (const source of facePartSources) {
    context.drawImage(await loadImage(source), 0, 0, 720, 720);
  }
  context.drawImage(drawingCanvas, 0, 0);
  return output.toDataURL('image/webp', 0.76);
}
```

Also implement `loadCanvasImage` with `new Image()`, `onload`, `onerror`, and `hasDrawingContent` by returning true for any face source before scanning drawing-canvas alpha pixels.

- [ ] **Step 4: 단위 테스트 통과 확인**

Run: `npm test -- tests/unit/sketch/canvas-composition.test.ts`

Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/components/sketch/canvas-composition.ts tests/unit/sketch/canvas-composition.test.ts
git commit -m "feat: compose face guide drawings"
```

---

### Task 4: 얼굴 만들기 컨트롤 UI

**Files:**
- Create: `src/components/sketch/FaceBuilderControls.tsx`
- Create: `tests/unit/ui/face-builder-controls.test.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Consumes: `FaceSelection`, `FacePartCategory`, `FACE_PARTS` from Task 1.
- Produces: `FaceBuilderControls` with props `selection`, `crosshairVisible`, `loadingSources`, `failedSources`, `onSelect`, `onRandomize`, `onClear`, `onCrosshairChange`, `onStartDrawing`, `onRetry`.

- [ ] **Step 1: 키보드·터치 가능한 파츠 선택 UI 실패 테스트 작성**

```tsx
render(
  <FaceBuilderControls
    crosshairVisible
    failedSources={new Set()}
    loadingSources={new Set()}
    onClear={vi.fn()}
    onCrosshairChange={vi.fn()}
    onRandomize={vi.fn()}
    onRetry={vi.fn()}
    onSelect={onSelect}
    onStartDrawing={vi.fn()}
    selection={EMPTY_FACE_SELECTION}
  />,
);
fireEvent.click(screen.getByRole('tab', { name: '눈' }));
fireEvent.click(screen.getByRole('button', { name: '부드러운 눈' }));
expect(onSelect).toHaveBeenCalledWith('eyes', 'gentle');
expect(screen.getByRole('checkbox', { name: '중앙선 보기' })).toBeChecked();
expect(screen.getByRole('button', { name: '이 얼굴로 시작하기' })).toBeVisible();
```

Add cases for `aria-pressed`, loading disables only the affected option, failed option exposes `다시 시도`, random and clear callbacks, and every visible option button having at least the `face-part-option` class used for 44px sizing.

- [ ] **Step 2: 실패 확인**

Run: `npm test -- tests/unit/ui/face-builder-controls.test.tsx`

Expected: FAIL because `FaceBuilderControls` does not exist.

- [ ] **Step 3: 프레젠테이션 컴포넌트 구현**

```tsx
interface FaceBuilderControlsProps {
  selection: FaceSelection;
  crosshairVisible: boolean;
  loadingSources: ReadonlySet<string>;
  failedSources: ReadonlySet<string>;
  onSelect: (category: FacePartCategory, id: string) => void;
  onRandomize: () => void;
  onClear: () => void;
  onCrosshairChange: (visible: boolean) => void;
  onStartDrawing: () => void;
  onRetry: (source: string) => void;
}
```

Use category tabs with labels `얼굴`, `머리`, `눈`, `입`, `소품`. Each option button previews `selectedFacePartSources(selectFacePart(selection, activeCategory, option.id))`, so the candidate is shown in the current whole-face context, and places the Korean label below it. Keep `랜덤 조합`, `얼굴 초기화`, `중앙선 보기`, `이 얼굴로 시작하기` as text controls because their meaning is clearer than new decorative icons.

- [ ] **Step 4: 기존 디자인 시스템에 맞춘 모바일 CSS 작성**

Add `.guide-mode-tabs`, `.face-category-tabs`, `.face-part-grid`, `.face-part-option`, `.face-builder-actions`, and `.crosshair-toggle`. Use no shadow, 1px `var(--line)` borders, at most 8px radius, `var(--accent)` only for active state, two preview columns at 320px and three at wider widths, and minimum 44px controls.

- [ ] **Step 5: 컴포넌트 테스트 실행**

Run: `npm test -- tests/unit/ui/face-builder-controls.test.tsx`

Expected: PASS.

- [ ] **Step 6: 커밋**

```bash
git add src/components/sketch/FaceBuilderControls.tsx src/app/globals.css tests/unit/ui/face-builder-controls.test.tsx
git commit -m "feat: add face builder controls"
```

---

### Task 5: SketchEditor 가이드·레이어·십자선 통합

**Files:**
- Modify: `src/components/sketch/SketchEditor.tsx`
- Modify: `src/app/globals.css`
- Create: `tests/unit/ui/sketch-editor-guide.test.tsx`
- Modify: `tests/unit/ui/sketch-editor-opacity.test.tsx`
- Modify: `tests/unit/ui/sketch-editor-fullscreen.test.tsx`

**Interfaces:**
- Consumes: Tasks 1, 3, 4의 `FaceSelection`, `selectedFacePartSources`, `randomFaceSelection`, `createCompositeDrawing`, `hasDrawingContent`, `FaceBuilderControls`.
- Produces: 기존 `SketchEditorHandle`을 변경하지 않고 얼굴 조합이 포함된 `exportDrawing()` 결과와 `hasDrawing()` 상태를 제공한다.

- [ ] **Step 1: 가이드 탭과 십자선의 실패 테스트 작성**

```tsx
render(<SketchEditor ariaLabel="그리기 캔버스" />);
fireEvent.click(screen.getByRole('button', { name: '그림 그리기' }));
fireEvent.click(screen.getByRole('button', { name: '그리기 도구 열기' }));

const guide = screen.getByRole('button', { name: '가이드' });
expect(guide).toBeEnabled();
fireEvent.click(guide);
expect(screen.getByRole('tab', { name: '사진 참고' })).toHaveAttribute('aria-disabled', 'true');
expect(screen.getByRole('tab', { name: '얼굴 만들기' })).toBeEnabled();
expect(screen.getByTestId('canvas-crosshair')).toBeVisible();
fireEvent.click(screen.getByRole('checkbox', { name: '중앙선 보기' }));
expect(screen.queryByTestId('canvas-crosshair')).not.toBeInTheDocument();
```

Add cases that select a face and eyes, verify both `.face-guide-part` images appear in manifest order, verify `전체 삭제` keeps them, and verify `얼굴 초기화` removes them without calling canvas `clearRect`.

- [ ] **Step 2: 얼굴만 있는 확인·나가기 실패 테스트 작성**

Select one face option without drawing, click `확인`, wait for the async composition, and expect the preview plus `onDrawingChange`. Reopen the editor, select a face, click `그리기 나가기`, and expect the same unsaved-work confirmation used for strokes.

- [ ] **Step 3: 참고 사진 테스트를 새 탐색 구조에 맞게 수정하고 실패 확인**

Replace direct `참고사진` button clicks with:

```ts
fireEvent.click(screen.getByRole('button', { name: '가이드' }));
fireEvent.click(screen.getByRole('tab', { name: '사진 참고' }));
```

Run: `npm test -- tests/unit/ui/sketch-editor-guide.test.tsx tests/unit/ui/sketch-editor-opacity.test.tsx tests/unit/ui/sketch-editor-fullscreen.test.tsx`

Expected: FAIL because the current editor still exposes `참고사진` and has no face/crosshair layers.

- [ ] **Step 4: 네 레이어와 가이드 상태 통합**

Change `EditorTab` to `'draw' | 'guide' | 'edit'`, add `GuideMode = 'photo' | 'face'`, and initialize:

```ts
const [guideMode, setGuideMode] = useState<GuideMode>(referenceImageUrl ? 'photo' : 'face');
const [faceSelection, setFaceSelection] = useState<FaceSelection>({ ...EMPTY_FACE_SELECTION });
const [crosshairVisible, setCrosshairVisible] = useState(true);
const [loadingFaceSources, setLoadingFaceSources] = useState(new Set<string>());
const [failedFaceSources, setFailedFaceSources] = useState(new Set<string>());
const [faceAssetAttempts, setFaceAssetAttempts] = useState<Record<string, number>>({});
const facePartSources = selectedFacePartSources(faceSelection);
```

Render the stage in this exact order: existing `.reference-layer`, `.face-guide-layer` containing one image per `facePartSources`, existing canvas, then `<div className="canvas-crosshair" data-testid="canvas-crosshair" />`. Give reference z-index 0, face layer 1, drawing canvas 2, crosshair 3, and `pointer-events: none` to every layer except the active drawing canvas/reference gesture surface. Add `sketch-stage--reference` only while `tab === 'guide' && guideMode === 'photo'` so the existing CSS blocks drawing input only during photo positioning.

When selection or randomization adds a source, add it to `loadingFaceSources` and remove it from `failedFaceSources`. Track each selected face image with `onLoad` and `onError`; errors update the matching source only and do not alter selection or canvas history. The retry callback removes that source from the failed set, adds it to the loading set, increments `faceAssetAttempts[source]`, and remounts the image with key `` `${source}:${faceAssetAttempts[source] ?? 0}` ``.

Add the non-exported center guide with the following visual floor:

```css
.canvas-crosshair { inset: 0; pointer-events: none; position: absolute; z-index: 3; }
.canvas-crosshair::before,
.canvas-crosshair::after { background: rgb(110 110 110 / 14%); content: ""; position: absolute; }
.canvas-crosshair::before { height: 1px; left: 0; right: 0; top: 50%; }
.canvas-crosshair::after { bottom: 0; left: 50%; top: 0; width: 1px; }
```

- [ ] **Step 5: 가이드 패널과 제스처 조건 통합**

The main nav labels become `그리기`, `가이드`, `편집`. Inside `guide`, render two `role="tab"` controls `사진 참고` and `얼굴 만들기` with `aria-selected`; the photo tab uses `aria-disabled="true"` and ignores clicks when no reference exists while the main `가이드` button remains enabled. Reference pointer handlers run only when `tab === 'guide' && guideMode === 'photo'`. `FaceBuilderControls.onStartDrawing` sets the main tab to `draw` without changing selection.

- [ ] **Step 6: 비동기 합성·빈 그림·나가기 흐름 연결**

Make `confirmDrawing` asynchronous. It first calls `hasDrawingContent(canvas, facePartSources)`, reports `얼굴을 만들거나 그림을 한 번 이상 그린 뒤 확인해 주세요.` when false, blocks while any selected source is loading or failed, then awaits `createCompositeDrawing`. On rejection it keeps fullscreen open and shows `얼굴 가이드를 불러오지 못했어요. 다시 시도해 주세요.`.

`requestExit` treats `hasDrawingContent(canvas, facePartSources)` as unsaved work. On confirmed exit it clears the drawing canvas, resets history and face selection, but leaves session-level `crosshairVisible` unchanged. `clear()` keeps its current drawing-only behavior. `얼굴 초기화` resets only `faceSelection` and asset status sets.

- [ ] **Step 7: 통합 단위 테스트 통과 확인**

Run: `npm test -- tests/unit/ui/sketch-editor-guide.test.tsx tests/unit/ui/sketch-editor-opacity.test.tsx tests/unit/ui/sketch-editor-fullscreen.test.tsx tests/unit/ui/sketch-editor-history.test.tsx tests/unit/ui/sketch-editor-import.test.tsx`

Expected: PASS with the old undo/redo and import behavior preserved.

- [ ] **Step 8: 타입·린트 검사와 커밋**

Run: `npx tsc --noEmit`

Expected: exit 0.

Run: `npm run lint -- --quiet`

Expected: exit 0.

```bash
git add src/components/sketch/SketchEditor.tsx src/app/globals.css tests/unit/ui/sketch-editor-guide.test.tsx tests/unit/ui/sketch-editor-opacity.test.tsx tests/unit/ui/sketch-editor-fullscreen.test.tsx
git commit -m "feat: integrate drawing guide layers"
```

---

### Task 6: 모바일 흐름과 최종 품질 검증

**Files:**
- Modify: `tests/e2e/sketchbook-flow.spec.ts`
- Modify only if a verified defect requires it: files already listed in Tasks 1–5.

**Interfaces:**
- Consumes: 완성된 `SketchEditor` 사용자 흐름.
- Produces: 모바일 생성·친구 참여에서 가이드 선택과 기존 제출 흐름이 함께 동작한다는 회귀 증거.

- [ ] **Step 1: E2E에 얼굴 가이드와 십자선 검증 추가**

In the friend flow, after opening tools, replace the old `참고사진` assertion with:

```ts
await friendPage.getByRole('button', { name: '가이드' }).click();
await expect(friendPage.getByRole('tab', { name: '사진 참고' })).toHaveAttribute('aria-selected', 'true');
await expect(friendPage.getByTestId('canvas-crosshair')).toBeVisible();
await friendPage.getByRole('tab', { name: '얼굴 만들기' }).click();
await friendPage.getByRole('tab', { name: '얼굴' }).click();
await friendPage.getByRole('button', { name: '갸름한 얼굴' }).click();
await friendPage.getByRole('tab', { name: '눈' }).click();
await friendPage.getByRole('button', { name: '부드러운 눈' }).click();
await friendPage.getByRole('button', { name: '이 얼굴로 시작하기' }).click();
```

Keep `drawOnCanvas(friendPage)` afterward so one test proves face composition plus free drawing. Before confirmation, assert `.face-guide-part` count is 2. After submission, keep the existing thumbnail format and 320×320 checks.

- [ ] **Step 2: 관련 단위 테스트 전체 실행**

Run: `npm test -- tests/unit/sketch tests/unit/ui/sketch-editor-guide.test.tsx tests/unit/ui/face-builder-controls.test.tsx tests/unit/ui/sketch-editor-opacity.test.tsx tests/unit/ui/sketch-editor-fullscreen.test.tsx tests/unit/ui/sketch-editor-history.test.tsx tests/unit/ui/sketch-editor-import.test.tsx`

Expected: PASS.

- [ ] **Step 3: 모바일 Playwright 흐름 실행**

Run: `npx playwright test tests/e2e/sketchbook-flow.spec.ts --project=mobile-chrome`

Expected: 생성 → 얼굴 가이드 → 자유 그리기 → 친구 제출 → 관리 → BEST → 스토리 저장 → 삭제 flow PASS against Firebase emulators.

- [ ] **Step 4: 320px, 390px, 650px 브라우저 시각 검수**

At each width, open the draw route and verify in one bounded pass: no horizontal overflow; crosshair is centered and faint; face parts align; category/option buttons are readable; controls stay within 650px; fullscreen buttons do not overlap the panel; portrait drawing remains touchable. Fix only defects found in these checks, then confirm once more.

- [ ] **Step 5: Impeccable detector와 전체 검증 실행**

Run: `node C:\Users\박도영\.agents\skills\impeccable\scripts\detect.mjs --json src/components/sketch/FaceBuilderControls.tsx src/components/sketch/SketchEditor.tsx src/app/globals.css`

Expected: no newly introduced high-confidence UI violations.

Run: `npm test`

Expected: all Vitest suites PASS.

Run: `npm run lint`

Expected: exit 0.

Run: `npx tsc --noEmit`

Expected: exit 0.

Run: `npm run build`

Expected: Next.js production build completes successfully.

- [ ] **Step 6: 최종 변경 커밋**

```bash
git add tests/e2e/sketchbook-flow.spec.ts
git add src/components/sketch/face-parts.ts src/components/sketch/canvas-composition.ts src/components/sketch/FaceBuilderControls.tsx src/components/sketch/SketchEditor.tsx src/app/globals.css
git add tests/unit/sketch/face-parts.test.ts tests/unit/sketch/face-part-assets.test.ts tests/unit/sketch/canvas-composition.test.ts tests/unit/ui/face-builder-controls.test.tsx tests/unit/ui/sketch-editor-guide.test.tsx tests/unit/ui/sketch-editor-opacity.test.tsx tests/unit/ui/sketch-editor-fullscreen.test.tsx
git add scripts/normalize-face-part.mjs public/guides/face-parts
git commit -m "test: verify mobile face guide flow"
```

Before committing, run `git diff --cached --name-only` and confirm `next-env.d.ts` and `src/app/create/CreateSketchbookForm.tsx` are absent.
