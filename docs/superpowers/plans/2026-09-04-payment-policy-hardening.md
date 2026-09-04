# 결제 정책 및 거래 보존 강화 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 결제 기록을 스케치북 삭제와 분리해 보존하고, PayApp 취소 상태·혜택 회수·구매자 고지·전자 영수증을 운영 가능한 수준으로 보완한다.

**Architecture:** 기존 스케치북 하위 구매 문서는 운영 주문으로 유지하고 최상위 `legalTransactionRecords`에 최소 거래 장부를 원자적으로 미러링한다. PayApp 상태 변환과 혜택 적용·회수는 `orders.ts`의 단일 Firestore 트랜잭션 경계에서 처리하며, 사용자 화면은 보호된 상태 조회 API가 제공하는 영수증용 최소 필드만 사용한다.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Firebase Admin/Firestore, Vitest, Testing Library, Playwright

**Spec:** `docs/superpowers/specs/2026-09-04-payment-policy-hardening-design.md`

## Global Constraints

- 전체 휴대전화번호, PayApp 연동 비밀값, 결제수단 상세정보, 그림과 메시지는 법정 거래 장부에 저장하지 않는다.
- 기존 작업 중인 `src/app/globals.css`, `src/app/m/[publicId]/ManageDashboard.tsx`, `src/app/m/[publicId]/ShareSketchbookButton.tsx`, `tests/unit/ui/share-sketchbook-button.test.tsx` 변경을 되돌리거나 덮어쓰지 않는다.
- 실제 고객센터 전화번호, 통신판매업 신고번호 또는 면제 사유, 과세 유형이 없으면 외부 결제 요청 전에 안전하게 중단한다.
- 운영 환경 설정과 Firebase Secret 생성·권한 부여·배포는 별도 승인과 실제 값 없이는 실행하지 않는다.
- 새 동작은 실패하는 테스트를 먼저 확인한 뒤 최소 구현으로 통과시킨다.
- UI는 최대 650px 모바일 흐름, 기존 종이·잉크·블루그레이 디자인 시스템, 44px 이상 터치 영역을 유지한다.

---

### Task 1: 법정 거래 장부와 주문 미러링

**Files:**
- Create: `src/lib/purchases/legal-records.ts`
- Modify: `src/lib/domain/types.ts`
- Modify: `src/lib/purchases/orders.ts`
- Test: `tests/unit/lib/purchase-orders.test.ts`

**Interfaces:**
- Produces: `LegalTransactionRecord`, `getLegalRecordReference(firestore, orderId)`, `buildLegalRecordWrite(purchase, now)`
- Consumes: 기존 `Purchase`, `PurchaseRecord`, Firestore transaction의 `set(..., { merge: true })`

- [ ] **Step 1: 거래 장부 미러링 실패 테스트 작성**

  `createFirestoreDouble()`에 최상위 `legalTransactionRecords` 저장소를 추가하고 새 READY 주문 생성 후 다음을 검증한다.

  ```ts
  expect(state.legalRecords.get('order-public-random')).toMatchObject({
    amount: 1000,
    buyerPhoneLast4: '5678',
    orderId: 'order-public-random',
    paymentStatus: 'READY',
    retentionExpiresAt: new Date('2031-09-04T00:00:00.000Z'),
  });
  expect(JSON.stringify(state.legalRecords.get('order-public-random')))
    .not.toContain('01012345678');
  ```

- [ ] **Step 2: RED 확인**

  Run: `npm test -- tests/unit/lib/purchase-orders.test.ts`

  Expected: `legalRecords` 또는 법정 장부 쓰기가 없어 FAIL

- [ ] **Step 3: 거래 장부 타입과 빌더 구현**

  `LegalTransactionRecord`에는 주문·공급자·상품·금액·상태·동의·결제 및 취소 시각·원본 상태·5년 만료일만 정의한다. `addCalendarYears(now, 5)`로 만료일을 계산하고 `undefined` 값은 Firestore 쓰기 객체에서 제외한다.

- [ ] **Step 4: 주문 생성·공급자 연결·실패 처리에 장부 미러링 추가**

  운영 주문과 거래 장부를 같은 Firestore 트랜잭션에서 `set`/`update`한다. 기존 READY 주문을 재사용할 때 누락된 동의 기록도 두 문서에 함께 보완한다.

- [ ] **Step 5: GREEN 확인**

  Run: `npm test -- tests/unit/lib/purchase-orders.test.ts`

  Expected: READY 주문과 공급자 연결 테스트 PASS

- [ ] **Step 6: 커밋**

  ```powershell
  git add -- src/lib/domain/types.ts src/lib/purchases/legal-records.ts src/lib/purchases/orders.ts tests/unit/lib/purchase-orders.test.ts
  git commit -m "결제 법정 장부 분리"
  ```

### Task 2: PayApp 상태·부분취소·혜택 회수

**Files:**
- Modify: `src/lib/domain/types.ts`
- Modify: `src/lib/purchases/orders.ts`
- Modify: `src/app/api/payments/payapp/feedback/route.ts`
- Modify: `src/lib/admin/types.ts`
- Modify: `src/lib/admin/repository.ts`
- Modify: `src/app/admin/(protected)/payments/AdminPaymentList.tsx`
- Test: `tests/unit/lib/purchase-orders.test.ts`
- Test: `tests/unit/api/payapp-feedback-route.test.ts`
- Test: `tests/unit/admin/repository.test.ts`
- Test: `tests/unit/ui/admin-payments.test.tsx`

**Interfaces:**
- Produces: `PurchaseStatus`의 `PARTIALLY_CANCELLED`, `cancelledAmount`, `providerPayState`, `benefitRevokedAt`, `benefitAdjustmentRequired`
- Consumes: PayApp `pay_state`, 선택적 `cancelprice`, 기존 구매 혜택 필드

- [ ] **Step 1: 상태 매핑과 취소금액 실패 테스트 작성**

  표 기반으로 `1/10 → READY`, `8/16/31/32/9/64 → CANCELLED`, `70/71 → PARTIALLY_CANCELLED`, `999 → REVIEW_REQUIRED`를 검증한다. 부분취소에서 `cancelprice`가 없거나 0 이하·결제금액 초과이면 `REVIEW_REQUIRED`와 `benefitAdjustmentRequired: true`가 저장되는 테스트를 추가한다.

- [ ] **Step 2: 전액취소 혜택 회수 실패 테스트 작성**

  성공 처리 후 `payState: '9'`를 전달하여 추가 인원 한도가 `30 → 20`으로 한 번만 감소하고 두 번째 통보에서는 더 줄지 않는지 검증한다. 참여자 수가 25이면 한도가 25 아래로 내려가지 않는 사례도 추가한다. 워터마크 주문은 취소되지 않은 다른 워터마크 구매가 없을 때만 `watermarkFree: false`가 되는지 검증한다.

- [ ] **Step 3: RED 확인**

  Run: `npm test -- tests/unit/lib/purchase-orders.test.ts tests/unit/api/payapp-feedback-route.test.ts`

  Expected: 부분취소 상태 부재와 혜택 미회수로 FAIL

- [ ] **Step 4: 피드백 파싱과 상태 전이 구현**

  피드백 Route Handler에서 `cancelprice`를 숫자 문자열일 때만 전달한다. `applyPayAppFeedback()`는 원본 상태를 항상 기록하고 알 수 없는 상태를 `FAILED`가 아닌 `REVIEW_REQUIRED`로 보낸다. 부분취소는 누적 취소금액과 조정 필요 상태를 기록하며 혜택을 자동 회수하지 않는다.

- [ ] **Step 5: 전액취소 혜택 회수 구현**

  `benefitAppliedAt && !benefitRevokedAt`일 때만 회수한다. 추가 인원은 `Math.max(10, participantCount, participantLimit - additionalLimit)`, 워터마크는 다른 유효한 워터마크 성공 주문이 없을 때만 비활성화한다. 운영 주문과 거래 장부에 `benefitRevokedAt`을 함께 기록한다.

- [ ] **Step 6: 관리자 표시 구현**

  관리자 목록에 `부분취소`, 누적 취소금액, 원본 PayApp 상태, `혜택 조정 확인 필요`를 텍스트로 표시하고 부분취소 주문에는 전체 취소 버튼을 노출하지 않는다.

- [ ] **Step 7: GREEN 확인**

  Run: `npm test -- tests/unit/lib/purchase-orders.test.ts tests/unit/api/payapp-feedback-route.test.ts tests/unit/admin/repository.test.ts tests/unit/ui/admin-payments.test.tsx`

  Expected: 네 테스트 파일 PASS

- [ ] **Step 8: 커밋**

  ```powershell
  git add -- src/lib/domain/types.ts src/lib/purchases/orders.ts src/app/api/payments/payapp/feedback/route.ts src/lib/admin/types.ts src/lib/admin/repository.ts 'src/app/admin/(protected)/payments/AdminPaymentList.tsx' tests/unit/lib/purchase-orders.test.ts tests/unit/api/payapp-feedback-route.test.ts tests/unit/admin/repository.test.ts tests/unit/ui/admin-payments.test.tsx
  git commit -m "결제 취소 상태 및 혜택 회수"
  ```

### Task 3: 스케치북 삭제 전 거래 장부 보존

**Files:**
- Modify: `src/lib/purchases/legal-records.ts`
- Modify: `src/lib/sketchbooks/repository.ts`
- Test: `tests/unit/lib/purchase-repository.test.ts`

**Interfaces:**
- Produces: `archiveLegacyPurchasesBeforeSketchbookDelete(sketchbookId)`
- Consumes: `sketchbooks/{id}/purchases` 스냅샷과 `legalTransactionRecords`

- [ ] **Step 1: 삭제 전 이관 실패 테스트 작성**

  구매 하위 문서가 있는 스케치북 삭제 시 법정 장부가 먼저 merge 저장된 뒤 `recursiveDelete`가 호출되는 순서를 검증한다. 장부 쓰기가 거부되면 `recursiveDelete`가 호출되지 않는 테스트도 작성한다.

- [ ] **Step 2: RED 확인**

  Run: `npm test -- tests/unit/lib/purchase-repository.test.ts`

  Expected: 기존 `deleteSketchbookPermanently()`가 즉시 `recursiveDelete`해 FAIL

- [ ] **Step 3: 기존 주문 이관 구현**

  삭제 함수가 구매 하위 문서를 읽어 각 주문을 거래 장부 형태로 변환하고 Firestore batch로 merge한 뒤에만 기존 트리를 삭제하게 한다. 구매가 없으면 추가 쓰기 없이 삭제한다.

- [ ] **Step 4: GREEN 확인**

  Run: `npm test -- tests/unit/lib/purchase-repository.test.ts tests/unit/api/manage-sketchbook-delete.test.ts tests/unit/api/admin-sketchbook-delete-route.test.ts`

  Expected: 삭제 경로 테스트 PASS

- [ ] **Step 5: 커밋**

  ```powershell
  git add -- src/lib/purchases/legal-records.ts src/lib/sketchbooks/repository.ts tests/unit/lib/purchase-repository.test.ts
  git commit -m "스케치북 삭제 거래 기록 보존"
  ```

### Task 4: 과세 유형과 운영 결제 준비 상태

**Files:**
- Modify: `src/lib/payments/payapp.ts`
- Modify: `src/lib/business.ts`
- Modify: `src/components/ui/BusinessDisclosure.tsx`
- Modify: `src/app/api/manage/[publicId]/purchase/route.ts`
- Modify: `README.md`
- Test: `tests/unit/lib/payapp.test.ts`
- Test: `tests/unit/api/purchase-route.test.ts`
- Test: `tests/unit/ui/terms-page.test.tsx`

**Interfaces:**
- Produces: `PayAppTaxMode`, 공개 사업자 연락처/통신판매업 정보, 운영 준비 검증
- Consumes: `PAYAPP_TAX_MODE`, `NEXT_PUBLIC_BUSINESS_PHONE`, 신고번호 또는 면제 사유

- [ ] **Step 1: 설정과 세액 요청 실패 테스트 작성**

  설정값이 빠졌을 때 `PayAppConfigurationError`가 발생하는 테스트를 추가한다. `TAXABLE`에서 4,490원을 공급가액 4,082원·부가세 408원으로, `TAX_FREE`에서 면세금액 4,490원으로 요청하는 transport 경계 테스트를 작성한다.

- [ ] **Step 2: 사업자 필수 정보 실패 테스트 작성**

  전화번호 또는 신고번호/면제 사유가 없으면 구매 Route Handler가 PayApp을 호출하지 않고 503을 반환하는 테스트를 작성한다. 두 값이 있으면 기존 결제 요청이 진행되는 테스트 환경을 갱신한다.

- [ ] **Step 3: RED 확인**

  Run: `npm test -- tests/unit/lib/payapp.test.ts tests/unit/api/purchase-route.test.ts tests/unit/ui/terms-page.test.tsx`

  Expected: 과세 필드와 준비 상태 검증 부재로 FAIL

- [ ] **Step 4: 과세 요청과 준비 상태 구현**

  `getPayAppConfig()`가 과세 유형을 검증하고 결제 요청 본문에 `amount_taxable`/`amount_vat` 또는 `amount_taxfree`를 추가한다. 공개 사업자 정보는 전화번호와 신고정보를 선택적으로 읽되, 구매 API는 둘 다 준비됐는지 서버에서 확인한다.

- [ ] **Step 5: 사업자 표시와 운영 문서 구현**

  판매자 정보에 전화번호와 통신판매업 신고번호 또는 면제 사유를 표시한다. README에 필요한 환경변수, Firebase Secret 등록·접근권한 명령, 세무 확인, 소액 승인·전액취소·부분취소 검증 순서를 기록한다. 실제 값과 운영 설정은 변경하지 않는다.

- [ ] **Step 6: GREEN 확인**

  Run: `npm test -- tests/unit/lib/payapp.test.ts tests/unit/api/purchase-route.test.ts tests/unit/ui/terms-page.test.tsx`

  Expected: 세 테스트 파일 PASS

- [ ] **Step 7: 커밋**

  ```powershell
  git add -- src/lib/payments/payapp.ts src/lib/business.ts src/components/ui/BusinessDisclosure.tsx 'src/app/api/manage/[publicId]/purchase/route.ts' README.md tests/unit/lib/payapp.test.ts tests/unit/api/purchase-route.test.ts tests/unit/ui/terms-page.test.tsx
  git commit -m "결제 운영 설정 검증"
  ```

### Task 5: 디지털 콘텐츠·미성년자 결제 동의

**Files:**
- Modify: `src/lib/purchases/consent.ts`
- Modify: `src/components/ui/PurchaseConsent.tsx`
- Modify: `src/app/m/[publicId]/ManageDashboard.tsx`
- Modify: `src/app/m/[publicId]/share/WatermarkPurchaseButton.tsx`
- Modify: `src/app/api/manage/[publicId]/purchase/route.ts`
- Modify: `src/lib/purchases/orders.ts`
- Test: `tests/unit/api/purchase-route.test.ts`
- Test: `tests/unit/ui/manage-dashboard.test.tsx`
- Test: `tests/unit/ui/watermark-purchase-button.test.tsx`

**Interfaces:**
- Produces: `legalCapacityConsent`, `legalCapacityConsentAt`, `legalCapacityConsentVersion`
- Consumes: 기존 `digitalContentConsent`와 동의 버전

- [ ] **Step 1: 두 동의 필수 검증 실패 테스트 작성**

  API 테스트에 디지털 콘텐츠 동의 또는 미성년자 관련 확인 중 하나라도 false/누락이면 400이고 PayApp이 호출되지 않는 사례를 추가한다. 성공 요청은 두 값을 모두 true로 보낸다.

- [ ] **Step 2: 두 결제 진입점 UI 실패 테스트 작성**

  관리 화면과 워터마크 결제 화면에서 두 체크박스를 모두 선택하기 전 결제 버튼이 비활성이고, 둘 다 선택한 요청 본문에 두 동의 값이 포함되는지 검증한다.

- [ ] **Step 3: RED 확인**

  Run: `npm test -- tests/unit/api/purchase-route.test.ts tests/unit/ui/manage-dashboard.test.tsx tests/unit/ui/watermark-purchase-button.test.tsx`

  Expected: 두 번째 동의와 서버 검증 부재로 FAIL

- [ ] **Step 4: 동의 컴포넌트와 서버 저장 구현**

  `PurchaseConsent`를 두 제어값을 받는 컴포넌트로 변경하고 무료 체험·미리보기, 7일 청약철회 원칙, 즉시 제공 제한, 미성년자 법정대리인 동의를 간결하게 표시한다. API가 두 동의를 검증하고 주문·거래 장부에 각각 시각과 버전을 기록한다.

- [ ] **Step 5: 기존 사용자 변경 보존 확인**

  `git diff -- src/app/m/[publicId]/ManageDashboard.tsx`로 작업 전 존재하던 변경이 유지됐는지 확인하고 동의 관련 구간만 추가한다. `ShareSketchbookButton.tsx`와 공유 버튼 테스트는 수정하지 않는다.

- [ ] **Step 6: GREEN 확인**

  Run: `npm test -- tests/unit/api/purchase-route.test.ts tests/unit/ui/manage-dashboard.test.tsx tests/unit/ui/watermark-purchase-button.test.tsx`

  Expected: 세 테스트 파일 PASS

- [ ] **Step 7: 커밋**

  `ManageDashboard.tsx`는 기존 사용자 변경과 결제 동의 변경이 같은 파일에 있으므로 `git diff`로 범위를 검토한 뒤 결제 관련 변경만 포함할 수 없으면 해당 파일은 최종 통합 커밋까지 보류한다.

  ```powershell
  git add -- src/lib/purchases/consent.ts src/components/ui/PurchaseConsent.tsx 'src/app/m/[publicId]/share/WatermarkPurchaseButton.tsx' 'src/app/api/manage/[publicId]/purchase/route.ts' src/lib/purchases/orders.ts tests/unit/api/purchase-route.test.ts tests/unit/ui/watermark-purchase-button.test.tsx
  git commit -m "결제 필수 동의 보강"
  ```

### Task 6: 보호된 전자 영수증과 환불 신청

**Files:**
- Modify: `src/app/api/manage/[publicId]/purchases/[orderId]/route.ts`
- Modify: `src/app/m/[publicId]/payment/result/PaymentResult.tsx`
- Modify: `src/app/globals.css`
- Test: `tests/unit/api/purchase-status-route.test.ts`
- Test: `tests/unit/ui/payment-result.test.tsx`

**Interfaces:**
- Produces: 영수증용 안전한 주문 응답, 인쇄 버튼, 사전 작성된 이메일 환불 링크
- Consumes: 관리 세션으로 검증된 `PurchaseRecord`, 공개 `BUSINESS_INFO`

- [ ] **Step 1: 안전한 영수증 응답 실패 테스트 작성**

  상태 API가 주문번호, 상품, 금액, 결제수단 유형, 생성·결제·부분취소·취소 시각과 취소금액을 반환하되 휴대전화 끝자리와 PG 주문번호는 반환하지 않는지 검증한다.

- [ ] **Step 2: 영수증 화면 실패 테스트 작성**

  완료 응답으로 주문번호, 상품명, `1,000원`, 결제일, 판매자 정보, 정책 링크, `영수증 인쇄`, `청약철회·환불 신청`을 표시하는지 검증한다. 부분취소 응답은 부분취소 금액과 고객센터 확인 안내를 표시한다.

- [ ] **Step 3: RED 확인**

  Run: `npm test -- tests/unit/api/purchase-status-route.test.ts tests/unit/ui/payment-result.test.tsx`

  Expected: 영수증 상세 필드와 동작 부재로 FAIL

- [ ] **Step 4: API와 영수증 화면 구현**

  API는 ISO 날짜 문자열과 허용된 필드만 직렬화한다. 화면은 기존 `payment-result-card` 안에서 상태 요약, `dl` 거래 정보, 판매자 정보, 정책 링크와 이메일 환불 신청을 순서대로 배치한다. 인쇄 버튼은 `window.print()`를 호출하고 네트워크 오류에서 기존 재시도 동작을 유지한다.

- [ ] **Step 5: 기존 CSS 변경 보존**

  `globals.css`의 `.drawing-picker-option img { width: 70%; margin: 0 auto; }` 변경을 유지한 채 영수증에 필요한 클래스만 파일 끝의 관련 섹션에 추가한다. 그림자와 과도한 둥근 모서리를 추가하지 않는다.

- [ ] **Step 6: GREEN 확인**

  Run: `npm test -- tests/unit/api/purchase-status-route.test.ts tests/unit/ui/payment-result.test.tsx`

  Expected: 두 테스트 파일 PASS

- [ ] **Step 7: 커밋 보류 또는 부분 스테이징**

  `globals.css`의 기존 변경이 결제 작업과 섞이므로 파일 전체를 자동 스테이징하지 않는다. 결제 CSS와 기존 70% 변경을 모두 해비님 요청 범위로 확인할 수 있는 최종 통합 시점에 함께 커밋한다.

### Task 7: 약관·개인정보 처리방침 보완

**Files:**
- Modify: `src/app/terms/page.tsx`
- Modify: `src/app/privacy/page.tsx`
- Test: `tests/unit/ui/terms-page.test.tsx`
- Test: `tests/unit/ui/privacy-page.test.tsx`

**Interfaces:**
- Produces: 청약철회·환불·미성년자·법정 장부 보관 고지
- Consumes: `BUSINESS_INFO`, 결제 동의와 거래 장부 실제 구현

- [ ] **Step 1: 정책 화면 실패 테스트 작성**

  약관에서 7일 청약철회 원칙, 무료 10명·워터마크 미리보기, 접수일부터 3영업일, 결제수단 제한과 판매자 환불 의무 구분, 미성년자 계약 취소, 이메일 신청 항목을 찾는 테스트를 작성한다. 개인정보 처리방침에서는 법정 장부 컬렉션이 콘텐츠와 분리되고 5년 후 파기된다는 설명을 검증한다.

- [ ] **Step 2: RED 확인**

  Run: `npm test -- tests/unit/ui/terms-page.test.tsx tests/unit/ui/privacy-page.test.tsx`

  Expected: 구체적 권리·분리 보관 문구 부재로 FAIL

- [ ] **Step 3: 정책 문구 구현**

  기존 서비스 보장 내용을 유지하면서 환불 기산점을 `환불 대상을 확인한 날`이 아닌 유효한 청약철회 접수일로 고친다. PayApp 결제수단 제한은 처리 방법의 제약일 뿐 법정 환불 의무를 없애지 않는다고 명시한다. 정책 버전과 시행일을 같은 날짜의 새 버전으로 올린다.

- [ ] **Step 4: GREEN 확인**

  Run: `npm test -- tests/unit/ui/terms-page.test.tsx tests/unit/ui/privacy-page.test.tsx`

  Expected: 두 테스트 파일 PASS

- [ ] **Step 5: 커밋**

  ```powershell
  git add -- src/app/terms/page.tsx src/app/privacy/page.tsx tests/unit/ui/terms-page.test.tsx tests/unit/ui/privacy-page.test.tsx
  git commit -m "결제 청약철회 및 보관 정책 보완"
  ```

### Task 8: 통합 검증과 최종 커밋

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/app/m/[publicId]/ManageDashboard.tsx`
- Modify: `tests/unit/ui/manage-dashboard.test.tsx`
- Verify: all changed payment and policy files

**Interfaces:**
- Consumes: Tasks 1–7의 모든 변경
- Produces: 테스트·린트·빌드·브라우저 검증이 끝난 main 작업 트리

- [ ] **Step 1: 관련 테스트 전체 실행**

  ```powershell
  npm test -- tests/unit/lib/purchase-orders.test.ts tests/unit/lib/purchase-repository.test.ts tests/unit/lib/payapp.test.ts tests/unit/api/payapp-feedback-route.test.ts tests/unit/api/purchase-route.test.ts tests/unit/api/purchase-status-route.test.ts tests/unit/api/manage-sketchbook-delete.test.ts tests/unit/api/admin-sketchbook-delete-route.test.ts tests/unit/admin/repository.test.ts tests/unit/ui/admin-payments.test.tsx tests/unit/ui/manage-dashboard.test.tsx tests/unit/ui/watermark-purchase-button.test.tsx tests/unit/ui/payment-result.test.tsx tests/unit/ui/terms-page.test.tsx tests/unit/ui/privacy-page.test.tsx
  ```

  Expected: 모든 테스트 PASS

- [ ] **Step 2: 전체 정적 검증**

  ```powershell
  npm run lint
  npm run build
  ```

  Expected: ESLint와 Next.js 프로덕션 빌드 PASS

- [ ] **Step 3: Impeccable 탐지 실행**

  ```powershell
  node C:\Users\박도영\.agents\skills\impeccable\scripts\detect.mjs --json src/components/ui/PurchaseConsent.tsx src/app/m/[publicId]/payment/result/PaymentResult.tsx src/app/terms/page.tsx src/app/privacy/page.tsx
  ```

  Expected: 차단 수준 디자인 규칙 위반 없음

- [ ] **Step 4: 브라우저 검증**

  개발 서버에서 모바일 390px와 데스크톱 1280px로 관리 결제 팝업, 워터마크 결제 팝업, 완료 영수증, 부분취소 영수증을 확인한다. 키보드만으로 두 동의와 인쇄·환불 링크에 접근하고 긴 주문번호·오류 응답에서 레이아웃이 넘치지 않는지 확인한다.

- [ ] **Step 5: 변경 경계 최종 확인**

  `git diff`를 기준으로 작업 전 존재한 공유 이미지·공유 버튼 변경이 유지됐는지 확인한다. 결제 작업과 같은 파일에 있는 기존 70% 이미지 변경 및 `ManageDashboard` 변경은 되돌리지 않고 함께 검토한다.

- [ ] **Step 6: 잔여 변경 커밋**

  ```powershell
  git add -- src/app/globals.css 'src/app/m/[publicId]/ManageDashboard.tsx' tests/unit/ui/manage-dashboard.test.tsx
  git commit -m "결제 동의 및 영수증 화면 보완"
  ```

- [ ] **Step 7: 최종 상태 확인**

  ```powershell
  git status --short
  git log -8 --oneline
  ```

  Expected: 사용자 소유의 공유 버튼 관련 변경만 남거나, 해당 변경도 별도 커밋된 경우 작업 트리가 깨끗함
