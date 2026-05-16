import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { WebViewMessageEvent } from 'react-native-webview';
import { colors } from '../../theme/colors';
import type { DribbleAnalysis, LessonMode, ShootAnalysis } from '../../types/app';

interface LessonCameraProps {
  lessonMode: LessonMode;
  isLessonActive: boolean;
  isCameraReady: boolean;
  onPoseMessage: (event: WebViewMessageEvent) => void;
}

type Landmark = { x: number; y: number; visibility?: number };

interface BallDetection {
  x: number;
  y: number;
  radius: number;
  pixelCount: number;
  color: 'orange' | 'red';
}

type JointKey =
  | 'head'
  | 'neck'
  | 'leftShoulder'
  | 'rightShoulder'
  | 'leftElbow'
  | 'rightElbow'
  | 'leftWrist'
  | 'rightWrist'
  | 'leftHip'
  | 'rightHip'
  | 'leftKnee'
  | 'rightKnee'
  | 'leftAnkle'
  | 'rightAnkle';

type SegmentJointKey =
  | 'leftShoulder'
  | 'rightShoulder'
  | 'leftElbow'
  | 'rightElbow'
  | 'leftWrist'
  | 'rightWrist'
  | 'leftHip'
  | 'rightHip'
  | 'leftKnee'
  | 'rightKnee'
  | 'leftAnkle'
  | 'rightAnkle';

type PosePayload =
  | { type: 'ready' }
  | { type: 'stream_started' }
  | { type: 'status'; message: string }
  | { type: 'points'; summary: string }
  | { type: 'dribble_analysis'; analysis: DribbleAnalysis }
  | { type: 'shoot_analysis'; analysis: ShootAnalysis }
  | { type: 'recording_ready'; videoUri: string }
  | { type: 'recording_error'; message: string }
  | { type: 'error'; message: string };

const INDEX = {
  nose: 0,
  leftEye: 2,
  rightEye: 5,
  leftEar: 7,
  rightEar: 8,
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
} as const;

const LABELS = {
  head: '머리',
  neck: '목',
  shoulder: '어깨',
  elbow: '팔꿈치',
  hand: '손',
  hip: '엉덩이',
  knee: '무릎',
  foot: '발',
} as const;

function visible(point?: Landmark | null) {
  return Boolean(point && (point.visibility ?? 1) > 0.4);
}

function midpoint(a: Landmark, b: Landmark): Landmark {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    visibility: Math.min(a.visibility ?? 1, b.visibility ?? 1),
  };
}

function distanceBetween(a: Landmark, b: Landmark) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function angleAt(a?: Landmark, b?: Landmark, c?: Landmark): number | null {
  if (!a || !b || !c || !visible(a) || !visible(b) || !visible(c)) {
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

  const cosine = Math.min(1, Math.max(-1, dot / (magAB * magCB)));
  return (Math.acos(cosine) * 180) / Math.PI;
}

function rgbToHsv(r: number, g: number, b: number) {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;

  let hue = 0;
  if (delta !== 0) {
    if (max === red) {
      hue = ((green - blue) / delta) % 6;
    } else if (max === green) {
      hue = (blue - red) / delta + 2;
    } else {
      hue = (red - green) / delta + 4;
    }
  }

  hue = Math.round(hue * 60);
  if (hue < 0) {
    hue += 360;
  }

  const saturation = max === 0 ? 0 : delta / max;
  const value = max;

  return { h: hue, s: saturation, v: value };
}

function classifyBallPixel(r: number, g: number, b: number): BallDetection['color'] | null {
  const { h, s, v } = rgbToHsv(r, g, b);

  const isOrange = h >= 10 && h <= 42 && s >= 0.45 && v >= 0.25 && r > g && g > b * 0.8;
  if (isOrange) {
    return 'orange';
  }

  const isRed = (h <= 12 || h >= 345) && s >= 0.45 && v >= 0.22 && r > g * 1.1 && r > b * 1.1;
  if (isRed) {
    return 'red';
  }

  return null;
}

function detectBall(
  video: HTMLVideoElement,
  processingCanvas: HTMLCanvasElement,
  processingContext: CanvasRenderingContext2D
): BallDetection | null {
  const width = 192;
  const height = 144;
  processingCanvas.width = width;
  processingCanvas.height = height;
  processingContext.drawImage(video, 0, 0, width, height);

  const { data } = processingContext.getImageData(0, 0, width, height);
  const visited = new Uint8Array(width * height);
  const colorMap = new Uint8Array(width * height);

  for (let index = 0; index < width * height; index += 1) {
    const offset = index * 4;
    const color = classifyBallPixel(data[offset], data[offset + 1], data[offset + 2]);
    colorMap[index] = color === 'orange' ? 1 : color === 'red' ? 2 : 0;
  }

  let best: BallDetection | null = null;

  for (let index = 0; index < colorMap.length; index += 1) {
    if (visited[index] || colorMap[index] === 0) {
      continue;
    }

    const queue = [index];
    visited[index] = 1;
    const colorValue = colorMap[index];
    let head = 0;
    let count = 0;
    let sumX = 0;
    let sumY = 0;
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;

    while (head < queue.length) {
      const current = queue[head];
      head += 1;

      const x = current % width;
      const y = Math.floor(current / width);

      count += 1;
      sumX += x;
      sumY += y;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);

      const neighbors = [current - 1, current + 1, current - width, current + width];

      for (const neighbor of neighbors) {
        if (neighbor < 0 || neighbor >= colorMap.length || visited[neighbor] || colorMap[neighbor] !== colorValue) {
          continue;
        }

        const currentX = current % width;
        const neighborX = neighbor % width;
        if (Math.abs(currentX - neighborX) > 1) {
          continue;
        }

        visited[neighbor] = 1;
        queue.push(neighbor);
      }
    }

    if (count < 90) {
      continue;
    }

    const blobWidth = maxX - minX + 1;
    const blobHeight = maxY - minY + 1;
    const aspectRatio = blobWidth / blobHeight;
    if (aspectRatio < 0.55 || aspectRatio > 1.45) {
      continue;
    }

    const radius = Math.max(blobWidth, blobHeight) / Math.max(width, height) / 2;
    const candidate: BallDetection = {
      x: sumX / count / width,
      y: sumY / count / height,
      radius,
      pixelCount: count,
      color: colorValue === 1 ? 'orange' : 'red',
    };

    if (!best || candidate.pixelCount > best.pixelCount) {
      best = candidate;
    }
  }

  return best;
}

function classifyEyeFocus(landmarks: Landmark[], neck: Landmark | null): DribbleAnalysis['eyeFocus'] {
  const nose = landmarks[INDEX.nose];
  const leftEar = landmarks[INDEX.leftEar];
  const rightEar = landmarks[INDEX.rightEar];
  const leftEye = landmarks[INDEX.leftEye];
  const rightEye = landmarks[INDEX.rightEye];

  if (!visible(nose) || !neck) {
    return 'unknown';
  }

  const headBase =
    visible(leftEar) && visible(rightEar)
      ? midpoint(leftEar, rightEar)
      : visible(leftEye) && visible(rightEye)
        ? midpoint(leftEye, rightEye)
        : null;

  if (!headBase) {
    return 'unknown';
  }

  const noseDrop = nose.y - headBase.y;
  const neckGap = neck.y - nose.y;
  return noseDrop > 0.055 || neckGap < 0.11 ? 'ball' : 'forward';
}

function classifyDribbleHeight(
  landmarks: Landmark[],
  neck: Landmark | null,
  hipMid: Landmark | null
): DribbleAnalysis['dribbleHeight'] {
  const wrists = [landmarks[INDEX.leftWrist], landmarks[INDEX.rightWrist]].filter(visible);

  if (!neck || !hipMid || wrists.length === 0) {
    return 'unknown';
  }

  const dribbleHand = wrists.reduce((lowest, current) => (current.y > lowest.y ? current : lowest));
  const neckDistance = Math.abs(dribbleHand.y - neck.y);
  const hipDistance = Math.abs(dribbleHand.y - hipMid.y);

  if (neckDistance + 0.015 < hipDistance) {
    return 'high';
  }

  if (hipDistance + 0.015 < neckDistance) {
    return 'low';
  }

  return 'balanced';
}

function didDribbleStart(landmarks: Landmark[], ball: BallDetection | null) {
  if (!ball) {
    return false;
  }

  const ballPoint: Landmark = { x: ball.x, y: ball.y, visibility: 1 };
  const lowerBodyPoints = [
    landmarks[INDEX.leftKnee],
    landmarks[INDEX.rightKnee],
    landmarks[INDEX.leftAnkle],
    landmarks[INDEX.rightAnkle],
  ].filter(visible);

  if (lowerBodyPoints.length === 0) {
    return false;
  }

  return lowerBodyPoints.some((point) => distanceBetween(point, ballPoint) <= 0.12);
}

function getShootingSide(landmarks: Landmark[]) {
  const leftArmAngle = angleAt(landmarks[INDEX.leftShoulder], landmarks[INDEX.leftElbow], landmarks[INDEX.leftWrist]);
  const rightArmAngle = angleAt(landmarks[INDEX.rightShoulder], landmarks[INDEX.rightElbow], landmarks[INDEX.rightWrist]);

  if (leftArmAngle !== null && rightArmAngle !== null) {
    return (landmarks[INDEX.leftWrist]?.y ?? 1) < (landmarks[INDEX.rightWrist]?.y ?? 1) ? 'left' : 'right';
  }

  if (leftArmAngle !== null) {
    return 'left';
  }

  if (rightArmAngle !== null) {
    return 'right';
  }

  return null;
}

function classifyTorsoPosture(shoulderMid: Landmark | null, hipMid: Landmark | null): DribbleAnalysis['torsoPosture'] {
  if (!shoulderMid || !hipMid) {
    return 'unknown';
  }

  const torsoHeight = hipMid.y - shoulderMid.y;

  if (torsoHeight > 0.3) {
    return 'high';
  }

  if (torsoHeight < 0.2) {
    return 'low';
  }

  return 'balanced';
}

function buildDribbleAnalysis(landmarks: Landmark[], ball: BallDetection | null): DribbleAnalysis {
  const leftShoulder = landmarks[INDEX.leftShoulder];
  const rightShoulder = landmarks[INDEX.rightShoulder];
  const leftHip = landmarks[INDEX.leftHip];
  const rightHip = landmarks[INDEX.rightHip];

  const shoulderMid = visible(leftShoulder) && visible(rightShoulder) ? midpoint(leftShoulder, rightShoulder) : null;
  const hipMid = visible(leftHip) && visible(rightHip) ? midpoint(leftHip, rightHip) : null;
  const neck = shoulderMid;
  const dribbleStarted = didDribbleStart(landmarks, ball);

  const eyeFocus = classifyEyeFocus(landmarks, neck);
  const dribbleHeight = dribbleStarted ? classifyDribbleHeight(landmarks, neck, hipMid) : 'unknown';
  const torsoPosture = classifyTorsoPosture(shoulderMid, hipMid);

  return {
    dribbleStarted,
    eyeFocus,
    dribbleHeight,
    torsoPosture,
    summary: [
      `드리블:${dribbleStarted ? '시작됨' : '대기 중'}`,
      `시선:${eyeFocus === 'ball' ? '공 쪽' : eyeFocus === 'forward' ? '앞' : '판정 어려움'}`,
      `드리블:${dribbleHeight === 'high' ? '높음' : dribbleHeight === 'low' ? '낮음' : dribbleHeight === 'balanced' ? '적절' : '판정 어려움'}`,
      `상체:${torsoPosture === 'high' ? '높음' : torsoPosture === 'low' ? '낮음' : torsoPosture === 'balanced' ? '적절' : '판정 어려움'}`,
      `공:${ball ? `${ball.color === 'orange' ? '주황' : '빨강'} 감지` : '탐색 중'}`,
    ].join(' | '),
  };
}

function buildShootAnalysis(landmarks: Landmark[], releaseVelocity: number | null, ball: BallDetection | null): ShootAnalysis {
  const leftShoulder = landmarks[INDEX.leftShoulder];
  const rightShoulder = landmarks[INDEX.rightShoulder];
  const leftElbow = landmarks[INDEX.leftElbow];
  const rightElbow = landmarks[INDEX.rightElbow];
  const leftWrist = landmarks[INDEX.leftWrist];
  const rightWrist = landmarks[INDEX.rightWrist];
  const leftHip = landmarks[INDEX.leftHip];
  const rightHip = landmarks[INDEX.rightHip];
  const leftKnee = landmarks[INDEX.leftKnee];
  const rightKnee = landmarks[INDEX.rightKnee];
  const leftAnkle = landmarks[INDEX.leftAnkle];
  const rightAnkle = landmarks[INDEX.rightAnkle];

  const leftArmAngle = angleAt(leftShoulder, leftElbow, leftWrist);
  const rightArmAngle = angleAt(rightShoulder, rightElbow, rightWrist);
  const shootingSide =
    leftArmAngle !== null && rightArmAngle !== null
      ? (leftWrist?.y ?? 1) < (rightWrist?.y ?? 1)
        ? 'left'
        : 'right'
      : leftArmAngle !== null
        ? 'left'
        : rightArmAngle !== null
          ? 'right'
          : null;

  const armAngle = shootingSide === 'left' ? leftArmAngle : shootingSide === 'right' ? rightArmAngle : null;
  const shootingShoulder = shootingSide === 'left' ? leftShoulder : shootingSide === 'right' ? rightShoulder : undefined;
  const shootingWrist = shootingSide === 'left' ? leftWrist : shootingSide === 'right' ? rightWrist : undefined;

  let armAngleState: ShootAnalysis['armAngleState'] = 'unknown';
  if (armAngle !== null) {
    if (armAngle < 90) {
      armAngleState = 'narrow';
    } else if (armAngle > 110) {
      armAngleState = 'wide';
    } else {
      armAngleState = 'balanced';
    }
  }

  const legAngles = [angleAt(leftHip, leftKnee, leftAnkle), angleAt(rightHip, rightKnee, rightAnkle)].filter(
    (value): value is number => value !== null
  );
  const legAngle = legAngles.length > 0 ? legAngles.reduce((sum, value) => sum + value, 0) / legAngles.length : null;

  let legAngleState: ShootAnalysis['legAngleState'] = 'unknown';
  if (legAngle !== null) {
    if (legAngle < 100) {
      legAngleState = 'low';
    } else if (legAngle > 130) {
      legAngleState = 'high';
    } else {
      legAngleState = 'balanced';
    }
  }

  const releasePose =
    armAngle !== null &&
    armAngle > 120 &&
    visible(shootingShoulder) &&
    visible(shootingWrist) &&
    shootingWrist!.y < shootingShoulder!.y;

  let releaseTiming: ShootAnalysis['releaseTiming'] = 'unknown';
  if (releasePose && releaseVelocity !== null) {
    if (releaseVelocity < -0.003) {
      releaseTiming = 'early';
    } else if (releaseVelocity > 0.003) {
      releaseTiming = 'late';
    } else {
      releaseTiming = 'balanced';
    }
  }

  return {
    armAngle,
    legAngle,
    releaseVelocity,
    armAngleState,
    releaseTiming,
    legAngleState,
    summary: [
      `팔:${armAngleState === 'narrow' ? '좁음' : armAngleState === 'wide' ? '넓음' : armAngleState === 'balanced' ? '적절' : '판정 어려움'}`,
      `타이밍:${releaseTiming === 'early' ? '빠름' : releaseTiming === 'late' ? '늦음' : releaseTiming === 'balanced' ? '적절' : '판정 어려움'}`,
      `하체:${legAngleState === 'low' ? '너무 낮음' : legAngleState === 'high' ? '높음' : legAngleState === 'balanced' ? '적절' : '판정 어려움'}`,
      `공:${ball ? `${ball.color === 'orange' ? '주황' : '빨강'} 감지` : '탐색 중'}`,
    ].join(' | '),
  };
}

function getProblemJointKeys(
  lessonMode: LessonMode,
  landmarks: Landmark[],
  dribbleAnalysis: DribbleAnalysis,
  shootAnalysis: ShootAnalysis
) {
  const problemJoints = new Set<JointKey>();

  if (lessonMode === 'dribble') {
    if (dribbleAnalysis.eyeFocus === 'ball') {
      problemJoints.add('head');
      problemJoints.add('neck');
    }

    if (dribbleAnalysis.dribbleStarted && dribbleAnalysis.dribbleHeight !== 'balanced' && dribbleAnalysis.dribbleHeight !== 'unknown') {
      problemJoints.add('leftWrist');
      problemJoints.add('rightWrist');
    }

    if (dribbleAnalysis.torsoPosture !== 'balanced' && dribbleAnalysis.torsoPosture !== 'unknown') {
      problemJoints.add('leftShoulder');
      problemJoints.add('rightShoulder');
      problemJoints.add('leftHip');
      problemJoints.add('rightHip');
    }
  } else {
    const shootingSide = getShootingSide(landmarks);
    const shoulderKey = shootingSide === 'left' ? 'leftShoulder' : 'rightShoulder';
    const elbowKey = shootingSide === 'left' ? 'leftElbow' : 'rightElbow';
    const wristKey = shootingSide === 'left' ? 'leftWrist' : 'rightWrist';

    if (shootingSide && shootAnalysis.armAngleState !== 'balanced' && shootAnalysis.armAngleState !== 'unknown') {
      problemJoints.add(shoulderKey);
      problemJoints.add(elbowKey);
      problemJoints.add(wristKey);
    }

    if (shootingSide && shootAnalysis.releaseTiming !== 'balanced' && shootAnalysis.releaseTiming !== 'unknown') {
      problemJoints.add(wristKey);
      problemJoints.add('leftHip');
      problemJoints.add('rightHip');
    }

    if (shootAnalysis.legAngleState !== 'balanced' && shootAnalysis.legAngleState !== 'unknown') {
      problemJoints.add('leftHip');
      problemJoints.add('rightHip');
      problemJoints.add('leftKnee');
      problemJoints.add('rightKnee');
      problemJoints.add('leftAnkle');
      problemJoints.add('rightAnkle');
    }
  }

  return problemJoints;
}

function shouldHighlightSegment(problemJointKeys: Set<JointKey>, a: SegmentJointKey, b: SegmentJointKey) {
  return problemJointKeys.has(a) || problemJointKeys.has(b);
}

export function LessonCamera({ lessonMode, isLessonActive, isCameraReady, onPoseMessage }: LessonCameraProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const onPoseMessageRef = useRef(onPoseMessage);

  useEffect(() => {
    onPoseMessageRef.current = onPoseMessage;
  }, [onPoseMessage]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return undefined;
    }

    host.innerHTML = '';

    if (!isLessonActive) {
      return undefined;
    }

    let cancelled = false;
    let animationFrameId = 0;
    let stream: MediaStream | null = null;
    let poseLandmarker: {
      detectForVideo: (video: HTMLVideoElement, timestampMs: number) => { landmarks?: Landmark[][] };
      close?: () => void;
    } | null = null;
    let recorder: MediaRecorder | null = null;
    let recorderChunks: Blob[] = [];
    let recorderStopping = false;
    let lastVideoTime = -1;
    let lastPointSummary = '';
    let lastDribbleSummary = '';
    let lastShootSummary = '';
    let lastSentAt = 0;
    let previousHipY: number | null = null;

    const emit = (payload: PosePayload) => {
      onPoseMessageRef.current({
        nativeEvent: {
          data: JSON.stringify(payload),
        },
      } as WebViewMessageEvent);
    };

    const finalizeRecording = () => {
      if (recorderChunks.length === 0) {
        emit({ type: 'recording_error', message: '저장할 영상 데이터가 없습니다.' });
        return;
      }

      const blob = new Blob(recorderChunks, {
        type: recorder?.mimeType || 'video/webm',
      });
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = typeof reader.result === 'string' ? reader.result : '';
        if (!result) {
          emit({ type: 'recording_error', message: '영상 인코딩에 실패했습니다.' });
          return;
        }

        emit({ type: 'recording_ready', videoUri: result });
      };
      reader.onerror = () => {
        emit({ type: 'recording_error', message: '영상 파일을 읽는 중 오류가 발생했습니다.' });
      };
      reader.readAsDataURL(blob);
    };

    const wrap = document.createElement('div');
    wrap.style.position = 'relative';
    wrap.style.width = '100%';
    wrap.style.height = '100%';
    wrap.style.background = colors.cameraBg;
    wrap.style.overflow = 'hidden';

    const video = document.createElement('video');
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    video.setAttribute('webkit-playsinline', 'true');
    Object.assign(video.style, {
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      transform: 'scaleX(-1)',
      background: colors.cameraBg,
      opacity: '0',
    } satisfies Partial<CSSStyleDeclaration>);

    const canvas = document.createElement('canvas');
    Object.assign(canvas.style, {
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
    } satisfies Partial<CSSStyleDeclaration>);

    const processingCanvas = document.createElement('canvas');
    const processingContext = processingCanvas.getContext('2d', { willReadFrequently: true });

    const hud = document.createElement('div');
    hud.textContent = 'MediaPipe와 공 인식을 준비하는 중입니다.';
    Object.assign(hud.style, {
      position: 'absolute',
      left: '12px',
      right: '12px',
      bottom: '12px',
      zIndex: '5',
      color: '#ffffff',
      background: 'rgba(0, 0, 0, 0.5)',
      borderRadius: '14px',
      padding: '10px 12px',
      fontSize: '13px',
      lineHeight: '1.45',
      pointerEvents: 'none',
    } satisfies Partial<CSSStyleDeclaration>);

    wrap.appendChild(video);
    wrap.appendChild(canvas);
    wrap.appendChild(hud);
    host.appendChild(wrap);

    const context = canvas.getContext('2d');
    if (!context || !processingContext) {
      emit({ type: 'error', message: '캔버스를 초기화할 수 없습니다.' });
      return undefined;
    }

    const setHud = (text: string) => {
      hud.textContent = text;
    };

    const resizeCanvas = () => {
      canvas.width = video.videoWidth || host.clientWidth || 1280;
      canvas.height = video.videoHeight || host.clientHeight || 720;
    };

    const projectX = (x: number) => (1 - x) * canvas.width;
    const projectY = (y: number) => y * canvas.height;

    const drawPoint = (point: Landmark, label: string, color: string) => {
      const x = projectX(point.x);
      const y = projectY(point.y);
      context.beginPath();
      context.arc(x, y, 7, 0, Math.PI * 2);
      context.fillStyle = color;
      context.fill();
      context.font = 'bold 16px Arial';
      context.lineWidth = 4;
      context.strokeStyle = 'rgba(0,0,0,0.75)';
      context.strokeText(label, x + 10, y - 10);
      context.fillStyle = '#ffffff';
      context.fillText(label, x + 10, y - 10);
    };

    const drawSegment = (a?: Landmark, b?: Landmark, color?: string) => {
      if (!a || !b || !color || !visible(a) || !visible(b)) {
        return;
      }

      context.beginPath();
      context.moveTo(projectX(a.x), projectY(a.y));
      context.lineTo(projectX(b.x), projectY(b.y));
      context.strokeStyle = color;
      context.lineWidth = 4;
      context.stroke();
    };

    const drawBall = (ball: BallDetection) => {
      const centerX = projectX(ball.x);
      const centerY = projectY(ball.y);
      const radius = ball.radius * Math.max(canvas.width, canvas.height);
      const stroke = ball.color === 'orange' ? '#ff9f1c' : '#ff4d5a';

      context.beginPath();
      context.arc(centerX, centerY, Math.max(radius, 16), 0, Math.PI * 2);
      context.strokeStyle = stroke;
      context.lineWidth = 4;
      context.stroke();

      context.fillStyle = 'rgba(0,0,0,0.55)';
      context.fillRect(centerX - 44, centerY - Math.max(radius, 16) - 32, 88, 22);
      context.fillStyle = '#ffffff';
      context.font = 'bold 13px Arial';
      context.textAlign = 'center';
      context.fillText(ball.color === 'orange' ? '주황 공' : '빨간 공', centerX, centerY - Math.max(radius, 16) - 16);
      context.textAlign = 'left';
    };

    const renderPose = (landmarks: Landmark[] | null) => {
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.save();
      context.translate(canvas.width, 0);
      context.scale(-1, 1);
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      context.restore();
      const ball = detectBall(video, processingCanvas, processingContext);

      if (!landmarks) {
        if (ball) {
          drawBall(ball);
        }

        setHud(ball ? `공 인식됨: ${ball.color === 'orange' ? '주황 공' : '빨간 공'}` : '화면 안에 몸과 공이 보이도록 맞춰 주세요.');
        const now = Date.now();
        if (now - lastSentAt > 1200) {
          lastSentAt = now;
          emit({ type: 'status', message: ball ? '공은 감지되지만 사람을 찾는 중입니다.' : '사람과 공을 찾는 중입니다.' });
        }
        return;
      }

      const head = landmarks[INDEX.nose];
      const leftShoulder = landmarks[INDEX.leftShoulder];
      const rightShoulder = landmarks[INDEX.rightShoulder];
      const leftElbow = landmarks[INDEX.leftElbow];
      const rightElbow = landmarks[INDEX.rightElbow];
      const leftWrist = landmarks[INDEX.leftWrist];
      const rightWrist = landmarks[INDEX.rightWrist];
      const leftHip = landmarks[INDEX.leftHip];
      const rightHip = landmarks[INDEX.rightHip];
      const leftKnee = landmarks[INDEX.leftKnee];
      const rightKnee = landmarks[INDEX.rightKnee];
      const leftAnkle = landmarks[INDEX.leftAnkle];
      const rightAnkle = landmarks[INDEX.rightAnkle];
      const neck = visible(leftShoulder) && visible(rightShoulder) ? midpoint(leftShoulder, rightShoulder) : null;
      const hipMid = visible(leftHip) && visible(rightHip) ? midpoint(leftHip, rightHip) : null;

      const detected: string[] = [];
      if (visible(head)) detected.push(LABELS.head);
      if (neck && visible(neck)) detected.push(LABELS.neck);
      if (visible(leftShoulder) || visible(rightShoulder)) detected.push(LABELS.shoulder);
      if (visible(leftElbow) || visible(rightElbow)) detected.push(LABELS.elbow);
      if (visible(leftWrist) || visible(rightWrist)) detected.push(LABELS.hand);
      if (visible(leftHip) || visible(rightHip)) detected.push(LABELS.hip);
      if (visible(leftKnee) || visible(rightKnee)) detected.push(LABELS.knee);
      if (visible(leftAnkle) || visible(rightAnkle)) detected.push(LABELS.foot);
      if (ball) {
        detected.push(ball.color === 'orange' ? '주황 공' : '빨간 공');
      }

      const releaseVelocity = hipMid && previousHipY !== null ? hipMid.y - previousHipY : null;
      if (hipMid) {
        previousHipY = hipMid.y;
      }

      const dribbleAnalysis = buildDribbleAnalysis(landmarks, ball);
      const shootAnalysis = buildShootAnalysis(landmarks, releaseVelocity, ball);
      const problemJointKeys = getProblemJointKeys(lessonMode, landmarks, dribbleAnalysis, shootAnalysis);
      const highlightColor = '#ff4d5a';
      const pickColor = (jointKey: JointKey, baseColor: string) => (problemJointKeys.has(jointKey) ? highlightColor : baseColor);
      const pickSegmentColor = (a: SegmentJointKey, b: SegmentJointKey, baseColor: string) =>
        shouldHighlightSegment(problemJointKeys, a, b) ? highlightColor : baseColor;
      drawSegment(leftShoulder, rightShoulder, pickSegmentColor('leftShoulder', 'rightShoulder', '#ffb347'));
      drawSegment(leftShoulder, leftElbow, pickSegmentColor('leftShoulder', 'leftElbow', '#ffb347'));
      drawSegment(rightShoulder, rightElbow, pickSegmentColor('rightShoulder', 'rightElbow', '#ffb347'));
      drawSegment(leftElbow, leftWrist, pickSegmentColor('leftElbow', 'leftWrist', '#ffd166'));
      drawSegment(rightElbow, rightWrist, pickSegmentColor('rightElbow', 'rightWrist', '#ffd166'));
      drawSegment(leftShoulder, leftHip, pickSegmentColor('leftShoulder', 'leftHip', '#7bd389'));
      drawSegment(rightShoulder, rightHip, pickSegmentColor('rightShoulder', 'rightHip', '#7bd389'));
      drawSegment(leftHip, rightHip, pickSegmentColor('leftHip', 'rightHip', '#7bd389'));
      drawSegment(leftHip, leftKnee, pickSegmentColor('leftHip', 'leftKnee', '#7bd389'));
      drawSegment(rightHip, rightKnee, pickSegmentColor('rightHip', 'rightKnee', '#7bd389'));
      drawSegment(leftKnee, leftAnkle, pickSegmentColor('leftKnee', 'leftAnkle', '#80ed99'));
      drawSegment(rightKnee, rightAnkle, pickSegmentColor('rightKnee', 'rightAnkle', '#80ed99'));
      if (visible(head)) drawPoint(head, LABELS.head, pickColor('head', '#ff6b6b'));
      if (neck && visible(neck)) drawPoint(neck, LABELS.neck, pickColor('neck', '#f7b267'));
      if (visible(leftShoulder)) drawPoint(leftShoulder, `왼쪽 ${LABELS.shoulder}`, pickColor('leftShoulder', '#ffd166'));
      if (visible(rightShoulder)) drawPoint(rightShoulder, `오른쪽 ${LABELS.shoulder}`, pickColor('rightShoulder', '#ffd166'));
      if (visible(leftElbow)) drawPoint(leftElbow, `왼쪽 ${LABELS.elbow}`, pickColor('leftElbow', '#ffb703'));
      if (visible(rightElbow)) drawPoint(rightElbow, `오른쪽 ${LABELS.elbow}`, pickColor('rightElbow', '#ffb703'));
      if (visible(leftWrist)) drawPoint(leftWrist, `왼쪽 ${LABELS.hand}`, pickColor('leftWrist', '#fb8500'));
      if (visible(rightWrist)) drawPoint(rightWrist, `오른쪽 ${LABELS.hand}`, pickColor('rightWrist', '#fb8500'));
      if (visible(leftHip)) drawPoint(leftHip, `왼쪽 ${LABELS.hip}`, pickColor('leftHip', '#06d6a0'));
      if (visible(rightHip)) drawPoint(rightHip, `오른쪽 ${LABELS.hip}`, pickColor('rightHip', '#06d6a0'));
      if (visible(leftKnee)) drawPoint(leftKnee, `왼쪽 ${LABELS.knee}`, pickColor('leftKnee', '#118ab2'));
      if (visible(rightKnee)) drawPoint(rightKnee, `오른쪽 ${LABELS.knee}`, pickColor('rightKnee', '#118ab2'));
      if (visible(leftAnkle)) drawPoint(leftAnkle, `왼쪽 ${LABELS.foot}`, pickColor('leftAnkle', '#4cc9f0'));
      if (visible(rightAnkle)) drawPoint(rightAnkle, `오른쪽 ${LABELS.foot}`, pickColor('rightAnkle', '#4cc9f0'));
      if (ball) {
        drawBall(ball);
      }
      const pointSummary = detected.join(', ');
      const issueSummary =
        problemJointKeys.size > 0
          ? '문제가 의심되는 관절을 빨간색으로 표시하고 있어요.'
          : '현재는 크게 문제로 보이는 관절이 없어요.';
      setHud(pointSummary ? `인식 중: ${pointSummary}\n${issueSummary}` : '관절과 공을 찾는 중입니다.');
      const now = Date.now();

      if (pointSummary && (pointSummary !== lastPointSummary || now - lastSentAt > 1200)) {
        lastPointSummary = pointSummary;
        lastSentAt = now;
        emit({ type: 'points', summary: pointSummary });
      }

      if (dribbleAnalysis.summary !== lastDribbleSummary || now - lastSentAt > 1200) {
        lastDribbleSummary = dribbleAnalysis.summary;
        emit({ type: 'dribble_analysis', analysis: dribbleAnalysis });
      }

      if (shootAnalysis.summary !== lastShootSummary || now - lastSentAt > 1200) {
        lastShootSummary = shootAnalysis.summary;
        emit({ type: 'shoot_analysis', analysis: shootAnalysis });
      }
    };

    const loop = () => {
      if (cancelled) {
        return;
      }

      if (!poseLandmarker || video.readyState < 2) {
        animationFrameId = window.requestAnimationFrame(loop);
        return;
      }

      if (video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        const result = poseLandmarker.detectForVideo(video, performance.now());
        const landmarks = result.landmarks && result.landmarks.length > 0 ? result.landmarks[0] : null;
        renderPose(landmarks);
      }

      animationFrameId = window.requestAnimationFrame(loop);
    };

    const start = async () => {
      try {
        if (!window.isSecureContext) {
          throw new Error('브라우저가 보안 컨텍스트가 아니라 카메라를 열 수 없습니다. localhost 또는 https에서 실행해 주세요.');
        }

        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('이 브라우저에서는 getUserMedia를 사용할 수 없습니다.');
        }

        emit({ type: 'status', message: 'MediaPipe와 공 인식 모델을 준비하는 중입니다.' });
        setHud('MediaPipe와 공 인식 모델을 준비하는 중입니다.');

        const loadVisionModule = new Function(
          'return import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest");'
        ) as () => Promise<{
          FilesetResolver: {
            forVisionTasks: (wasmRoot: string) => Promise<unknown>;
          };
          PoseLandmarker: {
            createFromOptions: (
              fileset: unknown,
              options: Record<string, unknown>
            ) => Promise<{
              detectForVideo: (video: HTMLVideoElement, timestampMs: number) => { landmarks?: Landmark[][] };
              close?: () => void;
            }>;
          };
        }>;

        const { FilesetResolver, PoseLandmarker } = await loadVisionModule();
        const fileset = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );

        poseLandmarker = await PoseLandmarker.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
          },
          runningMode: 'VIDEO',
          numPoses: 1,
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        emit({ type: 'ready' });

        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: 'user',
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        video.srcObject = stream;
        await video.play();
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        if (typeof MediaRecorder !== 'undefined') {
          const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
            ? 'video/webm;codecs=vp8,opus'
            : MediaRecorder.isTypeSupported('video/webm')
              ? 'video/webm'
              : '';

          const composedStream = canvas.captureStream(30);
          recorder = mimeType ? new MediaRecorder(composedStream, { mimeType }) : new MediaRecorder(composedStream);
          recorderChunks = [];
          recorderStopping = false;
          recorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) {
              recorderChunks.push(event.data);
            }
          };
          recorder.onstop = () => {
            if (recorderStopping) {
              finalizeRecording();
            }
          };
          recorder.onerror = () => {
            emit({ type: 'recording_error', message: '레슨 영상 녹화 중 오류가 발생했습니다.' });
          };
          recorder.start(1000);
        }

        emit({ type: 'stream_started' });
        setHud('카메라 시작 완료. 자세와 공을 분석하는 중입니다.');
        animationFrameId = window.requestAnimationFrame(loop);
      } catch (error) {
        const message = error instanceof Error ? error.message : '웹 카메라를 시작하지 못했습니다.';
        emit({ type: 'error', message });
        setHud(message);
      }
    };

    void start();

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resizeCanvas);
      if (recorder && recorder.state !== 'inactive') {
        recorderStopping = true;
        recorder.stop();
      }
      stream?.getTracks().forEach((track) => track.stop());
      poseLandmarker?.close?.();
      host.innerHTML = '';
    };
  }, [isLessonActive]);

  return (
    <View style={styles.videoWrap}>
      {isLessonActive ? (
        <>
          <div ref={hostRef} style={{ width: '100%', height: '100%', backgroundColor: colors.cameraBg }} />
          <View style={styles.overlay}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{isCameraReady ? 'LIVE' : 'LOADING'}</Text>
            </View>
          </View>
        </>
      ) : (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderTitle}>카메라 대기 중</Text>
          <Text style={styles.placeholderText}>레슨 시작을 누르면 자세와 공 인식이 함께 시작됩니다.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  videoWrap: {
    height: 560,
    backgroundColor: colors.cameraBg,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: colors.secondary,
    marginBottom: 16,
    position: 'relative',
  },
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'flex-start',
    padding: 16,
    pointerEvents: 'none',
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(230,57,70,0.9)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  badgeText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  placeholderTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 8,
  },
  placeholderText: {
    color: '#ddd1c8',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
});
