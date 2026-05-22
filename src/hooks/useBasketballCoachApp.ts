import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Linking from 'expo-linking';
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
  '드리블 피드백\n1. 시선, 드리블 높이, 상체 높이를 분석하는 중입니다.\n2. 몸 전체와 드리블 손이 화면 안에 보이도록 맞춰 주세요.\n3. 분석이 안정되면 자세 기준에 맞춰 피드백이 바로 바뀝니다.';

const DEFAULT_SHOOT_FEEDBACK =
  '슛 피드백\n1. 팔 각도, 슛 시점, 하체 각도를 분석하는 중입니다.\n2. 어깨부터 발까지 몸 전체가 화면 안에 잘 보이도록 맞춰 주세요.\n3. 분석이 안정되면 슛 기준에 맞춰 피드백이 바로 바뀝니다.';

function createFireworks(): FireworkItem[] {
  const emojis = ['🏀', '✨', '🔥', '👏', '🎯'];

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
      ? '시선이 좋아요. 지금처럼 공이 아니라 앞을 바라봐 주세요.'
      : '먼저 공이 아니라 앞을 보도록 시선을 맞춰 주세요.';

  const torsoLine =
    analysis.torsoPosture === 'balanced'
      ? '상체 높이가 안정적이에요. 지금 자세를 유지해 주세요.'
      : analysis.torsoPosture === 'high'
        ? '드리블 전에 무릎을 굽히고 상체를 조금 더 낮춰 주세요.'
        : analysis.torsoPosture === 'low'
          ? '상체가 너무 많이 숙여졌어요. 상체를 조금 더 세워 균형을 맞춰 주세요.'
          : '어깨와 엉덩이가 함께 보이도록 자세를 다시 맞춰 주세요.';

  return `드리블 준비 자세\n1. ${eyeLine}\n2. 시선과 상체 자세가 모두 맞으면 3초 뒤 드리블을 시작합니다.\n3. ${torsoLine}`;
}

function isShootStanceReady(analysis: ShootAnalysis) {
  return analysis.armAngleState === 'balanced';
}

function buildDribbleStanceFeedbackV2(analysis: DribbleAnalysis) {
  const torsoLine =
    analysis.stanceState === 'ready'
      ? `상체 기울기 ${analysis.torsoLeanAngle ? analysis.torsoLeanAngle.toFixed(1) : '--'}도로 준비 자세가 좋습니다.`
      : analysis.stanceState === 'too_upright'
        ? `상체 기울기가 ${analysis.torsoLeanAngle ? analysis.torsoLeanAngle.toFixed(1) : '--'}도예요. 15~45도가 되도록 조금 더 숙여 주세요.`
        : analysis.stanceState === 'too_low'
          ? `상체 기울기가 ${analysis.torsoLeanAngle ? analysis.torsoLeanAngle.toFixed(1) : '--'}도예요. 너무 많이 숙였으니 조금 세워 주세요.`
          : '어깨와 엉덩이가 잘 보이도록 서서 상체 기울기를 다시 잡아 주세요.';

  return `드리블 준비 자세\n1. 엉덩이에서 어깨까지의 상체 기울기를 15~45도로 맞춰 주세요.\n2. 이 자세를 3초 동안 유지하면 드리블을 시작하라고 알려드릴게요.\n3. ${torsoLine}`;
}

function buildDribbleStanceFeedbackV3(analysis: DribbleAnalysis) {
  if (analysis.bodyFacing === 'front') {
    const stanceLine =
      analysis.stanceState === 'ready'
        ? `무릎-엉덩이-무릎 각도 ${analysis.frontStanceAngle ? analysis.frontStanceAngle.toFixed(1) : '--'}도로 자세를 잘 낮췄습니다.`
        : `무릎-엉덩이-무릎 각도가 ${analysis.frontStanceAngle ? analysis.frontStanceAngle.toFixed(1) : '--'}도예요. 40~60도가 되도록 자세를 다시 맞춰 주세요.`;

    return `정면 드리블 준비 자세\n1. 자세를 낮춰 왼쪽 무릎, 엉덩이, 오른쪽 무릎 사이 각도를 40~60도로 맞춰 주세요.\n2. 이 자세를 3초 동안 유지하면 드리블을 시작하라고 알려드릴게요.\n3. ${stanceLine}`;
  }

  return buildDribbleStanceFeedbackV2(analysis);
}

function buildShootStanceFeedback(analysis: ShootAnalysis) {
  const armLine =
    analysis.armAngleState === 'balanced'
      ? '슛을 시작하기 좋은 팔 각도예요. 지금 자세를 유지해 주세요.'
      : analysis.armAngleState === 'narrow'
        ? '슛 전에 팔 각도가 너무 좁아요. 어깨와 팔을 조금 더 벌려 주세요.'
        : analysis.armAngleState === 'wide'
          ? '슛 전에 팔 각도가 너무 넓어요. 팔을 조금 더 모아서 준비해 주세요.'
          : '어깨, 팔꿈치, 손목이 잘 보이도록 자세를 다시 맞춰 주세요.';

  return `슛 준비 자세\n1. ${armLine}\n2. 팔 각도가 기준에 맞으면 3초 뒤 슛을 시작합니다.\n3. 준비 자세가 흐트러지면 다시 자세부터 맞출게요.`;
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
  const [debugText, setDebugText] = useState('카메라와 MediaPipe를 준비하는 중입니다.');
  const [feedbackText, setFeedbackText] = useState(DEFAULT_DRIBBLE_FEEDBACK);
  const [isLessonActive, setIsLessonActive] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [cameraSessionKey, setCameraSessionKey] = useState(0);
  const [countdownValue, setCountdownValue] = useState<number | null>(null);
  const [fireworks, setFireworks] = useState<FireworkItem[]>([]);
  const [showFireworks, setShowFireworks] = useState(false);

  const feedbackIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingFeedbackRef = useRef<string | null>(null);
  const latestFeedbackRef = useRef(feedbackText);
  const lessonModeRef = useRef(lessonMode);
  const lessonStartedAtRef = useRef<number | null>(null);
  const dribbleLessonPhaseRef = useRef<DribbleLessonPhase>('stance_setup');
  const shootLessonStartedRef = useRef(false);
  const stanceCountdownStartedAtRef = useRef<number | null>(null);
  const feedbackTimelineRef = useRef<FeedbackMoment[]>([]);
  const pendingStopSaveRef = useRef(false);
  const recordingFallbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shootAutoEndTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
      setCameraError('카메라 시작이 지연되고 있습니다. 잠시 후에도 화면이 비어 있으면 진행 상태 문구와 함께 알려 주세요.');
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

  const addLessonHomework = useCallback((mode: LessonMode) => {
    const nextHomework = buildLessonHomework(mode);
    setHomework((current) => mergeHomework(current, nextHomework));
  }, []);

  const saveLessonRecord = useCallback((videoUri: string) => {
    const dateKey = formatDateKey(new Date());
    const nextRecord: LessonRecord = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      dateKey,
      mode: lessonModeRef.current,
      feedback: latestFeedbackRef.current,
      feedbackTimeline: [...feedbackTimelineRef.current],
      videoUri,
      createdAt: new Date().toLocaleString(),
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

      if (shouldSaveRecord) {
        addLessonHomework(lessonModeRef.current);
        saveLessonRecord(videoUri);
      }

      lessonStartedAtRef.current = null;
      dribbleLessonPhaseRef.current = 'stance_setup';
      shootLessonStartedRef.current = false;
      stanceCountdownStartedAtRef.current = null;
      feedbackTimelineRef.current = [];
      pendingFeedbackRef.current = null;
      setCountdownValue(null);
      setIsLessonActive(false);
      setIsCameraReady(false);
      setCameraError('');
      setDebugText('카메라와 MediaPipe를 준비하는 중입니다.');
      setFeedbackAndRemember('레슨이 종료되었습니다. 기록일지에서 저장된 영상과 피드백을 확인할 수 있어요.');
    },
    [addLessonHomework, clearRecordingWait, clearShootAutoEnd, saveLessonRecord]
  );

  async function navigateTo(nextScreen: AppScreen) {
    if (screen === 'lesson' && nextScreen !== 'lesson' && isLessonActive) {
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
    clearShootAutoEnd();
    stanceCountdownStartedAtRef.current = null;
    setCountdownValue(null);
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
    clearShootAutoEnd();
    stanceCountdownStartedAtRef.current = null;
    setCountdownValue(null);
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
      Alert.alert('권한 필요', '레슨 촬영과 자세 분석을 위해 카메라 권한이 필요합니다.');
      return false;
    }

    return true;
  }

  async function beginLesson() {
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
    stanceCountdownStartedAtRef.current = null;
    feedbackTimelineRef.current = [];
    setCountdownValue(null);
    setIsLessonActive(true);
    setIsCameraReady(false);
    setDebugText('MediaPipe 분석 화면을 시작하는 중입니다.');
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
    setDebugText('레슨 영상을 저장하는 중입니다.');
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
        pendingFeedbackRef.current = buildDribbleFeedbackText(analysis);
        setDebugText(`드리블 전체 분석 중: ${analysis.summary}`);
        return;
      }

      if (phase === 'await_dribble' && analysis.dribbleStarted) {
        dribbleLessonPhaseRef.current = 'active';
        stanceCountdownStartedAtRef.current = null;
        setCountdownValue(null);
        pendingFeedbackRef.current = buildDribbleFeedbackText(analysis);
        setDebugText(`?몄떇?? ${analysis.summary}`);
        return;
      }

      if (!stanceReady) {
        dribbleLessonPhaseRef.current = 'stance_setup';
        stanceCountdownStartedAtRef.current = null;
        setCountdownValue(null);
        pendingFeedbackRef.current = buildDribbleStanceFeedbackV3(analysis);
        setDebugText('드리블 전에 준비 자세를 맞추는 중입니다.');
        return;
      }

      if (phase === 'stance_setup') {
        dribbleLessonPhaseRef.current = 'countdown';
        stanceCountdownStartedAtRef.current = Date.now();
        setImmediateLessonFeedback('좋아요. 상체 기울기가 기준에 맞습니다. 3초 동안 그대로 유지해 주세요.');
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
          setImmediateLessonFeedback('좋아요. 이제 드리블을 시작해 주세요. 상체 기울기, 시선, 공 간격을 함께 분석할게요.');
          setDebugText('드리블 1, 2, 3 기준 분석 시작');
          return;
          setImmediateLessonFeedback('좋아요. 이제 드리블을 시작하세요. 공이 내려오기 시작하면 본격적으로 피드백할게요.');
          setDebugText('드리블 시작 안내');
          return;
        }

        const remainingSeconds = Math.max(1, Math.ceil((DRIBBLE_STANCE_HOLD_MS - elapsed) / 1000));
        pendingFeedbackRef.current = `드리블 준비 자세 유지 중입니다.\n1. 상체 기울기를 지금처럼 15~45도로 유지해 주세요.\n2. ${remainingSeconds}초만 더 유지하면 드리블을 시작할 수 있어요.\n3. 자세가 무너지면 다시 준비 자세부터 확인할게요.`;
        setDebugText(`드리블 준비 자세 유지 중: ${remainingSeconds}초 남음`);
        return;
      }

      pendingFeedbackRef.current = '이제 드리블을 시작하세요. 공이 무릎이나 발 쪽까지 내려오면 드리블 분석을 이어갈게요.';
      setDebugText('드리블 시작 대기 중');
      return;
      setDebugText(`인식됨: ${analysis.summary}`);
    },
    []
  );

  const applyShootAnalysis = useCallback(
    (analysis: ShootAnalysis) => {
      if (lessonModeRef.current !== 'shoot') {
        return;
      }

      pendingFeedbackRef.current = buildShootFeedbackText(analysis);
      setDebugText(`인식됨: ${analysis.summary}`);
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
    [scheduleShootAutoEnd, setImmediateLessonFeedback]
  );

  const handlePoseMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const payload = JSON.parse(event.nativeEvent.data) as
          | { type: 'ready' }
          | { type: 'stream_started' }
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
          lessonStartedAtRef.current = Date.now();
          feedbackTimelineRef.current = [];
          if (latestFeedbackRef.current.trim()) {
            feedbackTimelineRef.current.push({
              atMs: 0,
              text: latestFeedbackRef.current.trim(),
            });
          }
          setIsCameraReady(true);
          setCameraError('');
          setDebugText('카메라 시작 완료, 자세를 인식하는 중입니다.');
          return;
        }

        if (payload.type === 'status') {
          setDebugText(payload.message);
          return;
        }

        if (payload.type === 'points') {
          setIsCameraReady(true);
          setDebugText(`인식됨: ${payload.summary}`);
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
          setDebugText(payload.message || '영상 저장에 실패했습니다. 피드백만 저장된 상태로 종료합니다.');

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
        setDebugText('카메라 상태 메시지를 처리하는 중입니다.');
      }
    },
    [applyDribbleAnalysis, applyShootAnalysisWithStance, finalizeLessonSession]
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
    isLessonActive,
    isCameraReady,
    cameraSessionKey,
    countdownValue,
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
