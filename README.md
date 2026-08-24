# 스캐치북

친구들이 그린 나를 한 권에 모으는 모바일 중심 참여형 초상화 서비스입니다. Next.js App Router와 Firebase Firestore·Storage를 사용하며, 결제는 실제 과금이 없는 모의 처리입니다.

## 로컬 실행

Node.js 20을 사용합니다.

```bash
npm install
copy .env.example .env.local
npm run emulators
npm run dev
```

`.env.local`에는 Firebase 웹 앱의 공개 설정값을 입력합니다. 서버는 Firebase Application Default Credentials를 사용하며, 서비스 계정 키 파일은 저장소에 커밋하지 않습니다. 배포 주소는 `NEXT_PUBLIC_APP_URL`에 입력해야 공유 미리보기 주소가 정확히 생성됩니다.

## 검증 명령

```bash
npm test
npm run lint
npm run build
npm run test:e2e -- --project=mobile-chrome
```

Firebase 규칙 통합 테스트와 전체 E2E는 Firestore·Storage 에뮬레이터가 필요합니다. 실제 운영 데이터에 테스트를 실행하지 않습니다.

## 이미지 저장 정책

- 본인 그림과 친구 그림: 서버에서 최대 720×960 WebP로 변환, 목표 품질 76, 최대 350KB
- 참고 사진: 서버에서 최대 1280×1280 WebP로 변환, 목표 품질 72, 최대 600KB
- 한도를 넘으면 크기와 품질을 한 번 더 낮추고, 그래도 초과하면 저장하지 않습니다.
- 기존 PNG·JPEG 데이터는 저장된 경로와 메타데이터를 그대로 읽어 호환합니다.

그림은 일반적으로 수십~수백 KB가 되지만 내용에 따라 달라지므로 100KB 이하는 보장하지 않습니다. 100MB는 모바일 그림 한 장 기준으로 지나치게 큰 용량입니다.

## 공개 운영 체크리스트

- `apphosting.yaml`의 `maxInstances: 1`을 유지하고 Firebase·Google Cloud 예산 알림을 설정합니다.
- 공개 생성·제출 API에는 인스턴스 단위 속도 제한이 적용됩니다. 여러 인스턴스로 확장할 때는 Redis 또는 Cloud Armor 같은 공유 제한 장치로 교체합니다.
- 초대형 베타를 넘어 공개 홍보할 때 Firebase App Check 또는 Turnstile을 추가합니다. 외부 키가 필요한 기능이라 현재 저장소에는 가짜 설정을 넣지 않았습니다.
- 오류율과 Storage·Firestore 사용량 알림은 Firebase Console에서 별도로 설정합니다.
- 배포 전 `/privacy` 안내와 관리 화면의 전체 삭제 동작을 에뮬레이터에서 확인합니다.

## 배포

Firebase App Hosting 배포 설정을 사용합니다. 이 저장소 작업만으로 배포되지는 않으며, 운영 배포와 환경 변수 변경은 별도 승인 후 진행합니다.
