# 페이앱 실결제 연동 설계

## 목표

현재 모의 결제를 페이앱 실결제로 교체한다. 결제 요청 성공만으로 혜택을 지급하지 않고, 페이앱 서버가 전송한 결제 완료 통보를 검증한 뒤 Firestore 트랜잭션에서 정확히 한 번 혜택을 적용한다. 개발·테스트에서는 외부 과금 없이 같은 상태 전이를 검증할 수 있어야 한다.

## 확정 범위

- 결제 대상은 친구 그림 10명·50명·100명 추가와 워터마크 제거 네 상품이다.
- 페이앱 최소 결제금액에 맞춰 990원인 친구 그림 10명 추가와 워터마크 제거를 각각 1,000원으로 변경한다. 나머지 금액은 4,490원과 8,490원을 유지한다.
- 결제 요청은 Next.js 서버가 페이앱 REST API에 FORM POST로 전송한다.
- 구매자 휴대전화번호는 결제창을 열기 전에 입력받으며 숫자로 정규화하고 서버에서 검증한다.
- 결제창은 모바일 호환성을 위해 페이앱이 반환한 `payurl`로 현재 창을 이동한다.
- 결제 완료 혜택은 `feedbackurl`의 `pay_state=4` 통보에서만 지급한다.
- 요청취소·승인취소·부분취소 통보는 주문 상태에 반영하되 이미 사용된 디지털 혜택을 자동 회수하지 않는다. 운영자가 상태와 주문을 확인한 뒤 별도 정책에 따라 처리한다.
- 관리자 화면은 페이앱 주문·결제 상태·결제수단·승인 시각을 조회할 수 있게 한다. 취소 API 호출 UI는 이번 범위에 포함하지만 부분취소 UI는 제외한다.
- 이용약관에는 실제 상품 가격, 페이앱 결제대행, 결제 완료 시점, 취소·환불 문의 절차를 반영한다. 개인정보 처리방침에는 결제 시 휴대전화번호 처리와 페이앱 제공·위탁 내용을 반영한다.
- 운영 배포, 운영 키 등록, 실제 결제 호출과 실제 취소 호출은 이 코드 작업에서 실행하지 않는다.

## 외부 설정과 비밀정보

서버 전용 환경 변수는 `PAYAPP_USER_ID`, `PAYAPP_LINK_KEY`, `PAYAPP_LINK_VALUE`를 사용한다. `PAYAPP_LINK_KEY`와 `PAYAPP_LINK_VALUE`는 `NEXT_PUBLIC_` 접두사를 사용하지 않으며 클라이언트 응답·로그·Git에 노출하지 않는다. 공개 콜백 URL은 `NEXT_PUBLIC_APP_URL`의 HTTPS Origin을 기준으로 만든다.

환경 변수가 누락되었거나 배포 Origin이 HTTPS가 아니면 결제 요청 API는 외부 호출 전에 안전한 설정 오류를 반환한다. 로컬 자동화 테스트는 주입된 가짜 전송 함수와 Firebase Emulator를 사용하고 실제 `api.payapp.kr`에 접근하지 않는다.

## 주문 데이터 모델

구매 문서 경로는 기존과 동일한 `sketchbooks/{sketchbookId}/purchases/{requestId}`를 유지한다. 주요 필드는 다음과 같다.

- `orderId`: 내부 주문 ID. 클라이언트가 만든 요청 ID와 분리된 예측 불가능한 값
- `provider`: `PAYAPP`
- `providerOrderId`: 페이앱 `mul_no`
- `productType`, `amount`, `additionalLimit`: 서버의 상품표에서 복사한 불변 주문 정보
- `paymentStatus`: `READY`, `SUCCEEDED`, `FAILED`, `CANCELLED`
- `buyerPhoneLast4`: 운영 확인용 마지막 네 자리만 저장
- `providerPayType`: 통보된 결제수단 코드
- `paidAt`, `cancelledAt`, `createdAt`, `updatedAt`
- `benefitAppliedAt`: 혜택 중복 적용 방지 표식

휴대전화번호 전체와 페이앱 연동 KEY·VALUE는 Firestore에 저장하지 않는다. 기존 `MOCK` 구매 문서는 읽기 호환을 유지하되 새 운영 통계와 목록은 `PAYAPP` 및 과거 `MOCK`을 모두 안전하게 표시한다.

## 결제 요청 흐름

1. 관리 권한이 있는 사용자가 상품과 휴대전화번호를 제출한다.
2. 서버는 관리 세션, 상품 ID, 서버 상품 금액, 휴대전화번호 형식, 요청 ID를 검증한다.
3. 동일 요청 ID의 주문이 있으면 기존 상태와 결제 URL을 재사용할 수 있는 경우 재사용하고, 완료된 주문이면 현재 혜택 상태를 반환한다.
4. 서버는 `READY` 주문을 먼저 저장한 후 페이앱 `payrequest`를 호출한다.
5. 요청에는 `userid`, `goodname`, `price`, `recvphone`, `feedbackurl`, `returnurl`, `var1=orderId`, `var2=requestId`, `smsuse=n`, `checkretry=y`를 사용한다.
6. 응답의 `state=1`, `mul_no`, HTTPS `payurl`을 검증하여 주문에 저장하고 클라이언트에 `payurl`만 반환한다.
7. 실패 시 주문을 `FAILED`로 갱신하고 페이앱 원문 오류나 비밀정보를 클라이언트에 노출하지 않는다.
8. 클라이언트는 같은 창에서 `payurl`로 이동한다. 이 시점에는 혜택을 적용하거나 결제 완료로 표시하지 않는다.

## 결제 통보와 혜택 적용

공개 Route Handler `POST /api/payments/payapp/feedback`은 FORM POST만 받는다. 전달된 `userid`, `linkkey`, `linkval`을 서버 환경 변수와 상수 시간 비교하고, `var1`, `var2`, `mul_no`로 저장된 주문을 찾는다. 주문의 상품·금액·판매자·페이앱 주문번호가 통보와 모두 일치하지 않으면 혜택을 적용하지 않는다.

`pay_state=4`이면 Firestore 트랜잭션에서 주문과 스케치북을 함께 읽는다. `benefitAppliedAt`이 없을 때만 인원 한도를 늘리거나 워터마크 권한을 적용하고 주문을 `SUCCEEDED`로 바꾼다. 이미 적용된 완료 통보는 성공 응답만 반복하여 중복 지급을 막는다. 취소 상태는 주문을 `CANCELLED`, 결제대기 상태는 `READY`, 알 수 없는 상태는 주문 원본을 바꾸지 않는다.

유효하게 처리한 통보와 이미 처리된 중복 통보에는 HTTP 200의 일반 텍스트 `SUCCESS`를 반환한다. 검증 실패에는 `SUCCESS`를 반환하지 않으며 민감한 실패 이유는 응답에 포함하지 않는다.

## 결제 복귀와 사용자 화면

`returnurl`은 GET과 FORM POST를 모두 받을 수 있는 서버 Route Handler로 둔다. 내부 주문 ID만 전달받아 303으로 `/m/{publicId}/payment/result?orderId=...`에 이동한다. 결과 화면은 관리 세션을 다시 검증하고 서버의 주문 상태를 조회한다.

- `READY`: “결제 결과를 확인하고 있어요”를 표시하고 제한된 횟수로 상태를 다시 조회
- `SUCCEEDED`: “결제가 완료됐습니다”와 적용된 혜택 표시
- `FAILED`: 재시도 안내
- `CANCELLED`: 결제 취소 안내

결제창 복귀나 쿼리 파라미터만으로 성공 처리하지 않는다. 기존 `모의 결제가 완료됐습니다` 팝업은 운영 실결제 흐름에서 사용하지 않는다. 모의 결제는 테스트 전용 전송 계층에서만 유지하고 사용자에게 실결제로 오인되는 성공 상태를 만들지 않는다.

## 관리자 취소

관리자 결제 목록의 `PAYAPP`이면서 `SUCCEEDED`인 주문에만 전체 취소 버튼을 제공한다. 관리자 세션과 Origin을 검증한 서버 API가 페이앱 `paycancel`을 호출하며 `userid`, `linkkey`, `mul_no`, 고정된 취소 사유를 전송한다. 취소 요청 성공만으로 혜택을 자동 회수하지 않고 주문 상태는 페이앱 통보와 대조한다. 취소 실패 원문은 서버 로그에 비밀정보 없이 기록하고 사용자에게는 일반화된 오류를 표시한다.

## 파일 경계

- `src/lib/payments/payapp.ts`: 환경 설정, FORM 요청·응답 파싱, 통보 서명 값 검증
- `src/lib/purchases/orders.ts`: 주문 생성·상태 조회·완료 혜택 트랜잭션
- `src/app/api/manage/[publicId]/purchase/route.ts`: 관리 세션 기반 결제 요청
- `src/app/api/payments/payapp/feedback/route.ts`: 서버 결제 통보
- `src/app/api/payments/payapp/return/route.ts`: 결제창 복귀 리다이렉트
- `src/app/api/manage/[publicId]/purchases/[orderId]/route.ts`: 결제 결과 상태 조회
- `src/app/api/admin/payments/[orderId]/cancel/route.ts`: 관리자 전체 취소 요청
- `src/app/m/[publicId]/ManageDashboard.tsx`, `src/app/m/[publicId]/share/WatermarkPurchaseButton.tsx`: 휴대전화번호 입력과 결제창 이동
- `src/app/m/[publicId]/payment/result/page.tsx`: 검증된 결제 결과 화면
- `src/lib/domain/types.ts`, `src/lib/admin/repository.ts`, 관리자 결제 UI: PAYAPP 상태 표시
- `src/app/terms/page.tsx`, `src/app/privacy/page.tsx`: 실제 결제·환불·결제 개인정보 처리 고지

## 오류와 복구

- 페이앱 요청 타임아웃은 사용자에게 재시도를 안내하되 같은 요청 ID를 사용하여 중복 주문을 억제한다.
- 페이앱 요청 성공 후 응답 저장에 실패할 수 있으므로 `var1`의 내부 주문 ID로 통보가 주문을 복구할 수 있어야 한다.
- 완료 통보 전에 사용자가 돌아와도 결과 화면은 성공을 추측하지 않는다.
- 통보 지연·재전송을 고려해 완료 처리는 멱등 트랜잭션으로 구현한다.
- 운영 로그에는 내부 주문 ID와 오류 분류만 남기고 휴대전화번호, 연동 KEY·VALUE, 전체 페이앱 요청 본문은 남기지 않는다.

## 테스트와 검증

- 페이앱 요청 FORM 생성, URL 인코딩 응답 파싱, HTTPS 결제 URL 검증 단위 테스트
- 환경 변수 누락과 비밀정보 비노출 테스트
- 주문 생성 중복 방지와 완료 통보 혜택 1회 적용 Firestore Emulator 테스트
- 잘못된 연동 값·금액·주문번호·상태 통보 거부 테스트
- 결제 요청 API, 통보 API, 결과 조회 API, 관리자 취소 API Route Handler 테스트
- 관리 화면과 워터마크 화면의 휴대전화번호 입력·로딩·오류·이동 테스트
- 관리자 결제 상태와 취소 버튼 테스트
- 약관의 실제 금액·결제대행·취소 안내와 개인정보 처리방침의 휴대전화번호·페이앱 제공 고지 테스트
- 외부 호출을 가짜 전송기로 대체한 모바일 E2E
- 전체 단위 테스트, 린트, 프로덕션 빌드, Firebase Emulator 통합 테스트

## 완료 기준

- 운영 비밀정보가 서버 밖으로 노출되지 않는다.
- 결제 요청 응답이나 복귀 URL만으로 혜택이 지급되지 않는다.
- 검증된 `pay_state=4` 통보가 동일 주문의 혜택을 정확히 한 번 적용한다.
- 네 상품이 페이앱 허용 금액으로 요청되며 관리 화면에서 실제 상태를 확인할 수 있다.
- 관리자 전체 취소 요청이 인증된 서버 경로에서만 가능하다.
- 실제 페이앱 키 없이 모든 자동화 검증이 통과한다.
- 운영 키 등록과 실제 소액 승인·취소 검증은 해비님의 별도 승인 후 실행한다.
