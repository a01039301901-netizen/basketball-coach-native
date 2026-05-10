import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Linking from 'expo-linking';
import { useCameraPermissions } from 'expo-camera';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import type { WebViewMessageEvent } from 'react-native-webview';
import { SKILLS } from '../constants/content';
import { DRIBBLE_FEEDBACKS, SHOOT_FEEDBACKS } from '../constants/feedback';
import { STORAGE_KEYS } from '../constants/storage';
import type { AppScreen, FireworkItem, LessonMode, LessonRecord, SkillKey } from '../types/app';
import { getCalendarCells } from '../utils/calendar';
import { formatDateKey } from '../utils/date';
import { buildFeedbackText } from '../utils/feedback';
import { buildLessonHomework, getHomeworkToShow, mergeHomework } from '../utils/homework';

function createFireworks(): FireworkItem[] {
  const emojis = ['🎉', '✨', '🔥', '🏀', '🎯'];

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
  const [debugText, setDebugText] = useState('카메라와 MediaPipe 준비 중');
  const [feedbackText, setFeedbackText] = useState('레슨을 시작하면 이곳에 드리블 또는 슛 코칭 피드백이 표시됩니다.');
  const [isLessonActive, setIsLessonActive] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [fireworks, setFireworks] = useState<FireworkItem[]>([]);
  const [showFireworks, setShowFireworks] = useState(false);

  const feedbackIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const latestFeedbackRef = useRef(feedbackText);
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
        const parsedLessonRecords = parseStoredJson<LessonRecord[]>(stored[STORAGE_KEYS.lessonRecords], []);
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
        Alert.alert('불러오기 실패', '저장된 앱 데이터를 읽는 중 문제가 발생했습니다.');
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
      setDebugText('보안 WebView에서 카메라 응답을 기다리는 중입니다.');
      setCameraError('카메라 시작이 지연되고 있습니다. 잠시 후에도 화면이 검게 유지되면 진행 상태 문구와 함께 알려주세요.');
    }, 8000);

    return () => clearTimeout(timer);
  }, [cameraError, isCameraReady, isLessonActive]);

  function addLessonHomework(mode: LessonMode) {
    const nextHomework = buildLessonHomework(mode);
    setHomework((current) => mergeHomework(current, nextHomework));
  }

  function saveLessonRecord() {
    const dateKey = formatDateKey(new Date());
    const nextRecord: LessonRecord = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      dateKey,
      mode: lessonMode,
      feedback: latestFeedbackRef.current,
      videoUri: '',
      createdAt: new Date().toLocaleString(),
    };

    setLessonRecords((current) => [...current, nextRecord]);
    setSelectedDateKey(dateKey);
  }

  async function finishLessonSession(shouldSaveRecord: boolean) {
    if (feedbackIntervalRef.current) {
      clearInterval(feedbackIntervalRef.current);
      feedbackIntervalRef.current = null;
    }

    if (shouldSaveRecord) {
      addLessonHomework(lessonMode);
      saveLessonRecord();
    }

    setIsLessonActive(false);
    setIsCameraReady(false);
    setDebugText('카메라와 MediaPipe 준비 중');
    setFeedbackText('레슨이 종료되었습니다. 기록일지에서 저장된 분석 내용을 확인할 수 있어요.');
  }

  async function navigateTo(nextScreen: AppScreen) {
    if (screen === 'lesson' && nextScreen !== 'lesson' && isLessonActive) {
      await finishLessonSession(true);
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
    setFeedbackText(
      mode === 'shoot'
        ? '레슨을 시작하면 이곳에 슛 코칭 피드백이 표시됩니다.'
        : '레슨을 시작하면 이곳에 드리블 코칭 피드백이 표시됩니다.'
    );
    setDebugText(mode === 'shoot' ? '슛 분석 모드 준비 중' : '드리블 분석 모드 준비 중');
  }

  function startFeedbackLoop(mode: LessonMode) {
    const feedbackPool = mode === 'shoot' ? SHOOT_FEEDBACKS : DRIBBLE_FEEDBACKS;

    if (feedbackIntervalRef.current) {
      clearInterval(feedbackIntervalRef.current);
    }

    let index = 0;

    const pushFeedback = () => {
      const lines = feedbackPool[index % feedbackPool.length];
      const nextFeedback = buildFeedbackText(mode, lines);
      latestFeedbackRef.current = nextFeedback;
      setFeedbackText(nextFeedback);
      index += 1;
    };

    pushFeedback();
    feedbackIntervalRef.current = setInterval(pushFeedback, 4000);
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

    setCameraError('');
    setIsLessonActive(true);
    setIsCameraReady(false);
    setDebugText('MediaPipe 분석 뷰를 시작하는 중');
    startFeedbackLoop(lessonMode);
  }

  async function endLesson() {
    await finishLessonSession(isLessonActive);
  }

  const handlePoseMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const payload = JSON.parse(event.nativeEvent.data) as {
        type: 'ready' | 'stream_started' | 'status' | 'points' | 'error';
        message?: string;
        summary?: string;
      };

      if (payload.type === 'ready') {
        setDebugText('MediaPipe 모델 준비 완료');
        return;
      }

      if (payload.type === 'stream_started') {
        setIsCameraReady(true);
        setCameraError('');
        setDebugText('카메라 시작 완료, 자세를 인식하는 중');
        return;
      }

      if (payload.type === 'status' && payload.message) {
        setDebugText(payload.message);
        return;
      }

      if (payload.type === 'points' && payload.summary) {
        setIsCameraReady(true);
        setDebugText(`인식됨: ${payload.summary}`);
        return;
      }

      if (payload.type === 'error') {
        setCameraError(payload.message || 'MediaPipe 또는 카메라 시작 중 문제가 발생했습니다.');
        setDebugText(payload.message || '카메라 시작 실패');
      }
    } catch {
      setDebugText('카메라 상태 메시지를 처리하는 중');
    }
  }, []);

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

    const nextText = `오늘 슛 성공 ${nextCount}개가 기록되었습니다.`;
    setFeedbackText(nextText);
    latestFeedbackRef.current = nextText;
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

    if (record?.videoUri) {
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
