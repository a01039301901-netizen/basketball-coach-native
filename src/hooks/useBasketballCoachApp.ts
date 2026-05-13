import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Linking from 'expo-linking';
import { useCameraPermissions } from 'expo-camera';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import type { WebViewMessageEvent } from 'react-native-webview';
import { SKILLS } from '../constants/content';
import { STORAGE_KEYS } from '../constants/storage';
import type {
  AppScreen,
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
  const [debugText, setDebugText] = useState('카메라와 MediaPipe를 준비하는 중입니다.');
  const [feedbackText, setFeedbackText] = useState(DEFAULT_DRIBBLE_FEEDBACK);
  const [isLessonActive, setIsLessonActive] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [fireworks, setFireworks] = useState<FireworkItem[]>([]);
  const [showFireworks, setShowFireworks] = useState(false);

  const feedbackIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const latestFeedbackRef = useRef(feedbackText);
  const lessonModeRef = useRef(lessonMode);
  const lessonStartedAtRef = useRef<number | null>(null);
  const feedbackTimelineRef = useRef<FeedbackMoment[]>([]);
  const pendingStopSaveRef = useRef(false);
  const recordingFallbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

        const todayKey = formatDateKey(new Date());
        parsedAttendance[todayKey] = 'attended';

        setAttendance(parsedAttendance);
        setHomework(parsedHomework);
        setLessonRecords(parsedLessonRecords);
        setShotSuccessRecords(parsedShotSuccess);
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
    return () => {
      if (feedbackIntervalRef.current) {
        clearInterval(feedbackIntervalRef.current);
      }

      if (recordingFallbackTimeoutRef.current) {
        clearTimeout(recordingFallbackTimeoutRef.current);
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
    const atMs = startedAt ? Math.max(0, Date.now() - startedAt) : 0;
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

  const clearRecordingWait = useCallback(() => {
    pendingStopSaveRef.current = false;
    if (recordingFallbackTimeoutRef.current) {
      clearTimeout(recordingFallbackTimeoutRef.current);
      recordingFallbackTimeoutRef.current = null;
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

      if (shouldSaveRecord) {
        addLessonHomework(lessonModeRef.current);
        saveLessonRecord(videoUri);
      }

      lessonStartedAtRef.current = null;
      feedbackTimelineRef.current = [];
      setIsLessonActive(false);
      setIsCameraReady(false);
      setCameraError('');
      setDebugText('카메라와 MediaPipe를 준비하는 중입니다.');
      setFeedbackAndRemember('레슨이 종료되었습니다. 기록일지에서 저장된 영상과 피드백을 확인할 수 있어요.');
    },
    [addLessonHomework, clearRecordingWait, saveLessonRecord, setFeedbackAndRemember]
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

  function changeLessonMode(mode: LessonMode) {
    setLessonMode(mode);
    setFeedbackAndRemember(mode === 'shoot' ? DEFAULT_SHOOT_FEEDBACK : DEFAULT_DRIBBLE_FEEDBACK);
    setDebugText(mode === 'shoot' ? '슛 분석 모드를 준비하는 중입니다.' : '드리블 분석 모드를 준비하는 중입니다.');
  }

  function startFeedbackLoop(mode: LessonMode) {
    if (feedbackIntervalRef.current) {
      clearInterval(feedbackIntervalRef.current);
      feedbackIntervalRef.current = null;
    }

    setFeedbackAndRemember(mode === 'shoot' ? DEFAULT_SHOOT_FEEDBACK : DEFAULT_DRIBBLE_FEEDBACK);
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
    setCameraError('');
    lessonStartedAtRef.current = Date.now();
    feedbackTimelineRef.current = [];
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

  const applyDribbleAnalysis = useCallback(
    (analysis: DribbleAnalysis) => {
      if (lessonModeRef.current !== 'dribble') {
        return;
      }

      setFeedbackAndRemember(buildDribbleFeedbackText(analysis));
      setDebugText(`인식됨: ${analysis.summary}`);
    },
    [setFeedbackAndRemember]
  );

  const applyShootAnalysis = useCallback(
    (analysis: ShootAnalysis) => {
      if (lessonModeRef.current !== 'shoot') {
        return;
      }

      setFeedbackAndRemember(buildShootFeedbackText(analysis));
      setDebugText(`인식됨: ${analysis.summary}`);
    },
    [setFeedbackAndRemember]
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
          applyShootAnalysis(payload.analysis);
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
    [applyDribbleAnalysis, applyShootAnalysis, finalizeLessonSession]
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
    debugText,
    feedbackText,
    isLessonActive,
    isCameraReady,
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
    openSkillVideo,
    openDiaryDate,
    changeMonth,
    deleteLessonRecord,
  };
}
