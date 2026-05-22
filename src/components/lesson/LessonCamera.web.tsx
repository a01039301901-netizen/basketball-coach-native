import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { WebViewMessageEvent } from 'react-native-webview';
import { colors } from '../../theme/colors';
import type { BallBrandOption, BallColorOption, DribbleAnalysis, LessonMode, ShootAnalysis } from '../../types/app';

interface LessonCameraProps {
  lessonMode: LessonMode;
  selectedBallBrand: BallBrandOption;
  selectedBallColors: BallColorOption[];
  isLessonActive: boolean;
  isCameraReady: boolean;
  countdownValue: number | null;
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

interface BallDetectionProfile {
  mergeColors: boolean;
  dilationRadius: number;
  minPixels: number;
  minFillRatio: number;
  minCircleCoverage: number;
  maxCircleCoverage: number;
}

interface HandDetection {
  handedness: 'left' | 'right';
  wrist: Landmark;
  handCenter: Landmark;
}

interface DribbleTracker {
  dribbleCount: number;
  lastHand: 'left' | 'right' | null;
  leftHandDribbleCount: number;
  rightHandDribbleCount: number;
  cycleActive: boolean;
  wasNearFoot: boolean;
  highestBallY: number | null;
  lowestBallY: number | null;
  bounceHighState: DribbleAnalysis['bounceHighState'];
  bounceLowState: DribbleAnalysis['bounceLowState'];
}

interface ShootTracker {
  initialHeadY: number | null;
  lowestLegAngle: number | null;
  headPeakY: number | null;
  releaseDetected: boolean;
  releaseTiming: ShootAnalysis['releaseTiming'];
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

type PoseResults = {
  image?: CanvasImageSource;
  poseLandmarks?: Landmark[];
};

type ClassicPose = {
  setOptions: (options: Record<string, unknown>) => void;
  onResults: (callback: (results: PoseResults) => void) => void;
  send: (input: { image: HTMLVideoElement }) => Promise<void>;
  close?: () => void;
};

type PoseGlobal = new (options: { locateFile: (file: string) => string }) => ClassicPose;

declare global {
  interface Window {
    Pose?: PoseGlobal;
  }
}

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
  leftPinky: 17,
  rightPinky: 18,
  leftIndex: 19,
  rightIndex: 20,
  leftThumb: 21,
  rightThumb: 22,
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
  wrist: '손목',
  hand: '손',
  hip: '엉덩이',
  knee: '무릎',
  foot: '발',
} as const;

const BODY_SEGMENTS: Array<[SegmentJointKey, SegmentJointKey, string]> = [
  ['leftShoulder', 'rightShoulder', '#ffb347'],
  ['leftShoulder', 'leftElbow', '#ffb347'],
  ['rightShoulder', 'rightElbow', '#ffb347'],
  ['leftElbow', 'leftWrist', '#ffd166'],
  ['rightElbow', 'rightWrist', '#ffd166'],
  ['leftShoulder', 'leftHip', '#7bd389'],
  ['rightShoulder', 'rightHip', '#7bd389'],
  ['leftHip', 'rightHip', '#7bd389'],
  ['leftHip', 'leftKnee', '#7bd389'],
  ['rightHip', 'rightKnee', '#7bd389'],
  ['leftKnee', 'leftAnkle', '#80ed99'],
  ['rightKnee', 'rightAnkle', '#80ed99'],
];

function createDribbleTracker(): DribbleTracker {
  return {
    dribbleCount: 0,
    lastHand: null,
    leftHandDribbleCount: 0,
    rightHandDribbleCount: 0,
    cycleActive: false,
    wasNearFoot: false,
    highestBallY: null,
    lowestBallY: null,
    bounceHighState: 'unknown',
    bounceLowState: 'unknown',
  };
}

function createShootTracker(): ShootTracker {
  return {
    initialHeadY: null,
    lowestLegAngle: null,
    headPeakY: null,
    releaseDetected: false,
    releaseTiming: 'unknown',
  };
}

function visible(point?: Landmark | null) {
  return Boolean(point && (point.visibility ?? 1) > 0.45);
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

function averagePoints(points: Landmark[]): Landmark | null {
  if (points.length === 0) {
    return null;
  }

  const total = points.reduce(
    (acc, point) => ({
      x: acc.x + point.x,
      y: acc.y + point.y,
    }),
    { x: 0, y: 0 }
  );

  return {
    x: total.x / points.length,
    y: total.y / points.length,
    visibility: 1,
  };
}

function getPoseHandDetections(landmarks: Landmark[]): HandDetection[] {
  const leftWrist = landmarks[INDEX.leftWrist];
  const rightWrist = landmarks[INDEX.rightWrist];
  const leftHand = averagePoints(
    [INDEX.leftPinky, INDEX.leftIndex, INDEX.leftThumb]
      .map((index) => landmarks[index])
      .filter((point): point is Landmark => visible(point))
  );
  const rightHand = averagePoints(
    [INDEX.rightPinky, INDEX.rightIndex, INDEX.rightThumb]
      .map((index) => landmarks[index])
      .filter((point): point is Landmark => visible(point))
  );

  const hands: HandDetection[] = [];
  if (visible(leftWrist) && leftHand) {
    hands.push({ handedness: 'left', wrist: leftWrist, handCenter: leftHand });
  }

  if (visible(rightWrist) && rightHand) {
    hands.push({ handedness: 'right', wrist: rightWrist, handCenter: rightHand });
  }

  return hands;
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

  return {
    h: hue,
    s: max === 0 ? 0 : delta / max,
    v: max,
  };
}

function getBallDetectionProfile(brand: BallBrandOption): BallDetectionProfile {
  if (brand === 'molten') {
    return {
      mergeColors: true,
      dilationRadius: 1,
      minPixels: 24,
      minFillRatio: 0.28,
      minCircleCoverage: 0.18,
      maxCircleCoverage: 1.38,
    };
  }

  if (brand === 'wilson') {
    return {
      mergeColors: true,
      dilationRadius: 1,
      minPixels: 28,
      minFillRatio: 0.3,
      minCircleCoverage: 0.2,
      maxCircleCoverage: 1.34,
    };
  }

  return {
    mergeColors: true,
    dilationRadius: 1,
    minPixels: 26,
    minFillRatio: 0.3,
    minCircleCoverage: 0.2,
    maxCircleCoverage: 1.34,
  };
}

function classifyBallPixel(r: number, g: number, b: number, selectedBallColors: BallColorOption[]): BallDetection['color'] | null {
  const { h, s, v } = rgbToHsv(r, g, b);

  const allowOrange = selectedBallColors.includes('orange');
  const allowBrown = selectedBallColors.includes('brown');
  const allowYellow = selectedBallColors.includes('yellow');
  const allowWhite = selectedBallColors.includes('white');
  const allowBlack = selectedBallColors.includes('black');
  const allowGray = selectedBallColors.includes('gray');
  const allowRed = selectedBallColors.includes('red');

  const isOrange = allowOrange && h >= 10 && h <= 42 && s >= 0.45 && v >= 0.25 && r > g && g > b * 0.8;
  if (isOrange) {
    return 'orange';
  }

  const isBrown = allowBrown && h >= 12 && h <= 34 && s >= 0.3 && v >= 0.18 && v <= 0.75 && r > g * 1.05 && g > b * 1.05;
  if (isBrown) {
    return 'orange';
  }

  const isYellow = allowYellow && h >= 40 && h <= 65 && s >= 0.35 && v >= 0.35;
  if (isYellow) {
    return 'orange';
  }

  const isWhite = allowWhite && s <= 0.18 && v >= 0.72;
  if (isWhite) {
    return 'orange';
  }

  const isBlack = allowBlack && v <= 0.18;
  if (isBlack) {
    return 'orange';
  }

  const isGray = allowGray && s <= 0.2 && v > 0.18 && v < 0.72;
  if (isGray) {
    return 'orange';
  }

  const isRed = allowRed && (h <= 12 || h >= 345) && s >= 0.45 && v >= 0.22 && r > g * 1.1 && r > b * 1.1;
  if (isRed) {
    return 'red';
  }

  return null;
}

function detectBall(
  video: HTMLVideoElement,
  processingCanvas: HTMLCanvasElement,
  processingContext: CanvasRenderingContext2D,
  selectedBallBrand: BallBrandOption,
  selectedBallColors: BallColorOption[]
): BallDetection | null {
  const profile = getBallDetectionProfile(selectedBallBrand);
  const width = 192;
  const height = 144;
  processingCanvas.width = width;
  processingCanvas.height = height;
  processingContext.drawImage(video, 0, 0, width, height);

  const { data } = processingContext.getImageData(0, 0, width, height);
  const visited = new Uint8Array(width * height);
  const colorMap = new Uint8Array(width * height);
  const mergedMap = new Uint8Array(width * height);

  for (let index = 0; index < width * height; index += 1) {
    const offset = index * 4;
    const color = classifyBallPixel(data[offset], data[offset + 1], data[offset + 2], selectedBallColors);
    colorMap[index] = color === 'orange' ? 1 : color === 'red' ? 2 : 0;
  }

  if (profile.mergeColors) {
    for (let index = 0; index < colorMap.length; index += 1) {
      if (colorMap[index] === 0) {
        continue;
      }

      const x = index % width;
      const y = Math.floor(index / width);

      for (let offsetY = -profile.dilationRadius; offsetY <= profile.dilationRadius; offsetY += 1) {
        for (let offsetX = -profile.dilationRadius; offsetX <= profile.dilationRadius; offsetX += 1) {
          const nextX = x + offsetX;
          const nextY = y + offsetY;
          if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height) {
            continue;
          }

          mergedMap[nextY * width + nextX] = 1;
        }
      }
    }
  }

  let best: BallDetection | null = null;

  const sourceMap = profile.mergeColors ? mergedMap : colorMap;

  for (let index = 0; index < sourceMap.length; index += 1) {
    if (visited[index] || sourceMap[index] === 0) {
      continue;
    }

    const queue = [index];
    visited[index] = 1;
    const colorValue = colorMap[index];
    let head = 0;
    let mergedCount = 0;
    let count = 0;
    let sumX = 0;
    let sumY = 0;
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    let orangeCount = 0;
    let redCount = 0;

    while (head < queue.length) {
      const current = queue[head];
      head += 1;

      const x = current % width;
      const y = Math.floor(current / width);

      mergedCount += 1;
      sumX += x;
      sumY += y;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);

      const currentColorValue = colorMap[current];
      if (currentColorValue !== 0) {
        count += 1;
        if (currentColorValue === 1) {
          orangeCount += 1;
        } else {
          redCount += 1;
        }
      }

      const neighbors = profile.mergeColors
        ? [
            current - 1,
            current + 1,
            current - width,
            current + width,
            current - width - 1,
            current - width + 1,
            current + width - 1,
            current + width + 1,
          ]
        : [current - 1, current + 1, current - width, current + width];
      for (const neighbor of neighbors) {
        if (neighbor < 0 || neighbor >= sourceMap.length || visited[neighbor]) {
          continue;
        }

        if (profile.mergeColors) {
          if (sourceMap[neighbor] === 0) {
            continue;
          }
        } else if (colorMap[neighbor] !== colorValue) {
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

    if (count < profile.minPixels) {
      continue;
    }

    const blobWidth = maxX - minX + 1;
    const blobHeight = maxY - minY + 1;
    const aspectRatio = blobWidth / blobHeight;
    if (aspectRatio < 0.55 || aspectRatio > 1.45) {
      continue;
    }

    const boundingArea = blobWidth * blobHeight;
    const fillRatio = (profile.mergeColors ? mergedCount : count) / boundingArea;
    if (fillRatio < profile.minFillRatio) {
      continue;
    }

    const radiusPx = Math.max(blobWidth, blobHeight) / 2;
    const estimatedCircleArea = Math.PI * radiusPx * radiusPx;
    const circleCoverage = (profile.mergeColors ? mergedCount : count) / estimatedCircleArea;
    if (circleCoverage < profile.minCircleCoverage || circleCoverage > profile.maxCircleCoverage) {
      continue;
    }

    const candidate: BallDetection = {
      x: sumX / mergedCount / width,
      y: sumY / mergedCount / height,
      radius: Math.max(blobWidth, blobHeight) / Math.max(width, height) / 2,
      pixelCount: count,
      color: redCount > orangeCount ? 'red' : colorValue === 2 ? 'red' : 'orange',
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

function getTorsoLeanAngle(shoulderMid: Landmark | null, hipMid: Landmark | null) {
  if (!shoulderMid || !hipMid) {
    return null;
  }

  const horizontal = Math.abs(shoulderMid.x - hipMid.x);
  const vertical = Math.abs(hipMid.y - shoulderMid.y);
  if (vertical < 0.001) {
    return null;
  }

  return (Math.atan2(horizontal, vertical) * 180) / Math.PI;
}

function classifyDribbleStance(angle: number | null): DribbleAnalysis['stanceState'] {
  if (angle === null) {
    return 'unknown';
  }

  if (angle < 15) {
    return 'too_upright';
  }

  if (angle > 45) {
    return 'too_low';
  }

  return 'ready';
}

function isBallNearFoot(ball: BallDetection | null, kneePoints: Landmark[], anklePoints: Landmark[]) {
  if (!ball) {
    return false;
  }

  const ballPoint: Landmark = { x: ball.x, y: ball.y, visibility: 1 };
  return [...kneePoints, ...anklePoints].some((point) => distanceBetween(point, ballPoint) <= 0.12);
}

function updateDribbleTracker(
  tracker: DribbleTracker,
  ball: BallDetection | null,
  shoulderMid: Landmark | null,
  hipMid: Landmark | null,
  kneePoints: Landmark[],
  anklePoints: Landmark[],
  leftHand: HandDetection | undefined,
  rightHand: HandDetection | undefined
) {
  if (!ball || !shoulderMid || !hipMid) {
    tracker.cycleActive = false;
    tracker.wasNearFoot = false;
    tracker.highestBallY = null;
    tracker.lowestBallY = null;
    tracker.bounceHighState = 'unknown';
    tracker.bounceLowState = 'unknown';
    return tracker;
  }

  const nearFoot = isBallNearFoot(ball, kneePoints, anklePoints);

  if (nearFoot && !tracker.cycleActive) {
    tracker.cycleActive = true;
    tracker.wasNearFoot = true;
    tracker.highestBallY = ball.y;
    tracker.lowestBallY = ball.y;

    const ballPoint: Landmark = { x: ball.x, y: ball.y, visibility: 1 };
    const leftDistance = leftHand ? distanceBetween(leftHand.handCenter, ballPoint) : Number.POSITIVE_INFINITY;
    const rightDistance = rightHand ? distanceBetween(rightHand.handCenter, ballPoint) : Number.POSITIVE_INFINITY;
    tracker.lastHand = leftDistance <= rightDistance ? 'left' : 'right';
  }

  if (tracker.cycleActive) {
    tracker.highestBallY = tracker.highestBallY === null ? ball.y : Math.min(tracker.highestBallY, ball.y);
    tracker.lowestBallY = tracker.lowestBallY === null ? ball.y : Math.max(tracker.lowestBallY, ball.y);

    if (tracker.wasNearFoot && ball.y < hipMid.y - 0.03) {
      tracker.dribbleCount += 1;
      if (tracker.lastHand === 'left') {
        tracker.leftHandDribbleCount += 1;
      } else if (tracker.lastHand === 'right') {
        tracker.rightHandDribbleCount += 1;
      }
      tracker.cycleActive = false;
      tracker.wasNearFoot = false;
      tracker.bounceHighState =
        tracker.highestBallY !== null && tracker.highestBallY < shoulderMid.y ? 'too_high' : 'balanced';
      tracker.bounceLowState =
        tracker.lowestBallY !== null && tracker.lowestBallY < hipMid.y ? 'too_low' : 'balanced';
      tracker.lastHand = null;
    }
  }

  return tracker;
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

function classifyBodyFacing(landmarks: Landmark[]) {
  const leftShoulder = landmarks[INDEX.leftShoulder];
  const rightShoulder = landmarks[INDEX.rightShoulder];
  const nose = landmarks[INDEX.nose];

  if (!visible(leftShoulder) || !visible(rightShoulder) || !visible(nose)) {
    return '판단 중';
  }

  const shoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x);
  const shoulderMidX = (leftShoulder.x + rightShoulder.x) / 2;
  const noseOffset = Math.abs(nose.x - shoulderMidX);

  if (shoulderWidth < 0.08 || noseOffset > 0.055) {
    return '옆';
  }

  if (shoulderWidth > 0.12 && noseOffset <= 0.055) {
    return '앞';
  }

  return '판단 중';
}

function normalizeBodyFacing(value: string): DribbleAnalysis['bodyFacing'] {
  if (value === '앞') {
    return 'front';
  }

  if (value === '옆') {
    return 'side';
  }

  return 'unknown';
}

function classifyFrontStanceAngle(angle: number | null): DribbleAnalysis['stanceState'] {
  if (angle === null) {
    return 'unknown';
  }

  if (angle < 40) {
    return 'too_upright';
  }

  if (angle > 60) {
    return 'too_low';
  }

  return 'ready';
}

function getFrontStanceAngle(leftKnee?: Landmark, hipMid?: Landmark | null, rightKnee?: Landmark) {
  return angleAt(leftKnee, hipMid ?? undefined, rightKnee);
}

function classifyFrontBallLane(
  ball: BallDetection | null,
  leftLegX: number | null,
  rightLegX: number | null
): DribbleAnalysis['frontBallLaneState'] {
  if (!ball || leftLegX === null || rightLegX === null) {
    return 'unknown';
  }

  const minX = Math.min(leftLegX, rightLegX);
  const maxX = Math.max(leftLegX, rightLegX);
  return ball.x >= minX && ball.x <= maxX ? 'between_legs' : 'outside_legs';
}

function classifyFootSpacing(
  leftAnkle?: Landmark,
  rightAnkle?: Landmark,
  leftShoulder?: Landmark,
  rightShoulder?: Landmark
): DribbleAnalysis['footSpacingState'] {
  if (!visible(leftAnkle) || !visible(rightAnkle) || !visible(leftShoulder) || !visible(rightShoulder)) {
    return 'unknown';
  }

  const footWidth = Math.abs((leftAnkle as Landmark).x - (rightAnkle as Landmark).x);
  const shoulderWidth = Math.abs((leftShoulder as Landmark).x - (rightShoulder as Landmark).x);

  if (footWidth < shoulderWidth) {
    return 'narrow';
  }

  if (footWidth >= shoulderWidth * 2) {
    return 'wide';
  }

  return 'balanced';
}

function classifyHandBalance(leftCount: number, rightCount: number): DribbleAnalysis['handBalanceState'] {
  if (leftCount === 0 && rightCount === 0) {
    return 'unknown';
  }

  return leftCount === rightCount ? 'balanced' : 'unbalanced';
}

function buildDribbleAnalysis(landmarks: Landmark[], ball: BallDetection | null, tracker: DribbleTracker): DribbleAnalysis {
  const leftShoulder = landmarks[INDEX.leftShoulder];
  const rightShoulder = landmarks[INDEX.rightShoulder];
  const leftHip = landmarks[INDEX.leftHip];
  const rightHip = landmarks[INDEX.rightHip];
  const leftKnee = landmarks[INDEX.leftKnee];
  const rightKnee = landmarks[INDEX.rightKnee];
  const leftAnkle = landmarks[INDEX.leftAnkle];
  const rightAnkle = landmarks[INDEX.rightAnkle];
  const nose = landmarks[INDEX.nose];
  const hands = getPoseHandDetections(landmarks);
  const leftHand = hands.find((hand) => hand.handedness === 'left');
  const rightHand = hands.find((hand) => hand.handedness === 'right');

  const shoulderMid = visible(leftShoulder) && visible(rightShoulder) ? midpoint(leftShoulder, rightShoulder) : null;
  const hipMid = visible(leftHip) && visible(rightHip) ? midpoint(leftHip, rightHip) : null;
  const neck = shoulderMid;
  const bodyFacing =
    visible(leftShoulder) && visible(rightShoulder) && visible(nose)
      ? Math.abs(leftShoulder.x - rightShoulder.x) < 0.08 || Math.abs(nose.x - (leftShoulder.x + rightShoulder.x) / 2) > 0.055
        ? 'side'
        : Math.abs(leftShoulder.x - rightShoulder.x) > 0.12
          ? 'front'
          : 'unknown'
      : 'unknown';
  const torsoLeanAngle = getTorsoLeanAngle(shoulderMid, hipMid);
  const frontStanceAngle = getFrontStanceAngle(leftKnee, hipMid, rightKnee);
  const stanceState = bodyFacing === 'front' ? classifyFrontStanceAngle(frontStanceAngle) : classifyDribbleStance(torsoLeanAngle);
  const kneePoints = [leftKnee, rightKnee].filter(visible);
  const anklePoints = [leftAnkle, rightAnkle].filter(visible);
  const nextTracker = updateDribbleTracker(tracker, ball, shoulderMid, hipMid, kneePoints, anklePoints, leftHand, rightHand);
  const dribbleStarted = nextTracker.dribbleCount > 0 || nextTracker.cycleActive;
  const eyeFocus = classifyEyeFocus(landmarks, neck);
  const frontBallLaneState = classifyFrontBallLane(ball, visible(leftAnkle) ? leftAnkle.x : null, visible(rightAnkle) ? rightAnkle.x : null);
  const footSpacingState = classifyFootSpacing(leftAnkle, rightAnkle, leftShoulder, rightShoulder);
  const handBalanceState = classifyHandBalance(nextTracker.leftHandDribbleCount, nextTracker.rightHandDribbleCount);

  return {
    dribbleStarted,
    bodyFacing,
    eyeFocus,
    dribbleHeight:
      nextTracker.bounceHighState === 'too_high'
        ? 'high'
        : nextTracker.bounceLowState === 'too_low'
          ? 'low'
          : nextTracker.dribbleCount > 0
            ? 'balanced'
            : 'unknown',
    torsoPosture:
      stanceState === 'too_upright'
        ? 'high'
        : stanceState === 'too_low'
          ? 'low'
          : stanceState === 'ready'
            ? 'balanced'
            : 'unknown',
    torsoLeanAngle,
    stanceState,
    frontStanceAngle,
    bounceHighState: nextTracker.bounceHighState,
    bounceLowState: nextTracker.bounceLowState,
    dribbleCount: nextTracker.dribbleCount,
    leftHandDribbleCount: nextTracker.leftHandDribbleCount,
    rightHandDribbleCount: nextTracker.rightHandDribbleCount,
    handBalanceState,
    frontBallLaneState,
    footSpacingState,
    highestBounceY: nextTracker.highestBallY,
    lowestBounceY: nextTracker.lowestBallY,
    summary: [
      `드리블:${dribbleStarted ? '시작' : '대기'}`,
      `시선:${classifyEyeFocus(landmarks, neck)}`,
      `높이:${dribbleStarted ? classifyDribbleHeight(landmarks, neck, hipMid) : 'unknown'}`,
      `상체:${classifyTorsoPosture(shoulderMid, hipMid)}`,
      `공:${ball ? ball.color : 'none'}`,
    ].join(' | '),
  };
}

function buildShootAnalysis(
  landmarks: Landmark[],
  releaseVelocity: number | null,
  ball: BallDetection | null,
  tracker: ShootTracker,
  previousHeadY: number | null
): ShootAnalysis {
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
  const head = landmarks[INDEX.nose];

  const leftArmAngle = angleAt(leftShoulder, leftElbow, leftWrist);
  const rightArmAngle = angleAt(rightShoulder, rightElbow, rightWrist);
  const shootingSide = getShootingSide(landmarks);
  const armAngle = shootingSide === 'left' ? leftArmAngle : shootingSide === 'right' ? rightArmAngle : null;
  const shootingShoulder = shootingSide === 'left' ? leftShoulder : shootingSide === 'right' ? rightShoulder : undefined;
  const shootingWrist = shootingSide === 'left' ? leftWrist : shootingSide === 'right' ? rightWrist : undefined;

  let armAngleState: ShootAnalysis['armAngleState'] = 'unknown';
  if (armAngle !== null) {
    armAngleState = armAngle < 90 ? 'narrow' : armAngle > 110 ? 'wide' : 'balanced';
  }

  const legAngles = [angleAt(leftHip, leftKnee, leftAnkle), angleAt(rightHip, rightKnee, rightAnkle)].filter(
    (value): value is number => value !== null
  );
  const legAngle = legAngles.length > 0 ? legAngles.reduce((sum, value) => sum + value, 0) / legAngles.length : null;

  if (legAngle !== null) {
    tracker.lowestLegAngle = tracker.lowestLegAngle === null ? legAngle : Math.min(tracker.lowestLegAngle, legAngle);
  }

  if (visible(head)) {
    tracker.initialHeadY = tracker.initialHeadY ?? head.y;
    tracker.headPeakY = tracker.headPeakY === null ? head.y : Math.min(tracker.headPeakY, head.y);
  }

  let legAngleState: ShootAnalysis['legAngleState'] = 'unknown';
  if (tracker.lowestLegAngle !== null) {
    legAngleState = tracker.lowestLegAngle < 100 ? 'low' : tracker.lowestLegAngle > 130 ? 'high' : 'balanced';
  }

  const releasePose =
    armAngle !== null &&
    armAngle > 120 &&
    visible(shootingShoulder) &&
    visible(shootingWrist) &&
    Boolean(shootingWrist && shootingShoulder && shootingWrist.y < shootingShoulder.y);

  if (!tracker.releaseDetected && releasePose && visible(head)) {
    tracker.releaseDetected = true;
    const headDelta = previousHeadY !== null ? head.y - previousHeadY : 0;
    const jumpGain = tracker.initialHeadY !== null ? tracker.initialHeadY - head.y : 0;

    if (jumpGain < 0.015 || headDelta < -0.003) {
      tracker.releaseTiming = 'early';
    } else if (headDelta > 0.003) {
      tracker.releaseTiming = 'late';
    } else {
      tracker.releaseTiming = 'balanced';
    }
  }

  const releaseTiming = tracker.releaseTiming;

  return {
    armAngle,
    legAngle,
    releaseVelocity,
    lowestLegAngle: tracker.lowestLegAngle,
    headPeakY: tracker.headPeakY,
    releaseDetected: tracker.releaseDetected,
    armAngleState,
    releaseTiming: tracker.releaseTiming,
    legAngleState,
    summary: [
      `팔:${armAngleState}`,
      `타이밍:${releaseTiming}`,
      `하체:${legAngleState}`,
      `공:${ball ? ball.color : 'none'}`,
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
    if (dribbleAnalysis.bodyFacing === 'front') {
      if (dribbleAnalysis.frontBallLaneState === 'between_legs') {
        problemJoints.add('leftKnee');
        problemJoints.add('rightKnee');
        problemJoints.add('leftAnkle');
        problemJoints.add('rightAnkle');
      }

      if (dribbleAnalysis.handBalanceState === 'unbalanced') {
        problemJoints.add('leftWrist');
        problemJoints.add('rightWrist');
      }

      if (dribbleAnalysis.footSpacingState === 'narrow' || dribbleAnalysis.footSpacingState === 'wide') {
        problemJoints.add('leftAnkle');
        problemJoints.add('rightAnkle');
        problemJoints.add('leftShoulder');
        problemJoints.add('rightShoulder');
      }

      if (dribbleAnalysis.stanceState !== 'ready' && dribbleAnalysis.stanceState !== 'unknown') {
        problemJoints.add('leftKnee');
        problemJoints.add('rightKnee');
        problemJoints.add('leftHip');
        problemJoints.add('rightHip');
      }
    } else if (dribbleAnalysis.eyeFocus === 'ball') {
      problemJoints.add('head');
      problemJoints.add('neck');
    }

    if (
      dribbleAnalysis.bodyFacing !== 'front' &&
      dribbleAnalysis.dribbleStarted &&
      (dribbleAnalysis.bounceHighState === 'too_high' || dribbleAnalysis.bounceLowState === 'too_low')
    ) {
      problemJoints.add('leftWrist');
      problemJoints.add('rightWrist');
    }

    if (
      dribbleAnalysis.bodyFacing !== 'front' &&
      dribbleAnalysis.stanceState !== 'ready' &&
      dribbleAnalysis.stanceState !== 'unknown'
    ) {
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

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[data-codex-src="${src}"]`) as HTMLScriptElement | null;
    if (existing?.dataset.loaded === 'true') {
      resolve();
      return;
    }

    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.dataset.codexSrc = src;
    script.onload = () => {
      script.dataset.loaded = 'true';
      resolve();
    };
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

export function LessonCamera({
  lessonMode,
  selectedBallBrand,
  selectedBallColors,
  isLessonActive,
  isCameraReady,
  countdownValue,
  onPoseMessage,
}: LessonCameraProps) {
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
    let rafId = 0;
    let stream: MediaStream | null = null;
    let pose: ClassicPose | null = null;
    let recorder: MediaRecorder | null = null;
    let recorderChunks: Blob[] = [];
    let recorderStopping = false;
    let inFlight = false;
    let lastPointSummary = '';
    let lastDribbleSummary = '';
    let lastShootSummary = '';
    let lastStatusAt = 0;
    let previousHipY: number | null = null;
    let previousHeadY: number | null = null;
    let dribbleTracker = createDribbleTracker();
    let shootTracker = createShootTracker();

    const emit = (payload: PosePayload) => {
      onPoseMessageRef.current({
        nativeEvent: { data: JSON.stringify(payload) },
      } as WebViewMessageEvent);
    };

    const finalizeRecording = () => {
      if (recorderChunks.length === 0) {
        emit({ type: 'recording_error', message: '저장할 영상 데이터가 없습니다.' });
        return;
      }

      const blob = new Blob(recorderChunks, { type: recorder?.mimeType || 'video/webm' });
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = typeof reader.result === 'string' ? reader.result : '';
        if (!result) {
          emit({ type: 'recording_error', message: '영상 인코딩에 실패했습니다.' });
          return;
        }
        emit({ type: 'recording_ready', videoUri: result });
      };
      reader.onerror = () => emit({ type: 'recording_error', message: '영상 파일을 읽는 중 오류가 발생했습니다.' });
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
      display: 'none',
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
    hud.textContent = 'MediaPipe Pose를 준비하는 중입니다.';
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

    const facingBadge = document.createElement('div');
    facingBadge.textContent = '방향: 판단 중';
    Object.assign(facingBadge.style, {
      position: 'absolute',
      top: '12px',
      right: '12px',
      zIndex: '6',
      color: '#fff6ed',
      background: 'rgba(0, 0, 0, 0.52)',
      borderRadius: '999px',
      padding: '8px 12px',
      fontSize: '12px',
      fontWeight: '700',
      letterSpacing: '0.2px',
      pointerEvents: 'none',
      border: '1px solid rgba(255,255,255,0.14)',
    } satisfies Partial<CSSStyleDeclaration>);

    wrap.appendChild(video);
    wrap.appendChild(canvas);
    wrap.appendChild(hud);
    wrap.appendChild(facingBadge);
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
    };

    const renderPose = (landmarks: Landmark[] | null) => {
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.save();
      context.translate(canvas.width, 0);
      context.scale(-1, 1);
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      context.restore();

      const ball = detectBall(video, processingCanvas, processingContext, selectedBallBrand, selectedBallColors);
      if (!landmarks) {
        facingBadge.textContent = '방향: 판단 중';
        if (ball) {
          drawBall(ball);
        }
        const now = Date.now();
        if (now - lastStatusAt > 1200) {
          lastStatusAt = now;
          emit({ type: 'status', message: ball ? '공은 보이지만 자세를 찾는 중입니다.' : '자세와 공을 찾는 중입니다.' });
        }
        setHud(ball ? `공 인식 중: ${ball.color}` : '화면 안에 몸 전체와 공이 보이도록 맞춰 주세요.');
        return;
      }

      const leftHand = getPoseHandDetections(landmarks).find((hand) => hand.handedness === 'left');
      const rightHand = getPoseHandDetections(landmarks).find((hand) => hand.handedness === 'right');
      const bodyFacing = classifyBodyFacing(landmarks);
      facingBadge.textContent = `방향: ${bodyFacing}`;
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

      const releaseVelocity = hipMid && previousHipY !== null ? hipMid.y - previousHipY : null;
      if (hipMid) {
        previousHipY = hipMid.y;
      }
      if (visible(head)) {
        previousHeadY = previousHeadY === null ? head.y : previousHeadY;
      }

      const dribbleAnalysis = buildDribbleAnalysis(landmarks, ball, dribbleTracker);
      const shootAnalysis = buildShootAnalysis(landmarks, releaseVelocity, ball, shootTracker, previousHeadY);
      if (visible(head)) {
        previousHeadY = head.y;
      }
      const problemJointKeys = getProblemJointKeys(lessonMode, landmarks, dribbleAnalysis, shootAnalysis);
      const highlightColor = '#ff4d5a';
      const pickColor = (jointKey: JointKey, baseColor: string) => (problemJointKeys.has(jointKey) ? highlightColor : baseColor);
      const pickSegmentColor = (a: SegmentJointKey, b: SegmentJointKey, baseColor: string) =>
        shouldHighlightSegment(problemJointKeys, a, b) ? highlightColor : baseColor;

      const byKey: Record<SegmentJointKey, Landmark | undefined> = {
        leftShoulder,
        rightShoulder,
        leftElbow,
        rightElbow,
        leftWrist,
        rightWrist,
        leftHip,
        rightHip,
        leftKnee,
        rightKnee,
        leftAnkle,
        rightAnkle,
      };

      for (const [from, to, color] of BODY_SEGMENTS) {
        drawSegment(byKey[from], byKey[to], pickSegmentColor(from, to, color));
      }

      if (leftHand) {
        drawSegment(leftHand.wrist, leftHand.handCenter, pickColor('leftWrist', '#ff8fab'));
      }
      if (rightHand) {
        drawSegment(rightHand.wrist, rightHand.handCenter, pickColor('rightWrist', '#ff8fab'));
      }

      if (visible(head)) drawPoint(head, LABELS.head, pickColor('head', '#ff6b6b'));
      if (neck && visible(neck)) drawPoint(neck, LABELS.neck, pickColor('neck', '#f7b267'));
      if (visible(leftShoulder)) drawPoint(leftShoulder, `왼쪽 ${LABELS.shoulder}`, pickColor('leftShoulder', '#ffd166'));
      if (visible(rightShoulder)) drawPoint(rightShoulder, `오른쪽 ${LABELS.shoulder}`, pickColor('rightShoulder', '#ffd166'));
      if (visible(leftElbow)) drawPoint(leftElbow, `왼쪽 ${LABELS.elbow}`, pickColor('leftElbow', '#ffb703'));
      if (visible(rightElbow)) drawPoint(rightElbow, `오른쪽 ${LABELS.elbow}`, pickColor('rightElbow', '#ffb703'));
      if (visible(leftWrist)) drawPoint(leftWrist, `왼쪽 ${LABELS.wrist}`, pickColor('leftWrist', '#fb8500'));
      if (visible(rightWrist)) drawPoint(rightWrist, `오른쪽 ${LABELS.wrist}`, pickColor('rightWrist', '#fb8500'));
      if (leftHand) drawPoint(leftHand.handCenter, `왼쪽 ${LABELS.hand}`, '#ff8fab');
      if (rightHand) drawPoint(rightHand.handCenter, `오른쪽 ${LABELS.hand}`, '#ff8fab');
      if (visible(leftHip)) drawPoint(leftHip, `왼쪽 ${LABELS.hip}`, pickColor('leftHip', '#06d6a0'));
      if (visible(rightHip)) drawPoint(rightHip, `오른쪽 ${LABELS.hip}`, pickColor('rightHip', '#06d6a0'));
      if (visible(leftKnee)) drawPoint(leftKnee, `왼쪽 ${LABELS.knee}`, pickColor('leftKnee', '#118ab2'));
      if (visible(rightKnee)) drawPoint(rightKnee, `오른쪽 ${LABELS.knee}`, pickColor('rightKnee', '#118ab2'));
      if (visible(leftAnkle)) drawPoint(leftAnkle, `왼쪽 ${LABELS.foot}`, pickColor('leftAnkle', '#4cc9f0'));
      if (visible(rightAnkle)) drawPoint(rightAnkle, `오른쪽 ${LABELS.foot}`, pickColor('rightAnkle', '#4cc9f0'));
      if (ball) drawBall(ball);

      const detected: string[] = [];
      if (visible(head)) detected.push(LABELS.head);
      if (neck && visible(neck)) detected.push(LABELS.neck);
      if (visible(leftShoulder) || visible(rightShoulder)) detected.push(LABELS.shoulder);
      if (visible(leftElbow) || visible(rightElbow)) detected.push(LABELS.elbow);
      if (visible(leftWrist) || visible(rightWrist)) detected.push(LABELS.wrist);
      if (leftHand || rightHand) detected.push(LABELS.hand);
      if (visible(leftHip) || visible(rightHip)) detected.push(LABELS.hip);
      if (visible(leftKnee) || visible(rightKnee)) detected.push(LABELS.knee);
      if (visible(leftAnkle) || visible(rightAnkle)) detected.push(LABELS.foot);
      if (ball) detected.push(ball.color === 'orange' ? '주황 공' : '빨간 공');

      const pointSummary = detected.join(', ');
      const issueSummary =
        problemJointKeys.size > 0 ? '문제가 의심되는 관절을 빨간색으로 표시 중입니다.' : '현재는 큰 자세 문제 없이 관절을 인식 중입니다.';
      setHud(pointSummary ? `인식 중: ${pointSummary}\n${issueSummary}` : '관절과 공을 찾는 중입니다.');

      const now = Date.now();
      if (pointSummary && (pointSummary !== lastPointSummary || now - lastStatusAt > 1200)) {
        lastPointSummary = pointSummary;
        lastStatusAt = now;
        emit({ type: 'points', summary: pointSummary });
      }

      if (dribbleAnalysis.summary !== lastDribbleSummary || now - lastStatusAt > 1200) {
        lastDribbleSummary = dribbleAnalysis.summary;
        emit({ type: 'dribble_analysis', analysis: dribbleAnalysis });
      }

      if (shootAnalysis.summary !== lastShootSummary || now - lastStatusAt > 1200) {
        lastShootSummary = shootAnalysis.summary;
        emit({ type: 'shoot_analysis', analysis: shootAnalysis });
      }
    };

    const loop = async () => {
      if (cancelled) {
        return;
      }

      if (pose && video.readyState >= 2 && !inFlight) {
        inFlight = true;
        try {
          await pose.send({ image: video });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'MediaPipe Pose 처리에 실패했습니다.';
          emit({ type: 'error', message });
          setHud(message);
        } finally {
          inFlight = false;
        }
      }

      rafId = window.requestAnimationFrame(() => {
        void loop();
      });
    };

    const start = async () => {
      try {
        if (!window.isSecureContext) {
          throw new Error('브라우저 보안 컨텍스트가 아니라 카메라를 사용할 수 없습니다. localhost 또는 https에서 실행해 주세요.');
        }

        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('이 브라우저에서는 getUserMedia를 사용할 수 없습니다.');
        }

        emit({ type: 'status', message: 'classic MediaPipe Pose를 준비하는 중입니다.' });
        setHud('classic MediaPipe Pose를 준비하는 중입니다.');

        await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js');
        const PoseCtor = window.Pose;
        if (!PoseCtor) {
          throw new Error('MediaPipe Pose 스크립트를 불러오지 못했습니다.');
        }

        pose = new PoseCtor({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
        });
        pose.setOptions({
          modelComplexity: 0,
          smoothLandmarks: true,
          enableSegmentation: false,
          minDetectionConfidence: 0.55,
          minTrackingConfidence: 0.55,
        });
        pose.onResults((results) => {
          renderPose(results.poseLandmarks ?? null);
        });

        emit({ type: 'ready' });

        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: 'user',
            width: { ideal: 960 },
            height: { ideal: 540 },
            frameRate: { ideal: 24, max: 30 },
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
          recorder.onerror = () => emit({ type: 'recording_error', message: '레슨 영상 녹화 중 오류가 발생했습니다.' });
          recorder.start(1000);
        }

        emit({ type: 'stream_started' });
        setHud('카메라 시작 완료. classic MediaPipe Pose로 분석 중입니다.');
        void loop();
      } catch (error) {
        const message = error instanceof Error ? error.message : '웹 카메라를 시작하지 못했습니다.';
        emit({ type: 'error', message });
        setHud(message);
      }
    };

    void start();

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resizeCanvas);
      if (recorder && recorder.state !== 'inactive') {
        recorderStopping = true;
        recorder.stop();
      }
      stream?.getTracks().forEach((track) => track.stop());
      pose?.close?.();
      host.innerHTML = '';
    };
  }, [isLessonActive, lessonMode, selectedBallBrand, selectedBallColors]);

  return (
    <View style={styles.videoWrap}>
      {isLessonActive ? (
        <>
          <div ref={hostRef} style={{ width: '100%', height: '100%', backgroundColor: colors.cameraBg }} />
          <View style={styles.overlay}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{isCameraReady ? 'LIVE' : 'LOADING'}</Text>
            </View>
            {countdownValue !== null ? (
              <View style={styles.countdownWrap}>
                <View style={styles.countdownBubble}>
                  <Text style={styles.countdownNumber}>{countdownValue}</Text>
                  <Text style={styles.countdownLabel}>START</Text>
                </View>
              </View>
            ) : null}
          </View>
        </>
      ) : (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderTitle}>카메라 대기 중</Text>
          <Text style={styles.placeholderText}>레슨 시작을 누르면 classic MediaPipe Pose 분석이 바로 시작됩니다.</Text>
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
  countdownWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countdownBubble: {
    width: 150,
    height: 150,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.48)',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.78)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countdownNumber: {
    color: '#fff6ed',
    fontSize: 64,
    fontWeight: '900',
    lineHeight: 72,
  },
  countdownLabel: {
    color: '#ffd8a8',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 2,
    marginTop: 2,
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
