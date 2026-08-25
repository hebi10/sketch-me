---
name: 스캐치북
description: 친구들이 그린 나를 한 권의 모바일 스케치북처럼 모으는 참여형 초상화 서비스
colors:
  ink: "#181818"
  graphite: "#6e6e6e"
  paper: "#ffffff"
  pencil-line: "#d8d3c9"
  sketch-blue: "#506f8f"
  sketch-blue-deep: "#3f5f82"
  success: "#4f7a5a"
  warning: "#c58b39"
  danger: "#b74b4b"
typography:
  display:
    fontFamily: "Gaegu, Apple SD Gothic Neo, Malgun Gothic, sans-serif"
    fontSize: "clamp(2.05rem, 9.2vw, 3.35rem)"
    fontWeight: 700
    lineHeight: 1.16
    letterSpacing: "-0.055em"
  headline:
    fontFamily: "Gaegu, Apple SD Gothic Neo, Malgun Gothic, sans-serif"
    fontSize: "clamp(1.65rem, 7.5vw, 2.75rem)"
    fontWeight: 700
    lineHeight: 1.16
  body:
    fontFamily: "Gaegu, Apple SD Gothic Neo, Malgun Gothic, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.7
  label:
    fontFamily: "Gaegu, Apple SD Gothic Neo, Malgun Gothic, sans-serif"
    fontSize: "0.82rem"
    fontWeight: 700
    lineHeight: 1.4
rounded:
  card: "6px"
  control: "8px"
  dialog: "12px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.sketch-blue}"
    textColor: "{colors.paper}"
    rounded: "{rounded.control}"
    padding: "12px 18px"
    height: "48px"
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "12px 18px"
    height: "48px"
  paper-card:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "8px"
---

# Design System: 스캐치북

## Overview

**Creative North Star: "손으로 넘기는 모바일 스케치북"**

화면은 앱 프레임보다 친구들이 남긴 그림을 먼저 보여주는 조용한 종이 책처럼 느껴져야 한다. 검은 잉크와 연필선 같은 중성색을 기본으로 쓰고, 행동과 순위 표시에만 절제된 블루를 사용한다. 바깥 페이지에는 배경색이나 질감을 깔지 않고, 실제 그림 카드와 테이프·연필선 모티프가 스케치북의 물성을 만든다.

밀도는 모바일에서 한 손으로 훑기 쉬운 수준을 유지한다. 장식은 의미가 있는 곳에만 두며, 생성 이미지보다 실제 사용자 그림이 서비스의 주인공이 된다.

**Key Characteristics:**

- 최대 650px의 한 권짜리 모바일 캔버스
- 연필선처럼 얇은 경계와 흰 종이 카드
- 검은 잉크 텍스트와 절제된 블루 CTA
- 테이프, 기울어진 종이, 작은 손그림 표식
- 친구 그림이 먼저 읽히는 2열 갤러리

## Colors

팔레트는 흰 종이, 검은 잉크, 회색 연필선에 스케치 블루 한 가지를 더한 구조다.

### Primary

- **스케치 블루:** 주요 CTA, BEST 배지, 참여 수와 활성 상태에 사용한다.
- **깊은 스케치 블루:** 기본 블루의 호버 상태에만 사용한다.

### Neutral

- **잉크 블랙:** 제목, 본문 핵심 정보, 아이콘의 기본색이다.
- **그래파이트:** 설명, 시간, 보조 정보에 사용한다.
- **흰 종이:** 카드, 캔버스, 입력 필드의 표면이다. 바깥 페이지 배경에는 강제하지 않는다.
- **연필선:** 카드, 구분선, 입력 테두리를 한 겹으로 나눈다.

**The One Blue Rule.** 한 화면의 주목 색은 스케치 블루 하나이며, CTA와 상태 정보 외의 넓은 면적에는 사용하지 않는다.

## Typography

**Display Font:** Gaegu 700 (Apple SD Gothic Neo, Malgun Gothic fallback)
**Body Font:** Gaegu 400 (Apple SD Gothic Neo, Malgun Gothic fallback)

**Character:** 무료 한글 손글씨 폰트 Gaegu를 자체 호스팅해 스케치북의 손맛을 일관되게 전달한다. 큰 제목은 700으로 또렷하게, 본문은 400과 넉넉한 줄 간격으로 읽기 쉽게 유지한다.

### Hierarchy

- **Display** (700, 유동형 2.05–3.35rem, 1.16): 랜딩의 질문 한 개에만 사용한다.
- **Headline** (700, 유동형 1.65–2.75rem, 1.16): 스케치북 이름과 주요 화면 제목에 사용한다.
- **Title** (700, 1–1.25rem): 갤러리와 도구 영역의 섹션 제목이다.
- **Body** (400, 1rem, 1.7): 안내와 설명에 사용한다.
- **Label** (700, 약 0.82rem): 입력 라벨, BEST 배지, 작은 상태 정보에 사용한다.

**The Whole Korean Word Rule.** 한국어 제목과 본문은 `word-break: keep-all`을 유지하고 제목에는 균형 줄바꿈을 적용해 한 글자만 다음 줄에 남기지 않는다.

## Layout

모든 주요 화면은 너비 100%, 최대 650px로 제한하고 화면 중앙에 정렬한다. 넓은 화면에서도 별도의 PC 레이아웃으로 확장하지 않는다. 좌우 여백은 화면에 따라 16–30px 사이에서 유동적으로 변한다.

친구 그림과 BEST 카드는 320px 이상에서 2열로 유지하며 319px 이하에서만 1열로 축소한다. 편집 캔버스는 정사각형 비율을 유지하고 모바일 세로 흐름에서 도구와 제출 폼이 이어진다.

**The Single Book Rule.** 모든 기능 화면은 동일한 650px 책 폭 안에서만 구성하며, 데스크톱용 보조 패널이나 다단 확장을 만들지 않는다.

## Elevation & Depth

그림자는 사용하지 않는다. 깊이는 1px 연필선, 종이 카드의 겹침, 작은 회전, 반투명 테이프만으로 표현한다.

**The Flat Paper Rule.** 카드가 떠 보이게 하는 그림자보다 종이 경계와 실제 콘텐츠의 겹침을 우선한다.

## Shapes

사진과 그림 카드는 6px, 버튼과 입력·큰 컨테이너는 8px로 살짝만 둥글게 처리한다. 원형은 색상 스와치처럼 물리적 형태가 원인인 컨트롤에만 사용한다. 구분은 모든 면을 감싸는 얇은 테두리나 완전한 가로선으로 처리한다.

## Components

### Buttons

- **Shape:** 과장되지 않은 8px 모서리와 최소 48px 높이
- **Primary:** 스케치 블루 바탕, 흰 글자, 700 굵기
- **Hover / Focus:** 더 깊은 블루로 변하고, 포커스는 연한 블루 외곽선으로 표시
- **Secondary:** 흰 종이 바탕과 1px 연필선, 잉크 텍스트

### Cards / Containers

- **Corner Style:** 작은 그림 카드는 6px, 큰 보드는 8px
- **Background:** 흰 종이
- **Shadow Strategy:** 그림자 없음
- **Border:** 1px 연필선
- **Internal Padding:** 작은 카드는 6–8px, 큰 보드는 12–20px

### Inputs / Fields

- **Style:** 흰 종이 바탕, 1px 연필선, 8px 모서리, 최소 52px 높이
- **Focus:** 스케치 블루 테두리와 옅은 포커스 외곽선
- **Error / Disabled:** 오류는 위험색 텍스트, 비활성은 불투명도 감소와 커서 변화로 함께 표현

### Navigation

상단 내비게이션은 58px 높이의 한 줄이며 아래에 1px 가로선을 둔다. 워드마크는 가운데 정렬하고 좌우 행동은 최소 44px 터치 영역을 가진다.

### Sketch Gallery

그림은 정사각형 흰 종이 카드 안에서 `contain`으로 전부 보인다. 이름과 시간은 같은 줄에 배치하고 긴 이름은 말줄임 처리한다. BEST 순위는 카드 왼쪽 위의 작은 블루 배지로 표시한다.

## Do's and Don'ts

### Do:

- **Do** 모든 새 화면을 최대 650px 중앙 정렬 모바일 흐름으로 만든다.
- **Do** 실제 그림을 자르지 않고 흰 종이 카드 안에 온전히 보여준다.
- **Do** 주요 행동과 활성 상태에만 스케치 블루를 사용한다.
- **Do** 한국어 단어 단위 줄바꿈과 44px 이상의 터치 영역을 유지한다.

### Don't:

- **Don't** 바깥 `html` 또는 `body`에 배경색, 종이 질감, 그라데이션을 넣지 않는다.
- **Don't** 650px 이후 데스크톱 다단 레이아웃으로 확장하지 않는다.
- **Don't** 그림자, 과한 둥근 모서리, 여러 포인트 색으로 사용자 그림과 경쟁하지 않는다.
- **Don't** 실제 사용자 그림 영역을 장식용 생성 이미지로 대체하지 않는다.
