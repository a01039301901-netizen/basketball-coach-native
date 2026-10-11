# Basketball Coach 프로젝트 핵심 알고리즘 및 어려운 코드 분석

## 면접 준비용 소논문

이 문서는 Basketball Coach 프로젝트의 핵심 구현을 문제 정의, 데이터 흐름, 알고리즘, 코드 구조, 예외 처리, 저장 방식, 보안상 주의점, 한계와 개선 방향까지 설명할 수 있도록 정리한 면접 대비 자료이다.

주요 소스:

- [poseWebHtml.ts](src/components/lesson/poseWebHtml.ts): 카메라 프레임, MediaPipe 포즈 추정, 관절 계산, 공 인식, 슛·드리블 분석
- [useBasketballCoachApp.ts](src/hooks/useBasketballCoachApp.ts): 로그인, 화면 상태, 레슨 상태 머신, 분석 결과 누적, 기록 저장
- [feedback.ts](src/utils/feedback.ts): 분석 결과를 피드백 문장으로 변환
- [lessonRecordStorage.ts](src/utils/lessonRecordStorage.ts): SQLiteStorage·AsyncStorage 동기화
- [remoteAccount.ts](src/utils/remoteAccount.ts): 인증 서버 API 연동
- [auth-server.js](etc/auth-server.js): Node.js 인증 서버
- [app.ts](src/types/app.ts): 레슨 분석 결과와 기록의 TypeScript 타입

---

## 초록

Basketball Coach는 사용자가 농구 슛과 드리블을 연습할 때 카메라 영상을 이용해 자세를 분석하고, 분석 결과를 실시간 피드백과 레슨 기록으로 제공하는 React Native 애플리케이션이다. 이 프로젝트의 핵심은 하나의 인공지능 분류 모델이 모든 것을 판단하는 구조가 아니라는 점이다.

MediaPipe Pose Landmarker가 카메라 영상에서 사람의 주요 관절 좌표와 visibility 값을 추정한다. 그 다음 애플리케이션이 관절 좌표에 기하학 계산과 시간 기반 규칙을 적용하여 팔꿈치 각도, 무릎 각도, 상체 기울기, 공의 위치, 드리블 간격, 슛 릴리스 타이밍 등을 계산한다. 농구공은 별도의 객체 분류 모델에만 의존하지 않고 HSV 색상 분할, 연결 성분, 원형도, 채움 비율, 이전 프레임과의 거리, 손과 몸의 위치를 조합하여 추적한다. 마지막으로 분석 결과를 레슨 상태 머신에 전달하여 준비 자세, 카운트다운, 수행 중, 릴리스 후 검토 단계를 제어한다.

따라서 이 프로젝트는 다음 네 가지 기술을 결합한 시스템으로 볼 수 있다.

1. 학습된 포즈 추정 모델을 이용한 관절 좌표 추출
2. 관절 좌표에 대한 기하학적 자세 분석
3. 색상과 형태를 이용한 농구공 후보 검출 및 추적
4. 시간 상태 머신과 규칙 기반 평가를 이용한 레슨 진행

이 구조의 장점은 각 판정 기준을 설명하고 수정하기 쉽다는 것이고, 단점은 카메라 각도, 조명, 가림, 영상의 2차원 투영에 영향을 많이 받는다는 것이다.

핵심어: React Native, TypeScript, MediaPipe, Pose Landmarker, 컴퓨터 비전, HSV, 상태 머신, 규칙 기반 판정, SQLiteStorage, AsyncStorage, Node.js

---

## 1. 프로젝트의 문제 정의와 설계 목표

### 1.1 해결하려는 문제

농구 초보자는 자신의 자세가 정확한지 혼자 판단하기 어렵다. 특히 다음 문제는 연습 직후 바로 확인하기 어렵다.

- 슛할 때 팔꿈치가 너무 좁거나 벌어지는지 알기 어렵다.
- 무릎을 충분히 굽혔다가 펴는지 알기 어렵다.
- 공을 놓는 시점이 무릎과 팔의 움직임에 맞는지 알기 어렵다.
- 드리블 높이가 너무 높거나 낮은지 감으로만 판단하게 된다.
- 드리블 중 시선이 공에만 고정되는지 확인하기 어렵다.
- 반복 횟수와 손별 사용 비율을 수동으로 기록해야 한다.

이 프로젝트는 카메라를 통해 얻은 관절과 공의 움직임을 수치화하고, 수치를 사람이 이해할 수 있는 피드백으로 바꾸는 것을 목표로 한다.

### 1.2 영상 저장과 분석의 차이

단순히 영상을 저장하면 사용자는 자신의 모습을 다시 볼 수 있지만, 어떤 부분을 고쳐야 하는지 스스로 찾아야 한다. 분석 시스템은 다음 과정을 자동화한다.

1. 영상을 프레임 단위로 읽는다.
2. 프레임에서 관절과 공의 위치를 찾는다.
3. 위치에서 각도·거리·속도·시간 차이를 계산한다.
4. 계산값을 레슨 기준과 비교한다.
5. 결과를 실시간 문장과 레슨 기록으로 제공한다.

따라서 프로젝트의 핵심 알고리즘은 영상에서 바로 정답을 맞히는 단일 분류기라기보다, 좌표를 추출하고 좌표를 측정값으로 바꾸고 측정값을 시간적으로 해석하는 파이프라인이다.

---

## 2. 전체 시스템 구조와 데이터 흐름

### 2.1 화면과 상태 구조

앱은 React Navigation 같은 별도의 라우팅 라이브러리 대신 현재 화면을 상태로 관리한다. AppScreen은 home, lesson, skill, diary, settings, rules 값을 사용하고, App.tsx는 현재 화면에 맞는 컴포넌트를 조건부 렌더링한다.

useBasketballCoachApp은 단순한 UI 훅이 아니라 앱의 애플리케이션 서비스 계층에 가깝다. 카메라 컴포넌트에서 전달된 메시지를 받고, 분석 결과를 레슨 상태로 반영하고, 레슨이 종료되면 기록을 저장한다.

~~~text
App.tsx
  └─ useBasketballCoachApp()
       ├─ 로그인·계정 상태
       ├─ 현재 화면 상태
       ├─ 레슨 모드와 레슨 phase
       ├─ 최신 포즈 분석값
       ├─ 드리블·슛 누적 결과
       ├─ 기록 저장 및 조회
       └─ 설정값·동기화 상태
~~~

### 2.2 한 프레임의 처리 흐름

~~~text
카메라 프레임
  ↓
WebView 또는 iframe 내부 분석 런타임
  ↓
MediaPipe Pose Landmarker
  ↓
관절 landmark 배열
  ↓
관절 각도·거리·자세 계산
  ↓
농구공 후보 검출 및 추적
  ↓
드리블 분석 또는 슛 분석 객체 생성
  ↓
postMessage / WebView 메시지
  ↓
React Native의 handlePoseMessage
  ↓
레슨 상태 머신 갱신
  ↓
화면 피드백 및 기록 저장
~~~

카메라 분석은 네이티브 React Native 코드가 매 프레임의 픽셀을 직접 처리하는 구조가 아니다. 네이티브에서는 LessonCamera.native.tsx가 WebView를 사용하고, 웹에서는 LessonCamera.web.tsx가 iframe을 사용한다. 실제 카메라 접근과 MediaPipe 실행은 poseWebHtml.ts가 만든 웹 분석 런타임에서 수행된다.

### 2.3 WebView 메시지 브리지

분석 런타임과 React Native 사이에는 JSON 메시지 브리지가 있다.

~~~ts
type PoseMessage =
  | { type: 'points'; summary: PoseSummary }
  | { type: 'dribble_analysis'; analysis: DribbleAnalysis }
  | { type: 'shoot_analysis'; analysis: ShootAnalysis }
  | { type: 'shoot_success_circle_detected' }
  | { type: 'recording_ready'; videoUri: string }
  | { type: 'status'; status: string }
  | { type: 'ready' }
  | { type: 'error'; message: string };
~~~

핵심 처리 형태는 다음과 같다.

~~~ts
function handlePoseMessage(rawMessage: string) {
  const message = JSON.parse(rawMessage);

  switch (message.type) {
    case 'dribble_analysis':
      applyDribbleAnalysis(message.analysis);
      break;
    case 'shoot_analysis':
      applyShootAnalysisWithStance(message.analysis);
      break;
    case 'recording_ready':
      saveRecordedVideo(message.videoUri);
      break;
    case 'shoot_success_circle_detected':
      completeShootReview();
      break;
  }
}
~~~

장점은 카메라·MediaPipe 처리와 React Native 화면 로직을 분리할 수 있다는 점이다. 단점은 JSON 직렬화, WebView 메시지 지연, 플랫폼별 카메라 권한과 파일 URI 차이를 함께 관리해야 한다는 점이다.

---

## 3. MediaPipe Pose Landmarker의 역할

### 3.1 MediaPipe는 무엇을 하는가

MediaPipe Pose Landmarker는 카메라 영상에서 사람의 신체 주요 지점을 추정하는 학습된 모델이다. 이 프로젝트에서 MediaPipe가 직접 반환하는 것은 드리블 자세가 좋다 또는 슛 성공이다라는 최종 판정이 아니라, 각 관절의 좌표와 visibility이다.

프로젝트의 설정은 다음과 같은 형태이다.

~~~ts
const poseLandmarker = await PoseLandmarker.createFromOptions(
  vision,
  {
    baseOptions: {
      modelAssetPath: POSE_MODEL_URL,
    },
    runningMode: 'VIDEO',
    numPoses: 1,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  },
);

const result = poseLandmarker.detectForVideo(
  videoElement,
  performance.now(),
);
~~~

runningMode가 VIDEO인 이유는 정지 이미지가 아니라 시간 순서가 있는 영상 프레임을 처리하기 위해서이다. numPoses가 1인 이유는 한 프레임에서 한 사람만 추적하기 위해서이다.

### 3.2 사용되는 landmark 번호

| 번호 | 이름 | 역할 |
|---:|---|---|
| 0 | nose | 얼굴 중심, 시선·머리 위치 기준 |
| 2 | leftEye | 눈 방향 추정 |
| 5 | rightEye | 눈 방향 추정 |
| 7 | leftEar | 측면 시선 추정 |
| 8 | rightEar | 측면 시선 추정 |
| 11 | leftShoulder | 어깨 폭, 팔 각도, 상체 기준 |
| 12 | rightShoulder | 어깨 폭, 팔 각도, 상체 기준 |
| 13 | leftElbow | 왼팔 각도 |
| 14 | rightElbow | 오른팔 각도 |
| 15 | leftWrist | 손 위치, 공과 손의 거리 |
| 16 | rightWrist | 손 위치, 공과 손의 거리 |
| 23 | leftHip | 상체 기울기, 다리 각도 |
| 24 | rightHip | 상체 기울기, 다리 각도 |
| 25 | leftKnee | 무릎 각도, 공 높이 기준 |
| 26 | rightKnee | 무릎 각도, 공 높이 기준 |
| 27 | leftAnkle | 발 간격, 공과 발의 거리 |
| 28 | rightAnkle | 발 간격, 공과 발의 거리 |

면접 답변:

> MediaPipe는 landmark 번호에 해당하는 관절 좌표를 제공하고, 애플리케이션은 그 좌표를 선택해 팔꿈치, 무릎, 상체, 시선 같은 측정값을 계산합니다. 따라서 최종 자세 판정은 MediaPipe의 기본 분류 결과가 아니라 제가 구현한 규칙 기반 분석입니다.

### 3.3 좌표와 visibility

landmark의 x, y는 화면을 기준으로 정규화된 좌표이며 대체로 0부터 1 사이이다. y는 화면 위쪽이 작고 아래쪽이 크다. 따라서 코드에서 y가 작아진다는 것은 화면상 위로 올라갔다는 뜻이다.

그러나 이 값은 3차원 실제 위치가 아니라 카메라 영상에 투영된 값이다. 가림, 역광, 화면 가장자리, 카메라 각도와 거리 변화가 있으면 오차가 커진다.

코드의 visible 함수는 visibility가 0.4보다 큰 landmark만 신뢰한다.

~~~ts
function visible(point?: Landmark | null) {
  return Boolean(point && (point.visibility ?? 1) > 0.4);
}
~~~

이 조건은 잘못 추정된 점 하나가 각도 계산을 망치는 것을 줄이지만, visibility가 높다고 해서 좌표가 항상 정확하다는 뜻은 아니다.

---

## 4. 관절 기하학 계산

### 4.1 중점과 거리

어깨 중심과 엉덩이 중심처럼 좌우 관절의 대표점을 사용할 때는 중점을 계산한다.

~~~ts
function midpoint(a: Point, b: Point) {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    visibility: Math.min(a.visibility ?? 1, b.visibility ?? 1),
  };
}

function distanceBetween(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
~~~

### 4.2 세 점으로 관절 각도 계산

팔꿈치 각도는 어깨-팔꿈치-손목 세 점으로 계산한다. 무릎 각도는 엉덩이-무릎-발목 세 점으로 계산한다. 꼭짓점은 항상 가운데 점이다.

~~~ts
function angleAt(a: Point, b: Point, c: Point) {
  if (!visible(a) || !visible(b) || !visible(c)) {
    return null;
  }

  const abx = a.x - b.x;
  const aby = a.y - b.y;
  const cbx = c.x - b.x;
  const cby = c.y - b.y;

  const dot = abx * cbx + aby * cby;
  const magAB = Math.hypot(abx, aby);
  const magCB = Math.hypot(cbx, cby);

  if (magAB === 0 || magCB === 0) {
    return null;
  }

  const cosine = Math.min(
    1,
    Math.max(-1, dot / (magAB * magCB)),
  );

  return Math.acos(cosine) * 180 / Math.PI;
}
~~~

수학적으로는 다음 내적 공식이다.

$$
\theta = \cos^{-1}\left(
\frac{\vec{BA}\cdot\vec{BC}}
{|\vec{BA}||\vec{BC}|}
\right)
$$

cosine 값에 -1과 1의 범위를 적용한 이유는 부동소수점 오차 때문이다. 이 처리가 없으면 작은 계산 오차 때문에 Math.acos가 NaN을 반환할 수 있다.

이 계산은 2차원 화면 좌표의 각도이다. 실제 3차원 관절 각도와 동일하다고 주장하기보다는 카메라 영상 평면에서 계산한 근사 각도라고 설명해야 한다.

### 4.3 좌우 평균

정면 드리블에서는 왼쪽과 오른쪽 다리가 모두 보일 수 있으므로 양쪽 각도의 평균을 사용한다.

~~~ts
const leftLegAngle = angleAt(leftHip, leftKnee, leftAnkle);
const rightLegAngle = angleAt(rightHip, rightKnee, rightAnkle);

const legAngles = [leftLegAngle, rightLegAngle]
  .filter((value): value is number => value !== null);

const averageLegAngle =
  legAngles.length > 0
    ? legAngles.reduce((sum, value) => sum + value, 0) / legAngles.length
    : null;
~~~

한쪽 관절이 가려졌을 때 다른 쪽 값만 사용할 수 있다는 장점이 있다. 반면 한쪽만 보이는 상태에서는 정면 자세의 대칭성을 정확히 확인하기 어렵다.

---

## 5. 신체 방향, 상체 자세, 시선 분석

### 5.1 정면과 측면 구분

드리블은 정면 드리블과 측면 드리블에서 의미 있는 기준이 다르다. 정면에서는 두 발 사이의 공 위치와 양손 균형을 볼 수 있고, 측면에서는 상체 기울기와 공의 상대 높이를 보는 것이 적합하다.

프로젝트는 어깨 폭과 코가 어깨 중심에서 얼마나 벗어났는지로 신체 방향을 추정한다.

~~~ts
function classifyBodyFacing(
  shoulders: { left: Point; right: Point },
  nose: Point | null,
): 'front' | 'side' | 'unknown' {
  const shoulderWidth = distanceBetween(
    shoulders.left,
    shoulders.right,
  );

  if (!nose || shoulderWidth === 0) {
    return 'unknown';
  }

  const shoulderMid = midpoint(
    shoulders.left,
    shoulders.right,
  );
  const noseOffset = Math.abs(nose.x - shoulderMid.x);

  if (
    shoulderWidth >= 0.16 &&
    noseOffset <= shoulderWidth * 0.32
  ) {
    return 'front';
  }

  if (
    shoulderWidth <= 0.14 ||
    noseOffset > shoulderWidth * 0.32
  ) {
    return 'side';
  }

  return 'unknown';
}
~~~

이는 머신러닝으로 정면·측면을 다시 학습하는 것이 아니라, 이미 얻은 landmark의 상대적 위치에 임계값을 적용하는 방식이다.

### 5.2 상체 기울기

어깨 중심과 엉덩이 중심을 연결한 선이 수직에서 얼마나 기울었는지 다음과 같이 구한다.

~~~ts
function getTorsoLeanAngle(
  shoulderMid: Point,
  hipMid: Point,
) {
  return Math.atan2(
    Math.abs(shoulderMid.x - hipMid.x),
    Math.abs(shoulderMid.y - hipMid.y) + 0.0001,
  ) * 180 / Math.PI;
}
~~~

| 상체 기울기 | 판정 |
|---:|---|
| 40도 미만 | 너무 upright |
| 40도 이상 80도 이하 | balanced |
| 80도 초과 | 너무 low |

이 값은 실제 농구 코치의 낮은 자세를 직접 측정한 것이 아니라 화면에서 상체 중심선이 기울어진 정도를 대신 사용하는 지표이다.

### 5.3 정면 드리블 준비 자세

정면 드리블에서는 양쪽 무릎의 평균 각도를 frontStanceAngle로 사용한다.

| 평균 무릎 각도 | 판정 |
|---:|---|
| 140도 미만 | too_low |
| 140도 이상 170도 이하 | ready |
| 170도 초과 | too_upright |

이 기준은 드리블을 시작하기 전에 준비 자세가 갖춰졌는지 확인하기 위한 것이다. 무릎이 너무 펴져 있으면 드리블 안정성이 떨어질 수 있고, 지나치게 낮으면 움직임의 범위가 제한될 수 있다.

### 5.4 시선 분석

시선은 눈동자를 정밀하게 추적하는 방식이 아니라 코, 눈, 귀, 목의 상대적 위치로 공을 보는지와 앞을 보는지를 근사한다. 정면에서는 눈과 목의 세로 간격을 사용한다.

~~~ts
const eyeNeckGap = Math.abs(
  eyeMid.y - neckMid.y,
);

const eyeFocus =
  eyeNeckGap <= 0.03
    ? 'ball'
    : 'forward';
~~~

측면에서는 코가 아래로 내려갔는지, 코와 목의 상대적 비율 등을 함께 확인한다. 슛 분석에서는 드리블의 시선 기준을 그대로 적용하지 않고 상황에 따라 unknown에 가깝게 처리한다.

기준을 넣은 이유:

> 시선은 단순히 자세가 낮은지보다 실제 경기 상황에서 중요한 기준입니다. 드리블 중 계속 공을 보면 주변 수비와 코트를 보기 어렵기 때문에, 눈과 머리의 상대 위치를 이용해 공을 보는 상태를 근사적으로 확인했습니다. 다만 카메라 영상만으로 눈동자를 직접 측정한 것은 아니므로 정확한 눈동자 방향보다 고개가 숙여졌는지에 가까운 지표입니다.

---

## 6. 농구공 인식: 색상·형태 기반 컴퓨터 비전

### 6.1 학습 모델과 규칙 판정의 구분

이 프로젝트의 농구공 인식은 별도의 학습된 농구공 객체 탐지 모델이 아니다. 현재 구현은 다음 특징을 조합한 전통적 컴퓨터 비전 방식이다.

- HSV 색상 범위
- 연결된 픽셀 영역
- 후보 영역의 가로세로 비율
- 영역의 채움 비율
- 원형도와 원형 범위
- 이전 프레임 공 위치와의 거리
- 공의 이동성
- 손목·발·몸통과의 상대 위치

정확한 면접 답변:

> 사람의 관절은 MediaPipe라는 학습된 포즈 모델로 얻고, 농구공은 현재 색상 기반 분할과 형태·움직임 규칙으로 검출하고 추적합니다. 사용자 색상 설정과 브랜드별 색상 프로필을 이용하기 때문에 특정 농구공에 맞출 수 있지만, 전용 객체 탐지 모델을 학습시킨 구조는 아닙니다.

### 6.2 RGB보다 HSV를 사용하는 이유

RGB는 색상과 밝기가 한 값에 섞여 있어 조명이 바뀌면 같은 물체도 값이 크게 달라질 수 있다. HSV는 색상 H, 채도 S, 명도 V를 분리하기 때문에 색상 범위를 설정하기 쉽다.

~~~ts
function classifyBallPixel(
  pixel: { r: number; g: number; b: number },
  profile: BallRecognitionProfile,
) {
  const hsv = rgbToHsv(pixel.r, pixel.g, pixel.b);

  for (const color of profile.colors) {
    const band = profile.learnedBandByColor[color];

    if (band && isInsideHueSaturationValueBand(hsv, band)) {
      return color === 'red' ? 2 : 1;
    }

    if (matchesFallbackColorThreshold(hsv, color)) {
      return color === 'red' ? 2 : 1;
    }
  }

  return 0;
}
~~~

색상 설정에는 orange, brown, yellow, white, black, gray, red 등이 사용된다.

### 6.3 색상 설정과 브랜드 설정

| 설정 | 의미 |
|---|---|
| 농구공 색상 | 사용자가 공에 포함된 색상 특징을 직접 선택 |
| 브랜드 프로필 | 해당 브랜드에 맞는 기본 색상과 검출 임계값 선택 |
| 사용자 학습 프로필 | 샘플 이미지에서 HSV 색상 띠와 패턴 특징 추정 |

Wilson, Spalding, Molten 프로필은 기본 색상과 minPixels, minFill, minCircleMatch 같은 후보 검출 기준을 다르게 사용할 수 있다. 브랜드 이름을 보고 서버에서 공을 알아내는 기능이 아니라, 해당 공에 더 적합한 파라미터 묶음을 선택하는 기능이다.

### 6.4 후보 영역 필터링

색상 픽셀을 모두 공이라고 간주하면 사람의 옷, 바닥, 벽도 공으로 잡힐 수 있다. 그래서 연결된 후보 영역마다 여러 조건을 적용한다.

~~~ts
function isValidBallCandidate(
  candidate: Candidate,
  profile: DetectionProfile,
) {
  return (
    candidate.pixelCount >= profile.minPixels &&
    candidate.aspectRatio >= profile.minAspect &&
    candidate.aspectRatio <= profile.maxAspect &&
    candidate.fillRatio >= profile.minFill &&
    candidate.circleCoverage >= profile.minCircleCoverage &&
    candidate.circleCoverage <= profile.maxCircleCoverage &&
    candidate.circleMatch >= profile.minCircleMatch &&
    candidate.outlineMatch >= profile.minOutline
  );
}
~~~

농구공은 영상에서 대체로 원에 가까운 영역으로 보이므로 가로세로 비율과 원형도를 사용한다. 단, 공이 빠르게 움직이거나 손에 가려지면 완벽한 원이 아니므로 여러 특징의 점수를 조합한다.

### 6.5 후보 점수 계산

후보가 여러 개이면 다음 특징의 가중합으로 가장 그럴듯한 공을 선택한다.

~~~ts
function scoreBallCandidate(
  candidate: Candidate,
  context: TrackingContext,
) {
  let score = 0;

  score += scorePixelCount(candidate);
  score += scoreShape(candidate);
  score += scoreCircleMatch(candidate);
  score += scoreFillRatio(candidate);
  score += scoreMotion(candidate, context);
  score += scoreBodyAlignment(candidate, context);
  score += scoreDistanceFromLastBall(candidate, context);
  score += scoreRadiusContinuity(candidate, context);
  score += scoreWristProximity(candidate, context);

  score -= scoreTorsoPenalty(candidate, context);

  return score;
}
~~~

이전 프레임 공과 가까운 후보에 높은 점수를 주는 것은 시간적 일관성을 이용하는 것이다. 매 프레임을 독립적으로 보면 후보가 갑자기 다른 물체로 바뀔 수 있으므로 이전 위치를 다음 프레임의 예측 기준으로 사용한다.

### 6.6 공 추적과 누락 처리

공이 한두 프레임 동안 손이나 몸에 가려질 수 있으므로 즉시 추적을 포기하지 않는다. 현재 구현은 일정 프레임까지 누락을 허용한 뒤 추적 상태를 초기화한다.

~~~ts
const MAX_BALL_TRACK_MISSING_FRAMES = 4;

if (candidate) {
  ballTrack.last = candidate;
  ballTrack.missingFrames = 0;
} else {
  ballTrack.missingFrames += 1;

  if (
    ballTrack.missingFrames >
    MAX_BALL_TRACK_MISSING_FRAMES
  ) {
    ballTrack.last = null;
  }
}
~~~

### 6.7 샘플 이미지 학습의 정확한 의미

설정 화면에서 샘플 이미지로 공 인식 프로필을 만들 수 있지만, 이것은 신경망 파라미터를 다시 학습시키는 의미의 머신러닝 훈련이 아니다.

1. 샘플 이미지에서 픽셀을 수집한다.
2. HSV 색상 버킷을 만든다.
3. 빈도가 높은 색상 세 개를 고른다.
4. 색상별 hue, saturation, value의 10~90 백분위 구간을 만든다.
5. 세로·가로·혼합 방향의 색상 패턴 정보를 만든다.
6. 프로필을 저장하고 실시간 색상 후보 검출에 사용한다.

정확한 설명:

> 사용자가 제공한 샘플 이미지에서 색상 분포를 추출해 HSV 밴드와 패턴 프로필을 만드는 캘리브레이션입니다. 신경망 파라미터를 업데이트하는 학습은 아닙니다.

현재 poseWebHtml.ts에는 패턴 프로필을 생성하고 저장하는 구조가 있지만, 실시간 런타임의 shouldUseBallPatternMatch 값은 false이므로 현재 프레임 검출에서 패턴 점수는 활성화되어 있지 않다. 구현되어 있는 것과 실제 실행 중인 것을 구분해서 말해야 한다.

---

## 7. 드리블 분석 알고리즘

### 7.1 드리블 분석의 목적

드리블 분석은 공이 보이는지만 판단하지 않는다.

- 안정된 준비 자세인가?
- 공이 너무 높거나 낮은가?
- 공이 다리 사이로 들어가는가?
- 좌우 손을 균형 있게 사용하는가?
- 바운스 간격이 일정한가?
- 시선이 공에만 고정되는가?
- 발 간격과 상체 높이가 적절한가?

### 7.2 드리블 시작 조건

분석은 사용자가 카메라 앞에 서자마자 바로 시작하지 않는다. 정면 드리블에서는 선택된 뷰가 정면이면 기본적으로 드리블 시작 상태를 허용하고, 측면에서는 공이 무릎이나 발 근처에 접근했는지를 확인한다.

~~~ts
function didDribbleStart(
  ball: BallPoint,
  landmarks: Landmarks,
) {
  const footOrKneePoints = [
    landmarks.leftKnee,
    landmarks.rightKnee,
    landmarks.leftAnkle,
    landmarks.rightAnkle,
  ].filter(visible);

  return footOrKneePoints.some(
    point => distanceBetween(ball, point) <= 0.12,
  );
}
~~~

측정 단위는 정규화 좌표의 상대 거리이므로 화면 해상도가 달라도 일정하게 적용할 수 있다. 단, 실제 미터 단위는 아니다.

### 7.3 바운스 카운트와 중복 방지

현재 드리블 카운트는 공이 발 근처 영역에 새로 진입하는 순간을 이벤트로 삼는다. 같은 바운스가 여러 프레임에서 반복 카운트되지 않도록 잠금 상태를 둔다.

| 상수 | 값 | 의미 |
|---|---:|---|
| DRIBBLE_FOOT_COUNT_DISTANCE | 0.12 | 발 근처로 보고 바운스를 세는 거리 |
| DRIBBLE_FOOT_RESET_DISTANCE | 0.17 | 충분히 멀어졌다고 보고 다음 바운스를 준비하는 거리 |
| DRIBBLE_FRONT_EYE_NECK_DOWN_GAP | 0.03 | 정면 시선의 보조 기준 |
| DRIBBLE_RHYTHM_BAD_INTERVAL_DIFF_MS | 200ms | 바운스 간격 차이가 이 값 이상이면 불규칙 |

~~~ts
function updateDribbleBounceTracking(
  landmarks: Landmarks,
  ball: BallPoint | null,
) {
  if (!ball) {
    resetNearFootFlags();
    return;
  }

  const nearestFootDistance = getNearestFootDistance(
    ball,
    landmarks,
  );

  const nearFoot = nearestFootDistance <= 0.12;
  const movedAwayFromFoot = nearestFootDistance >= 0.17;

  if (movedAwayFromFoot) {
    dribbleBounceLocked = false;
  }

  const enteredBounceZone =
    nearFoot && !wasBallNearFoot;

  if (
    enteredBounceZone &&
    !dribbleBounceLocked
  ) {
    dribbleCount += 1;
    sampleDribbleRhythm();
    updateControllingHand(ball, landmarks);
    dribbleBounceLocked = true;
  }

  wasBallNearFoot = nearFoot;
}
~~~

핵심은 이벤트 검출과 상태 잠금이다. nearFoot만 보고 카운트하면 한 번의 바운스가 여러 프레임에서 여러 번 증가한다. enteredBounceZone과 dribbleBounceLocked로 멀리 나갔다가 다시 들어온 경우만 다음 바운스로 해석한다.

### 7.4 드리블 손 판정

정면에서는 공의 x 좌표를 양쪽 발목 중앙과 비교해 어느 쪽에 있는지 본다. 측면에서는 공과 양쪽 손목의 거리를 비교해 가까운 손을 선택한다.

~~~ts
function inferControllingHand(
  ball: BallPoint,
  landmarks: Landmarks,
  view: 'front' | 'side',
) {
  if (view === 'front') {
    const ankleCenter = midpoint(
      landmarks.leftAnkle,
      landmarks.rightAnkle,
    );

    return ball.x < ankleCenter.x
      ? 'left'
      : 'right';
  }

  const leftDistance = distanceBetween(
    ball,
    landmarks.leftWrist,
  );
  const rightDistance = distanceBetween(
    ball,
    landmarks.rightWrist,
  );

  return leftDistance <= rightDistance
    ? 'left'
    : 'right';
}
~~~

이는 손의 실제 접촉을 직접 검출하는 것이 아니라 공과 신체 landmark의 상대 위치로 지배 손을 근사하는 방법이다.

### 7.5 드리블 높이

드리블 높이는 손목과 목, 엉덩이의 거리 관계를 이용한다. 목보다 공이 위에 가까우면 높은 드리블, 엉덩이 쪽에 가까우면 낮은 드리블, 중간이면 balanced로 분류한다.

~~~ts
function classifyDribbleHeight(
  ball: Point,
  neck: Point,
  hip: Point,
) {
  const neckDistance = distanceBetween(ball, neck);
  const hipDistance = distanceBetween(ball, hip);

  if (neckDistance + 0.015 < hipDistance) {
    return 'high';
  }

  if (hipDistance + 0.015 < neckDistance) {
    return 'low';
  }

  return 'balanced';
}
~~~

이 기준은 실제 높이가 아니라 사람의 몸을 기준으로 한 상대 높이이다. 사용자 키나 카메라 거리에 덜 민감하지만, 상체가 기울어져 있거나 공이 깊이 방향으로 움직이면 오차가 생길 수 있다.

### 7.6 바운스 높음·낮음

추적 중 가장 높은 위치와 가장 낮은 위치를 저장한 뒤, 어깨와 엉덩이의 y 좌표를 기준으로 비교한다.

~~~ts
function classifyBounceStates(
  highestBallY: number | null,
  lowestBallY: number | null,
  shoulderY: number,
  hipY: number,
) {
  const bounceHighState =
    highestBallY !== null &&
    highestBallY < shoulderY - 0.015
      ? 'too_high'
      : 'balanced';

  const bounceLowState =
    lowestBallY !== null &&
    lowestBallY < hipY - 0.015
      ? 'too_low'
      : 'balanced';

  return {
    bounceHighState,
    bounceLowState,
  };
}
~~~

이 결과는 실제 바닥으로부터의 높이가 아니라 신체 기준점에 대한 화면상의 상대 높이이다.

### 7.7 드리블 리듬

각 바운스의 이벤트 시각을 저장하고 직전 바운스와 시간 차이를 비교한다.

~~~ts
function sampleDribbleRhythm(now: number) {
  if (lastBounceAtMs !== null) {
    const interval = now - lastBounceAtMs;
    const previousInterval = lastIntervalMs;

    if (previousInterval !== null) {
      const difference = Math.abs(
        interval - previousInterval,
      );

      if (difference >= 200) {
        dribbleRhythmBadCount += 1;
      } else {
        dribbleRhythmGoodCount += 1;
      }
    }

    lastIntervalMs = interval;
  }

  lastBounceAtMs = now;
}
~~~

불규칙 비율은 다음과 같다.

$$
\text{badRatio}
=
\frac{\text{bad comparisons}}
{\text{good comparisons}+\text{bad comparisons}}
$$

불규칙 비율이 0.5 이상이면 needs_improvement, 그렇지 않으면 good으로 표시한다. 비교 데이터가 없으면 unknown으로 남긴다. 절대적인 BPM을 요구하는 방식이 아니라 사용자의 직전 리듬과 현재 리듬의 차이를 보는 방식이다.

### 7.8 정면 드리블의 공 위치와 발 간격

정면 드리블에서 공의 x 위치가 양발의 x 범위 안에 있으면 between_legs로 판단한다. 발 간격은 발목 사이 거리를 어깨 폭과 비교한다.

이 기준은 공이 다리 사이로 들어가 통제가 어려워지는 경우와 너무 좁거나 지나치게 넓은 준비 자세를 구분하기 위해 사용한다.

### 7.9 드리블 평가

드리블 종료 시 모든 프레임을 같은 비중으로 평가하지 않고 실제 드리블이 활성화된 active 구간을 중심으로 평가한다.

정면:

| 기준 | 안정 판정 |
|---|---|
| 준비 자세 | frontStanceAngle이 140~170도인 프레임 비율 50% 이상 |
| 공의 레인 | 다리 사이가 아닌 상태 50% 이상 |
| 시선 | forward 상태 50% 이상 |
| 리듬 | 최신 리듬 상태가 good |
| 발 간격 | balanced 상태 50% 이상 |

측면:

| 기준 | 안정 판정 |
|---|---|
| 상체 | balanced 상태 50% 이상 |
| 드리블 높이 | balanced 상태 50% 이상 |
| 시선 | forward 상태 50% 이상 |
| 리듬 | 최신 리듬 상태가 good |

기준별 안정 비율이 높은 항목은 강점, 낮은 항목은 개선점으로 변환한다.

---

## 8. 슛 분석 알고리즘

### 8.1 슛 분석의 단계

슛은 한 번의 자세가 아니라 연속 동작이다.

1. 준비 자세
2. 무릎이 가장 낮아지는 구간
3. 무릎 신전
4. 팔 신전
5. 공과 손의 분리
6. 릴리스 타이밍
7. 릴리스 높이
8. 릴리스까지 걸린 시간
9. 릴리스 후 성공 제스처

1~8은 자세와 시간 데이터를 기반으로 한 규칙 판정이고, 9는 실제 골대에 공이 들어갔는지를 영상으로 판정하는 것이 아니라 사용자의 성공 제스처를 확인하는 별도 단계이다.

### 8.2 슈팅 팔 선택

양쪽 팔이 모두 보이면 화면상 더 위로 올라간 손목, 즉 y가 더 작은 손목을 슈팅 팔로 선택한다. 한쪽만 보이면 보이는 쪽을 사용한다.

~~~ts
function chooseShootingSide(
  leftWrist: Point | null,
  rightWrist: Point | null,
) {
  if (leftWrist && rightWrist) {
    return leftWrist.y <= rightWrist.y
      ? 'left'
      : 'right';
  }

  if (leftWrist) return 'left';
  if (rightWrist) return 'right';
  return null;
}
~~~

이는 특정 사용자의 주손을 미리 입력받는 방식이 아니라 현재 동작에서 올라간 팔을 선택하는 휴리스틱이다. 양손 슛에서는 잘못 선택될 수 있다.

### 8.3 팔 각도와 준비 자세

팔 각도는 어깨-팔꿈치-손목 각도이다.

| 팔꿈치 각도 | 상태 |
|---:|---|
| 80도 미만 | narrow |
| 80도 이상 120도 이하 | balanced |
| 120도 초과 | wide |

준비 자세는 팔 각도 상태가 balanced이고, 슈팅 손이 어깨 근처 이상으로 올라오며, 공과 손의 거리가 일정 범위 안일 때 인식된다.

| 상수 | 값 | 의미 |
|---|---:|---|
| SHOOT_BALL_HAND_CONTACT_DISTANCE | 0.16 | 공이 슈팅 손 근처인지 |
| SHOOT_BALL_HAND_SEPARATION_DISTANCE | 0.22 | 공과 손이 분리된 거리 |
| SHOOT_BALL_HAND_SEPARATION_DELTA | 0.045 | 직전 프레임보다 증가한 거리 |

### 8.4 팔 신전 검출

팔이 펴졌다는 것은 현재 팔 각도가 크다는 것뿐 아니라 직전보다 충분히 증가했다는 뜻이어야 한다.

~~~ts
function isArmExtension(
  previousAngle: number | null,
  currentAngle: number | null,
  elapsedMs: number,
) {
  if (
    previousAngle === null ||
    currentAngle === null ||
    elapsedMs <= 0
  ) {
    return false;
  }

  const delta = currentAngle - previousAngle;
  const speed = delta / elapsedMs;

  return (
    previousAngle <= 130 &&
    currentAngle >= 145 &&
    delta >= 16 &&
    speed >= 0.08
  );
}
~~~

절대 각도와 변화량과 변화 속도를 함께 사용하면 처음부터 팔을 펴고 서 있는 상태를 슛 동작으로 잘못 인식하는 것을 줄일 수 있다.

### 8.5 무릎 굽힘과 신전

슛에서 무릎은 한 번 굽혔다가 펴져야 한다. 양쪽 무릎 각도 평균을 저장하고 관찰된 최소 각도를 기록한다.

~~~ts
const kneeExtension =
  currentLegAngle - previousLegAngle;

const extendedEnough =
  kneeExtension >= 4 &&
  currentLegAngle - lowestLegAngle >= 10;
~~~

무릎이 충분히 굽혀지지 않았다면 현재 각도가 커져도 신전 이벤트를 확정하지 않는다. 이 조건은 팔만 들어 올린 동작을 정상적인 슛 준비로 오인하는 것을 줄인다.

### 8.6 공과 손의 분리로 릴리스 검출

슛 릴리스는 공이 손 가까이에 있다가 팔 신전 후 손에서 멀어지는 이벤트로 정의한다.

~~~ts
const ballNearHand =
  ballHandDistance !== null &&
  ballHandDistance <= 0.16;

const ballSeparatedFromHand =
  ballHandDistance !== null &&
  (
    ballHandDistance >= 0.22 ||
    ballHandDistance - previousBallHandDistance >= 0.045
  );

const releaseDetectedNow =
  !alreadyReleased &&
  ballNearHandAtPreviousMoment &&
  armExtensionDetected &&
  ballSeparatedFromHand;
~~~

이는 공의 손 접촉을 직접 인식하는 것이 아니라 공 위치와 손목 landmark의 거리 변화를 이용한다. 공 검출이 실패하면 릴리스 이벤트도 검출할 수 없다.

### 8.7 릴리스 타이밍

팔 신전 시각과 무릎 신전 시각의 차이를 계산한다.

~~~ts
const releaseTimingDelta =
  armExtensionAtMs - kneeExtensionAtMs;

const releaseTiming =
  releaseTimingDelta < -180
    ? 'early'
    : releaseTimingDelta > 180
      ? 'late'
      : 'balanced';
~~~

- early: 팔 신전이 무릎 신전보다 너무 빠른 경우
- late: 팔 신전이 무릎 신전보다 너무 늦은 경우
- balanced: 두 이벤트가 180ms 안에 일어난 경우

180ms는 스포츠 과학의 절대 표준이라고 주장하는 값이 아니라 앱에서 동작 순서를 구분하기 위한 임계값이다.

### 8.8 릴리스 높이와 시간

릴리스 직전 공의 y 좌표와 머리 peak y를 비교한다. 공이 머리보다 화면상 위에 있으면 높은 릴리스로 분류한다.

~~~ts
const releasePointState =
  controlledBallY !== null &&
  headPeakY !== null &&
  controlledBallY < headPeakY
    ? 'high'
    : 'low';
~~~

무릎이 가장 낮은 시각부터 릴리스 시각까지의 시간도 계산한다.

~~~ts
const releaseDurationMs =
  releaseAtMs - lowestLegAngleAtMs;

const releaseDurationState =
  releaseDurationMs <= 600
    ? 'balanced'
    : 'slow';
~~~

이 값들은 실제 골대 방향 높이나 3차원 점프 높이가 아니라 화면상 머리와 신체 기준을 이용한 상대 측정값이다.

### 8.9 슛 성공 제스처

현재 구현에서 슛 성공은 골대나 공의 궤적을 실제로 추적해서 판정하지 않는다. 릴리스 후 최대 5초 동안 다음 제스처를 확인한다.

- 두 손목이 머리보다 위에 있음
- 머리가 양손의 x 범위 안에 있음
- 양쪽 팔꿈치가 어깨보다 위에 있음
- 손목이 팔꿈치보다 위에 있음
- 손목 사이 거리가 지나치게 멀지 않음
- 이 상태를 2프레임 이상 유지

정확한 면접 답변:

> 현재 버전은 공이 실제 골대에 들어갔는지를 비전으로 판정하지 않고, 릴리스 후 사용자가 성공 제스처를 취하면 성공으로 기록합니다. 향후에는 골대 위치 추정, 공 궤적, 실제 골망 통과를 별도의 검출 문제로 확장할 수 있습니다.

### 8.10 슛 평가 기준

| 기준 | 좋은 상태 |
|---|---|
| 팔 각도 | balanced |
| 다리 각도 | balanced |
| 릴리스 타이밍 | balanced |
| 릴리스 지점 | high |
| 릴리스 시간 | balanced |
| 슛 결과 | 성공 제스처 검출 |

이 기준은 “자세가 나쁩니다”가 아니라 “팔 신전이 무릎 신전보다 늦었습니다”, “릴리스 지점이 머리보다 낮았습니다”처럼 원인 중심 피드백을 만들기 위한 것이다.

---

## 9. 레슨 상태 머신

### 9.1 상태 머신을 사용하는 이유

실시간 분석에서는 같은 분석 결과라도 레슨 단계에 따라 의미가 달라진다. 준비 자세에서 공이 발 근처에 있다고 바로 드리블 횟수를 세면 안 된다. 슛이 릴리스된 뒤에는 일반 자세 분석보다 성공 제스처 대기가 중요하다.

드리블 phase는 다음과 같다.

~~~ts
type DribbleLessonPhase =
  | 'stance_setup'
  | 'countdown'
  | 'await_dribble'
  | 'active'
  | 'cooldown';
~~~

### 9.2 드리블 전이

~~~text
stance_setup
  └─ 자세가 ready 상태로 3초 유지
       ↓
countdown
  └─ 3초 경과
       ↓
await_dribble
  └─ 공이 시작 조건 충족
       ↓
active
  └─ 목표 횟수 달성 또는 종료
       ↓
cooldown / review
~~~

준비 자세 유지 시간은 DRIBBLE_STANCE_HOLD_MS = 3000이다. 잠깐 올바른 자세를 취한 한 프레임만으로 레슨이 시작되는 것을 막기 위해서이다.

### 9.3 드리블 분석 반영

applyDribbleAnalysis는 다음 순서로 동작한다.

1. 현재 모드가 드리블인지 확인한다.
2. 현재 phase와 맞지 않는 분석 메시지는 무시한다.
3. 카운트와 손별 카운트를 누적한다.
4. active 상태라면 분석 프레임을 저장한다.
5. 약점을 계산하고 피드백 문장을 만든다.
6. 목표 횟수에 도달하면 레슨을 종료하고 검토 상태로 이동한다.

~~~ts
function applyDribbleAnalysis(
  analysis: DribbleAnalysis,
) {
  if (lessonMode !== 'dribble') {
    return;
  }

  updateLatestAnalysis(analysis);
  updateDribbleCounts(analysis);

  if (dribblePhase === 'active') {
    saveActiveFrame(analysis);
    updateWeakPoint(analysis);
    setFeedback(
      buildDribbleFeedbackText(analysis),
    );

    if (analysis.dribbleCount >= targetCount) {
      finishDribbleLesson();
    }

    return;
  }

  if (
    dribblePhase === 'await_dribble' &&
    analysis.dribbleStarted
  ) {
    setDribblePhase('active');
    return;
  }

  if (analysis.stanceState !== 'ready') {
    setDribblePhase('stance_setup');
    setFeedback(
      buildDribbleFeedbackText(analysis),
    );
    return;
  }

  enterOrContinueCountdown();
}
~~~

### 9.4 슛 전이

~~~text
stance_setup
  └─ 준비 자세 안정
       ↓
countdown
  └─ 3초 유지
       ↓
active
  └─ 팔·무릎·공 분석
       ↓ releaseDetected
cooldown
  └─ 5초 안에 성공 제스처 확인
       ↓
review / record
~~~

카운트다운 중 자세가 무너지면 다시 준비 단계로 돌아간다. active 상태에서 releaseDetected가 발생하면 cooldown으로 이동해 5초 동안 성공 제스처를 기다린다.

### 9.5 프레임 상태와 시간 상태

프레임 상태:

- 현재 팔 각도
- 현재 공과 손의 거리
- 현재 시선
- 현재 드리블 높이

시간 상태:

- 드리블이 시작되었는가
- 같은 바운스를 중복 카운트했는가
- 무릎이 먼저 굽혀졌다가 펴졌는가
- 팔 신전 이후 공이 분리되었는가
- 성공 제스처를 2프레임 이상 유지했는가

면접 답변:

> 실시간 컴퓨터 비전에서는 한 프레임의 위치만으로 동작을 확정하기 어렵기 때문에, 이벤트 시각과 이전 프레임을 저장하는 상태 머신을 사용했습니다. 이 덕분에 준비, 수행, 릴리스, 검토를 구분하고 중복 카운트를 줄일 수 있었습니다.

---

## 10. 피드백 생성과 평가 기록

### 10.1 측정값을 문장으로 변환

feedback.ts의 역할은 분석 알고리즘 자체가 아니라 분석 결과를 사용자가 이해할 수 있는 문장으로 바꾸는 것이다.

~~~ts
function buildDribbleFeedbackText(
  analysis: DribbleAnalysis,
) {
  const messages: string[] = [];

  if (analysis.dribbleView === 'front') {
    if (analysis.stanceState === 'too_upright') {
      messages.push(
        '무릎을 조금 더 굽혀 준비 자세를 낮춰보세요.',
      );
    }

    if (
      analysis.frontBallLaneState === 'between_legs'
    ) {
      messages.push(
        '공이 다리 사이로 들어가지 않도록 옆으로 이동해보세요.',
      );
    }
  }

  if (analysis.eyeFocus === 'ball') {
    messages.push(
      '공만 보지 말고 시선을 앞에 두어보세요.',
    );
  }

  if (
    analysis.dribbleRhythmState ===
    'needs_improvement'
  ) {
    messages.push(
      '바운스 간격을 일정하게 유지해보세요.',
    );
  }

  return messages.length > 0
    ? messages.join(' ')
    : '현재 자세가 안정적입니다.';
}
~~~

### 10.2 레슨 기록

saveLessonRecord는 다음 정보를 하나의 LessonRecord로 만든다.

- 레슨 ID와 날짜
- 슛 또는 드리블 모드
- 성공 여부
- 피드백 문장
- 시간순 피드백 타임라인
- 영상 URI와 썸네일 URI
- 정면 또는 측면 드리블 뷰
- 왼손·오른손 드리블 횟수
- 대표 피드백 카테고리
- 전체 평가 결과

LessonRecordEvaluation은 good, average, bad 수준과 함께 기준별 결과, 강점, 개선점을 저장한다. 단순히 마지막 프레임만 저장하지 않고 레슨 전체를 요약한다.

### 10.3 50% 기준과 대표 분석

정면 드리블의 각 기준을 만족한 active 프레임 비율이 50% 이상이면 안정된 기준으로 본다. 한두 프레임의 검출 오류가 전체 평가를 바꾸지 않도록 하기 위한 방법이다.

평균값만 저장하면 사용자가 가장 잘한 장면과 고쳐야 할 장면을 확인하기 어렵다. 그래서 코드에는 긴 시간 동안 유지된 구간을 찾는 findLongestHighlightWindow 흐름이 있고, 대표 구간을 리뷰 영상 또는 피드백 타임라인에 연결할 수 있다.

### 10.4 분석 실패와 나쁜 자세 구분

visibility가 낮아 관절을 못 찾은 것은 사용자의 자세가 나쁜 것이 아니라 카메라 품질 문제일 수 있다. 개선된 평가라면 다음을 구분하는 것이 바람직하다.

- good: 측정 가능했고 기준을 만족
- needs_improvement: 측정 가능했지만 기준을 자주 벗어남
- insufficient_data: 관절 또는 공이 충분히 검출되지 않음

현재 프로젝트의 good, average, bad 평가를 설명할 때도 스포츠 과학적 절대 등급이 아니라 구현된 규칙에 따른 앱 내 평가임을 명확히 해야 한다.

---

## 11. 저장 구조와 데이터 처리

### 11.1 AsyncStorage와 SQLiteStorage

AsyncStorage는 @react-native-async-storage/async-storage 기반의 키-값 저장소이다. 계정 캐시, 세션 정보, 설정값, 간단한 배열과 객체를 JSON 문자열로 저장하는 데 사용한다.

예시 키:

- basketballAccounts
- basketballSession
- basketballRecentAccountId
- basketballBallColors
- basketballBallBrand
- basketballPosition

SQLiteStorage는 레슨 기록처럼 누적되고 동기화가 필요한 데이터의 저장 계층이다. 내부적으로 SQLite 테이블을 사용하지만 앱은 SQL 테이블을 직접 다루기보다 키-값 저장 API처럼 사용한다.

expo-sqlite 내부 저장 테이블은 다음과 같다.

~~~sql
CREATE TABLE IF NOT EXISTS storage (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT
);
~~~

기술적으로는 관계형 데이터베이스인 SQLite를 사용하지만, 프로젝트의 사용 방식은 여러 정규화된 테이블을 JOIN하는 전형적인 SQL 애플리케이션보다 JSON 값을 key에 넣는 저장소에 가깝다.

면접 답변:

> SQLite라는 관계형 데이터베이스 엔진을 사용하지만, 현재 프로젝트에서는 storage 테이블의 key와 value에 JSON을 저장합니다. 그래서 엔진 기준으로는 SQL이고, 데이터 사용 방식은 NoSQL의 key-value 저장 방식과 비슷합니다.

### 11.2 사용자별 키 분리

앱의 데이터는 사용자 ID를 키에 포함해 분리한다.

~~~ts
function getUserScopedKey(
  baseKey: string,
  userId: string,
) {
  return baseKey + ':' + userId;
}

const key = getUserScopedKey(
  'lessonRecords',
  account.id,
);
~~~

이 방식은 한 기기에서 여러 계정을 사용해도 기록이 섞이지 않도록 한다.

### 11.3 SQLiteStorage 큐

여러 저장 요청이 동시에 들어오면 같은 기록을 덮어쓰거나 순서가 뒤섞일 수 있다. lessonRecordStorage.ts는 저장 작업을 직렬화하는 큐를 사용한다.

~~~ts
let storageQueue = Promise.resolve();

function enqueueStorageTask<T>(
  task: () => Promise<T>,
) {
  const next = storageQueue.then(task);

  storageQueue = next.then(
    () => undefined,
    () => undefined,
  );

  return next;
}
~~~

이 구조는 이전 저장 작업이 끝난 후 다음 작업이 실행되도록 한다. 실패한 작업이 다음 작업을 막지 않도록 큐 내부 promise를 정리하는 것도 중요하다.

### 11.4 로컬·원격 병합

레슨 기록은 로컬과 서버 스냅샷이 서로 다를 수 있다. 프로젝트는 revision timestamp, sequence, 더 완전한 레코드 목록을 비교해 병합한다.

일반적인 병합 원칙:

1. 최신 revision을 비교한다.
2. 같은 revision이면 더 많은 정보를 가진 쪽을 선택한다.
3. 같은 ID의 항목은 더 최신 createdAt 또는 더 완전한 미디어 정보를 선택한다.
4. 병합 결과를 로컬에 저장한다.
5. 필요하면 서버 snapshot을 업데이트한다.

이는 오프라인 레슨이 먼저 저장된 뒤 인터넷이 복구되는 상황을 고려한 설계이다.

### 11.5 영상 파일과 메타데이터 분리

영상 binary 자체를 AsyncStorage나 SQLite value에 넣지 않는다. 영상은 파일 시스템에 저장하고 데이터베이스에는 URI와 메타데이터만 저장한다.

폴더:

- lesson-record-videos/<userId>/<recordId>.<ext>
- lesson-record-thumbnails/<userId>/<recordId>.jpg

~~~ts
type LessonRecord = {
  id: string;
  mode: 'dribble' | 'shoot';
  videoUri?: string;
  thumbnailUri?: string;
  feedback: string;
  createdAt: number;
};
~~~

대용량 영상을 key-value 저장소에 넣지 않는 이유는 메모리 사용, 직렬화 비용, 저장 용량과 읽기 성능 때문이다.

---

## 12. 로그인, API, 세션과 보안

### 12.1 클라이언트와 서버

프론트엔드는 React Native 앱이고, 백엔드는 etc/auth-server.js의 Node.js HTTP 서버이다. 서버는 계정과 세션을 JSON 파일에 저장하는 간단한 인증 서버이다.

| 메서드 | 경로 | 역할 |
|---|---|---|
| POST | /auth/login | 로그인 |
| POST | /auth/signup | 회원가입 |
| GET | /me | 현재 계정 확인 |
| PUT | /me/snapshot | 사용자 데이터 스냅샷 저장 |
| PATCH | /me/profile | 프로필 수정 |
| POST | /me/password | 비밀번호 변경 |
| DELETE | /me | 계정 삭제 |

클라이언트는 requestRemote를 통해 JSON을 보내고 로그인 이후 다음과 같은 헤더를 사용한다.

~~~ts
const headers = {
  'Content-Type': 'application/json',
  Authorization: 'Bearer ' + token,
};
~~~

### 12.2 비밀번호 해시

서버는 비밀번호를 평문으로 저장하지 않고 crypto.scryptSync로 해시한다.

~~~js
function createPasswordHash(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto
    .scryptSync(password, salt, 64)
    .toString('hex');

  return salt + ':' + derivedKey;
}
~~~

로그인 때는 저장된 salt를 다시 사용해 입력 비밀번호를 해시하고 저장된 derived key와 비교한다. salt는 비밀키가 아니며 같은 비밀번호의 해시 결과가 항상 같아지는 것을 막는 값이다.

### 12.3 세션 토큰

현재 인증 서버는 JWT를 사용하지 않는다. 로그인 성공 시 무작위 32바이트 토큰을 만들고 서버의 sessions 객체에 다음 정보를 저장한다.

~~~js
const token = crypto.randomBytes(32).toString('hex');

sessions[token] = {
  userId,
  createdAt: Date.now(),
  lastUsedAt: Date.now(),
};
~~~

이 방식은 opaque session token에 가깝다. 토큰 자체에 사용자 정보와 만료 시간이 인코딩되어 있지 않고, 서버가 토큰을 세션 저장소에서 조회해야 사용자를 확인할 수 있다.

면접 답변:

> 이 프로젝트의 인증은 JWT가 아니라 서버가 세션 토큰을 저장하고 요청의 Bearer 토큰을 조회하는 방식입니다. 토큰은 로그인 상태를 증명하는 식별자이고, 실제 사용자 정보는 서버의 sessions 저장소에 있습니다.

### 12.4 현재 구현의 보안상 주의점

현재 클라이언트는 오프라인 재연결과 계정 캐시를 위해 UserAccount에 선택적 password 값을 보관할 수 있다. 이는 프로토타입 단계에서는 편리하지만, 실제 서비스에서는 평문 비밀번호를 로컬에 저장하는 경로이므로 개선 대상이다.

정확한 면접 답변:

> 서버는 비밀번호를 scrypt 해시로 저장하지만, 현재 프로토타입의 오프라인 계정 캐시에는 재연결 편의를 위해 입력 비밀번호가 남을 수 있는 경로가 있습니다. 실제 배포라면 원문 비밀번호는 저장하지 않고 SecureStore에 세션 토큰 또는 refresh token만 보관하며 HTTPS와 토큰 만료·폐기 정책을 적용하겠습니다.

---

## 13. 환경변수와 설정값

환경변수는 코드 외부에서 실행 환경별 값을 주입하는 방법이다. API 주소나 서버 포트처럼 개발 환경과 배포 환경에서 달라지는 값을 코드에 직접 하드코딩하지 않기 위해 사용한다.

서버 예:

~~~js
const port = Number(
  process.env.AUTH_SERVER_PORT || 4317,
);

const host =
  process.env.AUTH_SERVER_HOST || '0.0.0.0';
~~~

클라이언트는 EXPO_PUBLIC_AUTH_SERVER_URL 같은 환경변수나 생성된 설정값을 통해 인증 서버 주소를 선택한다.

| 개념 | 예시 | 의미 |
|---|---|---|
| 환경변수 | AUTH_SERVER_PORT | 실행 환경이 외부에서 주입 |
| 설정값 | 농구공 색상, 브랜드 선택 | 사용자가 앱에서 변경 |
| 비밀값 | 비공개 API 키, refresh token | 노출 방지가 필요한 값 |

사용자가 농구공 색상을 바꾼 것은 환경변수 변경이 아니라 앱 설정값 변경이다. Expo Go 실행 시 개발 서버 주소를 환경별로 바꾸는 것은 환경변수나 빌드 설정의 대상이다.

---

## 14. 어려운 코드의 공통 설계 원리

### 14.1 한 프레임 판정과 이벤트 판정 분리

현재 각도는 프레임 값이고, 슛 릴리스나 드리블 바운스는 이벤트이다. 둘을 섞으면 같은 바운스가 여러 번 카운트되거나 팔을 들고 가만히 있는 것이 슛으로 인식될 수 있다.

~~~text
관측값:
  angle, distance, x, y, visibility

파생 상태:
  armAngleState, stanceState, dribbleHeight

이벤트:
  dribbleEntered, armExtended, releaseDetected

레슨 상태:
  countdown, active, cooldown, review
~~~

### 14.2 절대 기준과 상대 기준

화면 해상도와 사용자 키가 다르기 때문에 픽셀만 사용하지 않는다.

- 공과 손의 거리: 정규화 좌표 거리
- 공 높이: 목·엉덩이·어깨와의 상대 거리
- 발 간격: 어깨 폭과 비교
- 공 위치: 발목 중앙과 비교

이 방식은 다양한 화면 크기에 유리하지만 깊이 방향 움직임을 정확히 반영하지 못한다.

### 14.3 Hysteresis

드리블 카운트에서 진입 거리는 0.12, 리셋 거리는 0.17로 서로 다르다. 하나의 경계값만 사용하면 경계 근처에서 공이 들어왔다 나갔다 하며 상태가 흔들릴 수 있다.

~~~text
0.12 이하:
  바운스 영역 진입

0.17 이상:
  다음 바운스를 셀 수 있도록 리셋

0.12와 0.17 사이:
  현재 잠금 상태 유지
~~~

### 14.4 누락을 오류와 나쁜 자세로 구분

관절 또는 공이 안 보이는 상황을 바로 bad로 기록하면 잘못된 피드백이 된다. visible 검사, 공 추적의 누락 프레임 허용, unknown 상태가 필요한 이유이다.

> 측정할 수 없다는 것은 기준을 위반했다는 뜻이 아니다.

---

## 15. 시간 및 공간 복잡도

### 15.1 포즈 분석

MediaPipe 모델 추론 시간은 모델과 기기 성능에 따라 달라지므로 코드만으로 고정된 Big-O를 말하기 어렵다. 애플리케이션 측 후처리는 landmark 수가 고정되어 각 프레임에서 사실상 O(1)이다.

### 15.2 공 후보 검출

처리 영역의 픽셀 수를 N, 연결된 후보 수를 K라고 하면 색상 분할은 O(N), 후보 점수 계산은 O(K)이다. 처리 해상도를 높이면 정확도가 좋아질 수 있지만 N이 커져 프레임 처리 시간이 증가한다.

### 15.3 기록 평가

active 프레임 수를 F라고 할 때 기준 집계는 O(F)이다. 기록 수를 R이라고 하면 사용자별 기록 병합은 정렬을 사용하면 O(R log R), ID map을 사용하면 평균 O(R)로 처리할 수 있다.

---

## 16. 구현의 한계와 개선 계획

### 16.1 현재 한계

1. 관절 각도가 2D 화면 평면 근사값이다.
2. 카메라 각도와 가림에 따라 visibility와 공 검출이 흔들릴 수 있다.
3. 공 인식은 학습된 객체 탐지 모델이 아니라 색상·형태 규칙 기반이다.
4. 브랜드 패턴 프로필은 생성되지만 현재 실시간 패턴 매칭은 비활성화되어 있다.
5. 슛 성공은 실제 골대 통과가 아니라 사용자 성공 제스처이다.
6. 정면·측면 판정 임계값이 다양한 체형과 촬영 환경에 충분히 일반화되었다고 보기는 어렵다.
7. 프로토타입에는 클라이언트 평문 비밀번호 캐시 경로가 있어 실제 서비스 전에 제거해야 한다.
8. SQLiteStorage는 SQL 엔진을 사용하지만 현재 데이터 구조는 정규화된 관계형 스키마보다 key-value JSON 저장에 가깝다.

### 16.2 개선 방향

#### 1. 신뢰도 기반 피드백

각 기준에 visibility, 공 검출 confidence, 프레임 수를 함께 저장하고 신뢰도가 낮으면 평가를 유보한다.

#### 2. 카메라 보정

카메라 높이와 거리를 안내하고 어깨 폭이나 바닥 위치를 기준으로 스케일을 보정한다.

#### 3. 시계열 필터

각도와 공 위치에 이동 평균, 지수 평활, Kalman filter 등을 적용해 프레임 노이즈를 줄인다.

#### 4. 전용 객체 탐지 모델

다양한 농구공 이미지로 모바일용 객체 탐지 모델을 학습해 색상에 의존하지 않는 공 검출을 구현할 수 있다. 조명 변화에는 강해질 수 있지만 모델 용량과 추론 비용이 증가한다.

#### 5. 실제 슛 성공 판정

골대 landmark 또는 골대 탐지 모델, 공 궤적 추적, 림 통과 이벤트를 결합해야 한다.

#### 6. 보안 강화

- 클라이언트 원문 비밀번호 저장 제거
- Expo SecureStore에 토큰만 저장
- HTTPS 사용
- 세션 만료와 로그아웃 시 토큰 폐기
- 서버 데이터 파일 대신 실제 데이터베이스 사용
- 비밀번호 변경과 계정 삭제 요청에 대한 재인증

#### 7. 테스트 자동화

임계값 계산을 순수 함수로 분리하고 다음 데이터를 테스트한다.

- visibility가 낮은 landmark
- 한쪽 팔만 보이는 슛
- 공이 4프레임 동안 가려지는 경우
- 경계 거리 0.12와 0.17 주변
- 같은 바운스의 중복 프레임
- 리듬 비교 데이터가 하나뿐인 경우
- 릴리스 후 성공 제스처가 시간 제한을 넘는 경우

---

## 17. 면접용 핵심 답변

### 17.1 가장 어려운 알고리즘

> 가장 어려웠던 부분은 한 프레임의 자세를 보는 것이 아니라, 여러 프레임의 움직임을 하나의 드리블이나 슛 이벤트로 해석하는 부분이었습니다. MediaPipe에서 관절 좌표를 받은 뒤 팔꿈치와 무릎 각도, 공과 손의 거리, 바운스 시각을 계산하고 이전 프레임과 비교하는 상태 머신을 만들었습니다. 드리블은 공이 발 근처에 들어온 순간만 카운트하고 충분히 멀어져야 다음 바운스를 셀 수 있게 해서 중복 카운트를 줄였습니다.

### 17.2 MediaPipe가 자세를 직접 평가하나요?

> MediaPipe는 사람의 관절 landmark와 visibility를 추정하는 역할입니다. 팔이 좋은 각도인지, 드리블 높이가 적절한지, 슛 타이밍이 빠른지는 MediaPipe가 직접 판단하지 않습니다. 프로젝트에서는 landmark에 각도·거리·시간 차이 계산과 임계값 규칙을 적용해 별도로 판정합니다.

### 17.3 농구공 인식 모델을 직접 학습했나요?

> 현재 버전에서는 농구공 전용 객체 탐지 모델을 새로 학습하지 않았습니다. HSV 색상 분할로 후보 영역을 만들고 픽셀 수, 가로세로 비율, 채움 비율, 원형도, 이전 위치와의 거리, 손과 몸의 상대 위치를 조합해 공을 추적합니다. 샘플 이미지 등록도 신경망 재학습이 아니라 HSV 색상 밴드와 패턴 특징을 추출하는 캘리브레이션입니다.

### 17.4 왜 규칙 기반 판정을 사용했나요?

> 이 프로젝트의 기준은 팔 각도, 무릎 각도, 공의 상대 높이, 릴리스 시간처럼 설명 가능한 수치로 표현할 수 있었습니다. 규칙 기반 방식은 결과의 원인을 사용자에게 설명하기 쉽고 임계값을 조정하며 빠르게 검증할 수 있습니다. 반면 다양한 체형과 촬영 환경에 대한 일반화에는 한계가 있으므로, 이후에는 실제 레슨 데이터를 수집해 시계열 모델이나 전용 분류 모델을 검토할 수 있습니다.

### 17.5 슛 성공을 어떻게 확인하나요?

> 현재는 실제 골대와 공의 궤적을 분석하는 것이 아니라 릴리스 후 사용자가 양손을 머리 위로 올리는 성공 제스처를 2프레임 이상 유지했는지 확인합니다. 따라서 현재의 shot success는 실제 골 성공률이라기보다 사용자가 레슨 동작을 완료했다는 확인 이벤트입니다.

### 17.6 왜 상태 머신이 필요한가요?

> 카메라 분석 결과는 매 프레임 들어오므로 준비 자세, 카운트다운, 수행 중, 릴리스 후를 구분하지 않으면 같은 동작을 여러 번 세거나 잘못된 시점에 피드백을 제공하게 됩니다. 그래서 stance_setup, countdown, await_dribble, active, cooldown 단계로 나누고 특정 이벤트가 발생했을 때만 다음 상태로 이동하도록 했습니다.

### 17.7 SQLiteStorage는 SQL인가요, NoSQL인가요?

> 저장 엔진은 SQLite이므로 SQL 계열의 관계형 데이터베이스입니다. 다만 이 프로젝트에서는 storage 테이블의 key와 value에 JSON을 저장하는 방식으로 사용하기 때문에 실제 사용 패턴은 NoSQL key-value 저장소와 유사합니다. 여러 테이블을 JOIN하는 구조는 아닙니다.

### 17.8 영상은 어디에 저장하나요?

> 영상 binary는 AsyncStorage나 SQLite value에 넣지 않고 파일 시스템에 저장합니다. 레슨 기록에는 videoUri와 thumbnailUri 같은 경로와 분석 메타데이터만 저장합니다. 대용량 데이터를 문자열로 직렬화하는 비용과 저장 한계를 피하기 위해서입니다.

### 17.9 로그인은 JWT인가요?

> 현재 서버는 JWT가 아니라 opaque session token 방식입니다. 로그인 시 무작위 토큰을 발급하고 서버의 sessions 저장소에 사용자 ID와 시각을 기록합니다. 이후 요청은 Bearer 토큰으로 보내고 서버가 세션 저장소에서 토큰을 확인합니다.

### 17.10 개선하고 싶은 점은 무엇인가요?

> 첫째, 현재의 2D 각도와 임계값 판정을 visibility와 신뢰도 기반 평가로 보완하고 싶습니다. 둘째, 농구공 인식을 색상 규칙에서 전용 객체 탐지 모델로 확장하고 싶습니다. 셋째, 현재의 성공 제스처를 실제 골대·공 궤적 분석으로 발전시키고 싶습니다. 마지막으로 클라이언트에 비밀번호가 남을 수 있는 프로토타입 경로를 제거하고 SecureStore 기반 토큰 관리로 바꾸겠습니다.

---

## 18. 1분 발표 대본

> 제가 만든 Basketball Coach의 핵심은 카메라 영상을 단순히 저장하는 것이 아니라, 관절 좌표와 농구공 움직임을 수치화해서 레슨 피드백으로 바꾸는 것입니다.
>
> 먼저 MediaPipe Pose Landmarker로 코, 어깨, 팔꿈치, 손목, 엉덩이, 무릎, 발목의 좌표를 얻습니다. MediaPipe가 직접 자세를 평가하는 것은 아니고, 저는 세 점의 내적을 이용해 팔꿈치와 무릎 각도를 계산하고 어깨 중심과 엉덩이 중심으로 상체 기울기를 계산했습니다.
>
> 농구공은 별도의 학습된 객체 탐지 모델이 아니라 HSV 색상 분할, 연결 영역, 원형도, 이전 프레임과의 거리, 손목과 몸의 상대 위치를 조합해 검출하고 추적했습니다. 샘플 이미지 기능도 신경망 재학습이 아니라 색상 밴드를 추출하는 캘리브레이션입니다.
>
> 드리블은 공이 발 근처에 들어온 이벤트를 세고 공의 높이, 다리 사이 위치, 시선, 발 간격, 바운스 간격을 평가합니다. 슛은 무릎 굽힘, 무릎 신전, 팔 신전, 공과 손의 분리를 시간 순서로 분석해 릴리스 타이밍과 릴리스 높이를 판단합니다.
>
> 이 과정에서 한 프레임만으로 판단하지 않기 위해 준비 자세, 카운트다운, 수행 중, 릴리스 후 검토 상태를 상태 머신으로 관리했습니다. 결과는 AsyncStorage와 SQLiteStorage에 저장하고, 영상은 파일 시스템에 저장한 뒤 URI만 기록합니다. 현재는 규칙 기반 프로토타입이므로 카메라 각도와 조명에 한계가 있고, 향후에는 신뢰도 기반 평가와 실제 공·골대 추적 모델로 발전시키고 싶습니다.

---

## 19. 최종 요약

이 프로젝트의 핵심을 한 문장으로 요약하면 다음과 같다.

> 학습된 MediaPipe 모델로 얻은 사람 관절 좌표와 색상 기반 농구공 추적 결과를 기하학 계산·시간 상태 머신·규칙 기반 평가로 해석하여 React Native 앱의 실시간 농구 레슨과 기록으로 연결한 프로젝트입니다.

반드시 구분해서 기억할 내용:

1. MediaPipe는 관절 좌표를 추출하고 최종 레슨 판정은 애플리케이션 규칙이 한다.
2. 농구공 인식은 현재 색상·형태·움직임 기반 컴퓨터 비전이며 전용 학습 객체 모델이 아니다.
3. 샘플 이미지 등록은 신경망 학습이 아니라 색상 밴드 캘리브레이션이다.
4. 드리블과 슛은 현재 프레임 값보다 이전 프레임과 이벤트 시각을 함께 해석한다.
5. 상태 머신은 준비, 카운트다운, 수행, 릴리스 후 검토를 구분한다.
6. SQLiteStorage는 SQLite 엔진을 쓰지만 현재 사용 방식은 key-value JSON 저장에 가깝다.
7. 영상 binary는 파일 시스템에 저장하고 저장소에는 URI와 메타데이터를 저장한다.
8. 현재 로그인은 JWT가 아니라 서버 조회형 세션 토큰이다.
9. 서버 비밀번호는 scrypt 해시로 저장되지만 클라이언트 원문 비밀번호 캐시 경로는 실제 서비스에서 개선해야 한다.
10. 슛 성공 제스처는 실제 골대 득점 검출이 아니라 현재 프로토타입의 완료 확인 이벤트이다.

