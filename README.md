# 스캐치북

친구들이 그린 나를 한 권에 모으는 모바일 중심 참여형 초상화 서비스입니다. Next.js App Router와 Firebase Firestore·Storage를 사용하며, 결제는 실제 과금이 없는 모의 처리입니다.

## 로컬 실행

Node.js 22.x를 사용합니다.

```bash
npm install
copy .env.example .env.local
npm run emulators
npm run dev
```

`.env.local`에는 Firebase 웹 앱의 공개 설정값을 입력합니다. 서버는 Firebase Application Default Credentials를 사용하며, 서비스 계정 키 파일은 저장소에 커밋하지 않습니다. 배포 주소는 `NEXT_PUBLIC_APP_URL`에 입력해야 공유 미리보기 주소가 정확히 생성됩니다. App Check는 기본 비활성이므로 외부 사이트 키 없이도 로컬 개발·테스트·빌드가 동작합니다.

## 검증 명령

```bash
npm test
npm run lint
npm run build
npm run test:e2e -- --project=mobile-chrome
```

Firebase 규칙 통합 테스트와 전체 E2E는 Firestore·Storage 에뮬레이터가 필요합니다. 실제 운영 데이터에 테스트를 실행하지 않습니다.

관리자 E2E는 Playwright가 Auth·Firestore·Storage Emulator와 테스트 전용 Next.js 프로세스를 함께 시작합니다. 고정 테스트 계정과 데이터는 `sketch-me-local` 에뮬레이터에만 생성되며 실제 Firebase Authentication이나 운영 데이터에는 접근하지 않습니다.

```bash
npm run test:e2e -- --project=mobile-chrome
```

Playwright가 Emulator를 직접 시작할 때는 `firebase.json`의 기본 포트(9099/8080/9199)를 사용합니다. 다른 격리 포트가 필요하면 `PLAYWRIGHT_SKIP_WEBSERVER=1`을 설정하고, 동일한 포트로 구성한 Auth·Firestore·Storage Emulator와 Next.js를 먼저 직접 실행한 뒤 `PLAYWRIGHT_*_EMULATOR_HOST`를 지정합니다. webServer를 사용하는 상태에서 포트만 바꾸면 설정 오류로 즉시 중단됩니다. `PLAYWRIGHT_BASE_URL`은 canonical HTTP loopback Origin과 원문이 정확히 같아야 합니다. 외부 주소, `0.0.0.0`, 자격 증명, 공백, trailing slash, 경로, query와 hash는 거부합니다.

기존 로컬 서버를 재사용할 때도 주소만 보고 신뢰하지 않습니다. 다음은 기본 Emulator 포트와 별도 앱 포트 13000을 사용하는 PowerShell 예시입니다. 각 블록을 별도 터미널에서 실행합니다. 계정 값은 고정 테스트 픽스처이며 운영 UID·이메일이나 서비스 계정 키를 넣지 않습니다.

```powershell
# 터미널 1: 로컬 Emulator
npm run emulators -- --project sketch-me-local
```

```powershell
# 터미널 2: 테스트 전용 Next.js 서버
$env:FIREBASE_PROJECT_ID='sketch-me-local'
$env:FIREBASE_AUTH_EMULATOR_HOST='127.0.0.1:9099'
$env:FIRESTORE_EMULATOR_HOST='127.0.0.1:8080'
$env:FIREBASE_STORAGE_EMULATOR_HOST='127.0.0.1:9199'
$env:STORAGE_EMULATOR_HOST='http://127.0.0.1:9199'
$env:NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST='127.0.0.1:9099'
$env:NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET='sketch-me-local.appspot.com'
$env:ADMIN_UID='admin-e2e-uid'
$env:ADMIN_EMAIL='admin@example.com'
$env:ADMIN_ALLOWED_ORIGIN='http://127.0.0.1:13000'
$env:PLAYWRIGHT_E2E_SERVER='1'
npm run dev -- --hostname 127.0.0.1 --port 13000
```

서버 준비 확인은 다음처럼 Origin과 Playwright가 사용할 세 Emulator endpoint를 모두 전달합니다. 안전한 테스트 환경이며 서버의 설정과 endpoint가 정확히 같으면 상태 204와 `X-Sketch-Me-E2E-Ready: 1`을 반환합니다. 필수 `ADMIN_ALLOWED_ORIGIN`이나 header가 빠졌거나 일치하지 않으면 환경값을 노출하지 않고 404 또는 503을 반환합니다.

```powershell
$readinessHeaders = @{
  'X-Sketch-Me-E2E-Origin' = 'http://127.0.0.1:13000'
  'X-Sketch-Me-E2E-Auth-Emulator' = '127.0.0.1:9099'
  'X-Sketch-Me-E2E-Firestore-Emulator' = '127.0.0.1:8080'
  'X-Sketch-Me-E2E-Storage-Emulator' = '127.0.0.1:9199'
}
Invoke-WebRequest 'http://127.0.0.1:13000/api/e2e-readiness' `
  -Headers $readinessHeaders -UseBasicParsing
```

```powershell
# 터미널 3: 이미 시작한 프로세스를 검증한 뒤 E2E 실행
$env:PLAYWRIGHT_SKIP_WEBSERVER='1'
$env:PLAYWRIGHT_BASE_URL='http://127.0.0.1:13000'
$env:PLAYWRIGHT_AUTH_EMULATOR_HOST='127.0.0.1:9099'
$env:PLAYWRIGHT_FIRESTORE_EMULATOR_HOST='127.0.0.1:8080'
$env:PLAYWRIGHT_STORAGE_EMULATOR_HOST='127.0.0.1:9199'
npm run test:e2e -- --project=mobile-chrome
```

Playwright global setup은 위 readiness 응답을 확인한 뒤에만 고정 Google Emulator 사용자를 만들고 Firestore·Storage 픽스처를 적재합니다. 테스트 전용 서버는 일반 개발 서버와 빌드 잠금을 공유하지 않도록 별도 생성 디렉터리를 사용합니다. 따라서 일반 개발 서버나 운영 서버는 이 E2E 초기화를 승인할 수 없습니다.

Firebase 규칙·동시성 통합 테스트는 `FIREBASE_PROJECT_ID=sketch-me-local`과 loopback Emulator host가 모두 명시된 경우에만 실행됩니다. 일반 `npm test`에서는 해당 환경이 없으면 안전하게 건너뜁니다.

## 이미지 저장 정책

- 본인 그림과 친구 그림: 서버에서 최대 720×960 WebP로 변환, 목표 품질 76, 최대 350KB
- 참고 사진: 서버에서 최대 1280×1280 WebP로 변환, 목표 품질 72, 최대 600KB
- 한도를 넘으면 크기와 품질을 한 번 더 낮추고, 그래도 초과하면 저장하지 않습니다.
- 기존 PNG·JPEG 데이터는 저장된 경로와 메타데이터를 그대로 읽어 호환합니다.

그림은 일반적으로 수십~수백 KB가 되지만 내용에 따라 달라지므로 100KB 이하는 보장하지 않습니다. 100MB는 모바일 그림 한 장 기준으로 지나치게 큰 용량입니다.

## 공개 운영 체크리스트

- `apphosting.yaml`의 `maxInstances: 1`을 유지하고 Firebase·Google Cloud 예산 알림을 설정합니다.
- 공개 생성·제출 API에는 인스턴스 단위 속도 제한이 적용됩니다. 여러 인스턴스로 확장할 때는 Redis 또는 Cloud Armor 같은 공유 제한 장치로 교체합니다.
- Firebase App Check는 아래 절차로 공개 토큰 발급 플래그와 서버 검증 강제를 모두 명시적으로 활성화하기 전까지 동작하지 않습니다. 저장소에는 실제 사이트 키나 서비스 계정 키를 넣지 않습니다.
- 오류율과 Storage·Firestore 사용량 알림은 Firebase Console에서 별도로 설정합니다.
- 배포 전 `/privacy` 안내와 관리 화면의 전체 삭제 동작을 에뮬레이터에서 확인합니다.
- 운영자 차단은 이후 공개 응답을 막지만, 이미 내려받았거나 외부에 저장된 Story PNG는 회수할 수 없습니다.

## 선택적 Firebase App Check

공개 생성·그림 제출 Route Handler만 선택적으로 App Check 토큰을 검증합니다. `NEXT_PUBLIC_FIREBASE_APP_CHECK_ENABLED=true`와 `NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY`가 모두 있을 때만 브라우저가 Firebase App Check를 초기화하고 토큰을 발급합니다. 서버는 `FIREBASE_APP_CHECK_ENFORCEMENT_ENABLED=true`일 때만 토큰을 검증합니다. 기본값은 두 플래그 모두 `false`이며, 보호 배포에서는 세 설정을 함께 활성화합니다. 활성 상태에서는 각 공개 mutation 요청의 첫 단계에서 정확히 한 번 검증하며, 유효하지 않거나 없는 토큰은 401, 사이트 키 또는 서버 검증 구성이 잘못된 경우는 503으로 응답합니다. 기존 인스턴스 메모리 기반 속도 제한은 그대로 유지하며, Firebase 무료 할당량을 소모하는 Firestore 기반 rate limiter로 바꾸지 않습니다.

1. 별도 승인된 Firebase 프로젝트의 App Check에서 현재 웹 앱과 reCAPTCHA v3 공급자를 등록하고 공개 사이트 키를 발급합니다.
2. 같은 배포에 `NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY`, `NEXT_PUBLIC_FIREBASE_APP_CHECK_ENABLED=true`, `FIREBASE_APP_CHECK_ENFORCEMENT_ENABLED=true`를 함께 설정합니다. 공개 플래그와 사이트 키는 빌드 시 번들에 고정되므로, 두 공개 변수와 서버 검증 강제를 동시에 새 빌드로 배포해야 합니다.
3. 서버 런타임의 Firebase 프로젝트 ID와 Application Default Credentials가 같은 프로젝트를 가리키는지 확인합니다. 서비스 계정 JSON이나 reCAPTCHA 비밀값은 클라이언트 변수에 넣지 않습니다.
4. 배포 후 정상 브라우저에서 스케치북 생성과 그림 제출을 각각 한 번 확인하고, 토큰 없는 직접 POST가 401인지 확인합니다. 503이 보이면 강제를 끄고 사이트 키·프로젝트·서버 자격 증명을 먼저 점검합니다.
5. Firebase App Check 지표, Route Handler 401/503 비율, Firestore·Storage 사용량과 예산 알림을 함께 관찰합니다.

## 운영자 계정 설정

운영자 로그인은 Google 공급자로 로그인한 계정 한 개만 허용합니다. 실제 UID, 이메일, 서비스 계정 키는 저장소나 문서에 기록하지 않습니다.

1. Firebase Console의 Authentication에서 Google 로그인 공급자를 활성화합니다.
2. 허용할 Google 계정으로 최초 로그인한 뒤 Authentication 사용자 목록에서 UID와 인증 이메일을 확인합니다.
3. App Hosting 런타임에 `ADMIN_UID`, `ADMIN_EMAIL`, `ADMIN_ALLOWED_ORIGIN`을 설정합니다. `ADMIN_ALLOWED_ORIGIN`은 스킴과 호스트를 포함한 배포 Origin 하나와 정확히 같아야 합니다.
4. Authentication 승인 도메인에 실제 App Hosting 도메인을 추가합니다.
5. 배포 전에 `firestore.indexes.json`과 개발 프로젝트의 인덱스를 읽기 전용 명령으로 대조합니다. 실제 인덱스 배포는 별도 승인 후 실행합니다.

```bash
npx firebase firestore:indexes --project <development-project-id> --pretty
```

로컬에서 Emulator를 따로 확인하려면 다음 명령을 사용합니다. 실제 프로젝트 ID나 운영 자격 증명을 넣지 않습니다.

```bash
npm run emulators -- --project sketch-me-local
```

운영 세션은 로그인 직후 발급한 Firebase ID 토큰을 서버의 HttpOnly 세션 쿠키로 교환합니다. 쿠키는 운영에서 `Secure`, `SameSite=Strict`, `Path=/`가 적용되고 최대 12시간 후 만료됩니다. 로그아웃은 쿠키를 즉시 만료하며, 서버는 매 요청에서 폐기된 Firebase 세션인지 다시 검증합니다. 검증할 때는 로그인 → `/admin` 접근 → 로그아웃 → `/admin` 재접근 시 로그인 화면 이동 순서를 확인합니다.

에뮬레이터 검증과 별도로 배포 직전에는 실제 허용 Google 계정을 사용해 시크릿 브라우저에서 로그인 → `/admin` 접근 → 로그아웃 → `/admin` 재접근을 수동으로 한 번 확인합니다. 자동화 테스트에 실제 계정 비밀번호·ID 토큰을 넣지 않고, 허용하지 않은 계정이 거절되는지도 별도 계정으로 확인합니다.

결제 화면과 결제 통계는 모두 실제 과금이 없는 모의 데이터이며 취소·환불 기능을 제공하지 않습니다. 운영자 차단은 이후 공개 페이지, 제출, 이미지 응답을 막지만 이미 다운로드했거나 외부에 저장한 Story PNG까지 회수하지는 못합니다.

## 배포

Firebase App Hosting 배포 설정을 사용합니다. 이 저장소 작업만으로 배포되지는 않으며, 운영 배포와 환경 변수 변경은 별도 승인 후 진행합니다.
