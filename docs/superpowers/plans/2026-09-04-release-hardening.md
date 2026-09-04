# Release Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 스케치북의 PIN 안전성, 접근 가능한 그림 제출, 공개 화면 위계, 운영 App Check 설정, 핵심 E2E를 출시 가능한 상태로 만든다.

**Architecture:** 기존 API payload와 Firestore 스키마를 유지하고 클라이언트 검증·대체 입력·설정 판별기를 경계에 추가한다. 공개 mutation은 App Check 설정 판별 → 토큰 검증 → 교체 가능한 요청 제한 → 기존 Zod/저장 로직 순서를 유지한다.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5.8, Firebase 12, Vitest, Testing Library, Playwright

**Spec:** `docs/superpowers/specs/2026-09-04-project-hardening-design.md`

## Global Constraints

- Node.js 22.x와 기존 npm lockfile을 사용한다.
- API 경로, Firestore 스키마, 기존 요청·응답 payload를 변경하지 않는다.
- 사용자 그림은 720×720 흰 캔버스 안에 `contain`으로 배치한다.
- 실제 Firebase 사이트 키, 관리자 정보, 결제 비밀값을 저장소나 로그에 기록하지 않는다.
- 새 운영 서비스나 런타임 의존성을 추가하지 않는다.
- 모든 UI는 최대 650px 모바일 흐름과 기존 종이·블루그레이 디자인을 유지한다.
- 각 기능은 실패 테스트를 먼저 확인한 뒤 최소 구현으로 통과시킨다.

---

### Task 1: 관리 PIN 확인과 안전한 생성 완료 행동

**Files:**
- Create: `src/app/create/CreateCompleteActions.tsx`
- Modify: `src/app/create/CreateSketchbookForm.tsx:18-146`
- Modify: `src/app/globals.css`
- Test: `tests/unit/ui/create-sketchbook-form.test.tsx`
- Create: `tests/unit/ui/create-complete-actions.test.tsx`

**Interfaces:**
- Consumes: 기존 생성 응답의 `manageUrl`, `publicUrl`
- Produces: `CreateCompleteActions({ manageUrl, publicUrl }: CreateCompleteActionsProps)`
- Produces: `CreateDraft { name: string; managePinHint: string; ownerImageDataUrl?: string; version: 2 }`

- [ ] **Step 1: PIN을 초안에서 제외하고 확인 불일치를 막는 실패 테스트 작성**

```tsx
it('초안에는 PIN을 저장하거나 복원하지 않는다', async () => {
  sessionStorage.setItem(draftKey, JSON.stringify({ version: 1, name: '해비', managePin: '1234', managePinHint: '힌트' }));
  render(<CreateSketchbookForm />);
  await waitFor(() => expect(screen.getByLabelText('이름 또는 애칭')).toHaveValue('해비'));
  expect(screen.getByLabelText('관리용 비밀번호', { exact: true })).toHaveValue('');
  await waitFor(() => expect(JSON.parse(sessionStorage.getItem(draftKey) ?? '{}')).not.toHaveProperty('managePin'));
});

it('PIN 확인이 다르면 요청하지 않고 확인 필드에 오류를 표시한다', async () => {
  render(<CreateSketchbookForm />);
  fireEvent.change(screen.getByLabelText('관리용 비밀번호', { exact: true }), { target: { value: '1234' } });
  fireEvent.change(screen.getByLabelText('관리용 비밀번호 확인'), { target: { value: '1243' } });
  fireEvent.click(screen.getByRole('button', { name: '내 스케치북 만들기' }));
  expect(await screen.findByText('관리용 비밀번호가 일치하지 않아요.')).toBeVisible();
  expect(fetch).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: PIN 관련 테스트가 기존 동작 때문에 실패하는지 확인**

Run: `npx vitest run tests/unit/ui/create-sketchbook-form.test.tsx`

Expected: PIN이 복원되고 확인 필드가 없어 FAIL

- [ ] **Step 3: draft v2와 PIN 확인 필드 구현**

```tsx
interface CreateDraft {
  managePinHint: string;
  name: string;
  ownerImageDataUrl?: string;
  version: 2;
}

const [managePinConfirmation, setManagePinConfirmation] = useState('');
const [pinConfirmationError, setPinConfirmationError] = useState<string | null>(null);

if (managePin !== managePinConfirmation) {
  setPinConfirmationError('관리용 비밀번호가 일치하지 않아요.');
  return;
}
```

확인 입력은 `aria-describedby="manage-pin-confirmation-error"`로 인라인 오류와 연결하고 PIN이 바뀌면 기존 불일치 오류를 지운다. 초안 읽기는 v1 이름·힌트·그림을 마이그레이션하되 PIN을 무시하고, 저장은 v2 비민감 필드만 포함한다.

- [ ] **Step 4: 생성 완료 공유 행동의 실패 테스트 작성**

```tsx
it('공유 API가 없으면 공개 링크를 복사하고 상태를 알린다', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.assign(navigator, { clipboard: { writeText }, share: undefined });
  render(<CreateCompleteActions manageUrl="/m/abc" publicUrl="/s/abc" />);
  fireEvent.click(screen.getByRole('button', { name: '친구에게 공유하기' }));
  await waitFor(() => expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/s/abc`));
  expect(screen.getByRole('status')).toHaveTextContent('친구에게 보낼 링크를 복사했어요.');
});
```

- [ ] **Step 5: 생성 완료 공유 행동 구현**

```tsx
interface CreateCompleteActionsProps { manageUrl: string; publicUrl: string; }

export function CreateCompleteActions({ manageUrl, publicUrl }: CreateCompleteActionsProps) {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  async function share() {
    const url = new URL(publicUrl, window.location.origin).href;
    try {
      if (navigator.share) await navigator.share({ title: '내 스케치북', text: '친구들이 보는 내 모습을 그려주세요.', url });
      else await navigator.clipboard.writeText(url);
      setStatus(navigator.share ? '공유창을 열었어요.' : '친구에게 보낼 링크를 복사했어요.');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setStatus('공유하지 못했어요. 다시 시도해 주세요.');
    }
  }
  return (
    <div className="create-complete-actions">
      <button className="button button--primary" onClick={share} type="button">친구에게 공유하기</button>
      <button className="button button--secondary" onClick={() => router.push(manageUrl)} type="button">내 스케치북 관리하기</button>
      {status ? <p aria-live="polite" role="status">{status}</p> : null}
    </div>
  );
}
```

- [ ] **Step 6: 관련 테스트 통과 확인**

Run: `npx vitest run tests/unit/ui/create-sketchbook-form.test.tsx tests/unit/ui/create-complete-actions.test.tsx`

Expected: 모든 테스트 PASS

- [ ] **Step 7: 변경 커밋**

```bash
git add src/app/create/CreateSketchbookForm.tsx src/app/create/CreateCompleteActions.tsx src/app/globals.css tests/unit/ui/create-sketchbook-form.test.tsx tests/unit/ui/create-complete-actions.test.tsx
git commit -m "스케치북 생성 PIN 안전성 개선"
```

### Task 2: 접근 가능한 이미지 가져오기 경로

**Files:**
- Create: `src/components/sketch/import-image.ts`
- Modify: `src/components/sketch/SketchEditor.tsx:23-374`
- Modify: `src/app/globals.css`
- Create: `tests/unit/sketch/import-image.test.ts`
- Create: `tests/unit/ui/sketch-editor-accessibility.test.tsx`

**Interfaces:**
- Produces: `validateSketchImport(file: File): string | null`
- Produces: `drawImportedImage(canvas: HTMLCanvasElement, source: CanvasImageSource): void`
- `SketchEditor` 공개 props와 handle은 유지한다.

- [ ] **Step 1: 파일 형식·크기와 contain 계산 실패 테스트 작성**

```ts
it('지원하지 않는 형식과 10MB 초과 파일을 거절한다', () => {
  expect(validateSketchImport(new File(['x'], 'drawing.gif', { type: 'image/gif' }))).toBe('PNG, JPEG, WebP 이미지만 가져올 수 있어요.');
  const large = new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' });
  expect(validateSketchImport(large)).toBe('10MB 이하 이미지를 선택해 주세요.');
});

it('세로 이미지를 720 정사각형 안에 contain으로 배치한다', () => {
  expect(getContainedRect(900, 1200, 720, 720)).toEqual({ x: 90, y: 0, width: 540, height: 720 });
});
```

- [ ] **Step 2: 새 유틸 테스트가 export 부재로 실패하는지 확인**

Run: `npx vitest run tests/unit/sketch/import-image.test.ts`

Expected: 모듈 또는 export를 찾지 못해 FAIL

- [ ] **Step 3: 파일 검증과 contain 배치 유틸 구현**

```ts
const supportedTypes = new Set(['image/png', 'image/jpeg', 'image/webp']);
export const MAX_SKETCH_IMPORT_BYTES = 10 * 1024 * 1024;

export function validateSketchImport(file: File) {
  if (!supportedTypes.has(file.type)) return 'PNG, JPEG, WebP 이미지만 가져올 수 있어요.';
  if (file.size > MAX_SKETCH_IMPORT_BYTES) return '10MB 이하 이미지를 선택해 주세요.';
  return null;
}

export function getContainedRect(sourceWidth: number, sourceHeight: number, targetWidth: number, targetHeight: number) {
  const scale = Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  return { x: (targetWidth - width) / 2, y: (targetHeight - height) / 2, width, height };
}
```

- [ ] **Step 4: 접근성 UI 실패 테스트 작성**

```tsx
it('포인터를 사용하지 않아도 이미지 파일로 그림을 확정한다', async () => {
  render(<SketchEditor ariaLabel="친구 모습을 그리는 캔버스" />);
  const input = screen.getByLabelText('이미지로 가져오기');
  fireEvent.change(input, { target: { files: [new File(['image'], 'drawing.png', { type: 'image/png' })] } });
  expect(await screen.findByRole('img', { name: '그린 그림 미리보기' })).toBeVisible();
  expect(screen.getByRole('status')).toHaveTextContent('이미지를 그림으로 가져왔어요.');
});

it('펜과 지우개 상태를 aria-pressed로 전달한다', () => {
  render(<SketchEditor ariaLabel="그리기 캔버스" />);
  fireEvent.click(screen.getByRole('button', { name: '그림 그리기' }));
  fireEvent.click(screen.getByRole('button', { name: '그리기 도구 열기' }));
  expect(screen.getByRole('button', { name: '펜' })).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(screen.getByRole('button', { name: '지우개' }));
  expect(screen.getByRole('button', { name: '지우개' })).toHaveAttribute('aria-pressed', 'true');
});
```

- [ ] **Step 5: 이미지 가져오기와 ARIA 상태 구현**

`SketchEditor`에 `input type="file" accept="image/png,image/jpeg,image/webp"`를 연결한 보조 버튼을 추가한다. `createImageBitmap(file)`을 우선 사용하고 지원하지 않으면 object URL과 `Image`로 디코딩한다. 흰 배경을 채운 뒤 contain rect로 이미지를 그리고 `finishDrawing(canvas.toDataURL('image/webp', 0.76))`를 호출한다. object URL은 `finally`에서 해제한다.

```tsx
<label className="button button--secondary drawing-import-button">
  이미지로 가져오기
  <input accept="image/png,image/jpeg,image/webp" aria-label="이미지로 가져오기" onChange={importImage} type="file" />
</label>
<p aria-live="polite" className="drawing-import-status" role="status">{importStatus}</p>
```

펜·지우개에는 각각 `aria-pressed={!eraser}`, `aria-pressed={eraser}`를 설정하고 캔버스는 도움말 id를 `aria-describedby`로 연결한다.

- [ ] **Step 6: 관련 테스트 통과 확인**

Run: `npx vitest run tests/unit/sketch/import-image.test.ts tests/unit/ui/sketch-editor-accessibility.test.tsx tests/unit/ui/sketch-editor-guide.test.tsx tests/unit/ui/sketch-editor-history.test.tsx`

Expected: 모든 테스트 PASS

- [ ] **Step 7: 변경 커밋**

```bash
git add src/components/sketch/import-image.ts src/components/sketch/SketchEditor.tsx src/app/globals.css tests/unit/sketch/import-image.test.ts tests/unit/ui/sketch-editor-accessibility.test.tsx
git commit -m "그림 제출 접근성 대체 경로 추가"
```

### Task 3: 공개 화면 결과물 우선순위와 반응형 CTA

**Files:**
- Modify: `src/app/s/[publicId]/page.tsx:113-148`
- Modify: `src/app/(marketing)/page.tsx`
- Modify: `src/app/terms/page.tsx:7-9`
- Modify: `src/app/globals.css`
- Create: `tests/unit/ui/public-best-drawings.test.tsx`
- Modify: `tests/e2e/landing.spec.ts`
- Modify: `tests/unit/ui/terms-page.test.tsx`

**Interfaces:**
- 공개 페이지 props와 URL은 유지한다.
- BEST 렌더링 입력은 기존 `Drawing.bestRank`와 `Sketchbook.ownerBestRank`만 사용한다.

- [ ] **Step 1: 부분 BEST 렌더링 실패 테스트 작성**

```tsx
it('친구 그림은 있지만 BEST가 없으면 빈 BEST 슬롯을 표시하지 않는다', async () => {
  listVisibleDrawings.mockResolvedValue([{ ...drawing, bestRank: null }]);
  render(await PublicSketchbookPage({ params: Promise.resolve({ publicId: 'public-1' }), searchParams: Promise.resolve({}) }));
  expect(screen.queryByRole('heading', { name: '♕ 베스트 그림' })).not.toBeInTheDocument();
  expect(screen.getByRole('img', { name: '친구님의 그림' })).toBeVisible();
});

it('선정된 BEST 카드만 순서대로 표시한다', async () => {
  listVisibleDrawings.mockResolvedValue([{ ...drawing, id: 'd2', bestRank: 2 }]);
  render(await PublicSketchbookPage({ params: Promise.resolve({ publicId: 'public-1' }), searchParams: Promise.resolve({}) }));
  expect(screen.getByText('BEST 2')).toBeVisible();
  expect(screen.queryByText('선정 전')).not.toBeInTheDocument();
});
```

- [ ] **Step 2: BEST 테스트 실패 확인**

Run: `npx vitest run tests/unit/ui/public-best-drawings.test.tsx`

Expected: 빈 BEST 슬롯이 렌더링되어 FAIL

- [ ] **Step 3: 선정된 BEST만 렌더링**

```tsx
const rankedDrawings = [1, 2, 3, 4].flatMap((rank) => {
  const drawing = bestDrawings.find((item) => item.bestRank === rank);
  const owner = Boolean(sketchbook.ownerDrawingPath && sketchbook.ownerBestRank === rank);
  return drawing || owner ? [{ drawing, owner, rank }] : [];
});

{rankedDrawings.length > 0 ? <section>{rankedDrawings.map(renderRankedCard)}</section> : null}
```

- [ ] **Step 4: 390×667 CTA와 제목 중복 실패 테스트 작성**

```ts
test('390×667 첫 화면에 생성 CTA가 온전히 보인다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 667 });
  await page.goto('/');
  await expect(page.getByRole('link', { name: '내 스케치북 만들기' })).toBeInViewport({ ratio: 1 });
});
```

`terms-page.test.tsx`에는 metadata title이 `서비스 이용 및 결제 안내`인지 검증한다.

- [ ] **Step 5: 높이 기반 CTA와 metadata 수정**

```css
@media (orientation: portrait) and (max-height: 720px) {
  .landing-hero { padding-top: clamp(14px, 3.5svh, 28px); }
  .landing-collage { max-height: 34svh; width: auto; }
  .landing-collage img { height: 100%; object-fit: contain; width: auto; }
  .landing-action { margin-top: clamp(8px, 2svh, 16px); }
}
```

`src/app/terms/page.tsx`의 metadata title은 루트 template suffix를 제외한 `서비스 이용 및 결제 안내`로 변경한다.

- [ ] **Step 6: 관련 테스트 통과 확인**

Run: `npx vitest run tests/unit/ui/public-best-drawings.test.tsx tests/unit/ui/public-sketchbook-empty.test.tsx tests/unit/ui/terms-page.test.tsx`

Run: `npx playwright test tests/e2e/landing.spec.ts --project=mobile-chrome`

Expected: 모든 테스트 PASS

- [ ] **Step 7: 변경 커밋**

```bash
git add src/app/s/[publicId]/page.tsx src/app/terms/page.tsx src/app/globals.css tests/unit/ui/public-best-drawings.test.tsx tests/unit/ui/terms-page.test.tsx tests/e2e/landing.spec.ts
git commit -m "공개 결과 화면 우선순위 개선"
```

### Task 4: App Check 설정 정합성과 배포 가드

**Files:**
- Create: `src/lib/security/app-check-config.ts`
- Modify: `src/lib/security/app-check-client.ts`
- Modify: `src/lib/security/app-check-server.ts`
- Modify: `apphosting.yaml`
- Modify: `.env.example`
- Modify: `README.md`
- Modify: `tests/unit/security/app-check.test.ts`
- Create: `tests/unit/security/app-check-config.test.ts`

**Interfaces:**
- Produces: `resolveAppCheckMode(input): 'disabled' | 'enabled' | 'misconfigured'`
- Produces: `assertProductionAppCheckConfiguration(input): void`
- 기존 `getPublicMutationHeaders`와 `enforceAppCheck` 시그니처는 유지한다.

- [ ] **Step 1: 설정 조합 실패 테스트 작성**

```ts
it.each([
  [{ clientEnabled: false, enforcementEnabled: false, siteKey: '' }, 'disabled'],
  [{ clientEnabled: true, enforcementEnabled: true, siteKey: 'key' }, 'enabled'],
  [{ clientEnabled: true, enforcementEnabled: false, siteKey: 'key' }, 'misconfigured'],
  [{ clientEnabled: false, enforcementEnabled: true, siteKey: 'key' }, 'misconfigured'],
  [{ clientEnabled: true, enforcementEnabled: true, siteKey: '' }, 'misconfigured'],
])('App Check 조합을 판별한다', (input, expected) => {
  expect(resolveAppCheckMode(input)).toBe(expected);
});
```

- [ ] **Step 2: 설정 테스트 실패 확인**

Run: `npx vitest run tests/unit/security/app-check-config.test.ts`

Expected: 모듈을 찾지 못해 FAIL

- [ ] **Step 3: 순수 설정 판별기 구현**

```ts
export interface AppCheckConfiguration {
  clientEnabled: boolean;
  enforcementEnabled: boolean;
  siteKey: string;
}

export function resolveAppCheckMode(input: AppCheckConfiguration) {
  const hasKey = input.siteKey.trim().length > 0;
  if (!input.clientEnabled && !input.enforcementEnabled && !hasKey) return 'disabled' as const;
  if (input.clientEnabled && input.enforcementEnabled && hasKey) return 'enabled' as const;
  return 'misconfigured' as const;
}
```

- [ ] **Step 4: 클라이언트와 서버의 불완전 조합 테스트 추가**

클라이언트는 `misconfigured`에서 Firebase를 초기화하지 않고 기존 사용자용 보안 오류를 throw한다. 서버는 `misconfigured`에서 토큰 검증 전에 503을 반환한다. 두 테스트 모두 환경 변수 원문이 응답과 로그에 나타나지 않는지 검증한다.

- [ ] **Step 5: 판별기를 양쪽 경계에 연결**

```ts
const mode = resolveAppCheckMode({
  clientEnabled: process.env.NEXT_PUBLIC_FIREBASE_APP_CHECK_ENABLED === 'true',
  enforcementEnabled: process.env.FIREBASE_APP_CHECK_ENFORCEMENT_ENABLED === 'true',
  siteKey: process.env.NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY ?? '',
});
if (mode === 'misconfigured') return unavailableResponse();
if (mode === 'disabled') return null;
```

클라이언트 번들에는 서버 전용 환경 변수가 안전하게 인라인되지 않으므로 클라이언트에서는 `clientEnabled + siteKey`만 검사하고, 전체 3개 조합 검사는 서버와 배포 검사에서 수행한다.

- [ ] **Step 6: App Hosting 변수 연결과 운영 절차 갱신**

Firebase App Hosting 공식 스키마를 확인한 뒤 `NEXT_PUBLIC_FIREBASE_APP_CHECK_ENABLED`, `NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY`, `FIREBASE_APP_CHECK_ENFORCEMENT_ENABLED`의 build/runtime 가용성을 명시한다. 사이트 키 값은 저장하지 않고 secret 연결만 기록한다. README에는 배포 전 세 값의 동시 활성화와 토큰 없는 POST 401 확인을 한 단계로 묶는다.

- [ ] **Step 7: 관련 테스트 통과 확인**

Run: `npx vitest run tests/unit/security/app-check-config.test.ts tests/unit/security/app-check.test.ts tests/unit/api/public-app-check.test.ts`

Expected: 모든 테스트 PASS

- [ ] **Step 8: 변경 커밋**

```bash
git add src/lib/security/app-check-config.ts src/lib/security/app-check-client.ts src/lib/security/app-check-server.ts apphosting.yaml .env.example README.md tests/unit/security/app-check-config.test.ts tests/unit/security/app-check.test.ts
git commit -m "공개 API App Check 설정 강화"
```

### Task 5: 요청 제한 경계와 CSP·의존성 기록

**Files:**
- Create: `src/lib/security/public-mutation-rate-limiter.ts`
- Modify: `src/lib/security/rate-limit.ts`
- Modify: `src/app/api/sketchbooks/route.ts`
- Modify: `src/app/api/sketchbooks/[publicId]/drawings/route.ts`
- Modify: `README.md`
- Modify: `package-lock.json` only when non-breaking audit fix changes it
- Modify: `tests/unit/security/rate-limit.test.ts`
- Create: `tests/unit/security/public-mutation-rate-limiter.test.ts`

**Interfaces:**
- Produces: `PublicMutationRateLimiter.consume(request, action): RateLimitResult`
- Produces: `createInMemoryPublicMutationRateLimiter(options)`
- 기존 `enforcePublicMutationLimit(request, action)` export는 호환 wrapper로 유지한다.

- [ ] **Step 1: 저장 방식과 분리된 요청 제한 계약 테스트 작성**

```ts
it('주입한 limiter 결과를 429 응답으로 변환한다', () => {
  const limiter: PublicMutationRateLimiter = {
    consume: vi.fn(() => ({ allowed: false, retryAfter: 30 })),
  };
  const response = enforcePublicMutationLimit(new Request('https://example.com/api'), 'createSketchbook', limiter);
  expect(response?.status).toBe(429);
  expect(response?.headers.get('Retry-After')).toBe('30');
});
```

- [ ] **Step 2: 계약 테스트 실패 확인**

Run: `npx vitest run tests/unit/security/public-mutation-rate-limiter.test.ts`

Expected: limiter 주입 시그니처가 없어 FAIL

- [ ] **Step 3: 인터페이스와 메모리 구현 분리**

```ts
export type PublicMutationAction = 'createSketchbook' | 'submitDrawing';
export interface RateLimitResult { allowed: boolean; retryAfter: number; }
export interface PublicMutationRateLimiter {
  consume(request: Request, action: PublicMutationAction): RateLimitResult;
}
```

기존 fixed-window Map과 IP 정규화는 `createInMemoryPublicMutationRateLimiter` 내부로 이동한다. Route Handler와 wrapper의 응답 형식은 변경하지 않는다.

- [ ] **Step 4: 단일 인스턴스 배포 가드 문서화와 테스트**

README에 `maxInstances > 1`로 변경하기 전에 공유 limiter 구현이 필요하다는 배포 차단 조건을 추가한다. `apphosting.yaml`을 읽는 테스트는 `maxInstances: 1`이 유지되는지 검증한다.

- [ ] **Step 5: CSP 결정을 Next.js 16 문서 기준으로 기록**

`node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md`의 nonce 제약을 근거로 다음을 README 보안 절에 기록한다.

```text
nonce 기반 CSP는 모든 페이지를 동적 렌더링으로 전환하고 정적 최적화·CDN 캐시를 비활성화하므로 이번 변경에서는 적용하지 않는다. 현재 unsafe-inline은 Next.js 비-nonce 권장 구성과 인라인 React 스타일 호환을 위해 유지하며, 결제·관리 화면을 별도 동적 경계로 분리할 때 nonce 전환을 다시 평가한다.
```

- [ ] **Step 6: 비파괴적 의존성 감사 실행**

Run: `npm audit --omit=dev --json`

Run: `npm audit fix --package-lock-only`

Run: `npm audit --omit=dev`

`package-lock.json`에 파괴적 major downgrade 없이 `qs` 패치만 반영되면 유지한다. Firebase Admin 또는 Functions의 major downgrade가 필요하면 lockfile을 원상 유지하고 README에 `uuid` 전이 경로와 상위 패키지 업데이트 대기를 기록한다. `npm audit fix --force`와 검증되지 않은 `overrides`는 실행하지 않는다.

- [ ] **Step 7: 관련 테스트 통과 확인**

Run: `npx vitest run tests/unit/security/rate-limit.test.ts tests/unit/security/public-mutation-rate-limiter.test.ts tests/unit/api/sketchbook-create-safety.test.ts tests/unit/api/public-app-check.test.ts`

Expected: 모든 테스트 PASS

- [ ] **Step 8: 변경 커밋**

```bash
git add src/lib/security/public-mutation-rate-limiter.ts src/lib/security/rate-limit.ts src/app/api/sketchbooks/route.ts src/app/api/sketchbooks/[publicId]/drawings/route.ts README.md tests/unit/security/rate-limit.test.ts tests/unit/security/public-mutation-rate-limiter.test.ts
git add package-lock.json
git commit -m "공개 요청 제한 경계 정비"
```

`package-lock.json`이 변경되지 않았으면 해당 파일은 add 대상에서 제외한다.

### Task 6: 핵심 모바일 E2E 동기화

**Files:**
- Modify: `tests/e2e/sketchbook-flow.spec.ts:139-275`
- Modify: `tests/e2e/landing.spec.ts`
- Modify: `tests/e2e/mobile-layout.spec.ts`

**Interfaces:**
- 기존 Playwright fixture와 Firebase Emulator 설정을 유지한다.

- [ ] **Step 1: 워터마크 결제 팝업 열기 단계 추가**

```ts
const watermarkTrigger = managerPage.getByRole('button', { name: '워터마크 없이 저장하기 · 1,000원' });
await watermarkTrigger.click();
const watermarkDialog = managerPage.getByRole('dialog', { name: '워터마크 없이 저장하기' });
await expect(watermarkDialog).toBeVisible();
await watermarkDialog.getByLabel('결제용 휴대전화번호').fill('010-1234-5678');
await watermarkDialog.getByRole('checkbox', { name: /결제 완료 즉시 디지털 혜택 제공/ }).check();
await expect(watermarkDialog.getByRole('button', { name: '1,000원 결제하기' })).toBeEnabled();
await watermarkDialog.getByRole('button', { name: '결제창 닫기' }).click();
```

- [ ] **Step 2: 키보드 이미지 가져오기 E2E 추가**

작은 PNG fixture를 테스트 안에서 Buffer로 만들고 `setInputFiles`로 `이미지로 가져오기`에 전달한다. 미리보기 표시, 이름 입력, 제출 완료 메시지를 검증한다. 포인터 이벤트는 사용하지 않는다.

- [ ] **Step 3: BEST 미선정과 390×667 검증 추가**

친구 그림 제출 직후 관리자가 순위를 정하기 전 공개 페이지에 `선정 전`과 BEST 제목이 없는지 검증한다. 랜딩은 390×667에서 CTA가 `toBeInViewport({ ratio: 1 })`인지 검증한다.

- [ ] **Step 4: 핵심 E2E 실행**

Run: `npm run test:e2e -- --project=mobile-chrome`

Expected: 22개 이상 테스트, 0 failures

- [ ] **Step 5: 변경 커밋**

```bash
git add tests/e2e/sketchbook-flow.spec.ts tests/e2e/landing.spec.ts tests/e2e/mobile-layout.spec.ts
git commit -m "모바일 핵심 흐름 E2E 동기화"
```

### Task 7: 출시 하드닝 전체 검증

**Files:**
- Modify only if verification reveals a scoped defect in files already listed above.

**Interfaces:**
- 완료 기준은 spec의 출시 하드닝 항목 전체다.

- [ ] **Step 1: 단위·통합 테스트 실행**

Run: `npm test`

Expected: 모든 비에뮬레이터 테스트 PASS, 에뮬레이터 전용 테스트만 명시적으로 skip

- [ ] **Step 2: 정적 검증 실행**

Run: `npm run lint`

Run: `npm run build`

Expected: 두 명령 exit 0

- [ ] **Step 3: 모바일 E2E 실행**

Run: `npm run test:e2e -- --project=mobile-chrome`

Expected: 0 failures

- [ ] **Step 4: Impeccable detector 단일 실행**

Run: `node C:\Users\박도영\.agents\skills\impeccable\scripts\detect.mjs --json src/app src/components/sketch`

Expected: 새 P1 접근성 결함 없음. 디자인 토큰 advisory는 실제 drift와 문서 파서 false positive를 구분해 보고한다.

- [ ] **Step 5: 브라우저 시각 확인**

새 브라우저 탭에서 320×568, 390×667, 390×844로 `/`, `/create`, 공개 스케치북, 이미지 가져오기, 생성 완료 공유를 한 번씩 확인한다. 첫 번째 배치에서 발견한 결함만 한꺼번에 수정하고 한 번 더 확인한 뒤 종료한다.

- [ ] **Step 6: 출시 하드닝 완료 커밋**

검증 중 수정이 있었다면 관련 파일만 stage하고 다음 메시지로 커밋한다. 수정이 없으면 빈 커밋을 만들지 않는다.

```bash
git commit -m "출시 하드닝 검증 보완"
```
