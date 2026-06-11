import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Linking from 'expo-linking';
import { Audio } from 'expo-av';
import { useCameraPermissions } from 'expo-camera';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';
import type { WebViewMessageEvent } from 'react-native-webview';
import { SKILLS } from '../constants/content';
import { BALL_BRAND_PRESETS, DEFAULT_BALL_BRAND, DEFAULT_BALL_COLORS, DEFAULT_POSITION } from '../constants/settings';
import { STORAGE_KEYS } from '../constants/storage';
import type {
  AccountGender,
  AppScreen,
  AuthMode,
  AuthSession,
  AuthUser,
  BallBrandOption,
  BallColorOption,
  DribbleAnalysis,
  DribbleLessonView,
  FeedbackMoment,
  FireworkItem,
  HomeworkProgressItem,
  LessonMode,
  LessonRecord,
  LessonReviewClip,
  PositionOption,
  ShotGraphDatum,
  ShootAnalysis,
  SkillKey,
  UserAccount,
} from '../types/app';
import { getCalendarCells } from '../utils/calendar';
import { formatDateKey } from '../utils/date';
import { buildDribbleFeedbackText, buildShootFeedbackText } from '../utils/feedback';
import {
  buildDailyHomeworkProgress,
  DAILY_DRIBBLE_TARGET,
  DAILY_SHOOT_TARGET,
  getHomeworkCompletionMessage,
} from '../utils/homework';

const FEEDBACK_UPDATE_INTERVAL_MS = 1500;
const DRIBBLE_STANCE_HOLD_MS = 3000;
const SHOOT_RECOVERY_MS = 3000;
const DEFAULT_DEBUG_TEXT = '카메라와 MediaPipe를 준비하고 있습니다.';

type DribbleLessonPhase = 'stance_setup' | 'countdown' | 'await_dribble' | 'active' | 'cooldown';
type FrontDribbleCriterionNumber = 1 | 2 | 3 | 4;

interface FrontDribbleWeakPoint {
  criterionNumber: FrontDribbleCriterionNumber;
  feedbackText: string;
  count: number;
}

interface AuthFormValues {
  name: string;
  age: string;
  gender: AccountGender;
  password: string;
  keepSignedIn: boolean;
}

interface AuthActionResult {
  success: boolean;
  message: string;
}

const DEFAULT_DRIBBLE_FEEDBACK =
  '드리블 피드백\n1. 시선, 공 높이, 상체 자세를 분석하는 중입니다.\n2. 몸 전체와 공이 화면 안에 보이도록 맞춰 주세요.\n3. 분석이 안정되면 기준에 맞는 피드백이 바로 나타납니다.';

const DEFAULT_SHOOT_FEEDBACK =
  '슛 피드백\n1. 팔 각도, 슛 타이밍, 하체 각도를 분석하는 중입니다.\n2. 어깨부터 발끝까지 몸 전체가 화면 안에 보이도록 맞춰 주세요.\n3. 분석이 안정되면 기준에 맞는 피드백이 바로 나타납니다.';

function createFireworks(): FireworkItem[] {
  const emojis = ['🏀', '✨', '🔥', '🎉', '🙌'];

  return Array.from({ length: 10 }, (_, index) => ({
    id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
    emoji: emojis[Math.floor(Math.random() * emojis.length)],
    left: `${12 + Math.random() * 74}%` as `${number}%`,
    top: `${10 + Math.random() * 42}%` as `${number}%`,
  }));
}

function normalizeAccountName(name: string) {
  return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

function buildAccountStorageKey(baseKey: string, userId: string) {
  return `${baseKey}:${userId}`;
}

function getAccountStorageKeys(userId: string) {
  return {
    attendance: buildAccountStorageKey(STORAGE_KEYS.attendance, userId),
    lessonRecords: buildAccountStorageKey(STORAGE_KEYS.lessonRecords, userId),
    dribbleCounts: buildAccountStorageKey(STORAGE_KEYS.dribbleCounts, userId),
    shotAttempts: buildAccountStorageKey(STORAGE_KEYS.shotAttempts, userId),
    shotSuccess: buildAccountStorageKey(STORAGE_KEYS.shotSuccess, userId),
    ballColors: buildAccountStorageKey(STORAGE_KEYS.ballColors, userId),
    ballBrand: buildAccountStorageKey(STORAGE_KEYS.ballBrand, userId),
    position: buildAccountStorageKey(STORAGE_KEYS.position, userId),
  } as const;
}

function toAuthUser(account: UserAccount): AuthUser {
  return {
    id: account.id,
    name: account.name,
    age: account.age,
    gender: account.gender,
  };
}

function parseAgeInput(value: string) {
  const numericAge = Number(value.trim());

  if (!Number.isInteger(numericAge) || numericAge <= 0 || numericAge > 120) {
    return null;
  }

  return numericAge;
}

function parseStoredJson<T>(value: string | null, fallback: T): T {
  return value ? (JSON.parse(value) as T) : fallback;
}

function parseDateKeyToDate(dateKey: string) {
  const [yearText, monthText, dayText] = dateKey.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return new Date();
  }

  return new Date(year, month - 1, day);
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

function isDribbleStanceReady(analysis: DribbleAnalysis) {
  if (analysis.bodyFacing === 'front') {
    return analysis.stanceState === 'ready';
  }

  return (
    analysis.stanceState === 'ready' ||
    ((!analysis.stanceState || analysis.stanceState === 'unknown') &&
      analysis.eyeFocus === 'forward' &&
      analysis.torsoPosture === 'balanced')
  );
}

function isDribbleStanceReadyForView(analysis: DribbleAnalysis, expectedView: DribbleLessonView) {
  if (expectedView === 'front') {
    return analysis.bodyFacing === 'front' && analysis.stanceState === 'ready';
  }

  if (analysis.bodyFacing !== 'side') {
    return false;
  }

  return (
    analysis.stanceState === 'ready' ||
    ((!analysis.stanceState || analysis.stanceState === 'unknown') &&
      analysis.eyeFocus === 'forward' &&
      analysis.torsoPosture === 'balanced')
  );
}

function buildDribbleStanceFeedback(analysis: DribbleAnalysis) {
  const eyeLine =
    analysis.eyeFocus === 'forward'
      ? '시선이 좋습니다. 지금처럼 공이 아니라 앞을 바라봐 주세요.'
      : '시선이 공으로 내려가 있습니다. 공이 아니라 앞을 보고 드리블해 주세요.';

  const torsoLine =
    analysis.torsoPosture === 'balanced'
      ? '상체 자세가 안정적입니다. 지금 자세를 유지해 주세요.'
      : analysis.torsoPosture === 'high'
        ? '드리블 전에 상체가 너무 높습니다. 조금 더 낮춰 주세요.'
        : analysis.torsoPosture === 'low'
          ? '상체가 너무 많이 숙여졌습니다. 조금 세워서 균형을 맞춰 주세요.'
          : '어깨와 엉덩이가 잘 보이도록 자세를 다시 맞춰 주세요.';

  return `드리블 준비 자세\n1. ${eyeLine}\n2. 시선과 상체 자세가 모두 맞으면 3초 뒤 드리블을 시작합니다.\n3. ${torsoLine}`;
}

function isShootStanceReady(analysis: ShootAnalysis) {
  return analysis.readyPoseDetected;
}

function buildDribbleStanceFeedbackV2(analysis: DribbleAnalysis) {
  const torsoLine =
    analysis.stanceState === 'ready'
      ? `상체 기울기 ${analysis.torsoLeanAngle ? analysis.torsoLeanAngle.toFixed(1) : '--'}도로 준비 자세가 좋습니다.`
      : analysis.stanceState === 'too_upright'
        ? `상체 기울기가 ${analysis.torsoLeanAngle ? analysis.torsoLeanAngle.toFixed(1) : '--'}도예요. 40~80도가 되도록 조금 더 숙여 주세요.`
        : analysis.stanceState === 'too_low'
          ? `상체 기울기가 ${analysis.torsoLeanAngle ? analysis.torsoLeanAngle.toFixed(1) : '--'}도예요. 너무 많이 숙였으니 조금 세워 주세요.`
          : '어깨와 엉덩이가 잘 보이도록 서서 상체 기울기를 다시 확인해 주세요.';

  return `드리블 준비 자세\n1. 엉덩이에서 어깨까지의 상체 기울기를 40~80도로 맞춰 주세요.\n2. 이 자세를 3초 동안 유지하면 드리블을 시작하라고 알려드립니다.\n3. ${torsoLine}`;
}

function buildDribbleStanceFeedbackV3(analysis: DribbleAnalysis) {
  if (analysis.bodyFacing === 'front') {
    const stanceLine =
      analysis.stanceState === 'ready'
        ? `발-무릎-엉덩이 각도 ${analysis.frontStanceAngle ? analysis.frontStanceAngle.toFixed(1) : '--'}도로 준비 자세가 잘 잡혔습니다.`
        : `발-무릎-엉덩이 각도가 ${analysis.frontStanceAngle ? analysis.frontStanceAngle.toFixed(1) : '--'}도예요. 140~170도가 되도록 자세를 다시 맞춰 주세요.`;

    return `정면 드리블 준비 자세\n1. 자세를 낮춰 발-무릎-엉덩이 각도를 140~170도로 맞춰 주세요.\n2. 이 자세를 3초 동안 유지하면 드리블을 시작하라고 알려드립니다.\n3. ${stanceLine}`;
  }

  return buildDribbleStanceFeedbackV2(analysis);
}

function buildDribbleStanceFeedbackForView(analysis: DribbleAnalysis, expectedView: DribbleLessonView) {
  if (expectedView === 'front') {
    if (analysis.bodyFacing === 'side') {
      return '정면 드리블 준비 자세\n1. 카메라를 정면으로 바라보게 서 주세요.\n2. 발, 무릎, 엉덩이가 함께 잘 보이도록 맞춰 주세요.\n3. 정면이 확인되면 3초 카운트 뒤 드리블을 시작합니다.';
    }

    return buildDribbleStanceFeedbackV3(analysis);
  }

  if (analysis.bodyFacing === 'front') {
    return '옆모습 드리블 준비 자세\n1. 몸이 옆으로 보이게 돌아서 서 주세요.\n2. 어깨와 엉덩이가 함께 보이도록 상체를 낮춰 주세요.\n3. 옆모습이 확인되면 3초 카운트 뒤 드리블을 시작합니다.';
  }

  return buildDribbleStanceFeedbackV2(analysis);
}

function buildShootStanceFeedback(analysis: ShootAnalysis) {
  if (analysis.armAngleState === 'balanced' && !analysis.ballNearShootingHand) {
    return '슛 준비 자세\n1. 팔 각도는 좋습니다. 공을 슈팅 손 가까이 붙여 준비 자세를 보여 주세요.\n2. 공과 슈팅 손 위치가 함께 맞으면 3초 뒤 슛을 시작합니다.\n3. 공이 손에서 너무 멀어 보이면 카운트가 시작되지 않습니다.';
  }

  if (analysis.armAngleState === 'balanced' && !analysis.shootingHandRaised) {
    return '슛 준비 자세\n1. 팔 각도는 좋습니다. 슈팅 손과 공을 어깨 높이까지 들어 올려 주세요.\n2. 손 높이와 공 위치가 함께 맞으면 3초 뒤 슛을 시작합니다.\n3. 준비 자세가 무너지면 다시 자세부터 맞춥니다.';
  }

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
      return `발-무릎-엉덩이 각도가 ${analysis.frontStanceAngle ? analysis.frontStanceAngle.toFixed(1) : '--'}도예요. 140~170도가 되도록 자세를 다시 맞춰 주세요.`;
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
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [accounts, setAccounts] = useState<UserAccount[]>([]);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isAccountDataReady, setIsAccountDataReady] = useState(false);
  const [lessonMode, setLessonMode] = useState<LessonMode>('dribble');
  const [attendance, setAttendance] = useState<Record<string, string>>({});
  const [dailyDribbleRecords, setDailyDribbleRecords] = useState<Record<string, number>>({});
  const [lessonRecords, setLessonRecords] = useState<LessonRecord[]>([]);
  const [shotAttemptRecords, setShotAttemptRecords] = useState<Record<string, number>>({});
  const [shotSuccessRecords, setShotSuccessRecords] = useState<Record<string, number>>({});
  const [selectedDateKey, setSelectedDateKey] = useState('');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedSkillKey, setSelectedSkillKey] = useState<SkillKey | ''>('');
  const [selectedBallBrand, setSelectedBallBrand] = useState<BallBrandOption>(DEFAULT_BALL_BRAND);
  const [selectedBallColors, setSelectedBallColors] = useState<BallColorOption[]>(DEFAULT_BALL_COLORS);
  const [selectedPosition, setSelectedPosition] = useState<PositionOption>(DEFAULT_POSITION);
  const [isHomeworkRevealed, setIsHomeworkRevealed] = useState(false);
  const [debugText, setDebugText] = useState(DEFAULT_DEBUG_TEXT);
  const [feedbackText, setFeedbackText] = useState(DEFAULT_DRIBBLE_FEEDBACK);
  const [lessonReview, setLessonReview] = useState<LessonReviewClip | null>(null);
  const [selectedDribbleView, setSelectedDribbleView] = useState<DribbleLessonView>('front');
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
  const selectedDribbleViewRef = useRef<DribbleLessonView>(selectedDribbleView);
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
  const dailyDribbleRecordsRef = useRef<Record<string, number>>({});
  const shotAttemptRecordsRef = useRef<Record<string, number>>({});
  const shootAnalysisHistoryRef = useRef<ShootAnalysis[]>([]);
  const shootFeedbackLockedRef = useRef(false);
  const frontDribbleCriterionCountsRef = useRef<Record<FrontDribbleCriterionNumber, number>>(createFrontDribbleCriterionCounter());
  const frontDribbleWeakPointRef = useRef<FrontDribbleWeakPoint | null>(null);
  const frontDribbleSummaryShownRef = useRef(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const currentUserId = currentUser?.id ?? '';
  const isReady = isAuthReady && (!currentUser || isAccountDataReady);
  const selectedSkill = selectedSkillKey ? SKILLS[selectedSkillKey] : null;
  const todayKey = formatDateKey(new Date());
  const homeworkToShow = useMemo<HomeworkProgressItem[]>(
    () => buildDailyHomeworkProgress(dailyDribbleRecords[todayKey] || 0, shotAttemptRecords[todayKey] || 0),
    [dailyDribbleRecords, shotAttemptRecords, todayKey]
  );
  const calendarCells = useMemo(
    () => getCalendarCells(currentDate, attendance, dailyDribbleRecords, shotAttemptRecords),
    [attendance, currentDate, dailyDribbleRecords, shotAttemptRecords]
  );
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

  const resetAccountState = useCallback(() => {
    const resetDate = new Date();
    const resetDateKey = formatDateKey(resetDate);

    setScreen('home');
    setLessonMode('dribble');
    setAttendance({});
    setDailyDribbleRecords({});
    setLessonRecords([]);
    setShotAttemptRecords({});
    setShotSuccessRecords({});
    setSelectedDateKey(resetDateKey);
    setCurrentDate(resetDate);
    setSelectedSkillKey('');
    setSelectedBallBrand(DEFAULT_BALL_BRAND);
    setSelectedBallColors(DEFAULT_BALL_COLORS);
    setSelectedPosition(DEFAULT_POSITION);
    setIsHomeworkRevealed(false);
    setDebugText(DEFAULT_DEBUG_TEXT);
    setFeedbackText(DEFAULT_DRIBBLE_FEEDBACK);
    setLessonReview(null);
    setSelectedDribbleView('front');
    setCurrentDribbleCount(0);
    setIsLessonActive(false);
    setIsCameraActive(false);
    setIsCameraReady(false);
    setCameraError('');
    setCameraSessionKey(0);
    setCountdownValue(null);
    setDribbleResetToken(0);
    setShootResetToken(0);
    setRecordingStartToken(0);
    setRecordingStopToken(0);
    setFireworks([]);
    setShowFireworks(false);

    latestFeedbackRef.current = DEFAULT_DRIBBLE_FEEDBACK;
    pendingFeedbackRef.current = null;
    lessonModeRef.current = 'dribble';
    selectedDribbleViewRef.current = 'front';
    lessonStartedAtRef.current = null;
    dribbleLessonPhaseRef.current = 'stance_setup';
    shootLessonStartedRef.current = false;
    shootCooldownUntilRef.current = null;
    shootRecordingStartedRef.current = false;
    dribbleTargetCountRef.current = null;
    dribbleAutoEndingRef.current = false;
    stanceCountdownStartedAtRef.current = null;
    feedbackTimelineRef.current = [];
    pendingStopSaveRef.current = false;
    pendingReviewStopRef.current = false;
    pendingShootReviewRef.current = false;
    pendingShootRecordingStopRef.current = false;
    latestDribbleAnalysisRef.current = null;
    latestShootAnalysisRef.current = null;
    dailyDribbleRecordsRef.current = {};
    shotAttemptRecordsRef.current = {};
    shootAnalysisHistoryRef.current = [];
    shootFeedbackLockedRef.current = false;
    frontDribbleCriterionCountsRef.current = createFrontDribbleCriterionCounter();
    frontDribbleWeakPointRef.current = null;
    frontDribbleSummaryShownRef.current = false;
  }, []);

  const persistSession = useCallback(async (userId: string, keepSignedIn: boolean) => {
    if (keepSignedIn) {
      const nextSession: AuthSession = { userId };
      await AsyncStorage.setItem(STORAGE_KEYS.session, JSON.stringify(nextSession));
      return;
    }

    await AsyncStorage.removeItem(STORAGE_KEYS.session);
  }, []);

  useEffect(() => {
    latestFeedbackRef.current = feedbackText;
  }, [feedbackText]);

  useEffect(() => {
    dailyDribbleRecordsRef.current = dailyDribbleRecords;
  }, [dailyDribbleRecords]);

  useEffect(() => {
    shotAttemptRecordsRef.current = shotAttemptRecords;
  }, [shotAttemptRecords]);

  useEffect(() => {
    lessonModeRef.current = lessonMode;
  }, [lessonMode]);

  useEffect(() => {
    selectedDribbleViewRef.current = selectedDribbleView;
  }, [selectedDribbleView]);

  useEffect(() => {
    let isMounted = true;

    async function loadAuthState() {
      try {
        const entries = await AsyncStorage.multiGet([STORAGE_KEYS.accounts, STORAGE_KEYS.session]);
        const stored = Object.fromEntries(entries);
        const parsedAccounts = parseStoredJson<UserAccount[]>(stored[STORAGE_KEYS.accounts], []);
        const parsedSession = parseStoredJson<AuthSession | null>(stored[STORAGE_KEYS.session], null);

        if (!isMounted) {
          return;
        }

        setAccounts(parsedAccounts);
        setAuthMode(parsedAccounts.length > 0 ? 'login' : 'signup');

        if (parsedSession?.userId) {
          const sessionAccount = parsedAccounts.find((account) => account.id === parsedSession.userId);

          if (sessionAccount) {
            setCurrentUser(toAuthUser(sessionAccount));
          } else {
            await AsyncStorage.removeItem(STORAGE_KEYS.session);
          }
        }
      } catch {
        Alert.alert('불러오기 실패', '로그인 정보를 읽는 중 문제가 발생했습니다.');
      } finally {
        if (isMounted) {
          setIsAuthReady(true);
        }
      }
    }

    void loadAuthState();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    if (!currentUserId) {
      resetAccountState();
      setIsAccountDataReady(false);
      return () => {
        isMounted = false;
      };
    }

    setIsAccountDataReady(false);
    resetAccountState();

    async function loadAccountData() {
      try {
        const scopedKeys = getAccountStorageKeys(currentUserId);
        const entries = await AsyncStorage.multiGet([
          scopedKeys.attendance,
          scopedKeys.lessonRecords,
          scopedKeys.dribbleCounts,
          scopedKeys.shotAttempts,
          scopedKeys.shotSuccess,
          scopedKeys.ballColors,
          scopedKeys.ballBrand,
          scopedKeys.position,
        ]);

        if (!isMounted) {
          return;
        }

        const stored = Object.fromEntries(entries);
        const parsedAttendance = parseStoredJson<Record<string, string>>(stored[scopedKeys.attendance], {});
        const parsedLessonRecords = parseStoredJson<
          Array<LessonRecord | (Omit<LessonRecord, 'feedbackTimeline'> & { feedbackTimeline?: FeedbackMoment[] | string[] })>
        >(stored[scopedKeys.lessonRecords], []).map((record) => normalizeLessonRecord(record));
        const parsedDribbleCounts = parseStoredJson<Record<string, number>>(stored[scopedKeys.dribbleCounts], {});
        const parsedShotAttempts = parseStoredJson<Record<string, number>>(stored[scopedKeys.shotAttempts], {});
        const parsedShotSuccess = parseStoredJson<Record<string, number>>(stored[scopedKeys.shotSuccess], {});
        const parsedBallBrand = parseStoredJson<BallBrandOption>(stored[scopedKeys.ballBrand], DEFAULT_BALL_BRAND);
        const parsedBallColors = parseStoredJson<BallColorOption[]>(stored[scopedKeys.ballColors], DEFAULT_BALL_COLORS);
        const parsedPosition = parseStoredJson<PositionOption>(stored[scopedKeys.position], DEFAULT_POSITION);

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

        const nextTodayKey = formatDateKey(new Date());
        parsedAttendance[nextTodayKey] = 'attended';

        setAttendance(parsedAttendance);
        setDailyDribbleRecords(parsedDribbleCounts);
        setLessonRecords(parsedLessonRecords);
        setShotAttemptRecords(parsedShotAttempts);
        setShotSuccessRecords(parsedShotSuccess);
        setSelectedBallBrand(parsedBallBrand);
        setSelectedBallColors(
          parsedBallColors.length > 0 ? parsedBallColors : BALL_BRAND_PRESETS[parsedBallBrand] ?? DEFAULT_BALL_COLORS
        );
        setSelectedPosition(parsedPosition);
        setSelectedDateKey(nextTodayKey);
        setCurrentDate(new Date());

        await AsyncStorage.setItem(scopedKeys.attendance, JSON.stringify(parsedAttendance));
      } catch {
        if (isMounted) {
          Alert.alert('불러오기 실패', '계정 데이터를 읽는 중 문제가 발생했습니다.');
        }
      } finally {
        if (isMounted) {
          setIsAccountDataReady(true);
        }
      }
    }

    void loadAccountData();

    return () => {
      isMounted = false;
    };
  }, [currentUserId, resetAccountState]);

  useEffect(() => {
    if (!currentUserId || !isAccountDataReady) {
      return;
    }

    void AsyncStorage.setItem(getAccountStorageKeys(currentUserId).attendance, JSON.stringify(attendance));
  }, [attendance, currentUserId, isAccountDataReady]);

  useEffect(() => {
    if (!currentUserId || !isAccountDataReady) {
      return;
    }

    void AsyncStorage.setItem(getAccountStorageKeys(currentUserId).lessonRecords, JSON.stringify(lessonRecords));
  }, [currentUserId, isAccountDataReady, lessonRecords]);

  useEffect(() => {
    if (!currentUserId || !isAccountDataReady) {
      return;
    }

    void AsyncStorage.setItem(getAccountStorageKeys(currentUserId).dribbleCounts, JSON.stringify(dailyDribbleRecords));
  }, [currentUserId, dailyDribbleRecords, isAccountDataReady]);

  useEffect(() => {
    if (!currentUserId || !isAccountDataReady) {
      return;
    }

    void AsyncStorage.setItem(getAccountStorageKeys(currentUserId).shotAttempts, JSON.stringify(shotAttemptRecords));
  }, [currentUserId, isAccountDataReady, shotAttemptRecords]);

  useEffect(() => {
    if (!currentUserId || !isAccountDataReady) {
      return;
    }

    void AsyncStorage.setItem(getAccountStorageKeys(currentUserId).shotSuccess, JSON.stringify(shotSuccessRecords));
  }, [currentUserId, isAccountDataReady, shotSuccessRecords]);

  useEffect(() => {
    if (!currentUserId || !isAccountDataReady) {
      return;
    }

    void AsyncStorage.setItem(getAccountStorageKeys(currentUserId).ballColors, JSON.stringify(selectedBallColors));
  }, [currentUserId, isAccountDataReady, selectedBallColors]);

  useEffect(() => {
    if (!currentUserId || !isAccountDataReady) {
      return;
    }

    void AsyncStorage.setItem(getAccountStorageKeys(currentUserId).ballBrand, JSON.stringify(selectedBallBrand));
  }, [currentUserId, isAccountDataReady, selectedBallBrand]);

  useEffect(() => {
    if (!currentUserId || !isAccountDataReady) {
      return;
    }

    void AsyncStorage.setItem(getAccountStorageKeys(currentUserId).position, JSON.stringify(selectedPosition));
  }, [currentUserId, isAccountDataReady, selectedPosition]);

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

      startDribbleLessonFromCountdown(latestDribbleAnalysisRef.current?.bodyFacing === 'front');
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
    shootFeedbackLockedRef.current = false;
  }, []);

  const resetFrontDribbleTrackingSummary = useCallback(() => {
    latestDribbleAnalysisRef.current = null;
    frontDribbleCriterionCountsRef.current = createFrontDribbleCriterionCounter();
    frontDribbleWeakPointRef.current = null;
    frontDribbleSummaryShownRef.current = false;
  }, []);

  const updateFrontDribbleWeakPoint = useCallback((analysis: DribbleAnalysis) => {
    if (analysis.bodyFacing !== 'front') {
      return;
    }

    latestDribbleAnalysisRef.current = analysis;

    if (analysis.stanceState !== 'ready' && analysis.stanceState !== 'unknown') {
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

    if (!analysis || analysis.bodyFacing !== 'front') {
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

  const celebrateHomeworkCompletion = useCallback(() => {
    setFireworks(createFireworks());
    setShowFireworks(true);
  }, []);

  const recordDailyDribbleProgress = useCallback(
    (count: number) => {
      const amount = Math.max(0, count);
      const dateKey = formatDateKey(new Date());
      const previous = dailyDribbleRecordsRef.current[dateKey] || 0;
      const next = previous + amount;

      dailyDribbleRecordsRef.current = {
        ...dailyDribbleRecordsRef.current,
        [dateKey]: next,
      };
      setDailyDribbleRecords(dailyDribbleRecordsRef.current);

      return previous < DAILY_DRIBBLE_TARGET && next >= DAILY_DRIBBLE_TARGET;
    },
    []
  );

  const recordDailyShootAttempt = useCallback(() => {
    const dateKey = formatDateKey(new Date());
    const previous = shotAttemptRecordsRef.current[dateKey] || 0;
    const next = previous + 1;

    shotAttemptRecordsRef.current = {
      ...shotAttemptRecordsRef.current,
      [dateKey]: next,
    };
    setShotAttemptRecords(shotAttemptRecordsRef.current);

    return previous < DAILY_SHOOT_TARGET && next >= DAILY_SHOOT_TARGET;
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
        if (lessonModeRef.current === 'shoot') {
          const completedShootHomework = recordDailyShootAttempt();
          if (completedShootHomework) {
            celebrateHomeworkCompletion();
            setImmediateLessonFeedback(getHomeworkCompletionMessage('shoot'));
          }
        }
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
    [
      celebrateHomeworkCompletion,
      clearRecordingWait,
      clearShootAutoEnd,
      recordDailyShootAttempt,
      resetFrontDribbleTrackingSummary,
      resetShootAnalysisTracking,
      saveLessonRecord,
      setImmediateLessonFeedback,
    ]
  );

  function changeAuthMode(nextMode: AuthMode) {
    setAuthMode(nextMode);
  }

  async function login({ name, age, gender, password, keepSignedIn }: AuthFormValues): Promise<AuthActionResult> {
    const trimmedName = name.trim();
    const trimmedPassword = password.trim();
    const parsedAge = parseAgeInput(age);

    if (!trimmedName || parsedAge === null || !trimmedPassword) {
      return {
        success: false,
        message: '이름, 나이, 성별, 비밀번호를 모두 정확히 입력해 주세요.',
      };
    }

    if (accounts.length === 0) {
      return {
        success: false,
        message: '아직 등록된 계정이 없습니다. 회원가입으로 첫 계정을 만들어 주세요.',
      };
    }

    const normalizedName = normalizeAccountName(trimmedName);
    const matchedAccount = accounts.find(
      (account) =>
        normalizeAccountName(account.name) === normalizedName &&
        account.age === parsedAge &&
        account.gender === gender
    );

    if (!matchedAccount) {
      return {
        success: false,
        message: '입력한 이름, 나이, 성별과 일치하는 계정을 찾지 못했습니다.',
      };
    }

    if (matchedAccount.password !== trimmedPassword) {
      return {
        success: false,
        message: '비밀번호가 일치하지 않습니다.',
      };
    }

    await persistSession(matchedAccount.id, keepSignedIn);
    setCurrentUser(toAuthUser(matchedAccount));
    setAuthMode('login');

    return {
      success: true,
      message: '로그인되었습니다.',
    };
  }

  async function signup({ name, age, gender, password, keepSignedIn }: AuthFormValues): Promise<AuthActionResult> {
    const trimmedName = name.trim();
    const trimmedPassword = password.trim();
    const parsedAge = parseAgeInput(age);

    if (!trimmedName || parsedAge === null || !trimmedPassword) {
      return {
        success: false,
        message: '이름, 나이, 성별, 비밀번호를 모두 정확히 입력해 주세요.',
      };
    }

    const normalizedName = normalizeAccountName(trimmedName);
    const duplicatedAccount = accounts.find(
      (account) =>
        normalizeAccountName(account.name) === normalizedName &&
        account.age === parsedAge &&
        account.gender === gender
    );

    if (duplicatedAccount) {
      return {
        success: false,
        message: '같은 이름, 나이, 성별로 이미 만들어진 계정이 있습니다. 로그인으로 이동해 주세요.',
      };
    }

    const nextAccount: UserAccount = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: trimmedName,
      age: parsedAge,
      gender,
      password: trimmedPassword,
      createdAt: new Date().toISOString(),
    };
    const nextAccounts = [...accounts, nextAccount];

    await AsyncStorage.setItem(STORAGE_KEYS.accounts, JSON.stringify(nextAccounts));
    await persistSession(nextAccount.id, keepSignedIn);
    setAccounts(nextAccounts);
    setCurrentUser(toAuthUser(nextAccount));
    setAuthMode('login');

    return {
      success: true,
      message: '회원가입이 완료되었습니다.',
    };
  }

  async function logout() {
    if (screen === 'lesson' && (isLessonActive || isCameraActive)) {
      await endLesson(true);
    }

    await AsyncStorage.removeItem(STORAGE_KEYS.session);
    setCurrentUser(null);
    setAuthMode(accounts.length > 0 ? 'login' : 'signup');
  }

  async function navigateTo(nextScreen: AppScreen) {
    if (screen === 'lesson' && nextScreen !== 'lesson' && (isLessonActive || isCameraActive)) {
      await endLesson(true);
    }

    setScreen(nextScreen);
    if (nextScreen === 'diary' && !selectedDateKey) {
      const today = new Date();
      setSelectedDateKey(formatDateKey(today));
      setCurrentDate(today);
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

  function selectPosition(position: PositionOption) {
    setSelectedPosition(position);
  }

  function revealHomework() {
    setIsHomeworkRevealed(true);
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
            ballNearShootingHand: false,
            shootingHandRaised: false,
            readyPoseDetected: false,
            armAngleState: 'unknown',
            releaseTiming: 'unknown',
            legAngleState: 'unknown',
            summary: '',
          })
        : buildDribbleStanceFeedbackForView({
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
          }, selectedDribbleViewRef.current)
    );
    setDebugText(mode === 'shoot' ? '슛 분석 모드를 준비하는 중입니다.' : '드리블 분석 모드를 준비하는 중입니다.');
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
      setImmediateLessonFeedback(buildDribbleStanceFeedbackForView({
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
      }, selectedDribbleViewRef.current));
    } else {
      setImmediateLessonFeedback(buildShootStanceFeedback({
        armAngle: null,
        legAngle: null,
        releaseVelocity: null,
        lowestLegAngle: null,
        headPeakY: null,
        releaseDetected: false,
        ballNearShootingHand: false,
        shootingHandRaised: false,
        readyPoseDetected: false,
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

  async function beginLesson(dribbleTargetCount?: number, dribbleView?: DribbleLessonView) {
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
    if (lessonModeRef.current === 'dribble' && dribbleView) {
      selectedDribbleViewRef.current = dribbleView;
      setSelectedDribbleView(dribbleView);
    }
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
    setIsCameraReady(false);
    setRecordingStopToken(Date.now());
    setDebugText('목표 드리블 횟수에 도달했습니다. 종료 호루라기를 울리고 카메라 연결을 끄는 중입니다.');

    recordingFallbackTimeoutRef.current = setTimeout(() => {
      if (!pendingReviewStopRef.current) {
        return;
      }

      clearRecordingWait();
      pendingReviewStopRef.current = false;

      const frontWeakPoint = finalizeFrontDribbleWeakPoint();
      const finalFeedback = frontWeakPoint
        ? `${latestFeedbackRef.current}\n\n가장 보완이 필요한 기준은 ${frontWeakPoint.criterionNumber}번입니다. ${frontWeakPoint.feedbackText}`
        : latestFeedbackRef.current;
      const completedDribbleHomework = recordDailyDribbleProgress(dribbleTargetCountRef.current ?? 0);
      const completedFeedback = completedDribbleHomework
        ? `${finalFeedback}\n\n${getHomeworkCompletionMessage('dribble')}`
        : finalFeedback;

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
      latestFeedbackRef.current = completedFeedback;
      setFeedbackText(completedFeedback);
      setLessonReview(null);
      setIsLessonActive(false);
      setIsCameraActive(false);
      setIsCameraReady(false);
      setCameraError('');
      setDebugText('목표 드리블 횟수를 모두 채워 레슨이 자동으로 종료되었습니다.');
      if (completedDribbleHomework) {
        celebrateHomeworkCompletion();
      }
    }, 4000);
  }, [
    celebrateHomeworkCompletion,
    clearRecordingWait,
    clearShootAutoEnd,
    finalizeFrontDribbleWeakPoint,
    recordDailyDribbleProgress,
    resetShootAnalysisTracking,
  ]);

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
      const finalFeedback = frontWeakPoint
        ? `${reviewClip.feedback}\n\n가장 보완이 필요한 기준은 ${frontWeakPoint.criterionNumber}번입니다. ${frontWeakPoint.feedbackText}`
        : reviewClip.feedback;
      const finalReviewClip = {
        ...reviewClip,
        feedback: finalFeedback,
      };

      const completedDribbleHomework = recordDailyDribbleProgress(dribbleTargetCountRef.current ?? 0);
      saveLessonRecord(videoUri, finalReviewClip);

      const completedFeedback = completedDribbleHomework
        ? `${finalFeedback}\n\n${getHomeworkCompletionMessage('dribble')}`
        : finalFeedback;

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
      latestFeedbackRef.current = completedFeedback;
      setFeedbackText(completedFeedback);
      setLessonReview(finalReviewClip);
      setIsLessonActive(false);
      setIsCameraActive(false);
      setIsCameraReady(false);
      setCameraError('');
      setDebugText('목표 드리블 횟수를 모두 채워 레슨이 자동으로 종료되었습니다.');
      if (completedDribbleHomework) {
        celebrateHomeworkCompletion();
      }
    },
    [
      celebrateHomeworkCompletion,
      clearRecordingWait,
      finalizeFrontDribbleWeakPoint,
      recordDailyDribbleProgress,
      resetShootAnalysisTracking,
      saveLessonRecord,
    ]
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

      const completedShootHomework = recordDailyShootAttempt();
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
      const completionText = completedShootHomework ? `\n\n${getHomeworkCompletionMessage('shoot')}` : '';
      shootFeedbackLockedRef.current = true;
      setImmediateLessonFeedback(`${finalFeedback}${completionText}`);
      setDebugText('슛 촬영 분석이 끝났습니다. 결과 피드백을 유지합니다.');
      if (completedShootHomework) {
        celebrateHomeworkCompletion();
      }
    },
    [
      celebrateHomeworkCompletion,
      clearRecordingWait,
      recordDailyShootAttempt,
      resetShootAnalysisTracking,
      saveLessonRecord,
      setImmediateLessonFeedback,
    ]
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
      const targetView = selectedDribbleViewRef.current;
      const stanceReady = isDribbleStanceReadyForView(analysis, targetView);

      if (phase === 'active') {
        const effectiveAnalysis =
          targetView === 'front' && analysis.bodyFacing === 'front'
            ? {
                ...analysis,
                dribbleStarted: true,
              }
            : analysis;

        stanceCountdownStartedAtRef.current = null;
        setCountdownValue(null);
        setCurrentDribbleCount(effectiveAnalysis.dribbleCount);
        updateFrontDribbleWeakPoint(effectiveAnalysis);
        const nextFeedback = buildDribbleFeedbackText(effectiveAnalysis);
        pendingFeedbackRef.current = nextFeedback;
        const targetCount = dribbleTargetCountRef.current;
        if (targetCount && effectiveAnalysis.dribbleCount >= targetCount && !dribbleAutoEndingRef.current) {
          dribbleAutoEndingRef.current = true;
          playStartCue();
          setImmediateLessonFeedback(nextFeedback);
          setDebugText(`목표 드리블 ${targetCount}회에 도달해 레슨을 마무리합니다.`);
          finishDribbleRecordingForReview();
          return;
        }
        setDebugText(`드리블 분석 중: ${effectiveAnalysis.summary}`);
        return;
      }

      if (phase === 'await_dribble' && analysis.dribbleStarted) {
        dribbleLessonPhaseRef.current = 'active';
        stanceCountdownStartedAtRef.current = null;
        setCountdownValue(null);
        setCurrentDribbleCount(analysis.dribbleCount);
        pendingFeedbackRef.current = buildDribbleFeedbackText(analysis);
        setDebugText(`드리블 시작 감지: ${analysis.summary}`);
        return;
      }

      if (!stanceReady) {
        dribbleLessonPhaseRef.current = 'stance_setup';
        stanceCountdownStartedAtRef.current = null;
        setCountdownValue(null);
        pendingFeedbackRef.current = buildDribbleStanceFeedbackForView(analysis, targetView);
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
          startDribbleLessonFromCountdown(analysis.bodyFacing === 'front');
          return;
        }

        const remainingSeconds = Math.max(1, Math.ceil((DRIBBLE_STANCE_HOLD_MS - elapsed) / 1000));
        pendingFeedbackRef.current =
          targetView === 'front'
            ? `정면 드리블 준비 자세를 유지해 주세요.
1. 발-무릎-엉덩이 각도를 140~170도로 유지해 주세요.
2. ${remainingSeconds}초 동안 자세를 유지하면 녹화와 드리블 카운트가 시작됩니다.
3. 공과 하체가 함께 잘 보이도록 서 주세요.`
            : `옆모습 드리블 준비 자세를 유지해 주세요.
1. 상체 기울기를 40~80도로 유지해 주세요.
2. ${remainingSeconds}초 동안 자세를 유지하면 드리블을 시작합니다.
3. 공과 상체가 함께 잘 보이도록 서 주세요.`;
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

      if (shootFeedbackLockedRef.current) {
        if (!stanceReady) {
          setDebugText('이전 슛 피드백을 유지하는 중입니다. 다시 준비 자세가 맞으면 다음 슛을 시작합니다.');
          return;
        }

        shootFeedbackLockedRef.current = false;
      }

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
            clearRecordingWait();
            pendingReviewStopRef.current = false;
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
            setIsLessonActive(false);
            setIsCameraActive(false);
            setIsCameraReady(false);
            setCameraError('');
            latestFeedbackRef.current = `${latestFeedbackRef.current}\n\n영상 저장에는 실패했지만 목표 드리블 횟수를 채워 레슨은 종료되었습니다.`;
            setFeedbackText(latestFeedbackRef.current);
            setDebugText('목표 드리블 횟수를 모두 채워 레슨이 종료되었습니다. 카메라 연결도 꺼졌습니다.');
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
    [
      applyDribbleAnalysis,
      applyShootAnalysisWithStance,
      clearRecordingWait,
      completeDribbleReview,
      completeShootReview,
      finalizeLessonSession,
      isCameraActive,
      isLessonActive,
      resetShootAnalysisTracking,
      setImmediateLessonFeedback,
    ]
  );

  function openDiaryDate(dateKey: string) {
    setSelectedDateKey(dateKey);
    setCurrentDate(parseDateKeyToDate(dateKey));
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

    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(selectedSkill.query)}`;
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
    isReady,
    authMode,
    currentUser,
    screen,
    lessonMode,
    homeworkToShow,
    currentDate,
    selectedDateKey,
    selectedDateRecords,
    selectedDateShotCount,
    shotGraphData,
    calendarCells,
    selectedSkillKey,
    selectedBallBrand,
    selectedBallColors,
    selectedPosition,
    selectedDribbleView,
    isHomeworkRevealed,
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
    changeAuthMode,
    login,
    signup,
    logout,
    navigateTo,
    changeLessonMode,
    beginLesson,
    endLesson,
    handlePoseMessage,
    registerSuccessfulShot,
    selectSkill,
    selectBallBrand,
    toggleBallColor,
    selectPosition,
    setSelectedDribbleView,
    revealHomework,
    openSkillVideo,
    openDiaryDate,
    changeMonth,
    deleteLessonRecord,
  };
}
