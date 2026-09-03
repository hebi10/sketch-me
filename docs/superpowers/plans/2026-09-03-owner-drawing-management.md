# 소유자 그림 관리 및 자동 BEST 구현 계획

> 승인된 설계: `docs/superpowers/specs/2026-09-03-owner-drawing-management-design.md`

## 1. 친구 그림 자동 BEST 배정

- `tests/unit/sketchbooks/repository.test.ts`에 빈 BEST 순위를 제출 순서대로 채우고, 네 자리가 찬 뒤에는 배정하지 않는 실패 테스트를 추가한다.
- `src/lib/sketchbooks/repository.ts`의 제출 트랜잭션에서 기존 순위를 읽어 가장 낮은 빈 순위를 저장한다.
- 저장소 단위 테스트로 동시성 경계가 트랜잭션 안에 있는지 확인한다.

## 2. 관리자 전용 소유자 그림 수정 API

- `tests/unit/api/manage-owner-image.test.ts`에 인증 실패, 입력 검증 실패, 정상 교체 테스트를 추가한다.
- `src/lib/domain/schemas.ts`에 소유자 그림 수정 입력 스키마를 추가한다.
- `src/app/api/manage/[publicId]/owner/image/route.ts`에 관리 세션 인증, 이미지 최적화, Storage 교체, 경로 갱신을 수행하는 `PUT`을 추가한다.
- `src/lib/sketchbooks/repository.ts`에 소유자 이미지 경로와 수정 시각 갱신 함수를 추가한다.

## 3. 관리자 편집 화면

- `src/components/sketch/SketchEditor.tsx`에 기존 그림을 다시 여는 선택적 버튼 라벨을 추가하고 회귀 테스트를 작성한다.
- `src/app/m/[publicId]/owner/edit/page.tsx`와 클라이언트 편집 폼을 추가한다.
- `src/app/m/[publicId]/ManageDashboard.tsx`의 소유자 원본 카드에 편집 화면 링크를 추가한다.
- 필요한 스타일만 `src/app/globals.css`에 추가한다.

## 4. 공개 화면 소유자 그림 노출

- 공개 페이지 단위 테스트를 추가해 소유자 그림이 있을 때만 별도 섹션이 나타나는지 확인한다.
- `src/app/s/[publicId]/page.tsx`에 소유자 그림 섹션을 추가하고 기존 BEST 영역과 시각적으로 구분한다.

## 5. 검증 및 커밋

- 관련 Vitest 파일, 타입 검사, 린트를 실행한다.
- 가능하면 Playwright로 관리자 편집과 공개 페이지 반영을 확인한다.
- 전체 변경을 검토해 기존 미커밋 작업을 제외하고 이번 기능만 한국어 명사형 커밋으로 기록한다.
