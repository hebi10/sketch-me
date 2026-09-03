# 페이앱 실결제 연동 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 페이앱 결제 완료 통보를 검증한 뒤 구매 혜택을 정확히 한 번 적용하고 관리자 조회·전체 취소까지 제공한다.

**Architecture:** Next.js Route Handler가 페이앱 REST API와 통신하고 Firestore 구매 문서가 주문 상태의 기준이 된다. 브라우저는 서버가 반환한 HTTPS `payurl`로 이동하며, 결제 완료는 복귀 URL이 아니라 서명 값·주문번호·금액을 검증한 `feedbackurl`만 확정한다.

**Tech Stack:** Next.js 16.3 App Router, React 19, TypeScript, Firebase Admin Firestore, Vitest, Testing Library, Playwright

**Spec:** `docs/superpowers/specs/2026-09-03-payapp-live-payment-design.md`

## Global Constraints

- 990원 상품은 페이앱 최소 결제금액에 맞춰 1,000원으로 변경한다.
- `PAYAPP_LINK_KEY`, `PAYAPP_LINK_VALUE`와 구매자 전체 전화번호는 클라이언트·로그·Firestore에 노출하지 않는다.
- 결제 요청 성공이나 복귀 URL만으로 혜택을 지급하지 않는다.
- 동일 완료 통보가 반복되어도 혜택은 한 번만 적용한다.
- 실제 페이앱 호출·취소·운영 환경 변수 변경·배포는 실행하지 않는다.
- 운영 코드는 실제 페이앱 REST 계약을 사용하고 자동화 테스트는 주입된 전송기 또는 안전한 테스트 서버만 사용한다.

---

### Task 1: 페이앱 프로토콜과 상품 계약

**Files:**
- Create: `src/lib/payments/payapp.ts`
- Modify: `src/lib/purchases/plans.ts`
- Modify: `src/lib/domain/types.ts`
- Modify: `.env.example`
- Test: `tests/unit/lib/payapp.test.ts`
- Test: `tests/unit/lib/purchase-repository.test.ts`

**Interfaces:**
- Produces: `getPayAppConfig(env): PayAppConfig`
- Produces: `requestPayAppPayment(input, transport?): Promise<PayAppPaymentRequestResult>`
- Produces: `cancelPayAppPayment(input, transport?): Promise<void>`
- Produces: `verifyPayAppFeedback(values, config): boolean`
- Produces: `normalizeBuyerPhone(value): string | null`
- Produces: `Purchase.provider`에 `PAYAPP`, `Purchase.amount`에 `1000`과 페이앱 주문 메타데이터

- [ ] **Step 1: 페이앱 계약 실패 테스트 작성**

```ts
it('서버 상품 금액과 콜백 주소로 페이앱 FORM 요청을 만든다', async () => {
  const sent: URLSearchParams[] = [];
  const result = await requestPayAppPayment({
    buyerPhone: '010-1234-5678',
    orderId: 'order_public_random',
    plan: { amount: 1000, label: '워터마크 제거' },
    publicId: 'public-1',
    requestId: 'request-1',
  }, async (_url, init) => {
    sent.push(init.body as URLSearchParams);
    return new Response('state=1&mul_no=2000&payurl=https%3A%2F%2Fpayapp.kr%2Fpay%2F2000');
  });

  expect(Object.fromEntries(sent[0])).toMatchObject({
    cmd: 'payrequest',
    price: '1000',
    recvphone: '01012345678',
    var1: 'order_public_random',
    var2: 'request-1',
  });
  expect(result).toEqual({ providerOrderId: '2000', payUrl: 'https://payapp.kr/pay/2000' });
});
```

- [ ] **Step 2: 계약 테스트 RED 확인**

Run: `npm test -- tests/unit/lib/payapp.test.ts tests/unit/lib/purchase-repository.test.ts`

Expected: `requestPayAppPayment` 미정의, 990원 금액 또는 `PAYAPP` 타입 부재로 FAIL

- [ ] **Step 3: 최소 프로토콜 구현**

```ts
export type PayAppTransport = (url: string, init: RequestInit) => Promise<Response>;

export async function requestPayAppPayment(
  input: PayAppPaymentRequestInput,
  transport: PayAppTransport = fetch,
): Promise<PayAppPaymentRequestResult> {
  const config = getPayAppConfig();
  const body = new URLSearchParams({
    cmd: 'payrequest',
    userid: config.userId,
    goodname: input.plan.label,
    price: String(input.plan.amount),
    recvphone: input.buyerPhone,
    feedbackurl: `${config.appUrl}/api/payments/payapp/feedback`,
    returnurl: `${config.appUrl}/api/payments/payapp/return?orderId=${encodeURIComponent(input.orderId)}`,
    var1: input.orderId,
    var2: input.requestId,
    smsuse: 'n',
    checkretry: 'y',
  });
  const response = await transport('https://api.payapp.kr/oapi/apiLoad.html', { method: 'POST', body });
  return parsePayAppPaymentResponse(await response.text());
}
```

Configuration errors, timeout errors, non-HTTPS `payurl`, malformed `mul_no`, and upstream error text are converted to typed server errors with safe public messages.

- [ ] **Step 4: 계약 테스트 GREEN 확인**

Run: `npm test -- tests/unit/lib/payapp.test.ts tests/unit/lib/purchase-repository.test.ts`

Expected: PASS

- [ ] **Step 5: Task 1 커밋**

```bash
git add .env.example src/lib/payments/payapp.ts src/lib/purchases/plans.ts src/lib/domain/types.ts tests/unit/lib/payapp.test.ts tests/unit/lib/purchase-repository.test.ts
git commit -m "페이앱 결제 프로토콜 추가"
```

### Task 2: 멱등 주문 저장과 혜택 적용

**Files:**
- Create: `src/lib/purchases/orders.ts`
- Modify: `firestore.indexes.json`
- Test: `tests/unit/lib/purchase-orders.test.ts`
- Test: `tests/integration/purchase-orders.test.ts`

**Interfaces:**
- Consumes: `PurchasePlan`, `Purchase`, `PayAppPaymentRequestResult`
- Produces: `createPendingPurchase(input): Promise<PendingPurchaseResult>`
- Produces: `attachProviderPayment(input): Promise<void>`
- Produces: `failPendingPurchase(input): Promise<void>`
- Produces: `findPurchaseByOrderId(orderId): Promise<PurchaseRecord | null>`
- Produces: `applyPayAppFeedback(input): Promise<'APPLIED' | 'DUPLICATE' | 'UPDATED'>`
- Produces: `getManagedPurchase(publicId, orderId): Promise<Purchase | null>`

- [ ] **Step 1: 주문 멱등성 실패 테스트 작성**

```ts
it('동일한 완료 통보를 두 번 처리해도 인원 한도를 한 번만 늘린다', async () => {
  await createPendingPurchase(capacityOrder);
  await attachProviderPayment({ orderId: capacityOrder.orderId, providerOrderId: '2000', payUrl: 'https://payapp.kr/pay/2000' });

  expect(await applyPayAppFeedback(completedFeedback)).toBe('APPLIED');
  expect(await applyPayAppFeedback(completedFeedback)).toBe('DUPLICATE');

  expect((await readSketchbook()).participantLimit).toBe(20);
  expect((await readPurchase()).benefitAppliedAt).toBeTruthy();
});
```

- [ ] **Step 2: 주문 테스트 RED 확인**

Run: `npm test -- tests/unit/lib/purchase-orders.test.ts`

Run with Emulator: `$env:FIREBASE_PROJECT_ID='sketch-me-local'; $env:FIRESTORE_EMULATOR_HOST='127.0.0.1:8080'; npm test -- tests/integration/purchase-orders.test.ts`

Expected: 주문 함수 부재로 FAIL

- [ ] **Step 3: Firestore 트랜잭션 구현**

`createPendingPurchase`는 기존 요청 ID 문서를 재사용하고 다른 상품으로 재사용된 요청 ID를 거부한다. `applyPayAppFeedback`은 주문의 `providerOrderId`, `amount`, `productType`, `paymentStatus`, `benefitAppliedAt`을 검증한 후 같은 트랜잭션에서 스케치북 한도 또는 워터마크 권한과 주문 상태를 갱신한다. 주문 조회용 `orderId` 컬렉션 그룹 인덱스를 `firestore.indexes.json`에 선언한다.

- [ ] **Step 4: 주문 테스트 GREEN 확인**

Run: `npm test -- tests/unit/lib/purchase-orders.test.ts`

Run with Emulator: `$env:FIREBASE_PROJECT_ID='sketch-me-local'; $env:FIRESTORE_EMULATOR_HOST='127.0.0.1:8080'; npm test -- tests/integration/purchase-orders.test.ts`

Expected: PASS

- [ ] **Step 5: Task 2 커밋**

```bash
git add firestore.indexes.json src/lib/purchases/orders.ts tests/unit/lib/purchase-orders.test.ts tests/integration/purchase-orders.test.ts
git commit -m "결제 주문 멱등 처리 추가"
```

### Task 3: 결제 요청·통보·복귀·조회 API

**Files:**
- Modify: `src/app/api/manage/[publicId]/purchase/route.ts`
- Create: `src/app/api/payments/payapp/feedback/route.ts`
- Create: `src/app/api/payments/payapp/return/route.ts`
- Create: `src/app/api/manage/[publicId]/purchases/[orderId]/route.ts`
- Test: `tests/unit/api/purchase-route.test.ts`
- Create: `tests/unit/api/payapp-feedback-route.test.ts`
- Create: `tests/unit/api/payapp-return-route.test.ts`
- Create: `tests/unit/api/purchase-status-route.test.ts`

**Interfaces:**
- Consumes: Task 1 페이앱 클라이언트와 Task 2 주문 저장 함수
- Produces: `POST /api/manage/:publicId/purchase` → `{ orderId, payUrl }`
- Produces: `POST /api/payments/payapp/feedback` → `SUCCESS`
- Produces: `GET|POST /api/payments/payapp/return` → HTTP 303 결과 화면
- Produces: `GET /api/manage/:publicId/purchases/:orderId` → 안전한 주문 상태와 혜택 설명

- [ ] **Step 1: API 보안 실패 테스트 작성**

```ts
it('결제 요청 응답만으로 혜택을 적용하지 않고 결제 URL을 반환한다', async () => {
  const response = await POST(paymentRequest, context);
  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toEqual({
    orderId: expect.any(String),
    payUrl: 'https://payapp.kr/pay/2000',
  });
  expect(applyPayAppFeedback).not.toHaveBeenCalled();
});

it('금액이 다른 완료 통보는 혜택을 적용하지 않는다', async () => {
  const response = await POST_FEEDBACK(formRequest({ pay_state: '4', price: '1' }));
  expect(response.status).toBe(400);
  expect(await response.text()).not.toBe('SUCCESS');
});
```

- [ ] **Step 2: API 테스트 RED 확인**

Run: `npm test -- tests/unit/api/purchase-route.test.ts tests/unit/api/payapp-feedback-route.test.ts tests/unit/api/payapp-return-route.test.ts tests/unit/api/purchase-status-route.test.ts`

Expected: 신규 Route Handler 부재와 기존 즉시 혜택 응답으로 FAIL

- [ ] **Step 3: Route Handler 최소 구현**

결제 요청은 JSON을 검증하고 주문을 먼저 저장한 뒤 페이앱을 호출한다. 통보는 `request.formData()`로 알려진 필드만 문자열로 읽고 비밀값·금액·주문번호를 검증한다. 복귀 Route Handler는 `NextResponse.redirect(resultUrl, 303)`을 사용한다. 상태 조회는 관리 세션이 확인된 동일 스케치북 주문만 반환하며 `payUrl`, 전화번호, 공급자 원문은 제외한다.

- [ ] **Step 4: API 테스트 GREEN 확인**

Run: `npm test -- tests/unit/api/purchase-route.test.ts tests/unit/api/payapp-feedback-route.test.ts tests/unit/api/payapp-return-route.test.ts tests/unit/api/purchase-status-route.test.ts`

Expected: PASS

- [ ] **Step 5: Task 3 커밋**

```bash
git add src/app/api/manage/[publicId]/purchase/route.ts src/app/api/manage/[publicId]/purchases/[orderId]/route.ts src/app/api/payments/payapp/feedback/route.ts src/app/api/payments/payapp/return/route.ts tests/unit/api
git commit -m "페이앱 결제 API 연결"
```

### Task 4: 결제 입력과 결과 UX

**Files:**
- Modify: `src/app/m/[publicId]/ManageDashboard.tsx`
- Modify: `src/app/m/[publicId]/share/WatermarkPurchaseButton.tsx`
- Create: `src/components/ui/BuyerPhoneField.tsx`
- Create: `src/app/m/[publicId]/payment/result/page.tsx`
- Create: `src/app/m/[publicId]/payment/result/PaymentResult.tsx`
- Modify: `src/app/globals.css`
- Test: `tests/unit/ui/manage-dashboard.test.tsx`
- Test: `tests/unit/ui/watermark-purchase-button.test.tsx`
- Create: `tests/unit/ui/payment-result.test.tsx`

**Interfaces:**
- Consumes: 결제 요청 API의 `{ orderId, payUrl }`와 상태 API
- Produces: 전화번호 입력 오류, 요청 중 상태, 외부 결제창 이동, 서버 검증 기반 결과 표시

- [ ] **Step 1: 사용자 흐름 실패 테스트 작성**

```tsx
it('유효한 전화번호로 결제 요청 후 페이앱 URL로 이동한다', async () => {
  render(<ManageDashboard {...props} />);
  fireEvent.change(screen.getByLabelText('결제용 휴대전화번호'), { target: { value: '010-1234-5678' } });
  fireEvent.click(screen.getByRole('button', { name: '1,000원 결제하기' }));
  await waitFor(() => expect(assignPaymentLocation).toHaveBeenCalledWith('https://payapp.kr/pay/2000'));
  expect(screen.queryByText('결제가 완료됐습니다')).not.toBeInTheDocument();
});

it('서버 주문이 완료된 경우에만 완료 결과를 표시한다', async () => {
  render(<PaymentResult publicId="public-1" orderId="order-1" />);
  expect(await screen.findByRole('heading', { name: '결제가 완료됐습니다' })).toBeVisible();
});
```

- [ ] **Step 2: UI 테스트 RED 확인**

Run: `npm test -- tests/unit/ui/manage-dashboard.test.tsx tests/unit/ui/watermark-purchase-button.test.tsx tests/unit/ui/payment-result.test.tsx`

Expected: 전화번호 입력과 결과 컴포넌트 부재로 FAIL

- [ ] **Step 3: UI 최소 구현**

두 결제 진입점에서 같은 전화번호 정규화·오류 문구를 사용한다. `window.location.assign(payUrl)` 호출은 HTTPS 페이앱 URL 응답 후에만 실행한다. 결과 컴포넌트는 `READY`일 때 2초 간격, 최대 15회 조회하고 완료·실패·취소 시 중단한다. 기존 모의 완료 팝업은 제거한다.

- [ ] **Step 4: UI 테스트 GREEN 확인**

Run: `npm test -- tests/unit/ui/manage-dashboard.test.tsx tests/unit/ui/watermark-purchase-button.test.tsx tests/unit/ui/payment-result.test.tsx`

Expected: PASS

- [ ] **Step 5: Task 4 커밋**

```bash
git add src/app/globals.css src/app/m/[publicId] src/components/ui/BuyerPhoneField.tsx tests/unit/ui
git commit -m "실결제 사용자 흐름 연결"
```

### Task 5: 관리자 결제 조회와 전체 취소

**Files:**
- Modify: `src/lib/admin/repository.ts`
- Modify: `src/lib/admin/types.ts`
- Modify: `src/app/admin/(protected)/payments/AdminPaymentList.tsx`
- Create: `src/app/admin/(protected)/payments/AdminPaymentCancelButton.tsx`
- Create: `src/app/api/admin/payments/[orderId]/cancel/route.ts`
- Test: `tests/unit/ui/admin-payments.test.tsx`
- Create: `tests/unit/api/admin-payment-cancel-route.test.ts`
- Modify: `tests/unit/admin/repository.test.ts`

**Interfaces:**
- Consumes: `cancelPayAppPayment`, `findPurchaseByOrderId`, 관리자 세션·Origin 검증
- Produces: 인증된 `POST /api/admin/payments/:orderId/cancel`
- Produces: PAYAPP/MOCK 공급자와 READY/SUCCEEDED/FAILED/CANCELLED 상태 표시

- [ ] **Step 1: 관리자 취소 실패 테스트 작성**

```ts
it('성공한 PAYAPP 주문만 인증된 관리자가 전체 취소할 수 있다', async () => {
  const response = await POST(cancelRequest, { params: Promise.resolve({ orderId: 'order-1' }) });
  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toEqual({ cancelRequested: true });
});

it('MOCK 주문에는 취소 버튼을 표시하지 않는다', () => {
  render(<AdminPaymentList items={[mockPurchase]} nextCursor={null} />);
  expect(screen.queryByRole('button', { name: '전체 취소' })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: 관리자 테스트 RED 확인**

Run: `npm test -- tests/unit/api/admin-payment-cancel-route.test.ts tests/unit/ui/admin-payments.test.tsx tests/unit/admin/repository.test.ts`

Expected: 취소 Route Handler와 PAYAPP 표시 부재로 FAIL

- [ ] **Step 3: 관리자 기능 최소 구현**

기존 관리자 인증과 정확한 Origin 검증을 재사용한다. `PAYAPP`이면서 `SUCCEEDED`, `providerOrderId`가 있는 주문만 취소 요청한다. 목록·대시보드 통계의 `provider == MOCK` 고정 필터를 제거하고 상태별 레이블을 표시한다. 취소 응답 후 UI는 목록을 새로고침하되 혜택을 자동 회수하지 않는다.

- [ ] **Step 4: 관리자 테스트 GREEN 확인**

Run: `npm test -- tests/unit/api/admin-payment-cancel-route.test.ts tests/unit/ui/admin-payments.test.tsx tests/unit/admin/repository.test.ts`

Expected: PASS

- [ ] **Step 5: Task 5 커밋**

```bash
git add src/app/admin src/app/api/admin/payments src/lib/admin tests/unit/api/admin-payment-cancel-route.test.ts tests/unit/ui/admin-payments.test.tsx tests/unit/admin/repository.test.ts
git commit -m "관리자 결제 취소 기능 추가"
```

### Task 6: 정책 문서·운영 안내·전체 검증

**Files:**
- Modify: `src/app/terms/page.tsx`
- Modify: `src/app/privacy/page.tsx`
- Modify: `README.md`
- Modify: `tests/unit/ui/terms-page.test.tsx`
- Modify: `tests/unit/ui/privacy-page.test.tsx`
- Modify: `tests/e2e/sketchbook-flow.spec.ts`
- Modify: `tests/e2e/admin-flow.spec.ts`

**Interfaces:**
- Consumes: 실제 가격, 결제대행사, 전화번호 처리, 결제·취소 상태
- Produces: 심사 화면과 운영자가 확인할 수 있는 일관된 정책·런북·브라우저 회귀 테스트

- [ ] **Step 1: 정책과 E2E 실패 테스트 작성**

```tsx
it('페이앱 결제와 결제용 휴대전화번호 처리를 고지한다', () => {
  render(<PrivacyPage />);
  expect(screen.getByText(/페이앱/)).toBeVisible();
  expect(screen.getByText(/휴대전화번호/)).toBeVisible();
});
```

Playwright는 외부 결제 호출을 안전한 테스트 전송기로 대체하고 `READY → SUCCEEDED` 통보를 발생시킨 뒤 결과 화면과 관리자 주문을 확인한다.

- [ ] **Step 2: 정책 테스트 RED 확인**

Run: `npm test -- tests/unit/ui/terms-page.test.tsx tests/unit/ui/privacy-page.test.tsx`

Expected: 페이앱·전화번호·1,000원 고지 부재로 FAIL

- [ ] **Step 3: 정책과 운영 런북 구현**

약관에 네 상품 가격, 페이앱 결제대행, 결제 완료 기준, 전체 취소 문의를 반영한다. 개인정보 처리방침에 결제용 휴대전화번호, 페이앱 제공 목적·항목·보유 기준을 반영하되 확인되지 않은 사업자 정보는 만들지 않는다. README에는 판매자 설정, App Hosting 비밀 변수, HTTPS feedback/return URL, 소액 승인·전체 취소 운영 검증 순서를 기록한다.

- [ ] **Step 4: 전체 자동화 검증**

Run: `npm test`

Expected: 모든 단위 테스트 PASS, Firebase Emulator가 없는 통합 테스트만 명시적으로 SKIP

Run: `npm run lint`

Expected: 오류와 경고 없이 PASS

Run: `npm run build`

Expected: TypeScript와 프로덕션 빌드 PASS

Run: `$env:PLAYWRIGHT_BASE_URL='http://127.0.0.1:3100'; npm run test:e2e -- tests/e2e/sketchbook-flow.spec.ts tests/e2e/admin-flow.spec.ts --project=mobile-chrome`

Expected: 결제 요청·완료 통보·결과·관리자 흐름 PASS

- [ ] **Step 5: 비밀정보와 변경 범위 검토**

Run: `rg -n "PAYAPP_LINK_KEY|PAYAPP_LINK_VALUE|모의 결제가 완료됐습니다|990원" src README.md .env.example`

Expected: 비밀 변수는 서버 코드의 `process.env` 조회와 빈 `.env.example` 키에만 존재하고 실제 값은 없으며, 운영 UI에 모의 완료 문구와 990원 상품이 없음

Run: `git diff --check`

Expected: 오류 없음

- [ ] **Step 6: Task 6 커밋**

```bash
git add README.md src/app/terms/page.tsx src/app/privacy/page.tsx tests/unit/ui/terms-page.test.tsx tests/unit/ui/privacy-page.test.tsx tests/e2e
git commit -m "페이앱 운영 정책과 검증 추가"
```
