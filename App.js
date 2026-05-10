import AsyncStorage from '@react-native-async-storage/async-storage';
import { ResizeMode, Video } from 'expo-av';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system';
import * as Linking from 'expo-linking';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const STORAGE_KEYS = {
  attendance: 'basketballAttendance',
  homework: 'basketballHomework',
  lessonRecords: 'basketballLessonRecords',
  shotSuccess: 'shotSuccessRecords',
};

const REQUIRED_HOMEWORK = '농구 영상 1개 촬영하기';
const REQUIRED_SKILL_HOMEWORK = '새로운 기술 배우기';

const SKILLS = {
  shoot: {
    title: '슛 폼',
    player: '스테픈 커리',
    point: '무릎, 팔꿈치, 손목이 자연스럽게 이어지는 릴리즈를 관찰해 보세요.',
    query: 'Stephen Curry shooting form tutorial',
  },
  crossover: {
    title: '크로스오버',
    player: '앨런 아이버슨',
    point: '몸 방향을 속이고 공을 빠르게 반대쪽으로 넘기는 타이밍을 보세요.',
    query: 'Allen Iverson crossover tutorial',
  },
  layup: {
    title: '레이업',
    player: '카이리 어빙',
    point: '스텝과 손목 감각, 림 근처 마무리 동작을 관찰해 보세요.',
    query: 'Kyrie Irving layup tutorial',
  },
  stepback: {
    title: '스텝백',
    player: '제임스 하든',
    point: '뒤로 빠지는 발 동작과 슛 밸런스를 집중해서 보세요.',
    query: 'James Harden step back tutorial',
  },
  spin: {
    title: '스핀무브',
    player: '르브론 제임스',
    point: '수비수를 등지고 회전할 때 중심을 잃지 않는 자세를 보세요.',
    query: 'LeBron James spin move tutorial',
  },
  defense: {
    title: '수비 자세',
    player: '카와이 레너드',
    point: '낮은 자세, 발 이동, 손 위치를 관찰해 보세요.',
    query: 'Kawhi Leonard defense tutorial',
  },
};

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

const DRIBBLE_FEEDBACKS = [
  [
    '시선 처리가 좋아요. 앞을 보는 자세를 유지해 보세요.',
    '드리블 높이가 괜찮아요. 지금 간격을 유지해 보세요.',
    '상체 기울기가 좋아요. 안정적인 자세를 유지해 보세요.',
  ],
  [
    '시선이 공 쪽으로 내려간 것 같아요. 공이 아니라 앞을 보고 드리블해 보세요.',
    '공이 목 높이에 가까워요. 드리블을 조금 더 낮게 해 보세요.',
    '상체가 너무 세워져 있어요. 무릎을 굽히고 상체를 조금 낮춰 주세요.',
  ],
  [
    '시선 처리가 좋아요. 수비를 본다는 느낌으로 유지해 보세요.',
    '공이 엉덩이 높이에 너무 가까워요. 드리블을 조금 더 높게 해 보세요.',
    '상체가 너무 많이 숙여져 있어요. 시야가 좁아질 수 있으니 상체를 조금 높여 주세요.',
  ],
];

const SHOOT_FEEDBACKS = [
  [
    '팔 각도가 좋아요. 안정적인 슛 자세예요.',
    '슛 타이밍이 좋아요. 최고점에서 자연스럽게 릴리즈했어요.',
    '하체 자세가 좋아요. 점프 힘을 잘 사용할 수 있는 자세예요.',
  ],
  [
    '팔 각도가 조금 좁아요. 팔을 살짝 벌려 밀어 넣는 느낌으로 슛해 보세요.',
    '슛을 너무 빠르게 던졌어요. 최고점에서 부드럽게 릴리즈해 보세요.',
    '무릎이 너무 많이 굽혀졌어요. 조금 더 안정적으로 점프해 보세요.',
  ],
  [
    '팔 각도가 조금 넓어요. 팔을 조금 더 모아 힘을 효율적으로 전달해 보세요.',
    '슛 타이밍이 늦어요. 점프의 힘을 쓰려면 조금 더 일찍 던져 보세요.',
    '무릎이 너무 펴져 있어 점프 힘이 부족할 수 있어요. 자세를 조금 더 낮춰 보세요.',
  ],
];

function formatDateKey(date) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function formatMonthTitle(date) {
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
}

function buildFeedbackText(mode, lines) {
  const title = mode === 'shoot' ? '슛 피드백' : '드리블 피드백';
  return `${title}\n1. ${lines[0]}\n2. ${lines[1]}\n3. ${lines[2]}`;
}

function getHomeworkToShow(homework) {
  return [REQUIRED_HOMEWORK, REQUIRED_SKILL_HOMEWORK, ...homework].slice(0, 4);
}

function getCalendarCells(currentDate, attendance) {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const lastDate = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const todayFloor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const cells = [];

  for (let i = 0; i < firstDay; i += 1) {
    cells.push({ type: 'empty', key: `empty-${i}` });
  }

  for (let date = 1; date <= lastDate; date += 1) {
    const dateKey = `${year}-${month + 1}-${date}`;
    const targetDate = new Date(year, month, date);
    let status = '미체크';
    let variant = 'default';

    if (attendance[dateKey] === 'attended') {
      status = '출석';
      variant = 'attended';
    } else if (targetDate < todayFloor) {
      status = '결석';
      variant = 'absent';
    }

    cells.push({
      type: 'day',
      key: dateKey,
      date,
      dateKey,
      status,
      variant,
    });
  }

  return cells;
}

function createFireworks() {
  const emojis = ['🎉', '✨', '🔥', '🏀', '🎯'];

  return Array.from({ length: 10 }, (_, index) => ({
    id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
    emoji: emojis[Math.floor(Math.random() * emojis.length)],
    left: `${12 + Math.random() * 74}%`,
    top: `${10 + Math.random() * 42}%`,
  }));
}

function FireworkBurst({ visible, items }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translate = useRef(new Animated.Value(18)).current;
  const scale = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    if (!visible) {
      opacity.setValue(0);
      translate.setValue(18);
      scale.setValue(0.45);
      return;
    }

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 160,
        useNativeDriver: true,
      }),
      Animated.timing(translate, {
        toValue: -34,
        duration: 900,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.35,
          duration: 260,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 0.9,
          duration: 520,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [opacity, scale, translate, visible]);

  if (!visible) {
    return null;
  }

  return (
    <View pointerEvents="none" style={styles.fireworkArea}>
      {items.map((item) => (
        <Animated.Text
          key={item.id}
          style={[
            styles.firework,
            {
              left: item.left,
              top: item.top,
              opacity,
              transform: [{ translateY: translate }, { scale }],
            },
          ]}
        >
          {item.emoji}
        </Animated.Text>
      ))}
    </View>
  );
}

function Header({ showBack, onBack }) {
  return (
    <View style={styles.header}>
      <View style={styles.headerTextWrap}>
        <Text style={styles.headerEyebrow}>BASKETBALL TRAINING</Text>
        <Text style={styles.headerTitle}>AI 농구 코치</Text>
      </View>
      {showBack ? (
        <Pressable onPress={onBack} style={({ pressed }) => [styles.backButton, pressed && styles.buttonPressed]}>
          <Text style={styles.backButtonText}>메인으로</Text>
        </Pressable>
      ) : (
        <View style={styles.backButtonPlaceholder} />
      )}
    </View>
  );
}

function Card({ title, children, style }) {
  return (
    <View style={[styles.card, style]}>
      <Text style={styles.cardTitle}>{title}</Text>
      {children}
    </View>
  );
}

function PrimaryButton({ title, subtitle, onPress }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.mainButton, pressed && styles.buttonPressed]}>
      <Text style={styles.mainButtonTitle}>{title}</Text>
      <Text style={styles.mainButtonSubtitle}>{subtitle}</Text>
    </Pressable>
  );
}

function SmallButton({ title, onPress, variant = 'orange', disabled = false }) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.smallButton,
        variant === 'red' && styles.smallButtonRed,
        variant === 'dark' && styles.smallButtonDark,
        disabled && styles.smallButtonDisabled,
        pressed && !disabled && styles.buttonPressed,
      ]}
    >
      <Text style={styles.smallButtonText}>{title}</Text>
    </Pressable>
  );
}

export default function App() {
  const [screen, setScreen] = useState('home');
  const [lessonMode, setLessonMode] = useState('dribble');
  const [homework, setHomework] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [lessonRecords, setLessonRecords] = useState([]);
  const [shotSuccessRecords, setShotSuccessRecords] = useState({});
  const [selectedDateKey, setSelectedDateKey] = useState('');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedSkillKey, setSelectedSkillKey] = useState('');
  const [debugText, setDebugText] = useState('카메라와 공 인식 준비 중');
  const [feedbackText, setFeedbackText] = useState('레슨을 시작하면 이곳에 드리블 또는 슛 코칭 피드백이 표시됩니다.');
  const [isLessonActive, setIsLessonActive] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [fireworks, setFireworks] = useState([]);
  const [showFireworks, setShowFireworks] = useState(false);

  const cameraRef = useRef(null);
  const feedbackIntervalRef = useRef(null);
  const latestFeedbackRef = useRef(feedbackText);

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [microphonePermission, requestMicrophonePermission] = useMicrophonePermissions();

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
        const parsedAttendance = stored[STORAGE_KEYS.attendance] ? JSON.parse(stored[STORAGE_KEYS.attendance]) : {};
        const parsedHomework = stored[STORAGE_KEYS.homework] ? JSON.parse(stored[STORAGE_KEYS.homework]) : [];
        const parsedLessonRecords = stored[STORAGE_KEYS.lessonRecords] ? JSON.parse(stored[STORAGE_KEYS.lessonRecords]) : [];
        const parsedShotSuccess = stored[STORAGE_KEYS.shotSuccess] ? JSON.parse(stored[STORAGE_KEYS.shotSuccess]) : {};

        const todayKey = formatDateKey(new Date());
        parsedAttendance[todayKey] = 'attended';

        setAttendance(parsedAttendance);
        setHomework(parsedHomework);
        setLessonRecords(parsedLessonRecords);
        setShotSuccessRecords(parsedShotSuccess);
        setSelectedDateKey(todayKey);

        await AsyncStorage.setItem(STORAGE_KEYS.attendance, JSON.stringify(parsedAttendance));
      } catch (error) {
        Alert.alert('불러오기 실패', '저장된 앱 데이터를 읽는 중 문제가 발생했습니다.');
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEYS.homework, JSON.stringify(homework));
  }, [homework]);

  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEYS.attendance, JSON.stringify(attendance));
  }, [attendance]);

  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEYS.lessonRecords, JSON.stringify(lessonRecords));
  }, [lessonRecords]);

  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEYS.shotSuccess, JSON.stringify(shotSuccessRecords));
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

  async function navigateTo(nextScreen) {
    if (screen === 'lesson' && nextScreen !== 'lesson' && isLessonActive) {
      await finishLessonRecording(true);
    }

    setScreen(nextScreen);
    if (nextScreen === 'diary' && !selectedDateKey) {
      setSelectedDateKey(formatDateKey(new Date()));
    }
  }

  function selectSkill(skillKey) {
    setSelectedSkillKey(skillKey);
  }

  function changeLessonMode(mode) {
    setLessonMode(mode);
    setFeedbackText(
      mode === 'shoot'
        ? '레슨을 시작하면 이곳에 슛 코칭 피드백이 표시됩니다.'
        : '레슨을 시작하면 이곳에 드리블 코칭 피드백이 표시됩니다.'
    );
    setDebugText(mode === 'shoot' ? '슛 분석 모드 준비 중' : '드리블 분석 모드 준비 중');
  }

  function startFeedbackLoop(mode) {
    const feedbackPool = mode === 'shoot' ? SHOOT_FEEDBACKS : DRIBBLE_FEEDBACKS;

    if (feedbackIntervalRef.current) {
      clearInterval(feedbackIntervalRef.current);
    }

    let index = 0;

    const pushFeedback = () => {
      const lines = feedbackPool[index % feedbackPool.length];
      const nextFeedback = buildFeedbackText(mode, lines);
      const nextDebug = mode === 'shoot' ? '슛 분석 중' : '드리블 분석 중';

      setFeedbackText(nextFeedback);
      setDebugText(`${nextDebug} · 카메라 영상을 기반으로 코칭을 정리하고 있어요.`);
      latestFeedbackRef.current = nextFeedback;
      index += 1;
    };

    pushFeedback();
    feedbackIntervalRef.current = setInterval(pushFeedback, 4000);
  }

  async function ensurePermissions() {
    const cameraGranted = cameraPermission?.granted ?? (await requestCameraPermission()).granted;
    const microphoneGranted = microphonePermission?.granted ?? (await requestMicrophonePermission()).granted;

    if (!cameraGranted || !microphoneGranted) {
      Alert.alert('권한 필요', '레슨 촬영을 위해 카메라와 마이크 권한이 필요합니다.');
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
    setIsRecording(false);
    setIsCameraReady(false);
    startFeedbackLoop(lessonMode);
  }

  async function persistLessonRecord(tempUri) {
    const baseDir = FileSystem.documentDirectory ?? FileSystem.cacheDirectory;
    if (!baseDir) {
      return '';
    }

    const extension = tempUri.split('.').pop() || 'mov';
    const fileName = `lesson-${Date.now()}.${extension}`;
    const nextUri = `${baseDir}${fileName}`;

    await FileSystem.copyAsync({
      from: tempUri,
      to: nextUri,
    });

    return nextUri;
  }

  function addLessonHomework(mode) {
    const nextHomework = mode === 'shoot' ? '슛 30개 쏴보기' : '드리블 50개 연습하기';

    setHomework((current) => {
      const merged = current.includes(nextHomework) ? current.slice() : [nextHomework, ...current];
      return merged
        .filter((item) => item !== REQUIRED_HOMEWORK && item !== REQUIRED_SKILL_HOMEWORK)
        .slice(0, 2);
    });
  }

  async function finishLessonRecording(shouldStopRecording) {
    const modeAtFinish = lessonMode;

    if (feedbackIntervalRef.current) {
      clearInterval(feedbackIntervalRef.current);
      feedbackIntervalRef.current = null;
    }

    addLessonHomework(modeAtFinish);

    if (shouldStopRecording && isRecording && cameraRef.current) {
      try {
        await cameraRef.current.stopRecording();
      } catch (error) {
        // Ignore duplicate stop calls if recording already ended.
      }
    }

    setIsLessonActive(false);
    setIsRecording(false);
    setIsCameraReady(false);
    setDebugText('카메라와 공 인식 준비 중');
    setFeedbackText('레슨이 종료되었습니다. 기록일지에서 저장된 영상을 확인할 수 있어요.');
  }

  async function handleCameraReady() {
    setIsCameraReady(true);

    if (!isLessonActive || isRecording || !cameraRef.current) {
      return;
    }

    try {
      setIsRecording(true);
      const result = await cameraRef.current.recordAsync({
        maxDuration: 120,
      });

      if (!result?.uri) {
        setIsRecording(false);
        return;
      }

      const storedUri = await persistLessonRecord(result.uri);
      const dateKey = formatDateKey(new Date());
      const nextRecord = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        dateKey,
        mode: lessonMode,
        feedback: latestFeedbackRef.current,
        videoUri: storedUri,
        createdAt: new Date().toLocaleString(),
      };

      setLessonRecords((current) => [...current, nextRecord]);
      setSelectedDateKey(dateKey);
      setFeedbackText('오늘 레슨 영상과 피드백이 기록일지에 저장되었습니다.');
      latestFeedbackRef.current = '오늘 레슨 영상과 피드백이 기록일지에 저장되었습니다.';
      setIsRecording(false);
    } catch (error) {
      setCameraError('영상 녹화 또는 저장 중 문제가 발생했습니다.');
      setIsRecording(false);
    }
  }

  async function endLesson() {
    await finishLessonRecording(true);
  }

  function openDiaryDate(dateKey) {
    setSelectedDateKey(dateKey);
  }

  function changeMonth(delta) {
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

  async function deleteLessonRecord(recordId) {
    const record = lessonRecords.find((item) => item.id === recordId);

    if (record?.videoUri) {
      try {
        await FileSystem.deleteAsync(record.videoUri, { idempotent: true });
      } catch (error) {
        // Ignore delete failures for already-removed files.
      }
    }

    setLessonRecords((current) => current.filter((item) => item.id !== recordId));
  }

  function renderHomeScreen() {
    return (
      <View style={styles.contentGap}>
        <Card title="오늘은 어떤 연습을 할까요?" style={styles.heroCard}>
          <Text style={styles.paragraph}>
            기존 HTML 시안의 흐름을 바탕으로 다시 만든 모바일 전용 농구 코치 앱입니다. 원하는 기능을 선택해서 연습을 시작해 보세요.
          </Text>
          <View style={styles.verticalGap}>
            <PrimaryButton
              title="AI 레슨 받기"
              subtitle="카메라로 촬영하면서 드리블 또는 슛 코칭 피드백을 확인합니다."
              onPress={() => navigateTo('lesson')}
            />
            <PrimaryButton
              title="기록일지 보기"
              subtitle="출석, 슛 성공 개수, 저장된 레슨 영상을 날짜별로 확인합니다."
              onPress={() => navigateTo('diary')}
            />
            <PrimaryButton
              title="기술 배우기"
              subtitle="선수별 기술 포인트와 유튜브 검색 링크를 확인합니다."
              onPress={() => navigateTo('skill')}
            />
          </View>
        </Card>

        <Card title="오늘의 숙제">
          {homeworkToShow.map((item) => (
            <View key={item} style={styles.homeworkItem}>
              <Text style={styles.homeworkText}>{item}</Text>
            </View>
          ))}
        </Card>
      </View>
    );
  }

  function renderLessonScreen() {
    return (
      <View style={styles.contentGap}>
        <Card title="AI 레슨 받기" style={styles.heroCard}>
          <Text style={styles.paragraph}>분석 모드를 고르고 촬영을 시작해 주세요. 촬영 중에는 코칭 피드백이 자동으로 바뀝니다.</Text>

          <View style={styles.modeRow}>
            <Pressable
              disabled={isLessonActive}
              onPress={() => changeLessonMode('dribble')}
              style={({ pressed }) => [
                styles.modeButton,
                lessonMode === 'dribble' && styles.modeButtonActive,
                isLessonActive && styles.modeButtonDisabled,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={styles.modeButtonText}>드리블 분석</Text>
            </Pressable>
            <Pressable
              disabled={isLessonActive}
              onPress={() => changeLessonMode('shoot')}
              style={({ pressed }) => [
                styles.modeButton,
                lessonMode === 'shoot' && styles.modeButtonActive,
                isLessonActive && styles.modeButtonDisabled,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={styles.modeButtonText}>슛 분석</Text>
            </Pressable>
          </View>

          <View style={styles.statusBox}>
            <Text style={styles.statusText}>현재 모드: {lessonMode === 'shoot' ? '슛 분석' : '드리블 분석'}</Text>
          </View>

          <View style={styles.videoWrap}>
            {isLessonActive ? (
              <>
                <CameraView
                  ref={cameraRef}
                  style={styles.camera}
                  facing="front"
                  mode="video"
                  mute={false}
                  mirror
                  onCameraReady={handleCameraReady}
                  onMountError={(event) => setCameraError(event.nativeEvent.message)}
                />
                <View style={styles.cameraOverlay}>
                  <View style={styles.cameraBadge}>
                    <Text style={styles.cameraBadgeText}>
                      {isRecording ? 'REC' : isCameraReady ? 'READY' : 'LOADING'}
                    </Text>
                  </View>
                  <Text style={styles.overlayHint}>전신과 공이 함께 보이도록 세워 두면 더 좋은 피드백을 받을 수 있어요.</Text>
                </View>
              </>
            ) : (
              <View style={styles.cameraPlaceholder}>
                <Text style={styles.placeholderTitle}>카메라 대기 중</Text>
                <Text style={styles.placeholderText}>레슨 시작을 누르면 앱 안에서 바로 촬영을 시작합니다.</Text>
              </View>
            )}
          </View>

          <View style={styles.controlsRow}>
            <SmallButton title="레슨 시작" onPress={beginLesson} disabled={isLessonActive} />
            {lessonMode === 'shoot' ? <SmallButton title="슛 성공" onPress={registerSuccessfulShot} variant="dark" /> : null}
            <SmallButton title="레슨 종료" onPress={endLesson} variant="red" disabled={!isLessonActive} />
          </View>

          <View style={styles.infoBox}>
            <Text style={styles.infoLabel}>진행 상태</Text>
            <Text style={styles.infoText}>{debugText}</Text>
          </View>

          <View style={styles.infoBox}>
            <Text style={styles.infoLabel}>코칭 피드백</Text>
            <Text style={styles.infoText}>{feedbackText}</Text>
          </View>

          {cameraError ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{cameraError}</Text>
            </View>
          ) : null}
        </Card>

        <Card title="촬영 팁">
          <View style={styles.tipList}>
            <Text style={styles.tipText}>공이 화면에 너무 작게 나오지 않도록 촬영하기</Text>
            <Text style={styles.tipText}>주황색 배경 물건이 많지 않은 곳에서 촬영하기</Text>
            <Text style={styles.tipText}>너무 어두운 공간은 피하고 밝은 곳에서 촬영하기</Text>
            <Text style={styles.tipText}>드리블은 몸과 공이 함께 보이게, 슛은 상체와 릴리즈가 보이게 촬영하기</Text>
          </View>
        </Card>
      </View>
    );
  }

  function renderSkillScreen() {
    return (
      <Card title="새로운 기술 배우기">
        <Text style={styles.paragraph}>배우고 싶은 기술을 고르면 대표 선수와 관찰 포인트를 보여주고, 유튜브 검색으로 바로 이어집니다.</Text>

        <View style={styles.skillGrid}>
          {Object.entries(SKILLS).map(([key, value]) => (
            <Pressable
              key={key}
              onPress={() => selectSkill(key)}
              style={({ pressed }) => [
                styles.skillButton,
                selectedSkillKey === key && styles.skillButtonActive,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={styles.skillButtonText}>{value.title}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.skillViewer}>
          {selectedSkill ? (
            <>
              <Text style={styles.skillTitle}>{selectedSkill.title}</Text>
              <Text style={styles.skillInfo}>대표 선수: {selectedSkill.player}</Text>
              <Text style={styles.skillInfo}>관찰 포인트: {selectedSkill.point}</Text>
              <SmallButton title="유튜브에서 보기" onPress={openSkillVideo} />
            </>
          ) : (
            <Text style={styles.skillInfo}>기술을 선택하면 여기에서 설명과 영상 이동 버튼을 볼 수 있어요.</Text>
          )}
        </View>
      </Card>
    );
  }

  function renderDiaryScreen() {
    return (
      <Card title="기록일지">
        <View style={styles.calendarTop}>
          <SmallButton title="이전 달" onPress={() => changeMonth(-1)} variant="dark" />
          <Text style={styles.monthTitle}>{formatMonthTitle(currentDate)}</Text>
          <SmallButton title="다음 달" onPress={() => changeMonth(1)} variant="dark" />
        </View>

        <View style={styles.calendarGrid}>
          {DAY_NAMES.map((name) => (
            <View key={name} style={styles.dayName}>
              <Text style={styles.dayNameText}>{name}</Text>
            </View>
          ))}

          {calendarCells.map((cell) => {
            if (cell.type === 'empty') {
              return <View key={cell.key} style={[styles.dayCell, styles.dayCellEmpty]} />;
            }

            return (
              <Pressable
                key={cell.key}
                onPress={() => openDiaryDate(cell.dateKey)}
                style={({ pressed }) => [
                  styles.dayCell,
                  cell.variant === 'attended' && styles.dayCellAttended,
                  cell.variant === 'absent' && styles.dayCellAbsent,
                  selectedDateKey === cell.dateKey && styles.dayCellSelected,
                  pressed && styles.buttonPressed,
                ]}
              >
                <Text style={styles.dayNumber}>{cell.date}</Text>
                <Text style={styles.dayStatus}>{cell.status}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.dot, styles.dotGreen]} />
            <Text style={styles.legendText}>출석</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.dot, styles.dotRed]} />
            <Text style={styles.legendText}>결석</Text>
          </View>
        </View>

        <View style={styles.recordsSection}>
          <Text style={styles.recordsTitle}>
            {selectedDateKey ? `${selectedDateKey} 레슨 기록` : '날짜를 선택하면 레슨 기록이 표시됩니다.'}
          </Text>

          {selectedDateKey ? (
            <View style={styles.recordCard}>
              <Text style={styles.recordMeta}>슛 성공 기록: {selectedDateShotCount}개</Text>
            </View>
          ) : null}

          {selectedDateKey && selectedDateRecords.length === 0 ? (
            <View style={styles.recordCard}>
              <Text style={styles.recordText}>이 날짜에 저장된 레슨 영상이 없습니다.</Text>
            </View>
          ) : null}

          {selectedDateRecords.map((record) => (
            <View key={record.id} style={styles.recordCard}>
              <Text style={styles.recordTitle}>{record.mode === 'shoot' ? '슛 분석' : '드리블 분석'}</Text>
              <Text style={styles.recordMeta}>{record.createdAt}</Text>
              {record.videoUri ? (
                <Video
                  source={{ uri: record.videoUri }}
                  useNativeControls
                  shouldPlay={false}
                  isLooping={false}
                  resizeMode={ResizeMode.COVER}
                  style={styles.recordVideo}
                />
              ) : null}
              <Text style={styles.recordText}>{record.feedback}</Text>
              <SmallButton title="기록 삭제" onPress={() => deleteLessonRecord(record.id)} variant="red" />
            </View>
          ))}
        </View>
      </Card>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <View style={styles.appShell}>
        <View style={styles.backgroundGlowTop} />
        <View style={styles.backgroundGlowBottom} />
        <FireworkBurst visible={showFireworks} items={fireworks} />
        <Header showBack={screen !== 'home'} onBack={() => navigateTo('home')} />
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {screen === 'home' && renderHomeScreen()}
          {screen === 'lesson' && renderLessonScreen()}
          {screen === 'skill' && renderSkillScreen()}
          {screen === 'diary' && renderDiaryScreen()}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#120d09',
  },
  appShell: {
    flex: 1,
    backgroundColor: '#120d09',
    paddingHorizontal: 18,
    paddingTop: 14,
    position: 'relative',
  },
  backgroundGlowTop: {
    position: 'absolute',
    top: -120,
    right: -50,
    width: 260,
    height: 260,
    borderRadius: 999,
    backgroundColor: 'rgba(255,145,77,0.18)',
  },
  backgroundGlowBottom: {
    position: 'absolute',
    bottom: 40,
    left: -60,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: 'rgba(255,204,102,0.08)',
  },
  scrollContent: {
    paddingBottom: 32,
    gap: 18,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 16,
  },
  headerTextWrap: {
    flex: 1,
  },
  headerEyebrow: {
    color: '#f5b37f',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.8,
    marginBottom: 6,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 30,
    fontWeight: '900',
  },
  backButton: {
    backgroundColor: '#fff2e2',
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  backButtonText: {
    color: '#28170d',
    fontSize: 14,
    fontWeight: '800',
  },
  backButtonPlaceholder: {
    width: 90,
  },
  contentGap: {
    gap: 18,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 22,
    overflow: 'hidden',
  },
  heroCard: {
    minHeight: 320,
  },
  cardTitle: {
    color: '#fff7f1',
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 12,
  },
  paragraph: {
    color: '#f6d8c4',
    fontSize: 15,
    lineHeight: 23,
    marginBottom: 18,
  },
  verticalGap: {
    gap: 16,
  },
  mainButton: {
    minHeight: 120,
    borderRadius: 22,
    padding: 22,
    justifyContent: 'center',
    backgroundColor: '#ff8b2b',
  },
  mainButtonTitle: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 8,
  },
  mainButtonSubtitle: {
    color: '#fff3ea',
    fontSize: 14,
    lineHeight: 20,
  },
  buttonPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
  homeworkItem: {
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderRadius: 16,
    borderLeftWidth: 5,
    borderLeftColor: '#ffb547',
    padding: 16,
    marginBottom: 12,
  },
  homeworkText: {
    color: '#fff7f1',
    fontSize: 15,
    lineHeight: 22,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  modeButton: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
  },
  modeButtonActive: {
    backgroundColor: '#ff9f1c',
    borderColor: '#fff5ec',
  },
  modeButtonDisabled: {
    opacity: 0.5,
  },
  modeButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  statusBox: {
    backgroundColor: 'rgba(0,0,0,0.24)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  statusText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  videoWrap: {
    height: 420,
    backgroundColor: '#0f0f0f',
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#ff9f1c',
    marginBottom: 16,
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'space-between',
    padding: 16,
  },
  cameraBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(230,57,70,0.9)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  cameraBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  overlayHint: {
    color: '#ffffff',
    fontSize: 14,
    lineHeight: 20,
    backgroundColor: 'rgba(0,0,0,0.38)',
    borderRadius: 14,
    padding: 12,
  },
  cameraPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  placeholderTitle: {
    color: '#ffffff',
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
  controlsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  smallButton: {
    borderRadius: 14,
    backgroundColor: '#ff9f1c',
    paddingHorizontal: 18,
    paddingVertical: 13,
  },
  smallButtonRed: {
    backgroundColor: '#d83a4d',
  },
  smallButtonDark: {
    backgroundColor: '#3b2c22',
  },
  smallButtonDisabled: {
    opacity: 0.45,
  },
  smallButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  infoBox: {
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  infoLabel: {
    color: '#f5b37f',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 8,
    letterSpacing: 1,
  },
  infoText: {
    color: '#ffffff',
    fontSize: 14,
    lineHeight: 22,
  },
  errorBox: {
    borderRadius: 14,
    backgroundColor: 'rgba(216,58,77,0.22)',
    padding: 14,
  },
  errorText: {
    color: '#ffe2e7',
    fontSize: 14,
    lineHeight: 21,
  },
  tipList: {
    gap: 10,
  },
  tipText: {
    color: '#fff7f1',
    fontSize: 15,
    lineHeight: 22,
  },
  skillGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 18,
  },
  skillButton: {
    width: '48%',
    borderRadius: 18,
    padding: 18,
    backgroundColor: '#ff8b2b',
  },
  skillButtonActive: {
    backgroundColor: '#ff6b00',
  },
  skillButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
  },
  skillViewer: {
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderRadius: 20,
    padding: 18,
    gap: 10,
  },
  skillTitle: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '900',
  },
  skillInfo: {
    color: '#fff7f1',
    fontSize: 15,
    lineHeight: 22,
  },
  calendarTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 18,
  },
  monthTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '900',
    flex: 1,
    textAlign: 'center',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  dayName: {
    width: '14%',
    minHeight: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  dayNameText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  dayCell: {
    width: '14%',
    minHeight: 78,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderWidth: 2,
    borderColor: 'transparent',
    marginBottom: 8,
  },
  dayCellEmpty: {
    opacity: 0,
  },
  dayCellAttended: {
    backgroundColor: 'rgba(50,205,50,0.74)',
  },
  dayCellAbsent: {
    backgroundColor: 'rgba(216,58,77,0.75)',
  },
  dayCellSelected: {
    borderColor: '#fff6ed',
  },
  dayNumber: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
  },
  dayStatus: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 6,
  },
  legend: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 18,
    marginBottom: 18,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  legendText: {
    color: '#ffffff',
    fontSize: 14,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 999,
  },
  dotGreen: {
    backgroundColor: 'limegreen',
  },
  dotRed: {
    backgroundColor: '#d83a4d',
  },
  recordsSection: {
    marginTop: 4,
    gap: 14,
  },
  recordsTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '900',
  },
  recordCard: {
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderRadius: 18,
    padding: 16,
  },
  recordTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 4,
  },
  recordMeta: {
    color: '#ffd3ad',
    fontSize: 13,
    marginBottom: 10,
  },
  recordVideo: {
    width: '100%',
    height: 260,
    borderRadius: 16,
    backgroundColor: '#111111',
    marginBottom: 12,
  },
  recordText: {
    color: '#ffffff',
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 12,
  },
  fireworkArea: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 30,
  },
  firework: {
    position: 'absolute',
    fontSize: 32,
  },
});
