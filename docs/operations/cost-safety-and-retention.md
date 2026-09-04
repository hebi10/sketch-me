# 비용 안전장치 및 보관 정책 운영 가이드

## 적용 정책

- 스케치북 생성: IP 해시 기준 시간당 3개, 72시간당 9개
- 전체 서비스 생성: 시간당 60개
- 생성 제한용 IP 원문: 저장하지 않음
- 생성 제한용 IP 해시: 최대 72시간 보관 후 Firestore TTL 삭제
- 신규 무료 스케치북: 생성일로부터 6개월 후 자동 삭제
- 유료 스케치북: 마지막 결제일로부터 최소 1년 이용 보장, 서비스 운영 중 보관
- 기존 스케치북: 소급 자동 삭제하지 않고 `LEGACY`로 취급
- 관리 화면: 무료 스케치북 삭제 30일 전 경고

## 배포 전 비밀값

Firebase Secret Manager에 다음 값을 생성하고 App Hosting 백엔드가 읽을 수 있도록 권한을 연결한다.

- `PUBLIC_MUTATION_RATE_LIMIT_SECRET`: IP 해시에 사용하는 충분히 긴 무작위 값
- `RETENTION_CLEANUP_SECRET`: 자동 정리 API의 Bearer 인증에 사용하는 별도의 충분히 긴 무작위 값

두 값은 서로 다르게 만들고 저장소나 클라이언트 환경 변수에 기록하지 않는다. 비밀값이 없으면 생성 API와 자동 정리 API는 안전하게 실패하도록 구성되어 있다.

## Firestore 설정

배포 시 `firestore.indexes.json`을 함께 적용한다.

- `publicMutationRateLimits.expiresAt` TTL 정책
- `sketchbooks.retentionTier + retentionExpiresAt` 복합 인덱스

TTL 삭제는 만료 시각과 정확히 동시에 실행된다는 보장이 없으므로, 애플리케이션은 만료된 제한 기록을 트랜잭션 안에서 초기화한다.

## 자동 정리 스케줄

Cloud Scheduler에서 전용 서비스 계정의 OIDC 토큰으로 다음 요청을 하루 1회 호출한다. 정적 비밀값은 Scheduler 작업 설정에 저장하지 않는다.

- 메서드: `POST`
- URL: 운영 도메인의 `/api/internal/retention-cleanup`
- 서비스 계정: `retention-cleanup-scheduler@sketch-me-31e13.iam.gserviceaccount.com`
- OIDC 대상: `https://sketch.msgnote.kr/api/internal/retention-cleanup`
- 권장 실행 시간: 트래픽이 적은 시간대

App Hosting에는 OIDC 대상과 서비스 계정 이메일을 각각 `RETENTION_CLEANUP_OIDC_AUDIENCE`, `RETENTION_CLEANUP_SCHEDULER_SERVICE_ACCOUNT`로 설정한다. `RETENTION_CLEANUP_SECRET` 인증은 장애 대응용 수동 실행에만 사용하며 값은 명령 기록이나 로그에 남기지 않는다.

응답의 `deleted`, `failed`, `retried` 수치를 로그에서 확인한다. `failed`가 0보다 크거나 요청이 5xx로 끝나면 운영 알림 대상으로 연결한다. 정리 작업은 실패한 시스템 삭제 작업을 다음 실행에서 먼저 재시도한다.

## Firebase 비용 보호

Firebase와 연결된 Google Cloud 결제 계정에서 다음 항목을 직접 설정한다.

- 월간 예산: 초기 예상 매출보다 낮은 보수적 금액으로 시작
- 예산 알림: 50%, 80%, 100%
- 알림 수신자: 실제 대응 가능한 운영 이메일
- App Hosting, Firestore, Storage 사용량을 주 단위로 확인

예산 알림은 자동 지출 차단이 아니다. 예상치 못한 급증이 발생하면 App Hosting 트래픽, `publicMutationRateLimits`, Storage 사용량과 자동 정리 실패 로그를 함께 확인한다.

## 출시 전 확인

- 신규 무료 스케치북에 `retentionTier=FREE`, `retentionExpiresAt`이 기록되는지 확인
- 결제 완료 후 `retentionTier=PAID`, `retentionGuaranteedUntil`이 기록되는지 확인
- 기존 스케치북에 보관 필드가 없을 때 `LEGACY`로 표시되고 자동 정리 대상이 아닌지 확인
- 관리 화면에 무료 삭제 예정일 또는 유료 최소 보장일이 표시되는지 확인
- 생성 제한 초과 시 `429`, 제한 저장소 장애 시 `503`을 반환하는지 확인
- 자동 정리 API가 잘못된 Bearer 값에 `401`을 반환하는지 확인
- 자동 정리 API가 지정된 Scheduler 서비스 계정 OIDC 토큰만 허용하는지 확인
- Firestore TTL 목록에 `publicMutationRateLimits.expiresAt` 정책이 표시되는지 확인
- Cloud Scheduler 작업의 최근 실행 결과와 응답 코드가 정상인지 확인

## 소비자 불만·분쟁 기록

이메일 등 문의 채널로 소비자 불만 또는 분쟁이 접수되면 접수일, 처리 완료일, 주문 식별정보, 요청 내용과 처리 결과만 보관한다. 카드번호, 전체 휴대전화번호, 그림과 메시지는 별도로 복사하지 않는다.

- 법정 보관 대상 불만·분쟁 기록: 처리 완료일로부터 3년
- 일반 문의: 답변과 후속 조치가 끝나면 지체 없이 삭제
- 보관 만료 확인: 매월 1회

처리 완료일과 삭제 예정일을 문의 기록에 표시하고, 삭제 예정일이 지난 기록은 이메일과 별도 메모를 함께 삭제한다. 분쟁이 계속 중이거나 법령·수사기관 요청으로 보존이 필요한 경우에는 근거와 연장 기간을 함께 기록한다.
