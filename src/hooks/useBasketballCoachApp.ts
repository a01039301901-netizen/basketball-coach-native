import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Linking from 'expo-linking';
import { Audio } from 'expo-av';
import { useCameraPermissions } from 'expo-camera';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';
import type { WebViewMessageEvent } from 'react-native-webview';
import { SKILLS } from '../constants/content';
import { BALL_BRAND_PRESETS, DEFAULT_BALL_BRAND, DEFAULT_BALL_COLORS } from '../constants/settings';
import { STORAGE_KEYS } from '../constants/storage';
import type {
  AppScreen,
  BallBrandOption,
  BallColorOption,
  DribbleLessonView,
  DribbleAnalysis,
  FeedbackMoment,
  FireworkItem,
  LessonMode,
  LessonRecord,
  LessonReviewClip,
  ShotGraphDatum,
  ShootAnalysis,
  SkillKey,
} from '../types/app';
import { getCalendarCells } from '../utils/calendar';
import { formatDateKey } from '../utils/date';
import { buildLessonHomework, getHomeworkToShow, mergeHomework, normalizeHomework, removeHomework } from '../utils/homework';

const FEEDBACK_UPDATE_INTERVAL_MS = 1500;
const DRIBBLE_STANCE_HOLD_MS = 3000;
const SHOOT_RECOVERY_MS = 3000;

type DribbleLessonPhase = 'stance_setup' | 'countdown' | 'await_dribble' | 'active' | 'cooldown';
type FrontDribbleCriterionNumber = 1 | 2 | 3 | 4;

interface FrontDribbleWeakPoint {
  criterionNumber: FrontDribbleCriterionNumber;
  feedbackText: string;
  count: number;
}

const DEFAULT_DRIBBLE_FEEDBACK =
  '드리블 피드백\n1. 시선, 공 높이, 상체 자세를 분석하는 중입니다.\n2. 몸 전체와 공이 화면 안에 보이도록 맞춰 주세요.\n3. 분석이 안정되면 기준에 맞는 피드백이 바로 나타납니다.';

const DEFAULT_SHOOT_FEEDBACK =
  '슛 피드백\n1. 팔 각도, 슛 타이밍, 하체 각도를 분석하는 중입니다.\n2. 어깨부터 발끝까지 몸 전체가 화면 안에 보이도록 맞춰 주세요.\n3. 분석이 안정되면 기준에 맞는 피드백이 바로 나타납니다.';

function createEmptyDribbleAnalysis(): DribbleAnalysis {
  return {
    dribbleStarted: false,
    bodyFacing: 'unknown',
    eyeFocus: 'unknown',
    dribbleHeight: 'unknown',
    torsoPosture: 'unknown',
    torsoLeanAngle: null,
    stanceState: 'unknown',
    frontStanceAngle: null,
    bounceHighState: 'unknown',
    bounceLowState: 'unknown',
    dribbleCount: 0,
    leftHandDribbleCount: 0,
    rightHandDribbleCount: 0,
    handBalanceState: 'unknown',
    frontBallLaneState: 'unknown',
    footSpacingState: 'unknown',
    highestBounceY: null,
    lowestBounceY: null,
    summary: '',
  };
}

function createFireworks(): FireworkItem[] {
  const emojis = ['🏀', '✨', '🔥', '🎉', '🙌'];

  return Array.from({ length: 10 }, (_, index) => ({
    id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
    emoji: emojis[Math.floor(Math.random() * emojis.length)],
    left: `${12 + Math.random() * 74}%` as `${number}%`,
    top: `${10 + Math.random() * 42}%` as `${number}%`,
  }));
}

function parseStoredJson<T>(value: string | null, fallback: T): T {
  return value ? (JSON.parse(value) as T) : fallback;
}

function parseTimelineTimestamp(value: string) {
  const match = value.match(/^\[(\d{2}):(\d{2})\]\s*(.*)$/);

  if (!match) {
    return null;
  }

  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  const text = match[3]?.trim() ?? '';

  return {
    atMs: (minutes * 60 + seconds) * 1000,
    text,
  };
}

function normalizeFeedbackTimeline(
  timeline: FeedbackMoment[] | string[] | undefined,
  fallbackFeedback: string
): FeedbackMoment[] {
  if (!Array.isArray(timeline) || timeline.length === 0) {
    return fallbackFeedback ? [{ atMs: 0, text: fallbackFeedback }] : [];
  }

  const normalized = timeline
    .map((entry, index) => {
      if (typeof entry === 'string') {
        const parsed = parseTimelineTimestamp(entry);

        if (parsed) {
          return parsed;
        }

        return {
          atMs: index * 1000,
          text: entry.trim(),
        };
      }

      if (!entry || typeof entry.text !== 'string') {
        return null;
      }

      return {
        atMs: typeof entry.atMs === 'number' && Number.isFinite(entry.atMs) ? Math.max(0, entry.atMs) : index * 1000,
        text: entry.text.trim(),
      };
    })
    .filter((entry): entry is FeedbackMoment => Boolean(entry && entry.text));

  if (normalized.length > 0) {
    return normalized;
  }

  return fallbackFeedback ? [{ atMs: 0, text: fallbackFeedback }] : [];
}

function normalizeLessonRecord(record: LessonRecord | (Omit<LessonRecord, 'feedbackTimeline'> & { feedbackTimeline?: FeedbackMoment[] | string[] })) {
  return {
    ...record,
    feedbackTimeline: normalizeFeedbackTimeline(record.feedbackTimeline, record.feedback),
  };
}


function isPositiveFeedback(text: string) {
  const positiveKeywords = ['좋습니다', '좋아요', '안정적', '균형이 좋습니다', '타이밍이 좋습니다', '준비 자세가 좋습니다'];
  return positiveKeywords.some((keyword) => text.includes(keyword));
}

function scoreFeedbackText(text: string) {
  let score = 0;
  const strongKeywords = ['좁습니다', '넓습니다', '불균형', '급하게', '늦게', '더 낮게', '더 높게', '다시 맞춰', '벌려', '모아'];
  const mediumKeywords = ['확인 중', '조금 더', '유지', '안정적', '준비 자세'];

  if (strongKeywords.some((keyword) => text.includes(keyword))) {
    score += 3;
  }

  if (mediumKeywords.some((keyword) => text.includes(keyword))) {
    score += 1;
  }

  if (isPositiveFeedback(text)) {
    score -= 2;
  }

  return score;
}

function buildReviewClipFromTimeline(
  timeline: FeedbackMoment[],
  fallbackFeedback: string,
  videoUri: string
): LessonReviewClip {
  const buckets = new Map<string, { text: string; score: number; count: number; firstAtMs: number }>();

  for (const item of timeline) {
    const text = item.text.trim();
    if (!text) {
      continue;
    }

    const weight = Math.max(0, scoreFeedbackText(text));
    const bucket = buckets.get(text);

    if (bucket) {
      bucket.count += 1;
      bucket.score += Math.max(1, weight);
      continue;
    }

    buckets.set(text, {
      text,
      score: Math.max(1, weight),
      count: 1,
      firstAtMs: item.atMs,
    });
  }

  const candidates = [...buckets.values()]
    .filter((item) => !isPositiveFeedback(item.text))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      if (right.count !== left.count) {
        return right.count - left.count;
      }

      return left.firstAtMs - right.firstAtMs;
    });

  const fallbackEntry = timeline[timeline.length - 1] ?? { atMs: 0, text: fallbackFeedback };
  const selected = candidates[0] ?? {
    text: fallbackEntry.text || fallbackFeedback,
    score: 1,
    count: 1,
    firstAtMs: fallbackEntry.atMs,
  };

  const totalDuration = timeline[timeline.length - 1]?.atMs ?? 0;
  const maxStartAt = Math.max(0, totalDuration - 3000);
  const startAtMs = Math.max(0, Math.min(selected.firstAtMs, maxStartAt));

  return {
    videoUri,
    feedback: selected.text || fallbackFeedback,
    startAtMs,
    durationMs: 3000,
    title: '문제가 많았던 3초',
  };
}

function buildShootReviewFeedback(analysis: ShootAnalysis | null) {
  if (!analysis) {
    return '슛 촬영 분석 결과\n2. 점프 준비 자세를 충분히 분석하지 못했습니다. 전신과 공이 함께 보이도록 다시 촬영해 주세요.\n3. 공이 머리보다 높아지는 발사 시점을 충분히 확인하지 못했습니다. 슛 순간이 화면 안에 잘 보이도록 다시 촬영해 주세요.';
  }

  const legAngleText = analysis.lowestLegAngle !== null ? `${analysis.lowestLegAngle.toFixed(1)}도` : '--';
  const legLine =
    analysis.legAngleState === 'low'
      ? `2. 점프 준비 자세의 엉덩이-무릎-발 각도가 ${legAngleText}로 너무 작았습니다. 무릎을 조금 더 펴서 점프해 주세요.`
      : analysis.legAngleState === 'high'
        ? `2. 점프 준비 자세의 엉덩이-무릎-발 각도가 ${legAngleText}로 너무 컸습니다. 자세를 더 낮춰 점프해 주세요.`
        : analysis.legAngleState === 'balanced'
          ? `2. 점프 준비 자세의 하체 각도는 ${legAngleText}로 안정적이었습니다.`
          : '2. 점프 준비 자세의 하체 각도를 충분히 확인하지 못했습니다. 하체가 잘 보이도록 다시 촬영해 주세요.';

  const timingLine =
    analysis.releaseTiming === 'early'
      ? '3. 공이 머리보다 높아지기 전에 너무 빨리 발사했습니다. 점프를 조금 더 끌고 가서 슛해 주세요.'
      : analysis.releaseTiming === 'late'
        ? '3. 공이 머리보다 높아진 뒤 늦게 발사했습니다. 최고점에 더 가깝게 슛해 주세요.'
        : analysis.releaseTiming === 'balanced'
          ? '3. 공이 머리보다 높아지는 구간에서 발사 타이밍이 안정적이었습니다.'
          : '3. 공이 머리보다 높아지는 발사 시점을 충분히 확인하지 못했습니다. 슛 순간이 잘 보이도록 다시 촬영해 주세요.';

  return `슛 촬영 분석 결과\n${legLine}\n${timingLine}`;
}

function getSideDribbleStanceState(analysis: DribbleAnalysis) {
  if (analysis.torsoLeanAngle === null) {
    return 'unknown';
  }

  if (analysis.torsoLeanAngle < 15) {
    return 'too_upright';
  }

  if (analysis.torsoLeanAngle > 45) {
    return 'too_low';
  }

  return 'ready';
}

function getFrontDribbleStanceState(analysis: DribbleAnalysis) {
  if (analysis.frontStanceAngle === null) {
    return 'unknown';
  }

  if (analysis.frontStanceAngle < 40) {
    return 'too_low';
  }

  if (analysis.frontStanceAngle > 60) {
    return 'too_upright';
  }

  return 'ready';
}

function isShootStanceReady(analysis: ShootAnalysis) {
  return analysis.armAngleState === 'balanced';
}

function isDribbleStanceReady(analysis: DribbleAnalysis, lessonView: DribbleLessonView) {
  return lessonView === 'front'
    ? getFrontDribbleStanceState(analysis) === 'ready'
    : getSideDribbleStanceState(analysis) === 'ready';
}

function buildSideDribbleStanceFeedback(analysis: DribbleAnalysis) {
  const stanceState = getSideDribbleStanceState(analysis);
  const torsoLine =
    stanceState === 'ready'
      ? `상체 기울기 ${analysis.torsoLeanAngle ? analysis.torsoLeanAngle.toFixed(1) : '--'}도로 준비 자세가 좋습니다.`
      : stanceState === 'too_upright'
        ? `상체 기울기가 ${analysis.torsoLeanAngle ? analysis.torsoLeanAngle.toFixed(1) : '--'}도예요. 15~45도가 되도록 조금 더 숙여 주세요.`
        : stanceState === 'too_low'
          ? `상체 기울기가 ${analysis.torsoLeanAngle ? analysis.torsoLeanAngle.toFixed(1) : '--'}도예요. 너무 많이 숙였으니 조금 세워 주세요.`
          : '어깨와 엉덩이가 잘 보이도록 서서 상체 기울기를 다시 확인해 주세요.';

  return `옆모습 드리블 준비 자세\n1. 엉덩이에서 어깨까지의 상체 기울기를 15~45도로 맞춰 주세요.\n2. 이 자세를 3초 동안 유지하면 드리블 레슨을 시작합니다.\n3. ${torsoLine}`;
}

function buildFrontDribbleStanceFeedback(analysis: DribbleAnalysis) {
  const stanceState = getFrontDribbleStanceState(analysis);
  const stanceLine =
    stanceState === 'ready'
      ? `무릎-엉덩이-무릎 각도 ${analysis.frontStanceAngle ? analysis.frontStanceAngle.toFixed(1) : '--'}도로 준비 자세가 잘 잡혔습니다.`
      : `무릎-엉덩이-무릎 각도가 ${analysis.frontStanceAngle ? analysis.frontStanceAngle.toFixed(1) : '--'}도예요. 40~60도가 되도록 자세를 다시 맞춰 주세요.`;

  return `앞모습 드리블 준비 자세\n1. 자세를 낮춰 왼쪽 무릎, 엉덩이, 오른쪽 무릎 사이 각도를 40~60도로 맞춰 주세요.\n2. 이 자세를 3초 동안 유지하면 드리블 레슨을 시작합니다.\n3. ${stanceLine}`;
}

function buildDribbleStanceFeedback(analysis: DribbleAnalysis, lessonView: DribbleLessonView) {
  return lessonView === 'front'
    ? buildFrontDribbleStanceFeedback(analysis)
    : buildSideDribbleStanceFeedback(analysis);
}

function buildFrontDribbleFeedback(analysis: DribbleAnalysis) {
  const stanceState = getFrontDribbleStanceState(analysis);
  const stanceLine =
    stanceState === 'ready'
      ? `무릎-엉덩이-무릎 각도 ${analysis.frontStanceAngle ? analysis.frontStanceAngle.toFixed(1) : '--'}도로 자세가 안정적입니다.`
      : `무릎-엉덩이-무릎 각도가 ${analysis.frontStanceAngle ? analysis.frontStanceAngle.toFixed(1) : '--'}도예요. 40~60도가 되도록 자세를 다시 맞춰 주세요.`;

  const laneLine =
    analysis.frontBallLaneState === 'between_legs'
      ? '공이 다리 사이에 들어가 있습니다. 공을 다리 사이에서 드리블하지 말고 몸 옆에서 드리블해 주세요.'
      : analysis.frontBallLaneState === 'outside_legs'
        ? '공 위치는 좋습니다. 계속 다리 바깥쪽에서 드리블해 주세요.'
        : '공 위치를 확인하는 중입니다. 공과 하체가 함께 잘 보이도록 맞춰 주세요.';

  const handLine =
    analysis.handBalanceState === 'unbalanced'
      ? `왼손 ${analysis.leftHandDribbleCount}회, 오른손 ${analysis.rightHandDribbleCount}회예요. 양손 드리블 횟수 균형을 맞춰 주세요.`
      : analysis.handBalanceState === 'balanced'
        ? `왼손 ${analysis.leftHandDribbleCount}회, 오른손 ${analysis.rightHandDribbleCount}회로 균형이 좋습니다.`
        : '양손 드리블 횟수를 확인하는 중입니다.';

  const footLine =
    analysis.footSpacingState === 'narrow'
      ? '발 간격이 어깨보다 좁습니다. 조금 더 벌려 주세요.'
      : analysis.footSpacingState === 'wide'
        ? '발 간격이 너무 넓습니다. 조금만 좁혀 주세요.'
        : analysis.footSpacingState === 'balanced'
          ? '발 간격은 안정적입니다.'
          : '발 간격을 확인하는 중입니다.';

  return `앞모습 드리블 피드백\n1. ${stanceLine}\n2. ${laneLine}\n3. ${handLine} ${footLine}`;
}

function buildSideDribbleFeedback(analysis: DribbleAnalysis) {
  const stanceState = getSideDribbleStanceState(analysis);
  const stanceLine =
    stanceState === 'too_upright'
      ? `상체 기울기가 ${analysis.torsoLeanAngle ? analysis.torsoLeanAngle.toFixed(1) : '--'}도예요. 조금 더 숙여 주세요.`
      : stanceState === 'too_low'
        ? `상체 기울기가 ${analysis.torsoLeanAngle ? analysis.torsoLeanAngle.toFixed(1) : '--'}도예요. 조금 세워서 균형을 맞춰 주세요.`
        : stanceState === 'ready'
          ? `상체 기울기 ${analysis.torsoLeanAngle ? analysis.torsoLeanAngle.toFixed(1) : '--'}도로 자세가 안정적입니다.`
          : '어깨와 엉덩이가 잘 보이도록 서서 상체 기울기를 다시 확인해 주세요.';

  const eyeLine =
    analysis.eyeFocus === 'ball'
      ? '시선이 공으로 내려가 있습니다. 공이 아니라 앞을 보고 드리블해 주세요.'
      : analysis.eyeFocus === 'forward'
        ? '시선 처리는 좋습니다. 계속 앞을 보고 드리블해 주세요.'
        : '시선을 확인하는 중입니다. 얼굴과 상체가 함께 잘 보이도록 맞춰 주세요.';

  const bounceLine =
    !analysis.dribbleStarted
      ? '공이 발 가까이 내려왔다가 다시 올라오면 드리블이 시작된 것으로 보고 높이 분석을 시작합니다.'
      : analysis.bounceHighState === 'too_high'
        ? `공이 어깨보다 높게 튀고 있습니다. 공을 조금 더 낮게 튀겨 주세요. 현재 드리블 ${analysis.dribbleCount}회입니다.`
        : analysis.bounceLowState === 'too_low'
          ? `공이 엉덩이 아래까지 충분히 올라오지 못합니다. 공을 조금 더 높게 튀겨 주세요. 현재 드리블 ${analysis.dribbleCount}회입니다.`
          : `공 높이는 안정적입니다. 현재 드리블 ${analysis.dribbleCount}회입니다.`;

  return `옆모습 드리블 피드백\n1. ${stanceLine}\n2. ${eyeLine}\n3. ${bounceLine}`;
}

function buildDribbleFeedback(analysis: DribbleAnalysis, lessonView: DribbleLessonView) {
  return lessonView === 'front'
    ? buildFrontDribbleFeedback(analysis)
    : buildSideDribbleFeedback(analysis);
}

function buildDribbleCountdownFeedback(lessonView: DribbleLessonView, remainingSeconds: number) {
  if (lessonView === 'front') {
    return `앞모습 드리블 준비 자세를 유지해 주세요.\n1. 무릎-엉덩이-무릎 각도를 40~60도로 유지해 주세요.\n2. ${remainingSeconds}초 뒤 녹화와 드리블 카운트가 시작됩니다.\n3. 공과 하체가 함께 잘 보이도록 서 주세요.`;
  }

  return `옆모습 드리블 준비 자세를 유지해 주세요.\n1. 상체 기울기를 15~45도로 유지해 주세요.\n2. ${remainingSeconds}초 뒤 드리블 레슨을 시작합니다.\n3. 공과 상체가 함께 잘 보이도록 서 주세요.`;
}

function buildShootStanceFeedback(analysis: ShootAnalysis) {
  const armLine =
    analysis.armAngleState === 'balanced'
      ? '슛을 시작하기 좋은 팔 각도입니다. 지금 자세를 유지해 주세요.'
      : analysis.armAngleState === 'narrow'
        ? '준비 자세에서 팔 각도가 좁습니다. 팔을 조금 더 벌려 주세요.'
        : analysis.armAngleState === 'wide'
          ? '준비 자세에서 팔 각도가 넓습니다. 팔을 조금 더 모아 주세요.'
          : '어깨, 팔꿈치, 손목이 잘 보이도록 서서 준비 자세를 다시 맞춰 주세요.';

  return `슛 준비 자세\n1. ${armLine}\n2. 팔 각도가 기준에 맞으면 3초 뒤 슛을 시작합니다.\n3. 준비 자세가 무너지면 다시 자세부터 맞춥니다.`;
}

function createFrontDribbleCriterionCounter(): Record<FrontDribbleCriterionNumber, number> {
  return {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
  };
}

function buildFrontCriterionFeedback(
  criterionNumber: FrontDribbleCriterionNumber,
  analysis: DribbleAnalysis
) {
  switch (criterionNumber) {
    case 1:
      return `무릎-엉덩이-무릎 각도가 ${analysis.frontStanceAngle ? analysis.frontStanceAngle.toFixed(1) : '--'}도예요. 40~60도가 되도록 자세를 다시 맞춰 주세요.`;
    case 2:
      return '공이 다리 사이에 들어가 있습니다. 공을 다리 사이에서 드리블하지 말고 옆에서 드리블해 주세요.';
    case 3:
      return `왼손 ${analysis.leftHandDribbleCount}회, 오른손 ${analysis.rightHandDribbleCount}회로 차이가 있습니다. 양손 드리블 균형을 맞춰 주세요.`;
    case 4:
      if (analysis.footSpacingState === 'narrow') {
        return '발 간격이 어깨보다 좁습니다. 조금 더 벌려 주세요.';
      }

      return '발 간격이 너무 넓습니다. 조금만 좁혀 주세요.';
    default:
      return '자세를 다시 확인해 주세요.';
  }
}

export function useBasketballCoachApp() {
  const [screen, setScreen] = useState<AppScreen>('home');
  const [lessonMode, setLessonMode] = useState<LessonMode>('dribble');
  const [dribbleLessonView, setDribbleLessonView] = useState<DribbleLessonView>('side');
  const [homework, setHomework] = useState<string[]>([]);
  const [attendance, setAttendance] = useState<Record<string, string>>({});
  const [lessonRecords, setLessonRecords] = useState<LessonRecord[]>([]);
  const [shotAttemptRecords, setShotAttemptRecords] = useState<Record<string, number>>({});
  const [shotSuccessRecords, setShotSuccessRecords] = useState<Record<string, number>>({});
  const [selectedDateKey, setSelectedDateKey] = useState('');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedSkillKey, setSelectedSkillKey] = useState<SkillKey | ''>('');
  const [selectedBallBrand, setSelectedBallBrand] = useState<BallBrandOption>(DEFAULT_BALL_BRAND);
  const [selectedBallColors, setSelectedBallColors] = useState<BallColorOption[]>(DEFAULT_BALL_COLORS);
  const [debugText, setDebugText] = useState('카메라와 MediaPipe를 준비하고 있습니다.');
  const [feedbackText, setFeedbackText] = useState(DEFAULT_DRIBBLE_FEEDBACK);
  const [lessonReview, setLessonReview] = useState<LessonReviewClip | null>(null);
  const [currentDribbleCount, setCurrentDribbleCount] = useState(0);
  const [isLessonActive, setIsLessonActive] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [cameraSessionKey, setCameraSessionKey] = useState(0);
  const [countdownValue, setCountdownValue] = useState<number | null>(null);
  const [dribbleResetToken, setDribbleResetToken] = useState(0);
  const [shootResetToken, setShootResetToken] = useState(0);
  const [recordingStartToken, setRecordingStartToken] = useState(0);
  const [recordingStopToken, setRecordingStopToken] = useState(0);
  const [fireworks, setFireworks] = useState<FireworkItem[]>([]);
  const [showFireworks, setShowFireworks] = useState(false);

  const feedbackIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingFeedbackRef = useRef<string | null>(null);
  const latestFeedbackRef = useRef(feedbackText);
  const lessonModeRef = useRef(lessonMode);
  const dribbleLessonViewRef = useRef(dribbleLessonView);
  const lessonStartedAtRef = useRef<number | null>(null);
  const dribbleLessonPhaseRef = useRef<DribbleLessonPhase>('stance_setup');
  const shootLessonStartedRef = useRef(false);
  const shootCooldownUntilRef = useRef<number | null>(null);
  const shootRecordingStartedRef = useRef(false);
  const dribbleTargetCountRef = useRef<number | null>(null);
  const dribbleAutoEndingRef = useRef(false);
  const stanceCountdownStartedAtRef = useRef<number | null>(null);
  const feedbackTimelineRef = useRef<FeedbackMoment[]>([]);
  const pendingStopSaveRef = useRef(false);
  const recordingFallbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shootAutoEndTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingReviewStopRef = useRef(false);
  const pendingShootReviewRef = useRef(false);
  const pendingShootRecordingStopRef = useRef(false);
  const startCueSoundRef = useRef<Audio.Sound | null>(null);
  const webStartCueContextRef = useRef<any>(null);
  const latestDribbleAnalysisRef = useRef<DribbleAnalysis | null>(null);
  const latestShootAnalysisRef = useRef<ShootAnalysis | null>(null);
  const shootAnalysisHistoryRef = useRef<ShootAnalysis[]>([]);
  const frontDribbleCriterionCountsRef = useRef<Record<FrontDribbleCriterionNumber, number>>(createFrontDribbleCriterionCounter());
  const frontDribbleWeakPointRef = useRef<FrontDribbleWeakPoint | null>(null);
  const frontDribbleSummaryShownRef = useRef(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const selectedSkill = selectedSkillKey ? SKILLS[selectedSkillKey] : null;
  const homeworkToShow = useMemo(() => getHomeworkToShow(homework), [homework]);
  const calendarCells = useMemo(() => getCalendarCells(currentDate, attendance), [attendance, currentDate]);
  const selectedDateRecords = useMemo(
    () => lessonRecords.filter((record) => record.dateKey === selectedDateKey).slice().reverse(),
    [lessonRecords, selectedDateKey]
  );
  const selectedDateShotCount = selectedDateKey ? shotSuccessRecords[selectedDateKey] || 0 : 0;
  const shotGraphData = useMemo<ShotGraphDatum[]>(() => {
    const allDateKeys = Array.from(
      new Set([...Object.keys(shotAttemptRecords), ...Object.keys(shotSuccessRecords)])
    ).sort();

    return allDateKeys.map((dateKey) => {
      const attempts = shotAttemptRecords[dateKey] || 0;
      const successes = shotSuccessRecords[dateKey] || 0;
      const successRate = attempts > 0 ? Math.min(100, Math.round((successes / attempts) * 100)) : 0;

      return {
        dateKey,
        attempts,
        successes,
        successRate,
      };
    });
  }, [shotAttemptRecords, shotSuccessRecords]);

  useEffect(() => {
    latestFeedbackRef.current = feedbackText;
  }, [feedbackText]);

  useEffect(() => {
    lessonModeRef.current = lessonMode;
  }, [lessonMode]);

  useEffect(() => {
    dribbleLessonViewRef.current = dribbleLessonView;
  }, [dribbleLessonView]);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        const entries = await AsyncStorage.multiGet([
          STORAGE_KEYS.attendance,
          STORAGE_KEYS.homework,
          STORAGE_KEYS.lessonRecords,
          STORAGE_KEYS.shotSuccess,
          STORAGE_KEYS.ballColors,
          STORAGE_KEYS.ballBrand,
        ]);

        if (!isMounted) {
          return;
        }

        const stored = Object.fromEntries(entries);
        const parsedAttendance = parseStoredJson<Record<string, string>>(stored[STORAGE_KEYS.attendance], {});
        const parsedHomework = normalizeHomework(parseStoredJson<string[]>(stored[STORAGE_KEYS.homework], []));
        const parsedLessonRecords = parseStoredJson<
          Array<LessonRecord | (Omit<LessonRecord, 'feedbackTimeline'> & { feedbackTimeline?: FeedbackMoment[] | string[] })>
        >(stored[STORAGE_KEYS.lessonRecords], []).map((record) => normalizeLessonRecord(record));
        const parsedShotAttempts = parseStoredJson<Record<string, number>>(stored[STORAGE_KEYS.shotAttempts], {});
        const parsedShotSuccess = parseStoredJson<Record<string, number>>(stored[STORAGE_KEYS.shotSuccess], {});
        const parsedBallBrand = parseStoredJson<BallBrandOption>(stored[STORAGE_KEYS.ballBrand], DEFAULT_BALL_BRAND);
        const parsedBallColors = parseStoredJson<BallColorOption[]>(stored[STORAGE_KEYS.ballColors], DEFAULT_BALL_COLORS);

        const derivedShotAttempts = parsedLessonRecords.reduce<Record<string, number>>((accumulator, record) => {
          if (record.mode !== 'shoot') {
            return accumulator;
          }

          accumulator[record.dateKey] = (accumulator[record.dateKey] || 0) + 1;
          return accumulator;
        }, {});

        for (const [dateKey, count] of Object.entries(derivedShotAttempts)) {
          parsedShotAttempts[dateKey] = Math.max(parsedShotAttempts[dateKey] || 0, count);
        }

        const todayKey = formatDateKey(new Date());
        parsedAttendance[todayKey] = 'attended';

        setAttendance(parsedAttendance);
        setHomework(parsedHomework);
        setLessonRecords(parsedLessonRecords);
        setShotAttemptRecords(parsedShotAttempts);
        setShotSuccessRecords(parsedShotSuccess);
        setSelectedBallBrand(parsedBallBrand);
        setSelectedBallColors(
          parsedBallColors.length > 0 ? parsedBallColors : BALL_BRAND_PRESETS[parsedBallBrand] ?? DEFAULT_BALL_COLORS
        );
        setSelectedDateKey(todayKey);

        await AsyncStorage.setItem(STORAGE_KEYS.attendance, JSON.stringify(parsedAttendance));
      } catch {
        Alert.alert('불러오기 실패', '저장한 데이터를 읽는 중 문제가 발생했습니다.');
      }
    }

    void loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    void AsyncStorage.setItem(STORAGE_KEYS.homework, JSON.stringify(homework));
  }, [homework]);

  useEffect(() => {
    void AsyncStorage.setItem(STORAGE_KEYS.attendance, JSON.stringify(attendance));
  }, [attendance]);

  useEffect(() => {
    void AsyncStorage.setItem(STORAGE_KEYS.lessonRecords, JSON.stringify(lessonRecords));
  }, [lessonRecords]);

  useEffect(() => {
    void AsyncStorage.setItem(STORAGE_KEYS.shotAttempts, JSON.stringify(shotAttemptRecords));
  }, [shotAttemptRecords]);

  useEffect(() => {
    void AsyncStorage.setItem(STORAGE_KEYS.shotSuccess, JSON.stringify(shotSuccessRecords));
  }, [shotSuccessRecords]);

  useEffect(() => {
    void AsyncStorage.setItem(STORAGE_KEYS.ballColors, JSON.stringify(selectedBallColors));
  }, [selectedBallColors]);

  useEffect(() => {
    void AsyncStorage.setItem(STORAGE_KEYS.ballBrand, JSON.stringify(selectedBallBrand));
  }, [selectedBallBrand]);

  useEffect(() => {
    return () => {
      if (feedbackIntervalRef.current) {
        clearInterval(feedbackIntervalRef.current);
      }

      if (recordingFallbackTimeoutRef.current) {
        clearTimeout(recordingFallbackTimeoutRef.current);
      }

      if (shootAutoEndTimeoutRef.current) {
        clearTimeout(shootAutoEndTimeoutRef.current);
      }

      void stopStartCue();
      void unloadStartCue();
      void closeWebStartCue();
    };
  }, []);

  useEffect(() => {
    if (!showFireworks) {
      return undefined;
    }

    const timer = setTimeout(() => {
      setShowFireworks(false);
      setFireworks([]);
    }, 1000);

    return () => clearTimeout(timer);
  }, [showFireworks]);

  useEffect(() => {
    const countdownStartedAt = stanceCountdownStartedAtRef.current;

    if (!isLessonActive || !countdownStartedAt) {
      setCountdownValue(null);
      return undefined;
    }

    const updateCountdown = () => {
      const remaining = DRIBBLE_STANCE_HOLD_MS - (Date.now() - countdownStartedAt);
      if (remaining <= 0) {
        setCountdownValue(null);
        return;
      }

      setCountdownValue(Math.max(1, Math.ceil(remaining / 1000)));
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 100);

    return () => clearInterval(timer);
  }, [debugText, isLessonActive]);

  useEffect(() => {
    if (!isLessonActive || isCameraReady || cameraError) {
      return undefined;
    }

    const timer = setTimeout(() => {
      setDebugText('카메라 시작 응답을 기다리는 중입니다.');
      setCameraError('카메라 시작이 지연되고 있습니다. 잠시 후에도 화면이 비어 있으면 진행 상태 문구를 알려 주세요.');
    }, 8000);

    return () => clearTimeout(timer);
  }, [cameraError, isCameraReady, isLessonActive]);

  useEffect(() => {
    if (!isLessonActive) {
      return undefined;
    }

    const timer = setInterval(() => {
      if (dribbleLessonPhaseRef.current !== 'countdown') {
        return;
      }

      const countdownStartedAt = stanceCountdownStartedAtRef.current;
      if (!countdownStartedAt) {
        return;
      }

      if (Date.now() - countdownStartedAt < DRIBBLE_STANCE_HOLD_MS) {
        return;
      }

      if (lessonModeRef.current === 'shoot') {
        startShootLessonFromCountdown();
        return;
      }

      startDribbleLessonFromCountdown(dribbleLessonViewRef.current === 'front');
    }, 80);

    return () => clearInterval(timer);
  }, [isLessonActive, startDribbleLessonFromCountdown, startShootLessonFromCountdown]);

  const appendFeedbackTimeline = useCallback((text: string) => {
    if (!isLessonActive || !text) {
      return;
    }

    const trimmed = text.trim();
    const previous = feedbackTimelineRef.current[feedbackTimelineRef.current.length - 1];
    if (previous?.text === trimmed) {
      return;
    }

    const startedAt = lessonStartedAtRef.current;
    if (startedAt === null) {
      return;
    }

    const atMs = Math.max(0, Date.now() - startedAt);
    feedbackTimelineRef.current.push({
      atMs,
      text: trimmed,
    });
  }, [isLessonActive]);

  const setFeedbackAndRemember = useCallback((nextFeedback: string) => {
    latestFeedbackRef.current = nextFeedback;
    setFeedbackText(nextFeedback);
    appendFeedbackTimeline(nextFeedback);
  }, [appendFeedbackTimeline]);

  const flushPendingFeedback = useCallback(() => {
    const pendingFeedback = pendingFeedbackRef.current?.trim();

    if (!pendingFeedback || pendingFeedback === latestFeedbackRef.current.trim()) {
      pendingFeedbackRef.current = null;
      return;
    }

    setFeedbackAndRemember(pendingFeedback);
    pendingFeedbackRef.current = null;
  }, [setFeedbackAndRemember]);

  const setImmediateLessonFeedback = useCallback((nextFeedback: string) => {
    pendingFeedbackRef.current = null;
    setFeedbackAndRemember(nextFeedback);
  }, [setFeedbackAndRemember]);

  const clearRecordingWait = useCallback(() => {
    pendingStopSaveRef.current = false;
    if (recordingFallbackTimeoutRef.current) {
      clearTimeout(recordingFallbackTimeoutRef.current);
      recordingFallbackTimeoutRef.current = null;
    }
  }, []);

  const clearShootAutoEnd = useCallback(() => {
    if (shootAutoEndTimeoutRef.current) {
      clearTimeout(shootAutoEndTimeoutRef.current);
      shootAutoEndTimeoutRef.current = null;
    }
  }, []);

  const resetShootAnalysisTracking = useCallback(() => {
    pendingShootReviewRef.current = false;
    pendingShootRecordingStopRef.current = false;
    latestShootAnalysisRef.current = null;
    shootAnalysisHistoryRef.current = [];
    shootCooldownUntilRef.current = null;
    shootRecordingStartedRef.current = false;
  }, []);

  const resetFrontDribbleTrackingSummary = useCallback(() => {
    latestDribbleAnalysisRef.current = null;
    frontDribbleCriterionCountsRef.current = createFrontDribbleCriterionCounter();
    frontDribbleWeakPointRef.current = null;
    frontDribbleSummaryShownRef.current = false;
  }, []);

  const updateFrontDribbleWeakPoint = useCallback((analysis: DribbleAnalysis) => {
    if (dribbleLessonViewRef.current !== 'front') {
      return;
    }

    latestDribbleAnalysisRef.current = analysis;

    if (getFrontDribbleStanceState(analysis) !== 'ready' && getFrontDribbleStanceState(analysis) !== 'unknown') {
      frontDribbleCriterionCountsRef.current[1] += 1;
    }

    if (analysis.frontBallLaneState === 'between_legs') {
      frontDribbleCriterionCountsRef.current[2] += 1;
    }

    if (analysis.handBalanceState === 'unbalanced') {
      frontDribbleCriterionCountsRef.current[3] += 1;
    }

    if (analysis.footSpacingState === 'narrow' || analysis.footSpacingState === 'wide') {
      frontDribbleCriterionCountsRef.current[4] += 1;
    }
  }, []);

  const finalizeFrontDribbleWeakPoint = useCallback(() => {
    const analysis = latestDribbleAnalysisRef.current;

    if (!analysis || dribbleLessonViewRef.current !== 'front') {
      frontDribbleWeakPointRef.current = null;
      return null;
    }

    const counts = frontDribbleCriterionCountsRef.current;
    const ranked = (Object.entries(counts) as Array<[string, number]>)
      .map(([criterionNumber, count]) => ({
        criterionNumber: Number(criterionNumber) as FrontDribbleCriterionNumber,
        count,
      }))
      .sort((left, right) => {
        if (right.count !== left.count) {
          return right.count - left.count;
        }

        return left.criterionNumber - right.criterionNumber;
      });

    const strongestIssue = ranked[0];

    if (!strongestIssue || strongestIssue.count <= 0) {
      frontDribbleWeakPointRef.current = null;
      return null;
    }

    const summary = {
      criterionNumber: strongestIssue.criterionNumber,
      feedbackText: buildFrontCriterionFeedback(strongestIssue.criterionNumber, analysis),
      count: strongestIssue.count,
    } satisfies FrontDribbleWeakPoint;

    frontDribbleWeakPointRef.current = summary;
    return summary;
  }, []);

  const ensureWebStartCueContext = useCallback(async () => {
    if (Platform.OS !== 'web') {
      return null;
    }

    const browserWindow = globalThis as typeof globalThis & {
      AudioContext?: new () => any;
      webkitAudioContext?: new () => any;
    };
    const AudioContextCtor = browserWindow.AudioContext ?? browserWindow.webkitAudioContext;

    if (!AudioContextCtor) {
      return null;
    }

    if (!webStartCueContextRef.current) {
      webStartCueContextRef.current = new AudioContextCtor();
    }

    const context = webStartCueContextRef.current;

    if (context.state === 'suspended' && typeof context.resume === 'function') {
      try {
        await context.resume();
      } catch {
        // Ignore resume failures and fall back to the native sound path below.
      }
    }

    return context;
  }, []);

  const closeWebStartCue = useCallback(async () => {
    const context = webStartCueContextRef.current;
    webStartCueContextRef.current = null;

    if (!context || typeof context.close !== 'function') {
      return;
    }

    try {
      await context.close();
    } catch {
      // Ignore close failures during teardown.
    }
  }, []);

  const ensureStartCueSound = useCallback(async () => {
    if (Platform.OS === 'web') {
      return null;
    }

    if (startCueSoundRef.current) {
      return startCueSoundRef.current;
    }

    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
    });

    const { sound } = await Audio.Sound.createAsync(require('../../assets/sounds/whistle-start.wav'));
    startCueSoundRef.current = sound;
    return sound;
  }, []);

  const stopStartCue = useCallback(async () => {
    const sound = startCueSoundRef.current;
    if (!sound) {
      return;
    }

    try {
      await sound.stopAsync();
      await sound.setPositionAsync(0);
    } catch {
      // Ignore transient sound stop failures.
    }
  }, []);

  const unloadStartCue = useCallback(async () => {
    const sound = startCueSoundRef.current;
    startCueSoundRef.current = null;

    if (!sound) {
      return;
    }

    try {
      await sound.unloadAsync();
    } catch {
      // Ignore unload failures during cleanup.
    }
  }, []);

  const playStartCue = useCallback(() => {
    void (async () => {
      try {
        if (Platform.OS === 'web') {
          const context = await ensureWebStartCueContext();

          if (context) {
            const now = context.currentTime;
            const oscillator = context.createOscillator();
            const gain = context.createGain();
            const vibrato = context.createOscillator();
            const vibratoGain = context.createGain();
            const whistleDuration = 0.7;

            oscillator.type = 'square';
            oscillator.frequency.setValueAtTime(2200, now);
            oscillator.frequency.exponentialRampToValueAtTime(1760, now + whistleDuration);

            vibrato.type = 'sine';
            vibrato.frequency.setValueAtTime(18, now);
            vibratoGain.gain.setValueAtTime(80, now);

            gain.gain.setValueAtTime(0.0001, now);
            gain.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
            gain.gain.setValueAtTime(0.18, now + whistleDuration - 0.16);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + whistleDuration);

            vibrato.connect(vibratoGain);
            vibratoGain.connect(oscillator.frequency);
            oscillator.connect(gain);
            gain.connect(context.destination);

            oscillator.start(now);
            vibrato.start(now);
            oscillator.stop(now + whistleDuration);
            vibrato.stop(now + whistleDuration);
            return;
          }
        }

        const sound = await ensureStartCueSound();
        if (sound) {
          await sound.replayAsync();
        }
      } catch {
        // Keep the lesson flow running even if the cue sound fails.
      }
    })();
  }, [ensureStartCueSound, ensureWebStartCueContext]);

  const addLessonHomework = useCallback((mode: LessonMode) => {
    const nextHomework = buildLessonHomework(mode);
    setHomework((current) => mergeHomework(current, nextHomework));
  }, []);

  const deleteHomeworkItem = useCallback((targetHomework: string) => {
    setHomework((current) => removeHomework(current, targetHomework));
  }, []);

  const saveLessonRecord = useCallback((videoUri: string, reviewClip?: LessonReviewClip | null) => {
    const dateKey = formatDateKey(new Date());
    const mode = lessonModeRef.current;
    const nextRecord: LessonRecord = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      dateKey,
      mode,
      feedback: latestFeedbackRef.current,
      feedbackTimeline: [...feedbackTimelineRef.current],
      videoUri,
      createdAt: new Date().toLocaleString(),
      reviewFeedback: reviewClip?.feedback,
      reviewStartAtMs: reviewClip?.startAtMs,
      reviewDurationMs: reviewClip?.durationMs,
    };

    setLessonRecords((current) => [...current, nextRecord]);

    if (mode === 'shoot') {
      setShotAttemptRecords((current) => ({
        ...current,
        [dateKey]: (current[dateKey] || 0) + 1,
      }));
    }

    setSelectedDateKey(dateKey);
  }, []);

  const finalizeLessonSession = useCallback(
    async (shouldSaveRecord: boolean, videoUri: string) => {
      if (feedbackIntervalRef.current) {
        clearInterval(feedbackIntervalRef.current);
        feedbackIntervalRef.current = null;
      }

      clearRecordingWait();
      clearShootAutoEnd();
      pendingReviewStopRef.current = false;
      void stopStartCue();
      void unloadStartCue();

      if (shouldSaveRecord) {
        addLessonHomework(lessonModeRef.current);
        saveLessonRecord(videoUri);
      }

      lessonStartedAtRef.current = null;
      dribbleLessonPhaseRef.current = 'stance_setup';
      shootLessonStartedRef.current = false;
      resetShootAnalysisTracking();
      dribbleTargetCountRef.current = null;
      dribbleAutoEndingRef.current = false;
      stanceCountdownStartedAtRef.current = null;
      feedbackTimelineRef.current = [];
      pendingFeedbackRef.current = null;
      resetFrontDribbleTrackingSummary();
      setCurrentDribbleCount(0);
      setCountdownValue(null);
      setDribbleResetToken(0);
      setRecordingStartToken(0);
      setRecordingStopToken(0);
      setIsLessonActive(false);
      setIsCameraActive(false);
      setIsCameraReady(false);
      setCameraError('');
      setDebugText('카메라와 MediaPipe를 준비하고 있습니다.');
    },
    [addLessonHomework, clearRecordingWait, clearShootAutoEnd, resetFrontDribbleTrackingSummary, resetShootAnalysisTracking, saveLessonRecord]
  );

  async function navigateTo(nextScreen: AppScreen) {
    if (screen === 'lesson' && nextScreen !== 'lesson' && (isLessonActive || isCameraActive)) {
      await endLesson(true);
    }

    setScreen(nextScreen);
    if (nextScreen === 'diary' && !selectedDateKey) {
      setSelectedDateKey(formatDateKey(new Date()));
    }
  }

  function selectSkill(skillKey: SkillKey) {
    setSelectedSkillKey(skillKey);
  }

  function toggleBallColor(color: BallColorOption) {
    setSelectedBallColors((current) => {
      const exists = current.includes(color);
      if (exists) {
        const next = current.filter((item) => item !== color);
        return next.length > 0 ? next : DEFAULT_BALL_COLORS;
      }

      return [...current, color];
    });
  }

  function selectBallBrand(brand: BallBrandOption) {
    setSelectedBallBrand(brand);
    setSelectedBallColors(BALL_BRAND_PRESETS[brand]);
  }

  function changeLessonMode(mode: LessonMode) {
    setLessonMode(mode);
    dribbleLessonPhaseRef.current = 'stance_setup';
    shootLessonStartedRef.current = false;
    resetShootAnalysisTracking();
    dribbleTargetCountRef.current = null;
    dribbleAutoEndingRef.current = false;
    pendingReviewStopRef.current = false;
    clearShootAutoEnd();
    resetFrontDribbleTrackingSummary();
    setCurrentDribbleCount(0);
    stanceCountdownStartedAtRef.current = null;
    setCountdownValue(null);
    setDribbleResetToken(0);
    setShootResetToken(0);
    setRecordingStartToken(0);
    setRecordingStopToken(0);
    setLessonReview(null);
    setImmediateLessonFeedback(
      mode === 'shoot'
        ? buildShootStanceFeedback({
            armAngle: null,
            legAngle: null,
            releaseVelocity: null,
            lowestLegAngle: null,
            headPeakY: null,
            releaseDetected: false,
            armAngleState: 'unknown',
            releaseTiming: 'unknown',
            legAngleState: 'unknown',
            summary: '',
          })
        : buildDribbleStanceFeedback(createEmptyDribbleAnalysis(), dribbleLessonViewRef.current)
    );
    setDebugText(mode === 'shoot' ? '슛 분석 모드를 준비하는 중입니다.' : '드리블 분석 모드를 준비하는 중입니다.');
  }

  function changeDribbleLessonView(view: DribbleLessonView) {
    if (dribbleLessonViewRef.current === view) {
      return;
    }

    setDribbleLessonView(view);
    dribbleLessonViewRef.current = view;
    resetFrontDribbleTrackingSummary();
    dribbleLessonPhaseRef.current = 'stance_setup';
    stanceCountdownStartedAtRef.current = null;
    setCountdownValue(null);
    setCurrentDribbleCount(0);

    if (lessonModeRef.current === 'dribble' && !isLessonActive) {
      setLessonReview(null);
      setImmediateLessonFeedback(buildDribbleStanceFeedback(createEmptyDribbleAnalysis(), view));
      setDebugText(view === 'front' ? '앞모습 드리블 레슨을 준비하는 중입니다.' : '옆모습 드리블 레슨을 준비하는 중입니다.');
    }
  }

  function startFeedbackLoop(mode: LessonMode) {
    if (feedbackIntervalRef.current) {
      clearInterval(feedbackIntervalRef.current);
      feedbackIntervalRef.current = null;
    }

    pendingFeedbackRef.current = null;
    dribbleLessonPhaseRef.current = 'stance_setup';
    shootLessonStartedRef.current = false;
    resetShootAnalysisTracking();
    dribbleTargetCountRef.current = null;
    dribbleAutoEndingRef.current = false;
    pendingReviewStopRef.current = false;
    clearShootAutoEnd();
    resetFrontDribbleTrackingSummary();
    setCurrentDribbleCount(0);
    stanceCountdownStartedAtRef.current = null;
    setCountdownValue(null);
    setDribbleResetToken(0);
    setShootResetToken(0);
    setRecordingStopToken(0);
    setLessonReview(null);
    if (mode === 'dribble') {
      setImmediateLessonFeedback(buildDribbleStanceFeedback(createEmptyDribbleAnalysis(), dribbleLessonViewRef.current));
    } else {
      setImmediateLessonFeedback(buildShootStanceFeedback({
        armAngle: null,
        legAngle: null,
        releaseVelocity: null,
        lowestLegAngle: null,
        headPeakY: null,
        releaseDetected: false,
        armAngleState: 'unknown',
        releaseTiming: 'unknown',
        legAngleState: 'unknown',
        summary: '',
      }));
    }
    feedbackIntervalRef.current = setInterval(() => {
      flushPendingFeedback();
    }, FEEDBACK_UPDATE_INTERVAL_MS);
  }

  async function ensurePermissions() {
    const cameraGranted = cameraPermission?.granted === true || (await requestCameraPermission()).granted;

    if (!cameraGranted) {
      Alert.alert('권한 필요', '레슨 촬영과 자세 분석을 위해 카메라 권한이 필요합니다.');
      return false;
    }

    return true;
  }

  async function beginLesson(dribbleTargetCount?: number) {
    const granted = await ensurePermissions();
    if (!granted) {
      return;
    }

    clearRecordingWait();
    clearShootAutoEnd();
    setCameraSessionKey((current) => current + 1);
    setCameraError('');
    lessonStartedAtRef.current = null;
    dribbleLessonPhaseRef.current = 'stance_setup';
    shootLessonStartedRef.current = false;
    resetShootAnalysisTracking();
    dribbleTargetCountRef.current =
      lessonModeRef.current === 'dribble' && typeof dribbleTargetCount === 'number' && dribbleTargetCount > 0
        ? dribbleTargetCount
        : null;
    dribbleAutoEndingRef.current = false;
    pendingReviewStopRef.current = false;
    stanceCountdownStartedAtRef.current = null;
    feedbackTimelineRef.current = [];
    resetFrontDribbleTrackingSummary();
    setCurrentDribbleCount(0);
    setCountdownValue(null);
    setDribbleResetToken(0);
    setShootResetToken(0);
    setRecordingStartToken(0);
    setRecordingStopToken(0);
    setLessonReview(null);
    setIsLessonActive(true);
    setIsCameraActive(true);
    setIsCameraReady(false);
    setDebugText('MediaPipe 분석 화면을 시작하는 중입니다.');
    void ensureWebStartCueContext();
    void ensureStartCueSound();
    startFeedbackLoop(lessonModeRef.current);
  }

  async function endLesson(forceClose = false) {
    if (!isLessonActive && !isCameraActive) {
      return;
    }

    if (feedbackIntervalRef.current) {
      clearInterval(feedbackIntervalRef.current);
      feedbackIntervalRef.current = null;
    }

    clearShootAutoEnd();
    void stopStartCue();
    void unloadStartCue();
    pendingFeedbackRef.current = null;
    pendingReviewStopRef.current = false;
    setCountdownValue(null);

    if (!isLessonActive) {
      const frontWeakPoint = frontDribbleWeakPointRef.current;

      if (!forceClose && lessonModeRef.current === 'dribble' && frontWeakPoint && !frontDribbleSummaryShownRef.current) {
        frontDribbleSummaryShownRef.current = true;
        setImmediateLessonFeedback(
          `사용자님이 가장 부족했던 자세 부분은 ${frontWeakPoint.criterionNumber}번째 기준이에요, ${frontWeakPoint.feedbackText}`
        );
        setDebugText('레슨 요약을 확인해 주세요. 다시 누르면 카메라를 종료합니다.');
        return;
      }

      clearRecordingWait();
      pendingStopSaveRef.current = false;
      lessonStartedAtRef.current = null;
      dribbleLessonPhaseRef.current = 'stance_setup';
      shootLessonStartedRef.current = false;
      resetShootAnalysisTracking();
      dribbleTargetCountRef.current = null;
      dribbleAutoEndingRef.current = false;
      stanceCountdownStartedAtRef.current = null;
      feedbackTimelineRef.current = [];
      resetFrontDribbleTrackingSummary();
      setCurrentDribbleCount(0);
      setDribbleResetToken(0);
      setShootResetToken(0);
      setRecordingStartToken(0);
      setRecordingStopToken(0);
      setIsCameraActive(false);
      setIsCameraReady(false);
      setCameraError('');
      setDebugText('카메라와 MediaPipe를 준비하고 있습니다.');
      return;
    }

    pendingStopSaveRef.current = true;
    setDebugText('레슨 영상을 저장하는 중입니다.');
    setIsLessonActive(false);
    setIsCameraReady(false);

    recordingFallbackTimeoutRef.current = setTimeout(() => {
      if (!pendingStopSaveRef.current) {
        return;
      }

      void finalizeLessonSession(true, '');
    }, 5000);
  }

  const scheduleShootAutoEnd = useCallback(() => {
    clearShootAutoEnd();
    shootAutoEndTimeoutRef.current = setTimeout(() => {
      if (!isLessonActive || lessonModeRef.current !== 'shoot') {
        return;
      }

      void endLesson();
    }, 5000);
  }, [clearShootAutoEnd, isLessonActive]);


  const finishDribbleRecordingForReview = useCallback(() => {
    if (feedbackIntervalRef.current) {
      clearInterval(feedbackIntervalRef.current);
      feedbackIntervalRef.current = null;
    }

    pendingStopSaveRef.current = false;
    pendingReviewStopRef.current = true;
    clearShootAutoEnd();
    pendingFeedbackRef.current = null;
    setCountdownValue(null);
    setIsLessonActive(false);
    playStartCue();
    setRecordingStopToken(Date.now());
    setDebugText('목표 드리블 횟수에 도달했습니다. 녹화를 끝내고 기록일지에 저장하는 중입니다.');
  }, [clearShootAutoEnd, playStartCue]);

  const completeDribbleReview = useCallback(
    (videoUri: string) => {
      clearRecordingWait();
      pendingReviewStopRef.current = false;
      const frontWeakPoint = finalizeFrontDribbleWeakPoint();

      const reviewClip = buildReviewClipFromTimeline(
        [...feedbackTimelineRef.current],
        latestFeedbackRef.current,
        videoUri
      );

      const summaryFeedback =
        frontWeakPoint
          ? `사용자님이 가장 부족했던 자세 부분은 ${frontWeakPoint.criterionNumber}번째 기준이에요, ${frontWeakPoint.feedbackText}`
          : `가장 많이 나온 피드백은 다음 내용이에요.\n${reviewClip.feedback}`;

      latestFeedbackRef.current = summaryFeedback;
      frontDribbleSummaryShownRef.current = true;

      addLessonHomework(lessonModeRef.current);
      saveLessonRecord(videoUri, reviewClip);

      lessonStartedAtRef.current = null;
      dribbleLessonPhaseRef.current = 'stance_setup';
      shootLessonStartedRef.current = false;
      resetShootAnalysisTracking();
      dribbleTargetCountRef.current = null;
      dribbleAutoEndingRef.current = false;
      stanceCountdownStartedAtRef.current = null;
      feedbackTimelineRef.current = [];
      pendingFeedbackRef.current = null;
      setCurrentDribbleCount(0);
      setCountdownValue(null);
      setDribbleResetToken(0);
      setShootResetToken(0);
      setRecordingStartToken(0);
      setRecordingStopToken(0);
      setFeedbackText(summaryFeedback);
      setLessonReview(reviewClip);
      setIsLessonActive(false);
      setIsCameraActive(true);
      setIsCameraReady(true);
      setCameraError('');
      setDebugText('레슨이 끝났습니다. 녹화한 영상은 기록일지에 저장했고, 가장 많이 나온 피드백을 화면에 유지합니다.');
    },
    [addLessonHomework, clearRecordingWait, finalizeFrontDribbleWeakPoint, resetShootAnalysisTracking, saveLessonRecord]
  );

  const completeShootReview = useCallback(
    (videoUri: string) => {
      clearRecordingWait();
      pendingShootReviewRef.current = false;

      const recordedAnalyses = shootAnalysisHistoryRef.current;
      const finalAnalysis =
        [...recordedAnalyses].reverse().find((item) => item.releaseDetected) ??
        recordedAnalyses[recordedAnalyses.length - 1] ??
        latestShootAnalysisRef.current;

      const finalFeedback = buildShootReviewFeedback(finalAnalysis ?? null);
      latestFeedbackRef.current = finalFeedback;
      feedbackTimelineRef.current = [{ atMs: 0, text: finalFeedback }];
      setFeedbackText(finalFeedback);
      setLessonReview(null);

      addLessonHomework('shoot');
      saveLessonRecord(videoUri);

      lessonStartedAtRef.current = null;
      dribbleLessonPhaseRef.current = 'stance_setup';
      shootLessonStartedRef.current = false;
      resetShootAnalysisTracking();
      dribbleTargetCountRef.current = null;
      dribbleAutoEndingRef.current = false;
      stanceCountdownStartedAtRef.current = null;
      feedbackTimelineRef.current = [];
      pendingFeedbackRef.current = null;
      setCurrentDribbleCount(0);
      setCountdownValue(null);
      setDribbleResetToken(0);
      setShootResetToken(0);
      setRecordingStartToken(0);
      setRecordingStopToken(0);
      setIsLessonActive(true);
      setIsCameraActive(true);
      setIsCameraReady(true);
      setCameraError('');
      setImmediateLessonFeedback(`${finalFeedback}\n\n다시 슛 준비 자세를 맞춰 주세요. 준비 자세가 맞으면 3초 카운트가 다시 시작됩니다.`);
      setDebugText('슛 촬영 분석이 끝났습니다. 다시 준비 자세를 맞춰 주세요.');
    },
    [addLessonHomework, clearRecordingWait, resetShootAnalysisTracking, saveLessonRecord, setImmediateLessonFeedback]
  );

  function startDribbleLessonFromCountdown(isFrontDribble: boolean) {
    if (dribbleLessonPhaseRef.current !== 'countdown') {
      return;
    }

    dribbleLessonPhaseRef.current = 'active';
    stanceCountdownStartedAtRef.current = null;
    setCountdownValue(null);
    setCurrentDribbleCount(0);
    setDribbleResetToken(Date.now());
    playStartCue();
    setRecordingStartToken(Date.now());
    setImmediateLessonFeedback(
      isFrontDribble
        ? '시작합니다. 지금부터 녹화를 시작하고 드리블 횟수를 셉니다. 설정한 횟수까지 드리블해 주세요.'
        : '시작합니다. 이제 드리블을 진행해 주세요. 공 높이와 시선, 자세를 계속 분석합니다.'
    );
    setDebugText('카운트 완료, 드리블 시작');
  }

  function startShootLessonFromCountdown() {
    if (dribbleLessonPhaseRef.current !== 'countdown') {
      return;
    }

    shootLessonStartedRef.current = true;
    dribbleLessonPhaseRef.current = 'active';
    stanceCountdownStartedAtRef.current = null;
    setCountdownValue(null);
    pendingShootReviewRef.current = false;
    pendingShootRecordingStopRef.current = false;
    latestShootAnalysisRef.current = null;
    shootAnalysisHistoryRef.current = [];
    setShootResetToken(Date.now());
    playStartCue();
    if (!shootRecordingStartedRef.current) {
      setRecordingStartToken(Date.now());
      shootRecordingStartedRef.current = true;
    }
    setImmediateLessonFeedback('시작합니다. 이제 슛을 발사해 주세요. 촬영이 끝나면 2, 3번째 기준으로 결과를 알려드립니다.');
    setDebugText('카운트 완료, 슛 촬영 시작');
  }

  const applyDribbleAnalysis = useCallback(
    (analysis: DribbleAnalysis) => {
      if (lessonModeRef.current !== 'dribble') {
        return;
      }

      latestDribbleAnalysisRef.current = analysis;

      const phase = dribbleLessonPhaseRef.current;
      const isFrontLesson = dribbleLessonViewRef.current === 'front';
      const stanceReady = isDribbleStanceReady(analysis, dribbleLessonViewRef.current);

      if (phase === 'active') {
        const effectiveAnalysis: DribbleAnalysis =
          isFrontLesson
            ? {
                ...analysis,
                bodyFacing: 'front',
                dribbleStarted: true,
              }
            : {
                ...analysis,
                bodyFacing: 'side',
              };

        stanceCountdownStartedAtRef.current = null;
        setCountdownValue(null);
        setCurrentDribbleCount(effectiveAnalysis.dribbleCount);
        updateFrontDribbleWeakPoint(effectiveAnalysis);
        const nextFeedback = buildDribbleFeedback(effectiveAnalysis, dribbleLessonViewRef.current);
        pendingFeedbackRef.current = nextFeedback;
        const targetCount = dribbleTargetCountRef.current;
        if (targetCount && effectiveAnalysis.dribbleCount >= targetCount && !dribbleAutoEndingRef.current) {
          dribbleAutoEndingRef.current = true;
          setImmediateLessonFeedback(
            `${nextFeedback}\n\n목표 드리블 ${targetCount}회에 도달했습니다. 지금 녹화를 끝내고 기록일지에 저장합니다.`
          );
          setDebugText(`목표 드리블 ${targetCount}회에 도달해 녹화를 마무리하고 기록일지에 저장합니다.`);
          finishDribbleRecordingForReview();
          return;
        }
        setDebugText(`드리블 분석 중: ${effectiveAnalysis.summary}`);
        return;
      }

      if (!isFrontLesson && phase === 'await_dribble' && analysis.dribbleStarted) {
        dribbleLessonPhaseRef.current = 'active';
        stanceCountdownStartedAtRef.current = null;
        setCountdownValue(null);
        setCurrentDribbleCount(analysis.dribbleCount);
        pendingFeedbackRef.current = buildDribbleFeedback(
          {
            ...analysis,
            bodyFacing: 'side',
          } as DribbleAnalysis,
          'side'
        );
        setDebugText(`드리블 시작 감지: ${analysis.summary}`);
        return;
      }

      if (!stanceReady) {
        dribbleLessonPhaseRef.current = 'stance_setup';
        stanceCountdownStartedAtRef.current = null;
        setCountdownValue(null);
        pendingFeedbackRef.current = buildDribbleStanceFeedback(analysis, dribbleLessonViewRef.current);
        setDebugText('드리블 전에 준비 자세를 맞추는 중입니다.');
        return;
      }

      if (phase === 'stance_setup') {
        dribbleLessonPhaseRef.current = 'countdown';
        stanceCountdownStartedAtRef.current = Date.now();
        setImmediateLessonFeedback('좋아요. 준비 자세가 기준에 맞았습니다. 3초 동안 그대로 유지해 주세요.');
        setDebugText('드리블 준비 자세 확인: 3초 유지 중');
        return;
      }

      if (phase === 'countdown') {
        const countdownStartedAt = stanceCountdownStartedAtRef.current ?? Date.now();
        const elapsed = Date.now() - countdownStartedAt;

        if (elapsed >= DRIBBLE_STANCE_HOLD_MS) {
          startDribbleLessonFromCountdown(isFrontLesson);
          return;
        }

        const remainingSeconds = Math.max(1, Math.ceil((DRIBBLE_STANCE_HOLD_MS - elapsed) / 1000));
        pendingFeedbackRef.current = buildDribbleCountdownFeedback(dribbleLessonViewRef.current, remainingSeconds);
        setDebugText(`준비 자세 유지 중: ${remainingSeconds}초 남음`);
        return;
      }

      pendingFeedbackRef.current = '이제 드리블을 시작해 주세요. 공이 발 가까이 내려왔다가 다시 올라오면 드리블 분석을 이어갑니다.';
      setDebugText('드리블 시작 대기 중');
      return;
      setDebugText(`슛 분석 중: ${analysis.summary}`);
    },
    [finishDribbleRecordingForReview, startDribbleLessonFromCountdown, updateFrontDribbleWeakPoint]
  );

  const applyShootAnalysisWithStance = useCallback(
    (analysis: ShootAnalysis) => {
      if (lessonModeRef.current !== 'shoot') {
        return;
      }

      latestShootAnalysisRef.current = analysis;

      if (pendingShootReviewRef.current) {
        return;
      }

      const phase = dribbleLessonPhaseRef.current;
      const stanceReady = isShootStanceReady(analysis);

      if (phase === 'cooldown') {
        const cooldownUntil = shootCooldownUntilRef.current;

        if (cooldownUntil && Date.now() < cooldownUntil) {
          const remainingSeconds = Math.max(1, Math.ceil((cooldownUntil - Date.now()) / 1000));
          setDebugText(`슛 발사 확인 후 녹화 마무리 중: ${remainingSeconds}초 남음`);
          return;
        }

        if (shootRecordingStartedRef.current) {
          pendingShootReviewRef.current = true;
          pendingShootRecordingStopRef.current = true;
          shootCooldownUntilRef.current = null;
          setImmediateLessonFeedback('슛 촬영을 마무리하고 있습니다. 곧 2, 3번째 기준 분석 결과를 보여드립니다.');
          setDebugText('슛 촬영을 마무리하고 분석 중입니다.');
          setRecordingStopToken(Date.now());
          return;
        }

        dribbleLessonPhaseRef.current = 'stance_setup';
      }

      if (phase === 'active' || shootLessonStartedRef.current) {
        stanceCountdownStartedAtRef.current = null;
        setCountdownValue(null);
        if (shootRecordingStartedRef.current) {
          shootAnalysisHistoryRef.current.push(analysis);
        }

        if (analysis.releaseDetected) {
          shootLessonStartedRef.current = false;
          dribbleLessonPhaseRef.current = 'cooldown';
          shootCooldownUntilRef.current = Date.now() + SHOOT_RECOVERY_MS;
          setImmediateLessonFeedback('슛 발사를 확인했습니다. 3초 뒤 녹화를 마치고 2, 3번째 기준을 분석합니다.');
          setDebugText('슛 발사를 확인했습니다. 3초 뒤 녹화를 종료합니다.');
          return;
        }

        setDebugText('슛 촬영 중입니다. 공이 머리보다 높게 올라가는 발사 시점을 기다리고 있습니다.');
        return;
      }

      if (phase === 'countdown') {
        const countdownStartedAt = stanceCountdownStartedAtRef.current ?? Date.now();
        const elapsed = Date.now() - countdownStartedAt;

        if (elapsed >= DRIBBLE_STANCE_HOLD_MS) {
          startShootLessonFromCountdown();
          return;
        }

        const remainingSeconds = Math.max(1, Math.ceil((DRIBBLE_STANCE_HOLD_MS - elapsed) / 1000));
        pendingFeedbackRef.current = `슛 준비 자세를 유지해 주세요.\n1. 팔 각도를 기준 범위 안으로 맞춰 주세요.\n2. ${remainingSeconds}초 동안 자세를 유지하면 녹화를 시작합니다.\n3. 슛이 끝난 뒤 2, 3번째 기준으로 결과를 알려드립니다.`;
        setDebugText(`슛 준비 자세 유지 중: ${remainingSeconds}초 남음`);
        return;
      }

      if (!stanceReady) {
        dribbleLessonPhaseRef.current = 'stance_setup';
        stanceCountdownStartedAtRef.current = null;
        setCountdownValue(null);
        pendingFeedbackRef.current = buildShootStanceFeedback(analysis);
        setDebugText('슛 준비 자세를 맞추는 중입니다.');
        return;
      }

      if (phase === 'stance_setup') {
        dribbleLessonPhaseRef.current = 'countdown';
        stanceCountdownStartedAtRef.current = Date.now();
        setImmediateLessonFeedback('좋아요. 슛 준비 자세가 맞았습니다. 3초 동안 그대로 유지해 주세요.');
        setDebugText('슛 준비 자세 확인: 3초 유지 중');
        return;
      }

      setDebugText('슛 준비 자세를 확인하는 중입니다.');
    },
    [setImmediateLessonFeedback, startShootLessonFromCountdown]
  );

  const handlePoseMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const payload = JSON.parse(event.nativeEvent.data) as
          | { type: 'ready' }
          | { type: 'stream_started' }
          | { type: 'recording_started' }
          | { type: 'status'; message: string }
          | { type: 'points'; summary: string }
          | { type: 'dribble_analysis'; analysis: DribbleAnalysis }
          | { type: 'shoot_analysis'; analysis: ShootAnalysis }
          | { type: 'recording_ready'; videoUri: string }
          | { type: 'recording_error'; message: string }
          | { type: 'error'; message: string };

        if (payload.type === 'ready') {
          setDebugText('MediaPipe 모델 준비 완료');
          return;
        }

        if (payload.type === 'stream_started') {
          setIsCameraReady(true);
          setCameraError('');
          setDebugText('카메라 연결 완료, 분석을 시작합니다.');
          return;
        }

        if (payload.type === 'recording_started') {
          lessonStartedAtRef.current = Date.now();
          feedbackTimelineRef.current = [];
          setCurrentDribbleCount(0);
          latestShootAnalysisRef.current = null;
          shootAnalysisHistoryRef.current = [];
          if (latestFeedbackRef.current.trim()) {
            feedbackTimelineRef.current.push({
              atMs: 0,
              text: latestFeedbackRef.current.trim(),
            });
          }
          setDebugText('영상 녹화를 시작했습니다.');
          return;
        }

        if (payload.type === 'status') {
          setDebugText(payload.message);
          return;
        }

        if (payload.type === 'points') {
          if (!isCameraActive) {
            return;
          }

          setIsCameraReady(true);
          setDebugText(`인식 중: ${payload.summary}`);
          return;
        }

        if (payload.type === 'dribble_analysis') {
          if (!isLessonActive) {
            return;
          }

          setIsCameraReady(true);
          applyDribbleAnalysis(payload.analysis);
          return;
        }

        if (payload.type === 'shoot_analysis') {
          if (!isLessonActive) {
            return;
          }

          setIsCameraReady(true);
          applyShootAnalysisWithStance(payload.analysis);
          return;
        }

        if (payload.type === 'recording_ready') {
          if (pendingReviewStopRef.current) {
            completeDribbleReview(payload.videoUri);
            return;
          }

          if (pendingShootReviewRef.current || pendingShootRecordingStopRef.current) {
            completeShootReview(payload.videoUri);
            return;
          }

          void finalizeLessonSession(pendingStopSaveRef.current, payload.videoUri);
          return;
        }

        if (payload.type === 'recording_error') {
          setDebugText(payload.message || '영상 저장에 실패했습니다. 피드백만 유지한 상태로 종료합니다.');

          if (pendingReviewStopRef.current) {
            pendingReviewStopRef.current = false;
            setRecordingStopToken(0);
            setIsLessonActive(false);
            setIsCameraActive(true);
            return;
          }

          if (pendingShootReviewRef.current || pendingShootRecordingStopRef.current) {
            pendingShootReviewRef.current = false;
            pendingShootRecordingStopRef.current = false;
            const finalFeedback = buildShootReviewFeedback(latestShootAnalysisRef.current);
            latestFeedbackRef.current = `${finalFeedback}\n\n영상 저장에는 실패했습니다.`;
            setFeedbackText(latestFeedbackRef.current);
            resetShootAnalysisTracking();
            setRecordingStartToken(0);
            setRecordingStopToken(0);
            setShootResetToken(0);
            dribbleLessonPhaseRef.current = 'stance_setup';
            shootLessonStartedRef.current = false;
            setIsLessonActive(true);
            setIsCameraActive(true);
            setIsCameraReady(true);
            setImmediateLessonFeedback(`${latestFeedbackRef.current}\n\n다시 슛 준비 자세를 맞춰 주세요.`);
            return;
          }

          if (pendingStopSaveRef.current) {
            void finalizeLessonSession(true, '');
          }
          return;
        }

        if (payload.type === 'error') {
          setCameraError(payload.message || 'MediaPipe 또는 카메라 시작 중 문제가 발생했습니다.');
          setDebugText(payload.message || '카메라 시작 실패');
        }
      } catch {
        setDebugText('카메라 상태 메시지를 처리하는 중 문제가 발생했습니다.');
      }
    },
    [applyDribbleAnalysis, applyShootAnalysisWithStance, completeDribbleReview, completeShootReview, finalizeLessonSession, isCameraActive, isLessonActive]
  );

  function openDiaryDate(dateKey: string) {
    setSelectedDateKey(dateKey);
  }

  function changeMonth(delta: number) {
    setCurrentDate((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  }

  function registerSuccessfulShot() {
    if (lessonMode !== 'shoot') {
      Alert.alert('슛 분석 모드 전용', '슛 성공 기록은 슛 분석 모드에서만 사용할 수 있습니다.');
      return;
    }

    const todayKey = formatDateKey(new Date());
    const nextCount = (shotSuccessRecords[todayKey] || 0) + 1;

    setShotSuccessRecords((current) => ({
      ...current,
      [todayKey]: nextCount,
    }));

    const nextText = `오늘 슛 성공 ${nextCount}개를 기록했습니다.`;
    setFeedbackAndRemember(nextText);
    setFireworks(createFireworks());
    setShowFireworks(true);
  }

  async function openSkillVideo() {
    if (!selectedSkill) {
      return;
    }

    const url = selectedSkill.videoUrl;
    const supported = await Linking.canOpenURL(url);

    if (!supported) {
      Alert.alert('열기 실패', '기기에서 영상을 열 수 없습니다.');
      return;
    }

    await Linking.openURL(url);
  }

  async function deleteLessonRecord(recordId: string) {
    const record = lessonRecords.find((item) => item.id === recordId);

    if (record?.videoUri && !record.videoUri.startsWith('data:')) {
      try {
        await FileSystem.deleteAsync(record.videoUri, { idempotent: true });
      } catch {
        // Ignore delete failures for already-removed files.
      }
    }

    setLessonRecords((current) => current.filter((item) => item.id !== recordId));
  }

  return {
    screen,
    lessonMode,
    dribbleLessonView,
    homeworkToShow,
    deleteHomeworkItem,
    currentDate,
    selectedDateKey,
    selectedDateRecords,
    selectedDateShotCount,
    shotGraphData,
    calendarCells,
    selectedSkillKey,
    selectedBallBrand,
    selectedBallColors,
    debugText,
    feedbackText,
    lessonReview,
    currentDribbleCount,
    isCameraActive,
    isLessonActive,
    isCameraReady,
    cameraSessionKey,
    countdownValue,
    dribbleResetToken,
    shootResetToken,
    recordingStartToken,
    recordingStopToken,
    cameraError,
    fireworks,
    showFireworks,
    navigateTo,
    changeLessonMode,
    changeDribbleLessonView,
    beginLesson,
    endLesson,
    handlePoseMessage,
    registerSuccessfulShot,
    selectSkill,
    selectBallBrand,
    toggleBallColor,
    openSkillVideo,
    openDiaryDate,
    changeMonth,
    deleteLessonRecord,
  };
}



