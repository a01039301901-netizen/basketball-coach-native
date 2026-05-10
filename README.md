# AI 농구 코치

`Expo + React Native + TypeScript`로 정리한 농구 코치 앱입니다.

## 실행

```bash
npm install
npm start
```

- Android: `npm run android`
- iOS: `npm run ios`
- Web: `npm run web`

## 구조

```text
App.tsx
src/
  components/
    common/
    lesson/
  constants/
  hooks/
  screens/
  theme/
  types/
  utils/
```

## 파일 역할

- `App.tsx`: 앱 조립과 화면 분기만 담당
- `src/hooks/useBasketballCoachApp.ts`: 앱 상태와 주요 비즈니스 로직
- `src/screens/*`: 홈, 레슨, 기술, 기록일지 화면
- `src/components/*`: 공통 버튼, 카드, 헤더, 카메라 UI
- `src/constants/*`: 숙제, 기술 목록, 피드백 문구, 저장 키
- `src/utils/*`: 날짜 포맷, 달력 계산, 숙제 가공 같은 순수 함수
- `src/types/*`: 공통 타입 정의

## 현재 기능

- AI 레슨 받기
  - 드리블 분석 / 슛 분석 모드
  - 카메라 촬영
  - 레슨 종료 시 영상 저장
  - 모드별 코칭 피드백 표시
- 기록일지
  - 오늘 출석 자동 기록
  - 날짜별 레슨 영상 보기
  - 날짜별 슛 성공 개수 보기
  - 저장된 레슨 기록 삭제
- 기술 배우기
  - 대표 선수와 관찰 포인트 표시
  - 유튜브 검색 링크 열기
- 오늘의 숙제
  - 기본 숙제 표시
  - 레슨 모드에 따라 추가 숙제 저장
