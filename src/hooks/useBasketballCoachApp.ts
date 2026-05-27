import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Linking from 'expo-linking';
import { Audio } from 'expo-av';
import { useCameraPermissions } from 'expo-camera';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import type { WebViewMessageEvent } from 'react-native-webview';
import { SKILLS } from '../constants/content';
import { BALL_BRAND_PRESETS, DEFAULT_BALL_BRAND, DEFAULT_BALL_COLORS } from '../constants/settings';
import { STORAGE_KEYS } from '../constants/storage';
import type {
  AppScreen,
  BallBrandOption,
  BallColorOption,
  DribbleAnalysis,
  FeedbackMoment,
  FireworkItem,
  LessonMode,
  LessonRecord,
  LessonReviewClip,
  ShootAnalysis,
  SkillKey,
} from '../types/app';
import { getCalendarCells } from '../utils/calendar';
import { formatDateKey } from '../utils/date';
import { buildDribbleFeedbackText, buildShootFeedbackText } from '../utils/feedback';
import { buildLessonHomework, getHomeworkToShow, mergeHomework } from '../utils/homework';

const FEEDBACK_UPDATE_INTERVAL_MS = 1500;
const DRIBBLE_STANCE_HOLD_MS = 3000;

type DribbleLessonPhase = 'stance_setup' | 'countdown' | 'await_dribble' | 'active';

const DEFAULT_DRIBBLE_FEEDBACK =
  '?쒕━釉??쇰뱶諛?n1. ?쒖꽑, ?쒕━釉??믪씠, ?곸껜 ?믪씠瑜?遺꾩꽍?섎뒗 以묒엯?덈떎.\n2. 紐??꾩껜? ?쒕━釉??먯씠 ?붾㈃ ?덉뿉 蹂댁씠?꾨줉 留욎떠 二쇱꽭??\n3. 遺꾩꽍???덉젙?섎㈃ ?먯꽭 湲곗???留욎떠 ?쇰뱶諛깆씠 諛붾줈 諛붾앸땲??';

const DEFAULT_SHOOT_FEEDBACK =
  '???쇰뱶諛?n1. ??媛곷룄, ???쒖젏, ?섏껜 媛곷룄瑜?遺꾩꽍?섎뒗 以묒엯?덈떎.\n2. ?닿묠遺??諛쒓퉴吏 紐??꾩껜媛 ?붾㈃ ?덉뿉 ??蹂댁씠?꾨줉 留욎떠 二쇱꽭??\n3. 遺꾩꽍???덉젙?섎㈃ ??湲곗???留욎떠 ?쇰뱶諛깆씠 諛붾줈 諛붾앸땲??';

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
  const positiveKeywords = ['????', '???', '???', '??? ?', '???', '??? ???'];
  return positiveKeywords.some((keyword) => text.includes(keyword));
}

function scoreFeedbackText(text: string) {
  let score = 0;
  const strongKeywords = ['?? ?', '???', '???', '??', '? ', '??', '??', '??', '??', '??', '??', '?? ??', '??'];
  const mediumKeywords = ['??', '??', '??', '??', '? ??', '???'];

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
    title: '?? ???? 3?',
  };
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

function buildDribbleStanceFeedback(analysis: DribbleAnalysis) {
  const eyeLine =
    analysis.eyeFocus === 'forward'
      ? '?쒖꽑??醫뗭븘?? 吏湲덉쿂??怨듭씠 ?꾨땲???욎쓣 諛붾씪遊?二쇱꽭??'
      : '癒쇱? 怨듭씠 ?꾨땲???욎쓣 蹂대룄濡??쒖꽑??留욎떠 二쇱꽭??';

  const torsoLine =
    analysis.torsoPosture === 'balanced'
      ? '?곸껜 ?믪씠媛 ?덉젙?곸씠?먯슂. 吏湲??먯꽭瑜??좎???二쇱꽭??'
      : analysis.torsoPosture === 'high'
        ? '?쒕━釉??꾩뿉 臾대쫷??援쏀엳怨??곸껜瑜?議곌툑 ????떠 二쇱꽭??'
        : analysis.torsoPosture === 'low'
          ? '?곸껜媛 ?덈Т 留롮씠 ?숈뿬議뚯뼱?? ?곸껜瑜?議곌툑 ???몄썙 洹좏삎??留욎떠 二쇱꽭??'
          : '?닿묠? ?됰뜦?닿? ?④퍡 蹂댁씠?꾨줉 ?먯꽭瑜??ㅼ떆 留욎떠 二쇱꽭??';

  return `?쒕━釉?以鍮??먯꽭\n1. ${eyeLine}\n2. ?쒖꽑怨??곸껜 ?먯꽭媛 紐⑤몢 留욎쑝硫?3珥????쒕━釉붿쓣 ?쒖옉?⑸땲??\n3. ${torsoLine}`;
}

function isShootStanceReady(analysis: ShootAnalysis) {
  return analysis.armAngleState === 'balanced';
}

function buildDribbleStanceFeedbackV2(analysis: DribbleAnalysis) {
  const torsoLine =
    analysis.stanceState === 'ready'
      ? `?곸껜 湲곗슱湲?${analysis.torsoLeanAngle ? analysis.torsoLeanAngle.toFixed(1) : '--'}?꾨줈 以鍮??먯꽭媛 醫뗭뒿?덈떎.`
      : analysis.stanceState === 'too_upright'
        ? `?곸껜 湲곗슱湲곌? ${analysis.torsoLeanAngle ? analysis.torsoLeanAngle.toFixed(1) : '--'}?꾩삁?? 15~45?꾧? ?섎룄濡?議곌툑 ???숈뿬 二쇱꽭??`
        : analysis.stanceState === 'too_low'
          ? `?곸껜 湲곗슱湲곌? ${analysis.torsoLeanAngle ? analysis.torsoLeanAngle.toFixed(1) : '--'}?꾩삁?? ?덈Т 留롮씠 ?숈??쇰땲 議곌툑 ?몄썙 二쇱꽭??`
          : '?닿묠? ?됰뜦?닿? ??蹂댁씠?꾨줉 ?쒖꽌 ?곸껜 湲곗슱湲곕? ?ㅼ떆 ?≪븘 二쇱꽭??';

  return `?쒕━釉?以鍮??먯꽭\n1. ?됰뜦?댁뿉???닿묠源뚯????곸껜 湲곗슱湲곕? 15~45?꾨줈 留욎떠 二쇱꽭??\n2. ???먯꽭瑜?3珥??숈븞 ?좎??섎㈃ ?쒕━釉붿쓣 ?쒖옉?섎씪怨??뚮젮?쒕┫寃뚯슂.\n3. ${torsoLine}`;
}

function buildDribbleStanceFeedbackV3(analysis: DribbleAnalysis) {
  if (analysis.bodyFacing === 'front') {
    const stanceLine =
      analysis.stanceState === 'ready'
        ? `臾대쫷-?됰뜦??臾대쫷 媛곷룄 ${analysis.frontStanceAngle ? analysis.frontStanceAngle.toFixed(1) : '--'}?꾨줈 ?먯꽭瑜?????톬?듬땲??`
        : `臾대쫷-?됰뜦??臾대쫷 媛곷룄媛 ${analysis.frontStanceAngle ? analysis.frontStanceAngle.toFixed(1) : '--'}?꾩삁?? 40~60?꾧? ?섎룄濡??먯꽭瑜??ㅼ떆 留욎떠 二쇱꽭??`;

    return `?뺣㈃ ?쒕━釉?以鍮??먯꽭\n1. ?먯꽭瑜???떠 ?쇱そ 臾대쫷, ?됰뜦?? ?ㅻⅨ履?臾대쫷 ?ъ씠 媛곷룄瑜?40~60?꾨줈 留욎떠 二쇱꽭??\n2. ???먯꽭瑜?3珥??숈븞 ?좎??섎㈃ ?쒕━釉붿쓣 ?쒖옉?섎씪怨??뚮젮?쒕┫寃뚯슂.\n3. ${stanceLine}`;
  }

  return buildDribbleStanceFeedbackV2(analysis);
}

function buildShootStanceFeedback(analysis: ShootAnalysis) {
  const armLine =
    analysis.armAngleState === 'balanced'
      ? '?쏆쓣 ?쒖옉?섍린 醫뗭? ??媛곷룄?덉슂. 吏湲??먯꽭瑜??좎???二쇱꽭??'
      : analysis.armAngleState === 'narrow'
        ? '???꾩뿉 ??媛곷룄媛 ?덈Т 醫곸븘?? ?닿묠? ?붿쓣 議곌툑 ??踰뚮젮 二쇱꽭??'
        : analysis.armAngleState === 'wide'
          ? '???꾩뿉 ??媛곷룄媛 ?덈Т ?볦뼱?? ?붿쓣 議곌툑 ??紐⑥븘??以鍮꾪빐 二쇱꽭??'
          : '?닿묠, ?붽퓞移? ?먮ぉ????蹂댁씠?꾨줉 ?먯꽭瑜??ㅼ떆 留욎떠 二쇱꽭??';

  return `??以鍮??먯꽭\n1. ${armLine}\n2. ??媛곷룄媛 湲곗???留욎쑝硫?3珥????쏆쓣 ?쒖옉?⑸땲??\n3. 以鍮??먯꽭媛 ?먰듃?ъ?硫??ㅼ떆 ?먯꽭遺??留욎텧寃뚯슂.`;
}

export function useBasketballCoachApp() {
  const [screen, setScreen] = useState<AppScreen>('home');
  const [lessonMode, setLessonMode] = useState<LessonMode>('dribble');
  const [homework, setHomework] = useState<string[]>([]);
  const [attendance, setAttendance] = useState<Record<string, string>>({});
  const [lessonRecords, setLessonRecords] = useState<LessonRecord[]>([]);
  const [shotSuccessRecords, setShotSuccessRecords] = useState<Record<string, number>>({});
  const [selectedDateKey, setSelectedDateKey] = useState('');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedSkillKey, setSelectedSkillKey] = useState<SkillKey | ''>('');
  const [selectedBallBrand, setSelectedBallBrand] = useState<BallBrandOption>(DEFAULT_BALL_BRAND);
  const [selectedBallColors, setSelectedBallColors] = useState<BallColorOption[]>(DEFAULT_BALL_COLORS);
  const [debugText, setDebugText] = useState('移대찓?쇱? MediaPipe瑜?以鍮꾪븯??以묒엯?덈떎.');
  const [feedbackText, setFeedbackText] = useState(DEFAULT_DRIBBLE_FEEDBACK);
  const [lessonReview, setLessonReview] = useState<LessonReviewClip | null>(null);
  const [isLessonActive, setIsLessonActive] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [cameraSessionKey, setCameraSessionKey] = useState(0);
  const [countdownValue, setCountdownValue] = useState<number | null>(null);
  const [recordingStartToken, setRecordingStartToken] = useState(0);
  const [recordingStopToken, setRecordingStopToken] = useState(0);
  const [fireworks, setFireworks] = useState<FireworkItem[]>([]);
  const [showFireworks, setShowFireworks] = useState(false);

  const feedbackIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingFeedbackRef = useRef<string | null>(null);
  const latestFeedbackRef = useRef(feedbackText);
  const lessonModeRef = useRef(lessonMode);
  const lessonStartedAtRef = useRef<number | null>(null);
  const dribbleLessonPhaseRef = useRef<DribbleLessonPhase>('stance_setup');
  const shootLessonStartedRef = useRef(false);
  const dribbleTargetCountRef = useRef<number | null>(null);
  const dribbleAutoEndingRef = useRef(false);
  const stanceCountdownStartedAtRef = useRef<number | null>(null);
  const feedbackTimelineRef = useRef<FeedbackMoment[]>([]);
  const pendingStopSaveRef = useRef(false);
  const recordingFallbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shootAutoEndTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingReviewStopRef = useRef(false);
  const startCueSoundRef = useRef<Audio.Sound | null>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const selectedSkill = selectedSkillKey ? SKILLS[selectedSkillKey] : null;
  const homeworkToShow = useMemo(() => getHomeworkToShow(homework), [homework]);
  const calendarCells = useMemo(() => getCalendarCells(currentDate, attendance), [attendance, currentDate]);
  const selectedDateRecords = useMemo(
    () => lessonRecords.filter((record) => record.dateKey === selectedDateKey).slice().reverse(),
    [lessonRecords, selectedDateKey]
  );
  const selectedDateShotCount = selectedDateKey ? shotSuccessRecords[selectedDateKey] || 0 : 0;

  useEffect(() => {
    latestFeedbackRef.current = feedbackText;
  }, [feedbackText]);

  useEffect(() => {
    lessonModeRef.current = lessonMode;
  }, [lessonMode]);

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
        const parsedHomework = parseStoredJson<string[]>(stored[STORAGE_KEYS.homework], []);
        const parsedLessonRecords = parseStoredJson<
          Array<LessonRecord | (Omit<LessonRecord, 'feedbackTimeline'> & { feedbackTimeline?: FeedbackMoment[] | string[] })>
        >(stored[STORAGE_KEYS.lessonRecords], []).map((record) => normalizeLessonRecord(record));
        const parsedShotSuccess = parseStoredJson<Record<string, number>>(stored[STORAGE_KEYS.shotSuccess], {});
        const parsedBallBrand = parseStoredJson<BallBrandOption>(stored[STORAGE_KEYS.ballBrand], DEFAULT_BALL_BRAND);
        const parsedBallColors = parseStoredJson<BallColorOption[]>(stored[STORAGE_KEYS.ballColors], DEFAULT_BALL_COLORS);

        const todayKey = formatDateKey(new Date());
        parsedAttendance[todayKey] = 'attended';

        setAttendance(parsedAttendance);
        setHomework(parsedHomework);
        setLessonRecords(parsedLessonRecords);
        setShotSuccessRecords(parsedShotSuccess);
        setSelectedBallBrand(parsedBallBrand);
        setSelectedBallColors(
          parsedBallColors.length > 0 ? parsedBallColors : BALL_BRAND_PRESETS[parsedBallBrand] ?? DEFAULT_BALL_COLORS
        );
        setSelectedDateKey(todayKey);

        await AsyncStorage.setItem(STORAGE_KEYS.attendance, JSON.stringify(parsedAttendance));
      } catch {
        Alert.alert('遺덈윭?ㅺ린 ?ㅽ뙣', '??ν븳 ?곗씠?곕? ?쎈뒗 以?臾몄젣媛 諛쒖깮?덉뒿?덈떎.');
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
      setDebugText('移대찓???쒖옉 ?묐떟??湲곕떎由щ뒗 以묒엯?덈떎.');
      setCameraError('移대찓???쒖옉??吏?곕릺怨??덉뒿?덈떎. ?좎떆 ?꾩뿉???붾㈃??鍮꾩뼱 ?덉쑝硫?吏꾪뻾 ?곹깭 臾멸뎄? ?④퍡 ?뚮젮 二쇱꽭??');
    }, 8000);

    return () => clearTimeout(timer);
  }, [cameraError, isCameraReady, isLessonActive]);

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

  const ensureStartCueSound = useCallback(async () => {
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
        const sound = await ensureStartCueSound();
        await sound.replayAsync();
      } catch {
        // Keep the lesson flow running even if the cue sound fails.
      }
    })();
  }, [ensureStartCueSound]);

  const addLessonHomework = useCallback((mode: LessonMode) => {
    const nextHomework = buildLessonHomework(mode);
    setHomework((current) => mergeHomework(current, nextHomework));
  }, []);

  const saveLessonRecord = useCallback((videoUri: string, reviewClip?: LessonReviewClip | null) => {
    const dateKey = formatDateKey(new Date());
    const nextRecord: LessonRecord = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      dateKey,
      mode: lessonModeRef.current,
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
        addLessonHomework(lessonModeRef.current);
        saveLessonRecord(videoUri);
      }

      lessonStartedAtRef.current = null;
      dribbleLessonPhaseRef.current = 'stance_setup';
      shootLessonStartedRef.current = false;
      dribbleTargetCountRef.current = null;
      dribbleAutoEndingRef.current = false;
      stanceCountdownStartedAtRef.current = null;
      feedbackTimelineRef.current = [];
      pendingFeedbackRef.current = null;
      setCountdownValue(null);
      setRecordingStartToken(0);
      setRecordingStopToken(0);
      setIsLessonActive(false);
      setIsCameraActive(false);
      setIsCameraReady(false);
      setCameraError('');
      setDebugText('移대찓?쇱? MediaPipe瑜?以鍮꾪븯??以묒엯?덈떎.');
    },
    [addLessonHomework, clearRecordingWait, clearShootAutoEnd, saveLessonRecord]
  );

  async function navigateTo(nextScreen: AppScreen) {
    if (screen === 'lesson' && nextScreen !== 'lesson' && (isLessonActive || isCameraActive)) {
      await endLesson();
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
    dribbleTargetCountRef.current = null;
    dribbleAutoEndingRef.current = false;
    pendingReviewStopRef.current = false;
    clearShootAutoEnd();
    stanceCountdownStartedAtRef.current = null;
    setCountdownValue(null);
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
        : buildDribbleStanceFeedbackV3({
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
          })
    );
    setDebugText(mode === 'shoot' ? '??遺꾩꽍 紐⑤뱶瑜?以鍮꾪븯??以묒엯?덈떎.' : '?쒕━釉?遺꾩꽍 紐⑤뱶瑜?以鍮꾪븯??以묒엯?덈떎.');
  }

  function startFeedbackLoop(mode: LessonMode) {
    if (feedbackIntervalRef.current) {
      clearInterval(feedbackIntervalRef.current);
      feedbackIntervalRef.current = null;
    }

    pendingFeedbackRef.current = null;
    dribbleLessonPhaseRef.current = 'stance_setup';
    shootLessonStartedRef.current = false;
    dribbleTargetCountRef.current = null;
    dribbleAutoEndingRef.current = false;
    pendingReviewStopRef.current = false;
    clearShootAutoEnd();
    stanceCountdownStartedAtRef.current = null;
    setCountdownValue(null);
    setRecordingStopToken(0);
    setLessonReview(null);
    if (mode === 'dribble') {
      setImmediateLessonFeedback(buildDribbleStanceFeedbackV3({
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
      }));
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
      Alert.alert('沅뚰븳 ?꾩슂', '?덉뒯 珥ъ쁺怨??먯꽭 遺꾩꽍???꾪빐 移대찓??沅뚰븳???꾩슂?⑸땲??');
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
    dribbleTargetCountRef.current =
      lessonModeRef.current === 'dribble' && typeof dribbleTargetCount === 'number' && dribbleTargetCount > 0
        ? dribbleTargetCount
        : null;
    dribbleAutoEndingRef.current = false;
    pendingReviewStopRef.current = false;
    stanceCountdownStartedAtRef.current = null;
    feedbackTimelineRef.current = [];
    setCountdownValue(null);
    setRecordingStartToken(0);
    setRecordingStopToken(0);
    setLessonReview(null);
    setIsLessonActive(true);
    setIsCameraActive(true);
    setIsCameraReady(false);
    setDebugText('MediaPipe 遺꾩꽍 ?붾㈃???쒖옉?섎뒗 以묒엯?덈떎.');
    void ensureStartCueSound();
    startFeedbackLoop(lessonModeRef.current);
  }

  async function endLesson() {
    if (!isLessonActive) {
      return;
    }

    if (feedbackIntervalRef.current) {
      clearInterval(feedbackIntervalRef.current);
      feedbackIntervalRef.current = null;
    }

    pendingStopSaveRef.current = true;
    clearShootAutoEnd();
    setDebugText('?덉뒯 ?곸긽????ν븯??以묒엯?덈떎.');
    setCountdownValue(null);
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
    setRecordingStopToken(Date.now());
    setDebugText('?? ??? ??? ?? ??? ????? ?? ??? ???? ????.');
  }, [clearShootAutoEnd]);

  const completeDribbleReview = useCallback(
    (videoUri: string) => {
      clearRecordingWait();
      pendingReviewStopRef.current = false;

      const reviewClip = buildReviewClipFromTimeline(
        [...feedbackTimelineRef.current],
        latestFeedbackRef.current,
        videoUri
      );

      addLessonHomework(lessonModeRef.current);
      saveLessonRecord(videoUri, reviewClip);

      lessonStartedAtRef.current = null;
      dribbleLessonPhaseRef.current = 'stance_setup';
      shootLessonStartedRef.current = false;
      dribbleTargetCountRef.current = null;
      dribbleAutoEndingRef.current = false;
      stanceCountdownStartedAtRef.current = null;
      feedbackTimelineRef.current = [];
      pendingFeedbackRef.current = null;
      setCountdownValue(null);
      setRecordingStartToken(0);
      setRecordingStopToken(0);
      latestFeedbackRef.current = reviewClip.feedback;
      setFeedbackText(reviewClip.feedback);
      setLessonReview(reviewClip);
      setIsLessonActive(false);
      setIsCameraActive(true);
      setIsCameraReady(true);
      setCameraError('');
      setDebugText('??? ????. ?? ??? ?? ??? 3? ??? ?? ?? ???? ??? ???.');
    },
    [addLessonHomework, clearRecordingWait, saveLessonRecord]
  );

  const applyDribbleAnalysis = useCallback(
    (analysis: DribbleAnalysis) => {
      if (lessonModeRef.current !== 'dribble') {
        return;
      }

      const phase = dribbleLessonPhaseRef.current;
      const stanceReady = isDribbleStanceReady(analysis);

      if (phase === 'active') {
        stanceCountdownStartedAtRef.current = null;
        setCountdownValue(null);
        const nextFeedback = buildDribbleFeedbackText(analysis);
        pendingFeedbackRef.current = nextFeedback;
        const targetCount = dribbleTargetCountRef.current;
        if (targetCount && analysis.dribbleCount >= targetCount && !dribbleAutoEndingRef.current) {
          dribbleAutoEndingRef.current = true;
          setImmediateLessonFeedback(nextFeedback);
          setDebugText(`?? ??? ${targetCount}?? ??? ??? ?????.`);
          finishDribbleRecordingForReview();
          return;
        }
        setDebugText(`???????? ??? ?? ${analysis.summary}`);
        return;
      }

      if (phase === 'await_dribble' && analysis.dribbleStarted) {
        dribbleLessonPhaseRef.current = 'active';
        stanceCountdownStartedAtRef.current = null;
        setCountdownValue(null);
        pendingFeedbackRef.current = buildDribbleFeedbackText(analysis);
        setDebugText(`?紐꾨뻼?? ${analysis.summary}`);
        return;
      }

      if (!stanceReady) {
        dribbleLessonPhaseRef.current = 'stance_setup';
        stanceCountdownStartedAtRef.current = null;
        setCountdownValue(null);
        pendingFeedbackRef.current = buildDribbleStanceFeedbackV3(analysis);
        setDebugText('?쒕━釉??꾩뿉 以鍮??먯꽭瑜?留욎텛??以묒엯?덈떎.');
        return;
      }

      if (phase === 'stance_setup') {
        dribbleLessonPhaseRef.current = 'countdown';
        stanceCountdownStartedAtRef.current = Date.now();
        setImmediateLessonFeedback('醫뗭븘?? ?곸껜 湲곗슱湲곌? 湲곗???留욎뒿?덈떎. 3珥??숈븞 洹몃?濡??좎???二쇱꽭??');
        setDebugText('드리블 준비 자세 확인: 3초 유지 중');
        return;
      }

      if (phase === 'countdown') {
        const countdownStartedAt = stanceCountdownStartedAtRef.current ?? Date.now();
        const elapsed = Date.now() - countdownStartedAt;

        if (elapsed >= DRIBBLE_STANCE_HOLD_MS) {
          dribbleLessonPhaseRef.current = 'active';
          stanceCountdownStartedAtRef.current = null;
          setCountdownValue(null);
          playStartCue();
          setRecordingStartToken(Date.now());
          setImmediateLessonFeedback('???. ?? ???? ??? ???. ?? ???? ??, ??, ? ??? ?? ?????.');
          setDebugText('??? 1, 2, 3 ?? ?? ??');
          return;
        }

        const remainingSeconds = Math.max(1, Math.ceil((DRIBBLE_STANCE_HOLD_MS - elapsed) / 1000));
        pendingFeedbackRef.current = `???????????? ??? ??????.
1. ??? ?????? ???????15~45??? ??????????
2. ${remainingSeconds}??? ???????? ?????? ????????????
3. ????? ?????????? ???????????????????`;
        setDebugText(`???????????? ??? ?? ${remainingSeconds}?????`);
        return;
      }

      pendingFeedbackRef.current = '?댁젣 ?쒕━釉붿쓣 ?쒖옉?섏꽭?? 怨듭씠 臾대쫷?대굹 諛?履쎄퉴吏 ?대젮?ㅻ㈃ ?쒕━釉?遺꾩꽍???댁뼱媛덇쾶??';
      setDebugText('드리블 시작 대기 중');
      return;
      setDebugText(`?몄떇?? ${analysis.summary}`);
    },
    [finishDribbleRecordingForReview, playStartCue, setImmediateLessonFeedback]
  );

  const applyShootAnalysis = useCallback(
    (analysis: ShootAnalysis) => {
      if (lessonModeRef.current !== 'shoot') {
        return;
      }

      pendingFeedbackRef.current = buildShootFeedbackText(analysis);
      setDebugText(`?몄떇?? ${analysis.summary}`);
    },
    []
  );

  const applyShootAnalysisWithStance = useCallback(
    (analysis: ShootAnalysis) => {
      if (lessonModeRef.current !== 'shoot') {
        return;
      }

      if (shootLessonStartedRef.current) {
        dribbleLessonPhaseRef.current = 'active';
        stanceCountdownStartedAtRef.current = null;
        setCountdownValue(null);
        pendingFeedbackRef.current = buildShootFeedbackText(analysis);
        setDebugText(`? ?? ?? ? ${analysis.summary}`);
        return;
      }

      const phase = dribbleLessonPhaseRef.current;
      const stanceReady = isShootStanceReady(analysis);
      const releaseStarted =
        analysis.releaseTiming !== 'unknown' ||
        (analysis.releaseVelocity !== null && Math.abs(analysis.releaseVelocity) > 0.003);

      if (phase === 'active') {
        shootLessonStartedRef.current = true;
        stanceCountdownStartedAtRef.current = null;
        setCountdownValue(null);
        pendingFeedbackRef.current = buildShootFeedbackText(analysis);
        setDebugText(`? ?? ?? ? ${analysis.summary}`);
        return;
      }

      if (phase === 'await_dribble' && releaseStarted) {
        shootLessonStartedRef.current = true;
        dribbleLessonPhaseRef.current = 'active';
        stanceCountdownStartedAtRef.current = null;
        setCountdownValue(null);
        pendingFeedbackRef.current = buildShootFeedbackText(analysis);
        setDebugText(`? ?? ?? ? ${analysis.summary}`);
        return;
      }

      if (!stanceReady) {
        dribbleLessonPhaseRef.current = 'stance_setup';
        stanceCountdownStartedAtRef.current = null;
        setCountdownValue(null);
        pendingFeedbackRef.current = buildShootStanceFeedback(analysis);
        setDebugText('? ?? ??? ??? ????.');
        return;
      }

      if (phase === 'stance_setup') {
        dribbleLessonPhaseRef.current = 'countdown';
        stanceCountdownStartedAtRef.current = Date.now();
        setImmediateLessonFeedback('???. ?? ? ?? ??? ?????. 3? ?? ??? ??? ???.');
        setDebugText('? ?? ?? ??: 3? ?? ?');
        return;
      }

      if (phase === 'countdown') {
        const countdownStartedAt = stanceCountdownStartedAtRef.current ?? Date.now();
        const elapsed = Date.now() - countdownStartedAt;

        if (elapsed >= DRIBBLE_STANCE_HOLD_MS) {
          shootLessonStartedRef.current = true;
          dribbleLessonPhaseRef.current = 'active';
          stanceCountdownStartedAtRef.current = null;
          setCountdownValue(null);
          playStartCue();
          setRecordingStartToken(Date.now());
          scheduleShootAutoEnd();
          setImmediateLessonFeedback('? ?? ??? ?????. ?? ?? ?? ??? ?????.');
          setDebugText('? ? ?? ??');
          return;
        }

        const remainingSeconds = Math.max(1, Math.ceil((DRIBBLE_STANCE_HOLD_MS - elapsed) / 1000));
        pendingFeedbackRef.current = `? ?? ??? ??? ???.\n1. ? ??? ???? ??? ???.\n2. ${remainingSeconds}?? ? ???? ? ??? ?????.\n3. ??? ???? ?? ?? ???? ????.`;
        setDebugText(`? ?? ?? ?? ? ${remainingSeconds}? ??`);
        return;
      }

      shootLessonStartedRef.current = true;
      dribbleLessonPhaseRef.current = 'active';
      stanceCountdownStartedAtRef.current = null;
      setCountdownValue(null);
      pendingFeedbackRef.current = buildShootFeedbackText(analysis);
      setDebugText(`? ?? ?? ? ${analysis.summary}`);
    },
    [playStartCue, scheduleShootAutoEnd, setImmediateLessonFeedback]
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
          setDebugText('MediaPipe 紐⑤뜽 以鍮??꾨즺');
          return;
        }

        if (payload.type === 'stream_started') {
          setIsCameraReady(true);
          setCameraError('');
          setDebugText('??? ?? ??, ??? ???? ????.');
          return;
        }

        if (payload.type === 'recording_started') {
          lessonStartedAtRef.current = Date.now();
          feedbackTimelineRef.current = [];
          if (latestFeedbackRef.current.trim()) {
            feedbackTimelineRef.current.push({
              atMs: 0,
              text: latestFeedbackRef.current.trim(),
            });
          }
          setDebugText('?? ?? ???? ??? ???? ????.');
          return;
        }

        if (payload.type === 'status') {
          setDebugText(payload.message);
          return;
        }

        if (payload.type === 'points') {
          setIsCameraReady(true);
          setDebugText(`?몄떇?? ${payload.summary}`);
          return;
        }

        if (payload.type === 'dribble_analysis') {
          setIsCameraReady(true);
          applyDribbleAnalysis(payload.analysis);
          return;
        }

        if (payload.type === 'shoot_analysis') {
          setIsCameraReady(true);
          applyShootAnalysisWithStance(payload.analysis);
          return;
        }

        if (payload.type === 'recording_ready') {
          void finalizeLessonSession(pendingStopSaveRef.current, payload.videoUri);
          return;
        }

        if (payload.type === 'recording_error') {
          setDebugText(payload.message || '?곸긽 ??μ뿉 ?ㅽ뙣?덉뒿?덈떎. ?쇰뱶諛깅쭔 ??λ맂 ?곹깭濡?醫낅즺?⑸땲??');

          if (pendingReviewStopRef.current) {
            pendingReviewStopRef.current = false;
            setRecordingStopToken(0);
            setIsLessonActive(false);
            setIsCameraActive(true);
            return;
          }

          if (pendingStopSaveRef.current) {
            void finalizeLessonSession(true, '');
          }
          return;
        }

        if (payload.type === 'error') {
          setCameraError(payload.message || 'MediaPipe ?먮뒗 移대찓???쒖옉 以?臾몄젣媛 諛쒖깮?덉뒿?덈떎.');
          setDebugText(payload.message || '移대찓???쒖옉 ?ㅽ뙣');
        }
      } catch {
        setDebugText('移대찓???곹깭 硫붿떆吏瑜?泥섎━?섎뒗 以묒엯?덈떎.');
      }
    },
    [applyDribbleAnalysis, applyShootAnalysisWithStance, completeDribbleReview, finalizeLessonSession, isLessonActive]
  );

  function openDiaryDate(dateKey: string) {
    setSelectedDateKey(dateKey);
  }

  function changeMonth(delta: number) {
    setCurrentDate((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  }

  function registerSuccessfulShot() {
    if (lessonMode !== 'shoot') {
      Alert.alert('??遺꾩꽍 紐⑤뱶 ?꾩슜', '???깃났 湲곕줉? ??遺꾩꽍 紐⑤뱶?먯꽌留??ъ슜?????덉뒿?덈떎.');
      return;
    }

    const todayKey = formatDateKey(new Date());
    const nextCount = (shotSuccessRecords[todayKey] || 0) + 1;

    setShotSuccessRecords((current) => ({
      ...current,
      [todayKey]: nextCount,
    }));

    const nextText = `?ㅻ뒛 ???깃났 ${nextCount}媛쒕? 湲곕줉?덉뒿?덈떎.`;
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
      Alert.alert('?닿린 ?ㅽ뙣', '湲곌린?먯꽌 ?곸긽???????놁뒿?덈떎.');
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
    homeworkToShow,
    currentDate,
    selectedDateKey,
    selectedDateRecords,
    selectedDateShotCount,
    calendarCells,
    selectedSkillKey,
    selectedBallBrand,
    selectedBallColors,
    debugText,
    feedbackText,
    lessonReview,
    isCameraActive,
    isLessonActive,
    isCameraReady,
    cameraSessionKey,
    countdownValue,
    recordingStartToken,
    recordingStopToken,
    cameraError,
    fireworks,
    showFireworks,
    navigateTo,
    changeLessonMode,
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



