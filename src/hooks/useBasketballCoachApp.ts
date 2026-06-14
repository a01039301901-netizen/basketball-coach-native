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
  CorrectionHomeworkState,
  DailyHomeworkState,
  DribbleAnalysis,
  DribbleLessonView,
  FeedbackMoment,
  FireworkItem,
  HomeworkFeedbackCategory,
  HomeworkProgressItem,
  HomeworkStateRecord,
  HomeworkTestState,
  LessonMode,
  LessonRecord,
  LessonReviewClip,
  PositionOption,
  ShotGraphDatum,
  SkillVideoOpenEvent,
  ShootAnalysis,
  SkillKey,
  UserAccount,
} from '../types/app';
import { getCalendarCells } from '../utils/calendar';
import { formatDateKey } from '../utils/date';
import { buildDribbleFeedbackText, buildShootFeedbackText } from '../utils/feedback';
import {
  buildCorrectionHomeworkState,
  buildDailyHomeworkProgress,
  buildStage2UnlockSnapshot,
  createEmptyDailyHomeworkState,
  DAILY_DRIBBLE_TARGET,
  DAILY_SHOOT_TARGET,
  getDailyHomeworkState,
  getHomeworkCompletionMessage,
  getRepresentativeHomeworkFeedbackCategory,
  isDailyBaseHomeworkCompleted,
} from '../utils/homework';

const FEEDBACK_UPDATE_INTERVAL_MS = 1500;
const DRIBBLE_STANCE_HOLD_MS = 3000;
const SHOOT_RECOVERY_MS = 3000;
const STORAGE_LOAD_TIMEOUT_MS = 4000;
const STARTUP_RECOVERY_TIMEOUT_MS = 8000;
const DEFAULT_DEBUG_TEXT = '카메라와 MediaPipe를 준비하고 있습니다.';
const COUNTDOWN_CUE_BASE64 =
  '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';

type DribbleLessonPhase = 'stance_setup' | 'countdown' | 'await_dribble' | 'active' | 'cooldown';
type FrontDribbleCriterionNumber = 1 | 2 | 3 | 4;

interface FrontDribbleWeakPoint {
  criterionNumber: FrontDribbleCriterionNumber;
  feedbackText: string;
  count: number;
}

interface AuthFormValues {
  nickname: string;
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

interface TransferCodeResult {
  success: boolean;
  message: string;
  code?: string;
}

interface AccountTransferPayload {
  version: 1;
  exportedAt: string;
  account: UserAccount;
  data: {
    attendance: Record<string, string>;
    lessonRecords: LessonRecord[];
    dribbleCounts: Record<string, number>;
    shotAttempts: Record<string, number>;
    shotSuccess: Record<string, number>;
    ballColors: BallColorOption[];
    ballBrand: BallBrandOption;
    position: PositionOption;
    homework: HomeworkStateRecord;
  };
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

function normalizeNickname(nickname: string) {
  return nickname.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

function buildUniqueNickname(baseNickname: string, usedNicknames: Set<string>, fallbackSeed: string) {
  const trimmedBase = baseNickname.trim().replace(/\s+/g, ' ');
  const fallbackBase = trimmedBase || `user-${fallbackSeed.slice(-4)}`;
  let candidate = fallbackBase;
  let suffix = 1;

  while (usedNicknames.has(normalizeNickname(candidate))) {
    suffix += 1;
    candidate = `${fallbackBase}-${suffix}`;
  }

  usedNicknames.add(normalizeNickname(candidate));
  return candidate;
}

function buildAccountStorageKey(baseKey: string, userId: string) {
  return `${baseKey}:${userId}`;
}

function getAccountStorageKeys(userId: string) {
  return {
    attendance: buildAccountStorageKey(STORAGE_KEYS.attendance, userId),
    homework: buildAccountStorageKey(STORAGE_KEYS.homework, userId),
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
    nickname: account.nickname,
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

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallbackValue: T): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timeoutHandle = setTimeout(() => resolve(fallbackValue), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

function isRecordObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isAccountGender(value: unknown): value is AccountGender {
  return value === 'male' || value === 'female';
}

function sanitizeStoredAccounts(value: unknown): UserAccount[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const usedNicknames = new Set<string>();

  return value
    .map((entry, index) => {
      if (!isRecordObject(entry)) {
        return null;
      }

      if (
        typeof entry.id !== 'string' ||
        typeof entry.name !== 'string' ||
        typeof entry.age !== 'number' ||
        !Number.isFinite(entry.age) ||
        !isAccountGender(entry.gender) ||
        typeof entry.password !== 'string' ||
        typeof entry.createdAt !== 'string'
      ) {
        return null;
      }

      const fallbackSeed = entry.id || String(index + 1);
      const rawNickname = typeof entry.nickname === 'string' ? entry.nickname : entry.name;
      const nickname = buildUniqueNickname(rawNickname, usedNicknames, fallbackSeed);

      return {
        id: entry.id,
        nickname,
        name: entry.name.trim(),
        age: Math.trunc(entry.age),
        gender: entry.gender,
        password: entry.password,
        createdAt: entry.createdAt,
      };
    })
    .filter((account): account is UserAccount => Boolean(account));
}

function isBallBrandOption(value: unknown): value is BallBrandOption {
  return value === 'wilson' || value === 'spalding' || value === 'molten';
}

function isPositionOption(value: unknown): value is PositionOption {
  return value === 'none' || value === 'defense' || value === 'offense';
}

function isBallColorOption(value: unknown): value is BallColorOption {
  return value === 'orange' || value === 'brown' || value === 'yellow' || value === 'white' || value === 'black' || value === 'gray' || value === 'red';
}

function isSkillKey(value: unknown): value is SkillKey {
  return value === 'shoot' || value === 'crossover' || value === 'layup' || value === 'stepback' || value === 'spin' || value === 'defense';
}

function isHomeworkFeedbackCategory(value: unknown): value is HomeworkFeedbackCategory {
  return (
    value === 'dribble_balance' ||
    value === 'torso_posture' ||
    value === 'shoot_arm_angle' ||
    value === 'shoot_release_timing' ||
    value === 'leg_angle'
  );
}

function sanitizeStringRecord(value: unknown): Record<string, string> {
  if (!isRecordObject(value)) {
    return {};
  }

  const next: Record<string, string> = {};

  for (const [key, entryValue] of Object.entries(value)) {
    if (typeof entryValue === 'string') {
      next[key] = entryValue;
    }
  }

  return next;
}

function sanitizeNumberRecord(value: unknown): Record<string, number> {
  if (!isRecordObject(value)) {
    return {};
  }

  const next: Record<string, number> = {};

  for (const [key, entryValue] of Object.entries(value)) {
    if (typeof entryValue === 'number' && Number.isFinite(entryValue)) {
      next[key] = entryValue;
    }
  }

  return next;
}

function sanitizeSkillVideoEvents(value: unknown): SkillVideoOpenEvent[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!isRecordObject(entry) || !isSkillKey(entry.skillKey) || typeof entry.openedAt !== 'string') {
        return null;
      }

      return {
        skillKey: entry.skillKey,
        openedAt: entry.openedAt,
      } satisfies SkillVideoOpenEvent;
    })
    .filter((event): event is SkillVideoOpenEvent => Boolean(event));
}

function sanitizeDailyHomeworkState(value: unknown): DailyHomeworkState {
  if (!isRecordObject(value)) {
    return createEmptyDailyHomeworkState();
  }

  const baseState = createEmptyDailyHomeworkState();
  const stage2Unlock = isRecordObject(value.stage2Unlock)
    && typeof value.stage2Unlock.unlockedAt === 'string'
    && isPositionOption(value.stage2Unlock.position)
    && typeof value.stage2Unlock.dribbleCount === 'number'
    && Number.isFinite(value.stage2Unlock.dribbleCount)
    && typeof value.stage2Unlock.shootAttemptCount === 'number'
    && Number.isFinite(value.stage2Unlock.shootAttemptCount)
    && typeof value.stage2Unlock.shotSuccessCount === 'number'
    && Number.isFinite(value.stage2Unlock.shotSuccessCount)
    && typeof value.stage2Unlock.lessonCount === 'number'
    && Number.isFinite(value.stage2Unlock.lessonCount)
      ? {
          unlockedAt: value.stage2Unlock.unlockedAt,
          position: value.stage2Unlock.position,
          dribbleCount: Math.max(0, value.stage2Unlock.dribbleCount),
          shootAttemptCount: Math.max(0, value.stage2Unlock.shootAttemptCount),
          shotSuccessCount: Math.max(0, value.stage2Unlock.shotSuccessCount),
          lessonCount: Math.max(0, value.stage2Unlock.lessonCount),
        }
      : null;
  const handTotals = isRecordObject(value.handDribbleTotals)
    ? {
        left:
          typeof value.handDribbleTotals.left === 'number' && Number.isFinite(value.handDribbleTotals.left)
            ? Math.max(0, value.handDribbleTotals.left)
            : 0,
        right:
          typeof value.handDribbleTotals.right === 'number' && Number.isFinite(value.handDribbleTotals.right)
            ? Math.max(0, value.handDribbleTotals.right)
            : 0,
      }
    : baseState.handDribbleTotals;
  const correctionTask = isRecordObject(value.correctionTask)
    && (value.correctionTask.direction === 'left' || value.correctionTask.direction === 'right')
    && typeof value.correctionTask.baselineCount === 'number'
    && Number.isFinite(value.correctionTask.baselineCount)
    && typeof value.correctionTask.createdAt === 'string'
      ? {
          direction: value.correctionTask.direction === 'left' ? 'left' : 'right',
          baselineCount: Math.max(0, value.correctionTask.baselineCount),
          createdAt: value.correctionTask.createdAt,
        } satisfies CorrectionHomeworkState
      : null;

  return {
    stage2Unlock,
    skillVideoEvents: sanitizeSkillVideoEvents(value.skillVideoEvents),
    handDribbleTotals: handTotals,
    correctionTask,
  };
}

function sanitizeHomeworkStateRecord(value: unknown): HomeworkStateRecord {
  if (!isRecordObject(value)) {
    return {};
  }

  const next: HomeworkStateRecord = {};

  for (const [dateKey, entryValue] of Object.entries(value)) {
    next[dateKey] = sanitizeDailyHomeworkState(entryValue);
  }

  return next;
}

function sanitizeLessonRecords(value: unknown): LessonRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!isRecordObject(entry)) {
        return null;
      }

      const id = typeof entry.id === 'string' ? entry.id : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const dateKey = typeof entry.dateKey === 'string' ? entry.dateKey : formatDateKey(new Date());
      const mode = entry.mode === 'shoot' ? 'shoot' : 'dribble';
      const feedback = typeof entry.feedback === 'string' ? entry.feedback : '';
      const createdAt = typeof entry.createdAt === 'string' ? entry.createdAt : new Date().toISOString();
      const reviewFeedback = typeof entry.reviewFeedback === 'string' ? entry.reviewFeedback : undefined;
      const reviewStartAtMs =
        typeof entry.reviewStartAtMs === 'number' && Number.isFinite(entry.reviewStartAtMs) ? entry.reviewStartAtMs : undefined;
      const reviewDurationMs =
        typeof entry.reviewDurationMs === 'number' && Number.isFinite(entry.reviewDurationMs) ? entry.reviewDurationMs : undefined;
      const dribbleView = entry.dribbleView === 'side' ? 'side' : entry.dribbleView === 'front' ? 'front' : undefined;
      const leftHandDribbleCount =
        typeof entry.leftHandDribbleCount === 'number' && Number.isFinite(entry.leftHandDribbleCount)
          ? Math.max(0, entry.leftHandDribbleCount)
          : undefined;
      const rightHandDribbleCount =
        typeof entry.rightHandDribbleCount === 'number' && Number.isFinite(entry.rightHandDribbleCount)
          ? Math.max(0, entry.rightHandDribbleCount)
          : undefined;
      const representativeFeedbackCategory = isHomeworkFeedbackCategory(entry.representativeFeedbackCategory)
        ? entry.representativeFeedbackCategory
        : undefined;

      const nextRecord: LessonRecord = normalizeLessonRecord({
        id,
        dateKey,
        mode,
        feedback,
        feedbackTimeline: Array.isArray(entry.feedbackTimeline)
          ? (entry.feedbackTimeline as FeedbackMoment[] | string[])
          : undefined,
        videoUri: '',
        createdAt,
        reviewFeedback,
        reviewStartAtMs,
        reviewDurationMs,
        dribbleView,
        leftHandDribbleCount,
        rightHandDribbleCount,
        representativeFeedbackCategory,
      });

      return nextRecord;
    })
    .filter((record): record is LessonRecord => Boolean(record));
}

function sanitizeTransferPayload(value: unknown): AccountTransferPayload | null {
  if (!isRecordObject(value) || value.version !== 1) {
    return null;
  }

  const accountValue = value.account;
  const dataValue = value.data;

  if (!isRecordObject(accountValue) || !isRecordObject(dataValue)) {
    return null;
  }

  if (
    typeof accountValue.id !== 'string' ||
    (typeof accountValue.nickname !== 'string' && typeof accountValue.name !== 'string') ||
    typeof accountValue.name !== 'string' ||
    typeof accountValue.age !== 'number' ||
    !Number.isFinite(accountValue.age) ||
    !isAccountGender(accountValue.gender) ||
    typeof accountValue.password !== 'string' ||
    typeof accountValue.createdAt !== 'string'
  ) {
    return null;
  }

  const ballBrand = isBallBrandOption(dataValue.ballBrand) ? dataValue.ballBrand : DEFAULT_BALL_BRAND;
  const ballColors = Array.isArray(dataValue.ballColors)
    ? dataValue.ballColors.filter(isBallColorOption)
    : DEFAULT_BALL_COLORS;
  const position = isPositionOption(dataValue.position) ? dataValue.position : DEFAULT_POSITION;

  return {
    version: 1,
    exportedAt: typeof value.exportedAt === 'string' ? value.exportedAt : new Date().toISOString(),
    account: {
      id: accountValue.id,
      nickname: typeof accountValue.nickname === 'string' ? accountValue.nickname : accountValue.name,
      name: accountValue.name,
      age: Math.trunc(accountValue.age),
      gender: accountValue.gender,
      password: accountValue.password,
      createdAt: accountValue.createdAt,
    },
    data: {
      attendance: sanitizeStringRecord(dataValue.attendance),
      lessonRecords: sanitizeLessonRecords(dataValue.lessonRecords),
      dribbleCounts: sanitizeNumberRecord(dataValue.dribbleCounts),
      shotAttempts: sanitizeNumberRecord(dataValue.shotAttempts),
      shotSuccess: sanitizeNumberRecord(dataValue.shotSuccess),
      ballColors: ballColors.length > 0 ? ballColors : DEFAULT_BALL_COLORS,
      ballBrand,
      position,
      homework: sanitizeHomeworkStateRecord(dataValue.homework),
    },
  };
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

function normalizeLessonRecord(
  record: LessonRecord | (Omit<LessonRecord, 'feedbackTimeline'> & { feedbackTimeline?: FeedbackMoment[] | string[] })
): LessonRecord {
  const normalizedFeedbackTimeline = normalizeFeedbackTimeline(record.feedbackTimeline, record.feedback);
  const nextRecord = {
    ...record,
    feedbackTimeline: normalizedFeedbackTimeline,
  } as LessonRecord;
  const representativeFeedbackCategory =
    nextRecord.representativeFeedbackCategory ?? getRepresentativeHomeworkFeedbackCategory(nextRecord) ?? undefined;

  if (!representativeFeedbackCategory) {
    return nextRecord;
  }

  return {
    ...nextRecord,
    representativeFeedbackCategory,
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
  const armLine =
    analysis.armAngleState === 'balanced'
      ? '슛을 시작하기 좋은 팔 각도입니다. 지금 자세를 유지해 주세요.'
      : analysis.armAngleState === 'narrow'
        ? '준비 자세에서 팔 각도가 좁습니다. 팔을 조금 더 벌려 주세요.'
        : analysis.armAngleState === 'wide'
          ? '준비 자세에서 팔 각도가 넓습니다. 팔을 조금 더 모아 주세요.'
          : '어깨, 팔꿈치, 손목이 잘 보이도록 서서 준비 자세를 다시 맞춰 주세요.';

  return `슛 준비 자세\n1. ${armLine}\n2. 팔 각도가 기준에 맞으면 3초 카운트를 시작하고, 끝나면 슛 레슨을 시작합니다.\n3. 준비 자세가 무너지면 다시 자세부터 맞춥니다.`;
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
  const [homeworkState, setHomeworkState] = useState<HomeworkStateRecord>({});
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
  const [isCameraPreviewHidden, setIsCameraPreviewHidden] = useState(false);
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
  const [startupStatusText, setStartupStatusText] = useState('앱을 준비하고 있습니다.');
  const [isShootSuccessButtonVisible, setIsShootSuccessButtonVisible] = useState(false);

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
  const countdownCueSoundRef = useRef<Audio.Sound | null>(null);
  const countdownCueUriRef = useRef<string | null>(null);
  const lastCountdownCueValueRef = useRef<number | null>(null);
  const webStartCueContextRef = useRef<any>(null);
  const latestDribbleAnalysisRef = useRef<DribbleAnalysis | null>(null);
  const latestShootAnalysisRef = useRef<ShootAnalysis | null>(null);
  const dailyDribbleRecordsRef = useRef<Record<string, number>>({});
  const homeworkStateRef = useRef<HomeworkStateRecord>({});
  const shotAttemptRecordsRef = useRef<Record<string, number>>({});
  const shootAnalysisHistoryRef = useRef<ShootAnalysis[]>([]);
  const shootFeedbackLockedRef = useRef(false);
  const frontDribbleCriterionCountsRef = useRef<Record<FrontDribbleCriterionNumber, number>>(createFrontDribbleCriterionCounter());
  const frontDribbleWeakPointRef = useRef<FrontDribbleWeakPoint | null>(null);
  const frontDribbleSummaryShownRef = useRef(false);
  const shotSuccessRecordsRef = useRef<Record<string, number>>({});
  const shootSuccessRecordedForCurrentAttemptRef = useRef(false);
  const startupRecoveryTriggeredRef = useRef(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const currentUserId = currentUser?.id ?? '';
  const isReady = isAuthReady && (!currentUser || isAccountDataReady);
  const selectedSkill = selectedSkillKey ? SKILLS[selectedSkillKey] : null;
  const todayKey = formatDateKey(new Date());
  const todayDribbleCount = dailyDribbleRecords[todayKey] || 0;
  const todayShootAttemptCount = shotAttemptRecords[todayKey] || 0;
  const todayShotSuccessCount = shotSuccessRecords[todayKey] || 0;
  const todayHomeworkState = useMemo(() => getDailyHomeworkState(homeworkState, todayKey), [homeworkState, todayKey]);
  const todayLessonCount = useMemo(
    () => lessonRecords.filter((record) => record.dateKey === todayKey).length,
    [lessonRecords, todayKey]
  );
  const homeworkTestState = useMemo<HomeworkTestState>(() => {
    const correctionTask = todayHomeworkState.correctionTask;
    const correctionDirection = correctionTask?.direction ?? 'none';
    const correctionProgress =
      correctionTask?.direction === 'left'
        ? Math.max(0, todayHomeworkState.handDribbleTotals.left - correctionTask.baselineCount)
        : correctionTask?.direction === 'right'
          ? Math.max(0, todayHomeworkState.handDribbleTotals.right - correctionTask.baselineCount)
          : 0;

    return {
      dribbleCount: todayDribbleCount,
      shootAttemptCount: todayShootAttemptCount,
      shotSuccessCount: todayShotSuccessCount,
      skillVideoOpenCount: todayHomeworkState.skillVideoEvents.length,
      leftHandTotal: todayHomeworkState.handDribbleTotals.left,
      rightHandTotal: todayHomeworkState.handDribbleTotals.right,
      isStage2Unlocked: Boolean(todayHomeworkState.stage2Unlock),
      correctionDirection,
      correctionProgress,
    };
  }, [todayDribbleCount, todayHomeworkState, todayShootAttemptCount, todayShotSuccessCount]);
  const homeworkToShow = useMemo<HomeworkProgressItem[]>(
    () =>
      buildDailyHomeworkProgress({
        dateKey: todayKey,
        dailyDribbleCount: todayDribbleCount,
        shootAttemptCount: todayShootAttemptCount,
        shotSuccessCount: todayShotSuccessCount,
        lessonRecords,
        dailyState: todayHomeworkState,
      }),
    [
      lessonRecords,
      todayDribbleCount,
      todayHomeworkState,
      todayKey,
      todayShootAttemptCount,
      todayShotSuccessCount,
    ]
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
    setHomeworkState({});
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
    setStartupStatusText('앱을 준비하고 있습니다.');
    setIsShootSuccessButtonVisible(false);

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
    homeworkStateRef.current = {};
    shotAttemptRecordsRef.current = {};
    shotSuccessRecordsRef.current = {};
    shootSuccessRecordedForCurrentAttemptRef.current = false;
    shootAnalysisHistoryRef.current = [];
    shootFeedbackLockedRef.current = false;
    frontDribbleCriterionCountsRef.current = createFrontDribbleCriterionCounter();
    frontDribbleWeakPointRef.current = null;
    frontDribbleSummaryShownRef.current = false;
    lastCountdownCueValueRef.current = null;
  }, []);

  const persistSession = useCallback(async (userId: string, keepSignedIn: boolean) => {
    if (keepSignedIn) {
      const nextSession: AuthSession = { userId };
      await AsyncStorage.setItem(STORAGE_KEYS.session, JSON.stringify(nextSession));
      return;
    }

    await AsyncStorage.removeItem(STORAGE_KEYS.session);
  }, []);

  const recoverStartupToLogin = useCallback(async () => {
    startupRecoveryTriggeredRef.current = true;

    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.session);
    } catch {
      // Ignore session cleanup failures and continue to the login screen.
    }

    resetAccountState();
    setCurrentUser(null);
    setIsAuthReady(true);
    setIsAccountDataReady(false);
    setAuthMode(accounts.length > 0 ? 'login' : 'signup');
    setStartupStatusText('로그인 화면을 준비하고 있습니다.');
  }, [accounts.length, resetAccountState]);

  useEffect(() => {
    latestFeedbackRef.current = feedbackText;
  }, [feedbackText]);

  useEffect(() => {
    dailyDribbleRecordsRef.current = dailyDribbleRecords;
  }, [dailyDribbleRecords]);

  useEffect(() => {
    homeworkStateRef.current = homeworkState;
  }, [homeworkState]);

  useEffect(() => {
    shotAttemptRecordsRef.current = shotAttemptRecords;
  }, [shotAttemptRecords]);

  useEffect(() => {
    shotSuccessRecordsRef.current = shotSuccessRecords;
  }, [shotSuccessRecords]);

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
        if (isMounted) {
          setStartupStatusText('로그인 정보를 확인하고 있습니다.');
        }
        const entries = await withTimeout(
          AsyncStorage.multiGet([STORAGE_KEYS.accounts, STORAGE_KEYS.session]),
          STORAGE_LOAD_TIMEOUT_MS,
          [
            [STORAGE_KEYS.accounts, null],
            [STORAGE_KEYS.session, null],
          ] as [string, string | null][]
        );
        const stored = Object.fromEntries(entries);
        const parsedAccounts = sanitizeStoredAccounts(parseStoredJson<unknown[]>(stored[STORAGE_KEYS.accounts], []));
        const parsedSession = parseStoredJson<AuthSession | null>(stored[STORAGE_KEYS.session], null);

        if (!isMounted) {
          return;
        }

        setAccounts(parsedAccounts);
        setAuthMode(parsedAccounts.length > 0 ? 'login' : 'signup');

        if (startupRecoveryTriggeredRef.current) {
          setStartupStatusText('로그인 화면을 준비하고 있습니다.');
          return;
        }

        setStartupStatusText(parsedSession?.userId ? '저장된 계정을 불러오고 있습니다.' : '로그인 화면을 준비하고 있습니다.');
        await AsyncStorage.setItem(STORAGE_KEYS.accounts, JSON.stringify(parsedAccounts));

        if (parsedSession?.userId) {
          const sessionAccount = parsedAccounts.find((account) => account.id === parsedSession.userId);

          if (sessionAccount) {
            setCurrentUser(toAuthUser(sessionAccount));
          } else {
            await AsyncStorage.removeItem(STORAGE_KEYS.session);
          }
        }
      } catch {
        if (isMounted) {
          setStartupStatusText('로그인 정보를 읽지 못해 로그인 화면으로 이동합니다.');
        }
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
      setStartupStatusText('로그인 화면을 준비하고 있습니다.');
      return () => {
        isMounted = false;
      };
    }

    setIsAccountDataReady(false);
    resetAccountState();

    async function loadAccountData() {
      try {
        if (isMounted) {
          setStartupStatusText('계정 데이터를 불러오고 있습니다.');
        }
        const scopedKeys = getAccountStorageKeys(currentUserId);
        const entries = await withTimeout(
          AsyncStorage.multiGet([
            scopedKeys.attendance,
            scopedKeys.homework,
            scopedKeys.lessonRecords,
            scopedKeys.dribbleCounts,
            scopedKeys.shotAttempts,
            scopedKeys.shotSuccess,
            scopedKeys.ballColors,
            scopedKeys.ballBrand,
            scopedKeys.position,
          ]),
          STORAGE_LOAD_TIMEOUT_MS,
          [
            [scopedKeys.attendance, null],
            [scopedKeys.homework, null],
            [scopedKeys.lessonRecords, null],
            [scopedKeys.dribbleCounts, null],
            [scopedKeys.shotAttempts, null],
            [scopedKeys.shotSuccess, null],
            [scopedKeys.ballColors, null],
            [scopedKeys.ballBrand, null],
            [scopedKeys.position, null],
          ] as [string, string | null][]
        );

        if (!isMounted) {
          return;
        }

        const stored = Object.fromEntries(entries);
        const parsedAttendance = parseStoredJson<Record<string, string>>(stored[scopedKeys.attendance], {});
        const parsedHomework = sanitizeHomeworkStateRecord(parseStoredJson<unknown>(stored[scopedKeys.homework], {}));
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
        setHomeworkState(parsedHomework);
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
          setStartupStatusText('계정 데이터를 읽지 못해 기본 화면으로 이동합니다.');
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
    if (isReady) {
      startupRecoveryTriggeredRef.current = false;
      setStartupStatusText('');
      return;
    }

    const timeout = setTimeout(() => {
      if (startupRecoveryTriggeredRef.current) {
        return;
      }

      startupRecoveryTriggeredRef.current = true;
      setStartupStatusText('시작이 오래 걸려 저장된 로그인 상태를 초기화하고 있습니다.');
      void recoverStartupToLogin();
    }, STARTUP_RECOVERY_TIMEOUT_MS);

    return () => {
      clearTimeout(timeout);
    };
  }, [isReady, recoverStartupToLogin]);

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

    void AsyncStorage.setItem(getAccountStorageKeys(currentUserId).homework, JSON.stringify(homeworkState));
  }, [currentUserId, homeworkState, isAccountDataReady]);

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
      void unloadCountdownCue();
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

  const updateHomeworkStateForDate = useCallback(
    (dateKey: string, updater: (current: DailyHomeworkState) => DailyHomeworkState) => {
      setHomeworkState((current) => {
        const currentDailyState = getDailyHomeworkState(current, dateKey);
        const nextDailyState = updater(currentDailyState);
        const nextState = {
          ...current,
          [dateKey]: nextDailyState,
        };

        homeworkStateRef.current = nextState;
        return nextState;
      });
    },
    []
  );

  useEffect(() => {
    if (!currentUserId || !isAccountDataReady) {
      return;
    }

    if (!isDailyBaseHomeworkCompleted(todayDribbleCount, todayShootAttemptCount) || todayHomeworkState.stage2Unlock) {
      return;
    }

    setHomeworkState((current) => {
      const currentDailyState = getDailyHomeworkState(current, todayKey);

      if (currentDailyState.stage2Unlock) {
        return current;
      }

      const nextState = {
        ...current,
        [todayKey]: {
          ...currentDailyState,
          stage2Unlock: buildStage2UnlockSnapshot(
            selectedPosition,
            todayDribbleCount,
            todayShootAttemptCount,
            todayShotSuccessCount,
            todayLessonCount
          ),
        },
      };

      homeworkStateRef.current = nextState;
      return nextState;
    });
  }, [
    currentUserId,
    isAccountDataReady,
    todayDribbleCount,
    todayHomeworkState.stage2Unlock,
    todayKey,
    todayLessonCount,
    selectedPosition,
    todayShootAttemptCount,
    todayShotSuccessCount,
  ]);

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

  const ensureAudioPlaybackMode = useCallback(async () => {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
    });
  }, []);

  const ensureStartCueSound = useCallback(async () => {
    if (Platform.OS === 'web') {
      return null;
    }

    if (startCueSoundRef.current) {
      return startCueSoundRef.current;
    }

    await ensureAudioPlaybackMode();

    const { sound } = await Audio.Sound.createAsync(require('../../assets/sounds/whistle-start.wav'));
    startCueSoundRef.current = sound;
    return sound;
  }, [ensureAudioPlaybackMode]);

  const ensureCountdownCueSound = useCallback(async () => {
    if (Platform.OS === 'web') {
      return null;
    }

    if (countdownCueSoundRef.current) {
      return countdownCueSoundRef.current;
    }

    await ensureAudioPlaybackMode();

    let countdownCueUri = countdownCueUriRef.current;
    if (!countdownCueUri) {
      const cacheDirectory = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
      if (!cacheDirectory) {
        return null;
      }

      countdownCueUri = `${cacheDirectory}lesson-countdown-cue.wav`;
      countdownCueUriRef.current = countdownCueUri;

      const fileInfo = await FileSystem.getInfoAsync(countdownCueUri);
      if (!fileInfo.exists) {
        await FileSystem.writeAsStringAsync(countdownCueUri, COUNTDOWN_CUE_BASE64, {
          encoding: FileSystem.EncodingType.Base64,
        });
      }
    }

    const { sound } = await Audio.Sound.createAsync({ uri: countdownCueUri });
    countdownCueSoundRef.current = sound;
    return sound;
  }, [ensureAudioPlaybackMode]);

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

  const unloadCountdownCue = useCallback(async () => {
    const sound = countdownCueSoundRef.current;
    countdownCueSoundRef.current = null;

    if (!sound) {
      return;
    }

    try {
      await sound.unloadAsync();
    } catch {
      // Ignore unload failures during cleanup.
    }
  }, []);

  const playCountdownCue = useCallback(() => {
    void (async () => {
      try {
        if (Platform.OS === 'web') {
          const context = await ensureWebStartCueContext();

          if (context) {
            const now = context.currentTime;
            const oscillator = context.createOscillator();
            const gain = context.createGain();
            const cueDuration = 0.14;

            oscillator.type = 'triangle';
            oscillator.frequency.setValueAtTime(980, now);
            oscillator.frequency.exponentialRampToValueAtTime(760, now + cueDuration);

            gain.gain.setValueAtTime(0.0001, now);
            gain.gain.exponentialRampToValueAtTime(0.11, now + 0.015);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + cueDuration);

            oscillator.connect(gain);
            gain.connect(context.destination);

            oscillator.start(now);
            oscillator.stop(now + cueDuration);
            return;
          }
        }

        const sound = await ensureCountdownCueSound();
        if (sound) {
          await sound.replayAsync();
        }
      } catch {
        // Keep the lesson flow running even if the cue sound fails.
      }
    })();
  }, [ensureCountdownCueSound, ensureWebStartCueContext]);

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

  useEffect(() => {
    if (!isLessonActive || countdownValue === null) {
      lastCountdownCueValueRef.current = null;
      return;
    }

    if (lastCountdownCueValueRef.current === countdownValue) {
      return;
    }

    lastCountdownCueValueRef.current = countdownValue;
    playCountdownCue();
  }, [countdownValue, isLessonActive, playCountdownCue]);

  const celebrateHomeworkCompletion = useCallback(() => {
    setFireworks(createFireworks());
    setShowFireworks(true);
  }, []);

  const recordSkillVideoOpen = useCallback(
    (skillKey: SkillKey) => {
      const dateKey = formatDateKey(new Date());

      updateHomeworkStateForDate(dateKey, (current) => ({
        ...current,
        skillVideoEvents: [
          ...current.skillVideoEvents,
          {
            skillKey,
            openedAt: new Date().toISOString(),
          },
        ],
      }));
    },
    [updateHomeworkStateForDate]
  );

  const recordFrontDribbleHomeworkData = useCallback(
    (analysis: DribbleAnalysis | null) => {
      if (!analysis || analysis.bodyFacing !== 'front') {
        return;
      }

      const leftHandDribbleCount = Math.max(0, analysis.leftHandDribbleCount);
      const rightHandDribbleCount = Math.max(0, analysis.rightHandDribbleCount);

      if (leftHandDribbleCount === 0 && rightHandDribbleCount === 0) {
        return;
      }

      const dateKey = formatDateKey(new Date());

      updateHomeworkStateForDate(dateKey, (current) => {
        const nextHandDribbleTotals = {
          left: current.handDribbleTotals.left + leftHandDribbleCount,
          right: current.handDribbleTotals.right + rightHandDribbleCount,
        };

        return {
          ...current,
          handDribbleTotals: nextHandDribbleTotals,
          correctionTask: buildCorrectionHomeworkState(leftHandDribbleCount, rightHandDribbleCount, nextHandDribbleTotals),
        };
      });
    },
    [updateHomeworkStateForDate]
  );

  const applyHomeworkTestState = useCallback(
    (nextState: HomeworkTestState) => {
      const dateKey = formatDateKey(new Date());
      const safeDribbleCount = Math.max(0, Math.trunc(nextState.dribbleCount));
      const safeShootAttemptCount = Math.max(0, Math.trunc(nextState.shootAttemptCount));
      const safeShotSuccessCount = Math.max(0, Math.min(Math.trunc(nextState.shotSuccessCount), safeShootAttemptCount));
      const safeSkillVideoOpenCount = Math.max(0, Math.trunc(nextState.skillVideoOpenCount));
      const safeLeftHandTotal = Math.max(0, Math.trunc(nextState.leftHandTotal));
      const safeRightHandTotal = Math.max(0, Math.trunc(nextState.rightHandTotal));
      const safeCorrectionProgress = Math.max(0, Math.trunc(nextState.correctionProgress));
      const stage2Position = todayHomeworkState.stage2Unlock?.position ?? selectedPosition;
      const skillKeyForTest: SkillKey =
        stage2Position === 'defense' ? 'defense' : stage2Position === 'offense' ? 'shoot' : 'shoot';
      const skillVideoEvents = Array.from({ length: safeSkillVideoOpenCount }, (_, index) => ({
        skillKey: skillKeyForTest,
        openedAt: new Date(Date.now() + index).toISOString(),
      }));
      const correctionTask =
        nextState.correctionDirection === 'none'
          ? null
          : {
              direction: nextState.correctionDirection,
              baselineCount: Math.max(
                0,
                (nextState.correctionDirection === 'left' ? safeLeftHandTotal : safeRightHandTotal) - safeCorrectionProgress
              ),
              createdAt: new Date().toISOString(),
            };
      const stage2Unlock = nextState.isStage2Unlocked
        ? todayHomeworkState.stage2Unlock ??
          buildStage2UnlockSnapshot(
            stage2Position,
            safeDribbleCount,
            safeShootAttemptCount,
            safeShotSuccessCount,
            todayLessonCount
          )
        : null;

      dailyDribbleRecordsRef.current = {
        ...dailyDribbleRecordsRef.current,
        [dateKey]: safeDribbleCount,
      };
      setDailyDribbleRecords(dailyDribbleRecordsRef.current);

      shotAttemptRecordsRef.current = {
        ...shotAttemptRecordsRef.current,
        [dateKey]: safeShootAttemptCount,
      };
      setShotAttemptRecords(shotAttemptRecordsRef.current);

      shotSuccessRecordsRef.current = {
        ...shotSuccessRecordsRef.current,
        [dateKey]: safeShotSuccessCount,
      };
      setShotSuccessRecords(shotSuccessRecordsRef.current);

      updateHomeworkStateForDate(dateKey, (current) => ({
        ...current,
        stage2Unlock,
        skillVideoEvents,
        handDribbleTotals: {
          left: safeLeftHandTotal,
          right: safeRightHandTotal,
        },
        correctionTask,
      }));
    },
    [selectedPosition, todayHomeworkState.stage2Unlock, todayLessonCount, updateHomeworkStateForDate]
  );

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

  const recordSuccessfulShot = useCallback(
    (options?: { preserveFeedback?: boolean; debugMessage?: string; celebrate?: boolean }) => {
      const todayKey = formatDateKey(new Date());
      const nextCount = (shotSuccessRecordsRef.current[todayKey] || 0) + 1;
      const nextRecords = {
        ...shotSuccessRecordsRef.current,
        [todayKey]: nextCount,
      };

      shotSuccessRecordsRef.current = nextRecords;
      setShotSuccessRecords(nextRecords);
      shootSuccessRecordedForCurrentAttemptRef.current = true;

      if (!options?.preserveFeedback) {
        const nextText = `오늘 슛 성공 ${nextCount}개를 기록했습니다.`;
        setFeedbackAndRemember(nextText);
      }

      if (options?.debugMessage) {
        setDebugText(options.debugMessage);
      }

      setIsShootSuccessButtonVisible(false);

      if (options?.celebrate !== false) {
        setFireworks(createFireworks());
        setShowFireworks(true);
      }

      return nextCount;
    },
    [setFeedbackAndRemember]
  );

  const saveLessonRecord = useCallback((videoUri: string, reviewClip?: LessonReviewClip | null) => {
    const dateKey = formatDateKey(new Date());
    const mode = lessonModeRef.current;
    const latestDribbleAnalysis = latestDribbleAnalysisRef.current;
    const nextRecord = normalizeLessonRecord({
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
      dribbleView: mode === 'dribble' ? selectedDribbleViewRef.current : undefined,
      leftHandDribbleCount:
        mode === 'dribble' && selectedDribbleViewRef.current === 'front'
          ? Math.max(0, latestDribbleAnalysis?.leftHandDribbleCount ?? 0)
          : undefined,
      rightHandDribbleCount:
        mode === 'dribble' && selectedDribbleViewRef.current === 'front'
          ? Math.max(0, latestDribbleAnalysis?.rightHandDribbleCount ?? 0)
          : undefined,
      representativeFeedbackCategory: undefined,
    });

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
      setIsCameraPreviewHidden(false);
      setIsLessonActive(false);
      setIsCameraActive(false);
      setIsCameraReady(false);
      setCameraError('');
      setIsShootSuccessButtonVisible(false);
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

  async function createTransferCode(): Promise<TransferCodeResult> {
    if (!currentUserId) {
      return {
        success: false,
        message: '전송 코드를 만들려면 먼저 로그인해 주세요.',
      };
    }

    const currentAccount = accounts.find((account) => account.id === currentUserId);

    if (!currentAccount) {
      return {
        success: false,
        message: '현재 계정 정보를 찾지 못했습니다. 다시 로그인한 뒤 시도해 주세요.',
      };
    }

    const payload: AccountTransferPayload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      account: currentAccount,
      data: {
        attendance,
        lessonRecords: lessonRecords.map((record) => ({
          ...record,
          videoUri: '',
        })),
        dribbleCounts: dailyDribbleRecords,
        shotAttempts: shotAttemptRecords,
        shotSuccess: shotSuccessRecords,
        ballColors: selectedBallColors,
        ballBrand: selectedBallBrand,
        position: selectedPosition,
        homework: homeworkState,
      },
    };

    return {
      success: true,
      message: '전송 코드를 만들었습니다. 휴대폰 로그인 화면에서 붙여넣으면 계정을 가져올 수 있습니다.',
      code: JSON.stringify(payload),
    };
  }

  async function importAccountTransfer(code: string): Promise<AuthActionResult> {
    const trimmedCode = code.trim();

    if (!trimmedCode) {
      return {
        success: false,
        message: '붙여넣은 전송 코드가 비어 있습니다.',
      };
    }

    let parsedPayload: unknown;

    try {
      parsedPayload = JSON.parse(trimmedCode);
    } catch {
      return {
        success: false,
        message: '전송 코드를 읽지 못했습니다. 컴퓨터에서 만든 코드를 그대로 붙여넣어 주세요.',
      };
    }

    const payload = sanitizeTransferPayload(parsedPayload);

    if (!payload) {
      return {
        success: false,
        message: '지원하지 않는 전송 코드입니다. 최신 앱에서 다시 코드를 만들어 주세요.',
      };
    }

    const normalizedNickname = normalizeNickname(payload.account.nickname);
    const existingAccount =
      accounts.find((account) => account.id === payload.account.id) ??
      accounts.find((account) => normalizeNickname(account.nickname) === normalizedNickname);
    const targetAccountId = existingAccount?.id ?? payload.account.id;
    const nextAccount: UserAccount = {
      ...payload.account,
      nickname: payload.account.nickname.trim().replace(/\s+/g, ' '),
      id: targetAccountId,
    };
    const scopedKeys = getAccountStorageKeys(targetAccountId);
    const nextAccounts = [
      ...accounts.filter((account) => {
        if (account.id === targetAccountId) {
          return false;
        }

        return normalizeNickname(account.nickname) !== normalizedNickname;
      }),
      nextAccount,
    ];

    await AsyncStorage.multiSet([
      [STORAGE_KEYS.accounts, JSON.stringify(nextAccounts)],
      [scopedKeys.attendance, JSON.stringify(payload.data.attendance)],
      [scopedKeys.lessonRecords, JSON.stringify(payload.data.lessonRecords)],
      [scopedKeys.dribbleCounts, JSON.stringify(payload.data.dribbleCounts)],
      [scopedKeys.shotAttempts, JSON.stringify(payload.data.shotAttempts)],
      [scopedKeys.shotSuccess, JSON.stringify(payload.data.shotSuccess)],
      [scopedKeys.ballColors, JSON.stringify(payload.data.ballColors)],
      [scopedKeys.ballBrand, JSON.stringify(payload.data.ballBrand)],
      [scopedKeys.position, JSON.stringify(payload.data.position)],
      [scopedKeys.homework, JSON.stringify(payload.data.homework)],
    ]);
    await persistSession(targetAccountId, true);

    setAccounts(nextAccounts);
    setCurrentUser(toAuthUser(nextAccount));
    setAuthMode('login');

    return {
      success: true,
      message: '계정을 가져와서 바로 로그인했습니다.',
    };
  }

  async function login({ nickname, name, age, gender, password, keepSignedIn }: AuthFormValues): Promise<AuthActionResult> {
    const trimmedNickname = nickname.trim();
    const trimmedName = name.trim();
    const trimmedPassword = password.trim();
    const parsedAge = parseAgeInput(age);

    if (!trimmedNickname || !trimmedName || parsedAge === null || !trimmedPassword) {
      return {
        success: false,
        message: '닉네임, 이름, 나이, 성별, 비밀번호를 모두 정확히 입력해 주세요.',
      };
    }

    if (accounts.length === 0) {
      return {
        success: false,
        message: '이 기기에는 아직 등록된 계정이 없습니다. 컴퓨터에서 만든 계정은 아래 전송 코드로 가져오거나 회원가입으로 새로 만들어 주세요.',
      };
    }

    const normalizedNickname = normalizeNickname(trimmedNickname);
    const matchedAccount = accounts.find((account) => normalizeNickname(account.nickname) === normalizedNickname);

    if (!matchedAccount) {
      return {
        success: false,
        message: '입력한 닉네임과 일치하는 계정을 찾지 못했습니다.',
      };
    }

    if (
      normalizeAccountName(matchedAccount.name) !== normalizeAccountName(trimmedName) ||
      matchedAccount.age !== parsedAge ||
      matchedAccount.gender !== gender
    ) {
      return {
        success: false,
        message: '닉네임은 맞지만 이름, 나이 또는 성별 정보가 계정과 일치하지 않습니다.',
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

  async function signup({ nickname, name, age, gender, password, keepSignedIn }: AuthFormValues): Promise<AuthActionResult> {
    const trimmedNickname = nickname.trim();
    const trimmedName = name.trim();
    const trimmedPassword = password.trim();
    const parsedAge = parseAgeInput(age);

    if (!trimmedNickname || !trimmedName || parsedAge === null || !trimmedPassword) {
      return {
        success: false,
        message: '닉네임, 이름, 나이, 성별, 비밀번호를 모두 정확히 입력해 주세요.',
      };
    }

    const normalizedNickname = normalizeNickname(trimmedNickname);
    const duplicatedAccount = accounts.find((account) => normalizeNickname(account.nickname) === normalizedNickname);

    if (duplicatedAccount) {
      return {
        success: false,
        message: '이미 사용 중인 닉네임입니다. 다른 닉네임을 입력해 주세요.',
      };
    }

    const nextAccount: UserAccount = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      nickname: trimmedNickname,
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
    setIsShootSuccessButtonVisible(false);
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
    setIsCameraPreviewHidden(false);
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
    setIsCameraPreviewHidden(false);
    setLessonReview(null);
    setIsShootSuccessButtonVisible(false);
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
    setIsCameraPreviewHidden(false);
    setIsShootSuccessButtonVisible(false);
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
      setIsCameraPreviewHidden(false);
      setIsShootSuccessButtonVisible(false);
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
    setIsCameraPreviewHidden(true);
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
      recordFrontDribbleHomeworkData(selectedDribbleViewRef.current === 'front' ? latestDribbleAnalysisRef.current : null);
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
      setIsCameraPreviewHidden(false);
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
    recordFrontDribbleHomeworkData,
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

      recordFrontDribbleHomeworkData(selectedDribbleViewRef.current === 'front' ? latestDribbleAnalysisRef.current : null);
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
      setIsCameraPreviewHidden(false);
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
      recordFrontDribbleHomeworkData,
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
      setIsCameraPreviewHidden(false);
      setIsLessonActive(true);
      setIsCameraActive(true);
      setIsCameraReady(true);
      setCameraError('');
      setIsShootSuccessButtonVisible(!shootSuccessRecordedForCurrentAttemptRef.current);
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
    shootSuccessRecordedForCurrentAttemptRef.current = false;
    setIsShootSuccessButtonVisible(false);
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
          setIsShootSuccessButtonVisible(true);
          setImmediateLessonFeedback('슛 발사를 확인했습니다. 3초 뒤 녹화를 마치고 2, 3번째 기준을 분석합니다.');
          setDebugText('슛 발사를 확인했습니다. 3초 뒤 녹화를 종료합니다.');
          return;
        }

        setDebugText('슛 촬영 중입니다. 공이 머리보다 높게 올라가는 발사 시점을 기다리고 있습니다.');
        return;
      }

      if (phase === 'countdown') {
        if (!stanceReady) {
          dribbleLessonPhaseRef.current = 'stance_setup';
          stanceCountdownStartedAtRef.current = null;
          setCountdownValue(null);
          pendingFeedbackRef.current =
            '슛 준비 자세가 흐트러졌습니다.\n1. 팔 각도를 다시 80~120도로 맞춰 주세요.\n2. 준비 자세가 다시 잡히면 3초 카운트를 처음부터 시작합니다.\n3. 카운트가 끝나면 그때 슛 레슨을 시작합니다.';
          setDebugText('슛 준비 자세가 무너져 카운트를 다시 시작합니다.');
          return;
        }

        const countdownStartedAt = stanceCountdownStartedAtRef.current ?? Date.now();
        const elapsed = Date.now() - countdownStartedAt;

        if (elapsed >= DRIBBLE_STANCE_HOLD_MS) {
          startShootLessonFromCountdown();
          return;
        }

        const remainingSeconds = Math.max(1, Math.ceil((DRIBBLE_STANCE_HOLD_MS - elapsed) / 1000));
        pendingFeedbackRef.current = `슛 준비 자세를 유지해 주세요.\n1. 팔 각도를 기준 범위 안으로 맞춰 주세요.\n2. ${remainingSeconds}초 동안 자세를 유지하면 슛 레슨을 시작합니다.\n3. 슛이 끝난 뒤 2, 3번째 기준으로 결과를 알려드립니다.`;
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
          | { type: 'shoot_success_gesture' }
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

        if (payload.type === 'shoot_success_gesture') {
          if (lessonModeRef.current !== 'shoot') {
            return;
          }

          recordSuccessfulShot({
            preserveFeedback: true,
            debugMessage: '슛 발사 1초 뒤 X자 팔 동작을 확인해 슛 성공 1회를 자동 기록했습니다.',
          });
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
            setIsCameraPreviewHidden(false);
            setIsLessonActive(false);
            setIsCameraActive(false);
            setIsCameraReady(false);
            setCameraError('');
            setIsShootSuccessButtonVisible(false);
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
            setIsCameraPreviewHidden(false);
            dribbleLessonPhaseRef.current = 'stance_setup';
            shootLessonStartedRef.current = false;
            setIsLessonActive(true);
            setIsCameraActive(true);
            setIsCameraReady(true);
            setIsShootSuccessButtonVisible(false);
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
      recordSuccessfulShot,
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

    if (!isShootSuccessButtonVisible) {
      Alert.alert('슛 발사 확인 필요', '슛 발사를 먼저 인식한 뒤에 슛 성공을 기록할 수 있습니다.');
      return;
    }

    recordSuccessfulShot();
  }

  function adjustSelectedDateShotSuccess(delta: number) {
    if (!selectedDateKey || delta === 0) {
      return;
    }

    const maxAttempts = shotAttemptRecords[selectedDateKey] || 0;

    setShotSuccessRecords((current) => {
      const currentCount = current[selectedDateKey] || 0;
      const nextCount = Math.max(0, Math.min(maxAttempts, currentCount + delta));

      if (nextCount === currentCount) {
        return current;
      }

      if (nextCount === 0) {
        const next = { ...current };
        delete next[selectedDateKey];
        return next;
      }

      return {
        ...current,
        [selectedDateKey]: nextCount,
      };
    });
  }

  async function openSkillVideo() {
    if (!selectedSkill || !selectedSkillKey) {
      return;
    }

    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(selectedSkill.query)}`;
    const supported = await Linking.canOpenURL(url);

    if (!supported) {
      Alert.alert('열기 실패', '기기에서 영상을 열 수 없습니다.');
      return;
    }

    await Linking.openURL(url);
    recordSkillVideoOpen(selectedSkillKey);
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
    homeworkTestState,
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
    isCameraPreviewHidden,
    isLessonActive,
    isCameraReady,
    cameraSessionKey,
    countdownValue,
    startupStatusText,
    isShootSuccessButtonVisible,
    recoverStartupToLogin,
    dribbleResetToken,
    shootResetToken,
    recordingStartToken,
    recordingStopToken,
    cameraError,
    fireworks,
    showFireworks,
    changeAuthMode,
    createTransferCode,
    importAccountTransfer,
    login,
    signup,
    logout,
    navigateTo,
    changeLessonMode,
    beginLesson,
    endLesson,
    handlePoseMessage,
    registerSuccessfulShot,
    adjustSelectedDateShotSuccess,
    selectSkill,
    selectBallBrand,
    toggleBallColor,
    selectPosition,
    setSelectedDribbleView,
    revealHomework,
    openSkillVideo,
    applyHomeworkTestState,
    openDiaryDate,
    changeMonth,
    deleteLessonRecord,
  };
}
