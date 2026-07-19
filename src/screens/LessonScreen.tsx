import { type AVPlaybackStatus, ResizeMode, Video } from 'expo-av';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import type { WebViewMessageEvent } from 'react-native-webview';
import { InfoBox } from '../components/common/InfoBox';
import { LessonCamera } from '../components/lesson/LessonCamera';
import { colors } from '../theme/colors';
import type { BallBrandOption, BallColorOption, DribbleLessonView, LessonMode, LessonReviewClip } from '../types/app';
import { getDesktopMobileFrameWidth, shouldUseDesktopMobileLayout } from '../utils/layout';

const DRIBBLE_MODE_IMAGE = require('../../assets/lesson-player-silhouette.png');
const SHOOT_MODE_IMAGE = require('../../assets/lesson-mode/shoot.png');

interface LessonScreenProps {
  lessonMode: LessonMode;
  selectedDribbleView: DribbleLessonView;
  selectedBallBrand: BallBrandOption;
  selectedBallColors: BallColorOption[];
  isCameraActive: boolean;
  isCameraPreviewHidden: boolean;
  isLessonActive: boolean;
  isCameraReady: boolean;
  cameraSessionKey: number;
  countdownValue: number | null;
  dribbleResetToken: number;
  shootResetToken: number;
  recordingStartToken: number;
  recordingStopToken: number;
  cameraStopMode: 'review' | 'disconnect' | null;
  debugText: string;
  feedbackText: string;
  lessonReview: LessonReviewClip | null;
  currentDribbleCount: number;
  cameraError: string;
  isShootSuccessButtonVisible: boolean;
  onSelectMode: (mode: LessonMode) => void;
  onSelectDribbleView: (view: DribbleLessonView) => void;
  onBeginLesson: (dribbleTargetCount?: number, dribbleView?: DribbleLessonView) => void;
  onEndLesson: () => void;
  onRegisterSuccessfulShot: () => void;
  onGoHome: () => void;
  onPoseMessage: (event: WebViewMessageEvent) => void;
}

interface ModeButtonProps {
  title: string;
  imageSource: ImageSourcePropType;
  imageTintColor?: string;
  active: boolean;
  disabled: boolean;
  onPress: () => void;
}

function ModeButton({ title, imageSource, imageTintColor, active, disabled, onPress }: ModeButtonProps) {
  return (
    <Pressable
      accessibilityState={{ disabled, selected: active }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.modeButton,
        disabled && styles.modeButtonDisabled,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.modeButtonArtworkFrame}>
        <Image
          source={imageSource}
          style={[styles.modeButtonArtwork, imageTintColor ? { tintColor: imageTintColor } : null]}
          resizeMode="contain"
        />
      </View>
      <Text style={styles.modeButtonText}>{title}</Text>
    </Pressable>
  );
}

interface OverlayUtilityButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'neutral' | 'accent' | 'danger';
}

function OverlayUtilityButton({ title, onPress, variant = 'neutral' }: OverlayUtilityButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.overlayUtilityButton,
        variant === 'accent' && styles.overlayUtilityButtonAccent,
        variant === 'danger' && styles.overlayUtilityButtonDanger,
        pressed && styles.pressed,
      ]}
    >
      <Text style={styles.overlayUtilityButtonText}>{title}</Text>
    </Pressable>
  );
}

interface CameraShutterButtonProps {
  active: boolean;
  disabled?: boolean;
  onPress: () => void;
}

function CameraShutterButton({ active, disabled = false, onPress }: CameraShutterButtonProps) {
  return (
    <Pressable
      accessibilityLabel={active ? '레슨 종료' : '레슨 시작'}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.shutterButton,
        active && styles.shutterButtonActive,
        disabled && styles.shutterButtonDisabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <View style={[styles.shutterButtonInner, active && styles.shutterButtonInnerActive]} />
    </Pressable>
  );
}

interface ReviewClipPlayerProps {
  clip: LessonReviewClip;
  reserveToggleSpace?: boolean;
}

function ReviewClipPlayer({ clip, reserveToggleSpace = false }: ReviewClipPlayerProps) {
  const videoRef = useRef<Video | null>(null);
  const [durationMillis, setDurationMillis] = useState(clip.durationMs);
  const loopEndMs = Math.max(clip.startAtMs + 250, Math.min(clip.startAtMs + clip.durationMs, durationMillis));

  useEffect(() => {
    const player = videoRef.current;

    if (!player) {
      return;
    }

    void player.setPositionAsync(clip.startAtMs);
    void player.playAsync();
  }, [clip.startAtMs, clip.videoUri]);

  function handlePlaybackStatusUpdate(status: AVPlaybackStatus) {
    if (!status.isLoaded) {
      return;
    }

    if (typeof status.durationMillis === 'number' && status.durationMillis > 0 && status.durationMillis !== durationMillis) {
      setDurationMillis(status.durationMillis);
    }

    if (status.positionMillis >= loopEndMs && loopEndMs > clip.startAtMs) {
      void videoRef.current?.setPositionAsync(clip.startAtMs);
      void videoRef.current?.playAsync();
    }
  }

  return (
    <View style={[styles.reviewWrap, reserveToggleSpace && styles.sectionCardWithToggleSpace]}>
      <Text style={styles.reviewTitle}>{clip.title}</Text>
      <Video
        ref={videoRef}
        source={{ uri: clip.videoUri }}
        style={styles.reviewVideo}
        resizeMode={ResizeMode.COVER}
        shouldPlay
        useNativeControls
        progressUpdateIntervalMillis={100}
        onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
      />
      <Text style={styles.reviewHint}>문제가 가장 많이 나타난 약 3초 구간을 반복해서 보여주고 있습니다.</Text>
    </View>
  );
}

interface RealtimeCoachingPanelProps {
  lessonMode: LessonMode;
  currentDribbleCount: number;
  feedbackText: string;
  lessonReview: LessonReviewClip | null;
  cameraError: string;
  isWideLayout: boolean;
}

type CoachingSectionKey = 'dribbleCount' | 'feedback' | 'review' | 'camera' | 'tips';
type CoachingPanelState = 'expanded' | 'half' | 'hidden';

interface CoachingSectionProps {
  title: string;
  collapsed: boolean;
  allowCollapse: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function CoachingSection({ title, collapsed, allowCollapse, onToggle, children }: CoachingSectionProps) {
  const contentAnimation = useRef(new Animated.Value(collapsed ? 0 : 1)).current;
  const [contentHeight, setContentHeight] = useState(0);
  const effectiveCollapsed = allowCollapse ? collapsed : false;

  useEffect(() => {
    Animated.timing(contentAnimation, {
      toValue: effectiveCollapsed ? 0 : 1,
      duration: effectiveCollapsed ? 220 : 280,
      easing: effectiveCollapsed ? Easing.bezier(0.35, 0, 0.2, 1) : Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [contentAnimation, effectiveCollapsed]);

  const animatedHeight = contentAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, Math.max(contentHeight, 1)],
  });
  const animatedOpacity = contentAnimation.interpolate({
    inputRange: [0, 0.32, 1],
    outputRange: [0, 0.14, 1],
  });
  const animatedTranslateY = contentAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [-10, 0],
  });

  return (
    <View style={[styles.sectionBlock, effectiveCollapsed && styles.sectionBlockCollapsed]}>
      {allowCollapse ? (
        <Pressable
          accessibilityLabel={effectiveCollapsed ? `${title} 펼치기` : `${title} 접기`}
          onPress={onToggle}
          style={({ pressed }) => [
            styles.sectionToggleButton,
            effectiveCollapsed ? styles.sectionToggleButtonCollapsed : styles.sectionToggleButtonFloating,
            effectiveCollapsed ? styles.sectionToggleButtonCollapsedChip : styles.sectionToggleButtonRound,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.sectionToggleIcon}>{effectiveCollapsed ? '^' : 'v'}</Text>
          {effectiveCollapsed ? <Text style={styles.sectionToggleLabel}>{title}</Text> : null}
        </Pressable>
      ) : null}
      <Animated.View
        pointerEvents={effectiveCollapsed ? 'none' : 'auto'}
        style={[
          styles.sectionContentWrap,
          {
            height: animatedHeight,
            opacity: animatedOpacity,
            transform: [{ translateY: animatedTranslateY }],
          },
        ]}
      >
        <View
          onLayout={(event) => {
            const nextHeight = Math.max(1, Math.ceil(event.nativeEvent.layout.height));
            setContentHeight((current) => (current === nextHeight ? current : nextHeight));
          }}
        >
          {children}
        </View>
      </Animated.View>
    </View>
  );
}

function RealtimeCoachingPanel({
  lessonMode,
  currentDribbleCount,
  feedbackText,
  lessonReview,
  cameraError,
  isWideLayout,
}: RealtimeCoachingPanelProps) {
  const allowSectionCollapse = true;
  const modeLabel = lessonMode === 'shoot' ? '슛 분석' : '드리블 분석';
  const modeSummary =
    lessonMode === 'shoot'
      ? '준비자세와 발사 흐름을 보면서 바로 고치면 좋은 점을 알려드려요.'
      : '드리블 리듬과 자세를 따라가며 지금 바로 바꾸면 좋은 점을 알려드려요.';
  const [hiddenSections, setHiddenSections] = useState<Record<CoachingSectionKey, boolean>>({
    dribbleCount: false,
    feedback: false,
    review: false,
    camera: false,
    tips: false,
  });

  function toggleSection(sectionKey: CoachingSectionKey) {
    setHiddenSections((current) => ({
      ...current,
      [sectionKey]: !current[sectionKey],
    }));
  }

  return (
    <>
      <View style={styles.coachingHero}>
        <View style={styles.coachingHeroTop}>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveBadgeText}>LIVE COACH</Text>
          </View>
          <View style={styles.modePill}>
            <Text style={styles.modePillText}>{modeLabel}</Text>
          </View>
        </View>

        <Text style={styles.sideTitle}>실시간 코칭</Text>
        <Text style={styles.sideSubtitle}>{modeSummary}</Text>
      </View>
      {lessonMode === 'dribble' ? (
        <CoachingSection
          title="드리블 횟수"
          collapsed={hiddenSections.dribbleCount}
          allowCollapse={allowSectionCollapse}
          onToggle={() => toggleSection('dribbleCount')}
        >
          <InfoBox label="드리블 횟수" text={`${currentDribbleCount}회`} reserveToggleSpace={allowSectionCollapse} translucent />
        </CoachingSection>
      ) : null}

      <CoachingSection
        title="핵심 피드백"
        collapsed={hiddenSections.feedback}
        allowCollapse={allowSectionCollapse}
        onToggle={() => toggleSection('feedback')}
      >
        <InfoBox label="실시간 피드백" text={feedbackText} reserveToggleSpace={allowSectionCollapse} translucent />
      </CoachingSection>

      {lessonReview ? (
        <CoachingSection
          title="문제 장면 복기"
          collapsed={hiddenSections.review}
          allowCollapse={allowSectionCollapse}
          onToggle={() => toggleSection('review')}
        >
          <ReviewClipPlayer clip={lessonReview} reserveToggleSpace={allowSectionCollapse} />
        </CoachingSection>
      ) : null}

      {cameraError ? (
        <CoachingSection
          title="카메라 알림"
          collapsed={hiddenSections.camera}
          allowCollapse={allowSectionCollapse}
          onToggle={() => toggleSection('camera')}
        >
          <View style={[styles.errorBox, allowSectionCollapse && styles.sectionCardWithToggleSpace]}>
            <Text style={styles.errorText}>{cameraError}</Text>
          </View>
        </CoachingSection>
      ) : null}

      <CoachingSection
        title="촬영 팁"
        collapsed={hiddenSections.tips}
        allowCollapse={allowSectionCollapse}
        onToggle={() => toggleSection('tips')}
      >
        <View style={[styles.tipBox, allowSectionCollapse && styles.sectionCardWithToggleSpace]}>
          <Text style={styles.tipTitle}>촬영 팁</Text>
          <Text style={styles.tipText}>
            몸 전체가 화면 안에 들어오면 어깨, 팔꿈치, 손목, 엉덩이, 무릎, 발을 더 안정적으로 인식합니다.
          </Text>
          <Text style={styles.tipText}>
            밝은 장소에서 촬영하고, 공과 다리가 배경과 겹치지 않도록 서 주면 분석 정확도가 더 좋아집니다.
          </Text>
          <Text style={styles.tipText}>
            슛 분석은 어깨부터 발끝까지, 드리블 분석은 손목과 상체가 잘 보이도록 맞춰 주세요.
          </Text>
        </View>
      </CoachingSection>
    </>
  );
}

export function LessonScreen({
  lessonMode,
  selectedDribbleView,
  selectedBallBrand,
  selectedBallColors,
  isCameraActive,
  isCameraPreviewHidden,
  isLessonActive,
  isCameraReady,
  cameraSessionKey,
  countdownValue,
  dribbleResetToken,
  shootResetToken,
  recordingStartToken,
  recordingStopToken,
  cameraStopMode,
  debugText,
  feedbackText,
  lessonReview,
  currentDribbleCount,
  cameraError,
  isShootSuccessButtonVisible,
  onSelectMode,
  onSelectDribbleView,
  onBeginLesson,
  onEndLesson,
  onRegisterSuccessfulShot,
  onGoHome,
  onPoseMessage,
}: LessonScreenProps) {
  const { width, height } = useWindowDimensions();
  const isDesktopMobileMode = shouldUseDesktopMobileLayout(width);
  const layoutWidth = isDesktopMobileMode ? getDesktopMobileFrameWidth(width) : width;
  const isWideLayout = !isDesktopMobileMode && layoutWidth >= 1080;
  const isLandscapeMobileLayout = !isDesktopMobileMode && !isWideLayout && width > height;
  const shouldLeftDockCoaching = isLandscapeMobileLayout;
  const isSideDockedCoaching = isWideLayout;
  const isLessonSessionBusy = isLessonActive || isCameraActive;
  const allowPanelDragHide = !isSideDockedCoaching;
  const coachingPanelTopInset = 88;
  const coachingPanelBottomInset = 12;
  const bottomControlsInset = 170;
  const floatingCoachingHeight = isSideDockedCoaching
    ? Math.max(320, height - coachingPanelTopInset - coachingPanelBottomInset)
    : Math.max(240, height - coachingPanelTopInset - coachingPanelBottomInset);
  const floatingCoachingWidth = isWideLayout
    ? Math.max(320, Math.min(layoutWidth * 0.32, 420))
    : isLandscapeMobileLayout
      ? Math.max(280, Math.min(layoutWidth * 0.34, 360))
      : Math.min(layoutWidth - 24, 420);
  const coachingHiddenOffset = floatingCoachingHeight + coachingPanelBottomInset + 32;
  const coachingHalfOffset = Math.max(0, Math.min(coachingHiddenOffset - 72, floatingCoachingHeight * 0.5));
  const coachingPanelTranslateY = useRef(new Animated.Value(allowPanelDragHide ? coachingHiddenOffset : 0)).current;
  const coachingPanelTranslateYRef = useRef(0);
  const coachingPanelDragStartRef = useRef(0);
  const coachingPanelIsAnimatingRef = useRef(false);

  const [showDribbleGuide, setShowDribbleGuide] = useState(false);
  const [dribbleGuideStep, setDribbleGuideStep] = useState(0);
  const [showLessonModePicker, setShowLessonModePicker] = useState(false);
  const [showShootGuide, setShowShootGuide] = useState(false);
  const [shootGuideStep, setShootGuideStep] = useState(0);
  const [dribbleCountInput, setDribbleCountInput] = useState('10');
  const [coachingPanelState, setCoachingPanelState] = useState<CoachingPanelState>(allowPanelDragHide ? 'hidden' : 'expanded');
  const isCoachingPanelHidden = coachingPanelState === 'hidden';
  const isCoachingPanelHalfOpen = coachingPanelState === 'half';

  const parsedDribbleCount = useMemo(() => {
    const nextValue = Number.parseInt(dribbleCountInput, 10);
    return Number.isFinite(nextValue) && nextValue > 0 ? nextValue : 0;
  }, [dribbleCountInput]);
  const lessonCameraContent = (
    <LessonCamera
      key={cameraSessionKey}
      lessonMode={lessonMode}
      selectedBallBrand={selectedBallBrand}
      selectedBallColors={selectedBallColors}
      cameraSessionKey={cameraSessionKey}
      isCameraActive={isCameraActive}
      isCameraPreviewHidden={isCameraPreviewHidden}
      isLessonActive={isLessonActive}
      isCameraReady={isCameraReady}
      countdownValue={countdownValue}
      dribbleResetToken={dribbleResetToken}
      shootResetToken={shootResetToken}
      recordingStartToken={recordingStartToken}
      recordingStopToken={recordingStopToken}
      cameraStopMode={cameraStopMode}
      containerStyle={styles.fullscreenCamera}
      onPoseMessage={onPoseMessage}
    />
  );

  useEffect(() => {
    if (isLessonActive || isCameraActive) {
      setShowLessonModePicker(false);
    }

    if (lessonMode !== 'dribble' || isLessonActive) {
      setShowDribbleGuide(false);
      setDribbleGuideStep(0);
    }

    if (lessonMode !== 'shoot' || isLessonActive) {
      setShowShootGuide(false);
      setShootGuideStep(0);
    }
  }, [isCameraActive, isLessonActive, lessonMode]);

  useEffect(() => {
    const listenerId = coachingPanelTranslateY.addListener(({ value }) => {
      coachingPanelTranslateYRef.current = value;
    });

    return () => {
      coachingPanelTranslateY.removeListener(listenerId);
    };
  }, [coachingPanelTranslateY]);

  useEffect(() => {
    if (!allowPanelDragHide) {
      setCoachingPanelState('expanded');
      coachingPanelIsAnimatingRef.current = false;
      coachingPanelTranslateY.stopAnimation();
      coachingPanelTranslateY.setValue(0);
      return;
    }

    if (coachingPanelIsAnimatingRef.current) {
      return;
    }

    if (coachingPanelState === 'hidden') {
      coachingPanelTranslateY.setValue(coachingHiddenOffset);
      return;
    }

    if (coachingPanelState === 'half') {
      coachingPanelTranslateY.setValue(coachingHalfOffset);
    }
  }, [allowPanelDragHide, coachingHalfOffset, coachingHiddenOffset, coachingPanelState, coachingPanelTranslateY]);

  useEffect(() => {
    if (isCameraActive) {
      if (allowPanelDragHide) {
        setCoachingPanelState('hidden');
        coachingPanelIsAnimatingRef.current = false;
        coachingPanelTranslateY.stopAnimation();
        coachingPanelTranslateY.setValue(coachingHiddenOffset);
      }
      return;
    }

    coachingPanelIsAnimatingRef.current = false;
    coachingPanelTranslateY.stopAnimation();

    if (allowPanelDragHide) {
      setCoachingPanelState('hidden');
      coachingPanelTranslateY.setValue(coachingHiddenOffset);
      return;
    }

    setCoachingPanelState('expanded');
    coachingPanelTranslateY.setValue(0);
  }, [allowPanelDragHide, coachingHiddenOffset, coachingPanelTranslateY, isCameraActive]);

  function getCoachingPanelOffset(nextState: CoachingPanelState) {
    if (nextState === 'expanded') {
      return 0;
    }

    if (nextState === 'half') {
      return coachingHalfOffset;
    }

    return coachingHiddenOffset;
  }

  function animateCoachingPanelTo(nextState: CoachingPanelState) {
    setCoachingPanelState(nextState);
    coachingPanelIsAnimatingRef.current = true;

    const toValue = getCoachingPanelOffset(nextState);
    const animation =
      nextState === 'hidden'
        ? Animated.timing(coachingPanelTranslateY, {
            toValue,
            duration: 220,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          })
        : Animated.spring(coachingPanelTranslateY, {
            toValue,
            damping: 24,
            stiffness: 220,
            mass: 0.9,
            useNativeDriver: true,
          });

    animation.start(() => {
      coachingPanelIsAnimatingRef.current = false;
    });
  }

  function expandCoachingPanel() {
    animateCoachingPanelTo('expanded');
  }

  function halfOpenCoachingPanel() {
    animateCoachingPanelTo('half');
  }

  function hideCoachingPanel() {
    animateCoachingPanelTo('hidden');
  }

  function getNearestCoachingPanelState(offset: number, velocityY: number): CoachingPanelState {
    const projectedOffset = Math.max(0, Math.min(coachingHiddenOffset, offset + velocityY * 96));
    const snapPoints: Array<{ state: CoachingPanelState; offset: number }> = [
      { state: 'expanded', offset: 0 },
      { state: 'half', offset: coachingHalfOffset },
      { state: 'hidden', offset: coachingHiddenOffset },
    ];

    let closestState: CoachingPanelState = 'expanded';
    let closestDistance = Number.POSITIVE_INFINITY;

    snapPoints.forEach(({ state, offset: snapOffset }) => {
      const distance = Math.abs(projectedOffset - snapOffset);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestState = state;
      }
    });

    return closestState;
  }

  function snapCoachingPanel(offset: number, velocityY: number) {
    const nextState = getNearestCoachingPanelState(offset, velocityY);

    if (nextState === 'expanded') {
      expandCoachingPanel();
      return;
    }

    if (nextState === 'half') {
      halfOpenCoachingPanel();
      return;
    }

    hideCoachingPanel();
  }

  function restoreCoachingPanel() {
    halfOpenCoachingPanel();
  }

  function finishCoachingPanelDrag(dy: number, vy: number) {
    const nextOffset = Math.max(0, Math.min(coachingHiddenOffset, coachingPanelDragStartRef.current + dy));
    snapCoachingPanel(nextOffset, vy);
  }

  function finishCoachingPanelRestoreDrag(dy: number, vy: number) {
    const nextOffset = Math.max(0, Math.min(coachingHiddenOffset, coachingPanelDragStartRef.current + dy));
    snapCoachingPanel(nextOffset, vy);
  }

  const coachingPanelPanResponder = allowPanelDragHide
    ? PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dy) > Math.abs(gestureState.dx) && Math.abs(gestureState.dy) > 4,
        onPanResponderGrant: () => {
          coachingPanelTranslateY.stopAnimation();
          coachingPanelDragStartRef.current = coachingPanelTranslateYRef.current;
        },
        onPanResponderMove: (_, gestureState) => {
          const nextValue = Math.max(0, Math.min(coachingHiddenOffset, coachingPanelDragStartRef.current + gestureState.dy));
          coachingPanelTranslateY.setValue(nextValue);
        },
        onPanResponderRelease: (_, gestureState) => {
          finishCoachingPanelDrag(gestureState.dy, gestureState.vy);
        },
        onPanResponderTerminate: (_, gestureState) => {
          finishCoachingPanelDrag(gestureState.dy, gestureState.vy);
        },
      })
    : null;
  const coachingRestorePanResponder = allowPanelDragHide
    ? PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dy) > Math.abs(gestureState.dx) && Math.abs(gestureState.dy) > 4,
        onPanResponderGrant: () => {
          coachingPanelTranslateY.stopAnimation();
          coachingPanelDragStartRef.current = coachingPanelTranslateYRef.current;
        },
        onPanResponderMove: (_, gestureState) => {
          const nextValue = Math.max(0, Math.min(coachingHiddenOffset, coachingPanelDragStartRef.current + gestureState.dy));
          coachingPanelTranslateY.setValue(nextValue);
        },
        onPanResponderRelease: (_, gestureState) => {
          finishCoachingPanelRestoreDrag(gestureState.dy, gestureState.vy);
        },
        onPanResponderTerminate: (_, gestureState) => {
          finishCoachingPanelRestoreDrag(gestureState.dy, gestureState.vy);
        },
      })
    : null;

  const coachingRestoreOpacity = coachingPanelTranslateY.interpolate({
    inputRange: [0, coachingHiddenOffset * 0.65, coachingHiddenOffset],
    outputRange: [0, 0.12, 1],
    extrapolate: 'clamp',
  });
  const coachingRestoreTranslateY = coachingPanelTranslateY.interpolate({
    inputRange: [0, coachingHiddenOffset],
    outputRange: [16, 0],
    extrapolate: 'clamp',
  });
  const coachingPanelFadeStartOffset = Math.min(
    coachingHiddenOffset - 24,
    Math.max(coachingHalfOffset + 1, coachingHiddenOffset * 0.84)
  );
  const coachingPanelOpacity = coachingPanelTranslateY.interpolate({
    inputRange: [0, coachingHalfOffset, coachingPanelFadeStartOffset, coachingHiddenOffset],
    outputRange: [1, 1, 0.22, 0],
    extrapolate: 'clamp',
  });
  const isRoundLessonControlActive = isLessonActive || isCameraActive;
  const floatingCoachingFrame = isLandscapeMobileLayout
    ? {
        left: 12,
        top: coachingPanelTopInset,
        bottom: coachingPanelBottomInset,
        width: floatingCoachingWidth,
      }
    : {
        left: 12,
        right: 12,
        top: coachingPanelTopInset,
        bottom: coachingPanelBottomInset,
      };

  function openLessonStart() {
    if (isLessonSessionBusy) {
      return;
    }

    setShowLessonModePicker(true);
  }

  function closeLessonModePicker() {
    setShowLessonModePicker(false);
  }

  function openLessonGuide(mode: LessonMode) {
    setShowLessonModePicker(false);
    onSelectMode(mode);

    if (mode === 'dribble') {
      setShowShootGuide(false);
      setShootGuideStep(0);
      setDribbleGuideStep(0);
      setShowDribbleGuide(true);
      return;
    }

    setShowDribbleGuide(false);
    setDribbleGuideStep(0);
    setShootGuideStep(0);
    setShowShootGuide(true);
  }

  function closeDribbleGuide() {
    setShowDribbleGuide(false);
    setDribbleGuideStep(0);
  }

  function confirmDribbleGuideStep() {
    if (dribbleGuideStep === 0 && parsedDribbleCount <= 0) {
      return;
    }

    if (dribbleGuideStep < 3) {
      setDribbleGuideStep((current) => current + 1);
      return;
    }

    if (isLessonSessionBusy) {
      setShowDribbleGuide(false);
      setDribbleGuideStep(0);
      return;
    }

    setShowDribbleGuide(false);
    setDribbleGuideStep(0);
    onBeginLesson(parsedDribbleCount, selectedDribbleView);
  }

  const dribbleViewLabel = selectedDribbleView === 'front' ? '앞모습 드리블' : '옆모습 드리블';

  function closeShootGuide() {
    setShowShootGuide(false);
    setShootGuideStep(0);
  }

  function confirmShootGuideStep() {
    if (shootGuideStep < 2) {
      setShootGuideStep((current) => current + 1);
      return;
    }

    if (isLessonSessionBusy) {
      setShowShootGuide(false);
      setShootGuideStep(0);
      return;
    }

    setShowShootGuide(false);
    setShootGuideStep(0);
    onBeginLesson();
  }

  const dribbleConfirmLabel = dribbleGuideStep === 3 ? '레슨 시작' : '확인';
  const shootConfirmLabel = shootGuideStep === 2 ? '레슨 시작' : '확인';

  return (
    <View style={styles.screenRoot}>
      <View style={styles.cameraViewport}>
        {lessonCameraContent}
      </View>
      <View pointerEvents="none" style={styles.cameraChromeTop} />
      <View pointerEvents="none" style={styles.cameraChromeBottom} />
      <View pointerEvents="box-none" style={styles.topActionOverlay}>
        <Pressable onPress={onGoHome} style={({ pressed }) => [styles.homeChip, pressed && styles.pressed]}>
          <Text style={styles.homeChipText}>{'<'}</Text>
        </Pressable>
      </View>

      {isCameraActive && isSideDockedCoaching ? (
        <View
          pointerEvents="box-none"
          style={[
            styles.sideRailOverlay,
            shouldLeftDockCoaching ? styles.sideRailOverlayLandscape : null,
            { top: coachingPanelTopInset, bottom: coachingPanelBottomInset },
          ]}
        >
          <View
            style={[
              styles.sideCard,
              styles.sideCardDockedOverlay,
              shouldLeftDockCoaching ? styles.sideCardDockedOverlayLandscape : null,
              { width: floatingCoachingWidth, height: '100%' },
            ]}
          >
            <ScrollView
              style={styles.sideCardScroll}
              contentContainerStyle={[
                styles.sideCardContent,
                isCoachingPanelHalfOpen ? { paddingBottom: coachingHalfOffset + 24 } : null,
              ]}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
            >
              <RealtimeCoachingPanel
                lessonMode={lessonMode}
                currentDribbleCount={currentDribbleCount}
                feedbackText={feedbackText}
                lessonReview={lessonReview}
                cameraError={cameraError}
                isWideLayout={isWideLayout}
              />
            </ScrollView>
          </View>
        </View>
      ) : null}

      {isCameraActive && !isSideDockedCoaching ? (
        <View pointerEvents="box-none" style={styles.coachingOverlay}>
          <Animated.View
            pointerEvents={allowPanelDragHide && isCoachingPanelHidden ? 'none' : 'auto'}
            style={[
              styles.sideCard,
              styles.sideCardFloating,
              floatingCoachingFrame,
              allowPanelDragHide
                ? {
                    opacity: coachingPanelOpacity,
                    transform: [{ translateY: coachingPanelTranslateY }],
                  }
                : null,
            ]}
          >
            {allowPanelDragHide ? (
              <View {...coachingPanelPanResponder?.panHandlers} style={styles.panelDragHandle}>
                <View style={styles.panelGrip} />
                <Text style={styles.panelDragHint}>숨기기</Text>
              </View>
            ) : null}
            <ScrollView
              style={styles.sideCardScroll}
              contentContainerStyle={[
                styles.sideCardContent,
                isCoachingPanelHalfOpen ? { paddingBottom: coachingHalfOffset + 24 } : null,
              ]}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
            >
              <RealtimeCoachingPanel
                lessonMode={lessonMode}
                currentDribbleCount={currentDribbleCount}
                feedbackText={feedbackText}
                lessonReview={lessonReview}
                cameraError={cameraError}
                isWideLayout={isWideLayout}
              />
            </ScrollView>
          </Animated.View>

          {allowPanelDragHide ? (
            <View
              pointerEvents="box-none"
              style={[
                styles.coachingRestoreWrap,
                isLandscapeMobileLayout ? styles.coachingRestoreWrapLandscape : { bottom: bottomControlsInset },
              ]}
            >
              <Animated.View
                pointerEvents={isCoachingPanelHidden ? 'auto' : 'none'}
                {...coachingRestorePanResponder?.panHandlers}
                style={{
                  opacity: coachingRestoreOpacity,
                  transform: [{ translateY: coachingRestoreTranslateY }],
                }}
              >
                <Pressable onPress={restoreCoachingPanel} style={({ pressed }) => [styles.coachingRestoreChip, pressed && styles.pressed]}>
                  <Text style={styles.coachingRestoreChipText}>^ 실시간 코칭</Text>
                </Pressable>
              </Animated.View>
            </View>
          ) : null}
        </View>
      ) : null}

      <View
        pointerEvents="box-none"
        style={[styles.bottomControlsOverlay, isLandscapeMobileLayout ? styles.bottomControlsOverlayLandscape : null]}
      >
        {isLandscapeMobileLayout ? (
          <>
            <View pointerEvents="box-none" style={styles.landscapeShutterDock}>
              <CameraShutterButton active={isRoundLessonControlActive} onPress={isRoundLessonControlActive ? onEndLesson : openLessonStart} />
            </View>

            {lessonMode === 'shoot' && isShootSuccessButtonVisible ? (
              <View pointerEvents="box-none" style={styles.landscapeUtilityDock}>
                <OverlayUtilityButton title="슛 성공" onPress={onRegisterSuccessfulShot} variant="accent" />
              </View>
            ) : null}
          </>
        ) : (
          <View style={[styles.bottomControlsStack, isWideLayout ? styles.bottomControlsStackWide : null]}>
            <View style={styles.captureControlsRow}>
              <View style={styles.captureSideSlot}>
                <View style={styles.captureSidePlaceholder} />
              </View>

              <View style={styles.captureButtonStack}>
                <CameraShutterButton active={isRoundLessonControlActive} onPress={isRoundLessonControlActive ? onEndLesson : openLessonStart} />
              </View>

              <View style={styles.captureSideSlot}>
                {lessonMode === 'shoot' && isShootSuccessButtonVisible ? (
                  <OverlayUtilityButton title="슛 성공" onPress={onRegisterSuccessfulShot} variant="accent" />
                ) : (
                  <View style={styles.captureSidePlaceholder} />
                )}
              </View>
            </View>
          </View>
        )}
      </View>

      <Modal visible={showLessonModePicker} transparent animationType="fade" onRequestClose={closeLessonModePicker}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Pressable
              onPress={closeLessonModePicker}
              style={({ pressed }) => [styles.modalCloseButton, pressed && styles.pressed]}
            >
              <Text style={styles.modalCloseButtonText}>X</Text>
            </Pressable>
            <Text style={styles.modalTitle}>레슨 모드 선택</Text>
            <Text style={styles.modalBody}>이번 레슨에서 어떤 동작을 분석할지 선택해 주세요.</Text>
            <View style={styles.modePickerOptions}>
              <ModeButton
                title="드리블"
                imageSource={DRIBBLE_MODE_IMAGE}
                imageTintColor="#050505"
                active={lessonMode === 'dribble'}
                disabled={false}
                onPress={() => openLessonGuide('dribble')}
              />
              <ModeButton
                title="슛"
                imageSource={SHOOT_MODE_IMAGE}
                active={lessonMode === 'shoot'}
                disabled={false}
                onPress={() => openLessonGuide('shoot')}
              />
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showDribbleGuide} transparent animationType="fade" onRequestClose={closeDribbleGuide}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>드리블 레슨 안내</Text>
            <Text style={styles.modalStep}>STEP {dribbleGuideStep + 1} / 4</Text>

            {dribbleGuideStep === 0 ? (
              <>
                <Text style={styles.modalBody}>드리블을 몇 번 하고 레슨을 끝낼 것인지 정해주세요.</Text>
                <TextInput
                  value={dribbleCountInput}
                  onChangeText={(value) => setDribbleCountInput(value.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                  placeholder="예: 10"
                  placeholderTextColor="rgba(255,255,255,0.45)"
                  style={styles.countInput}
                  maxLength={3}
                />
                <View style={styles.viewSelectRow}>
                  <Pressable
                    onPress={() => onSelectDribbleView('front')}
                    style={({ pressed }) => [
                      styles.viewSelectButton,
                      selectedDribbleView === 'front' && styles.viewSelectButtonActive,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.viewSelectTitle}>앞모습 드리블</Text>
                    <Text style={styles.viewSelectCaption}>정면 자세와 양손 균형을 봅니다.</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => onSelectDribbleView('side')}
                    style={({ pressed }) => [
                      styles.viewSelectButton,
                      selectedDribbleView === 'side' && styles.viewSelectButtonActive,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.viewSelectTitle}>옆모습 드리블</Text>
                    <Text style={styles.viewSelectCaption}>상체 기울기와 시선을 봅니다.</Text>
                  </Pressable>
                </View>
                <Text style={styles.modalHint}>입력한 횟수만큼 {dribbleViewLabel}을 하면 자동으로 녹화가 끝나고 리뷰를 시작합니다.</Text>
              </>
            ) : null}

            {dribbleGuideStep === 1 ? (
              <>
                <Text style={styles.modalBody}>
                  상체를 낮춰 드리블 준비 자세로 맞춰 주세요. 그러면 카운트가 시작됩니다.
                </Text>
                <Text style={styles.modalHint}>선택한 촬영: {dribbleViewLabel}</Text>
                <Text style={styles.modalHint}>설정한 목표 드리블 횟수: {parsedDribbleCount}회</Text>
              </>
            ) : null}

            {dribbleGuideStep === 2 ? (
              <>
                <Text style={styles.modalBody}>카운트가 끝나면 드리블을 시작해 주세요.</Text>
                <Text style={styles.modalHint}>선택한 촬영: {dribbleViewLabel}</Text>
                <Text style={styles.modalHint}>준비 자세를 유지하면 화면 중앙에서 3초 카운트가 진행됩니다.</Text>
              </>
            ) : null}

            {dribbleGuideStep === 3 ? (
              <>
                <Text style={styles.modalBody}>{dribbleViewLabel}으로 정해준 드리블 횟수 동안 영상을 녹화해 레슨하겠습니다.</Text>
                <Text style={styles.modalHint}>목표 드리블 횟수: {parsedDribbleCount}회</Text>
              </>
            ) : null}

            <View style={styles.modalActions}>
              <Pressable onPress={closeDribbleGuide} style={({ pressed }) => [styles.modalGhostButton, pressed && styles.pressed]}>
                <Text style={styles.modalGhostButtonText}>닫기</Text>
              </Pressable>
              <Pressable
                onPress={confirmDribbleGuideStep}
                disabled={dribbleGuideStep === 0 && parsedDribbleCount <= 0}
                style={({ pressed }) => [
                  styles.modalPrimaryButton,
                  dribbleGuideStep === 0 && parsedDribbleCount <= 0 && styles.modalPrimaryButtonDisabled,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.modalPrimaryButtonText}>{dribbleConfirmLabel}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showShootGuide} transparent animationType="fade" onRequestClose={closeShootGuide}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>슛 레슨 안내</Text>
            <Text style={styles.modalStep}>STEP {shootGuideStep + 1} / 3</Text>

            {shootGuideStep === 0 ? (
              <>
                <Text style={styles.modalBody}>
                  슛을 하기 위한 준비 자세로 팔 각도를 80~120도 범위에 맞춰 공을 들어 주세요. 그러면 카운트가 시작됩니다.
                </Text>
                <Text style={styles.modalHint}>어깨, 팔꿈치, 손목 각도가 잘 보이도록 화면 안으로 들어와 주세요.</Text>
              </>
            ) : null}

            {shootGuideStep === 1 ? (
              <>
                <Text style={styles.modalBody}>카운트가 끝나면 슛을 발사해 주세요.</Text>
                <Text style={styles.modalHint}>카운트가 끝난 뒤에는 준비 자세 안내로 돌아가지 않고 바로 슛 분석을 진행합니다.</Text>
              </>
            ) : null}

            {shootGuideStep === 2 ? (
              <>
                <Text style={styles.modalBody}>또한 카운트가 끝나면 녹화를 시작해 레슨하겠습니다.</Text>
                <Text style={styles.modalHint}>촬영된 영상과 피드백은 기록일지에서도 다시 확인할 수 있습니다.</Text>
              </>
            ) : null}

            <View style={styles.modalActions}>
              <Pressable onPress={closeShootGuide} style={({ pressed }) => [styles.modalGhostButton, pressed && styles.pressed]}>
                <Text style={styles.modalGhostButtonText}>닫기</Text>
              </Pressable>
              <Pressable onPress={confirmShootGuideStep} style={({ pressed }) => [styles.modalPrimaryButton, pressed && styles.pressed]}>
                <Text style={styles.modalPrimaryButtonText}>{shootConfirmLabel}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const sharedPanel = {
  backgroundColor: colors.surface,
  borderWidth: 0,
  borderColor: 'transparent',
  borderRadius: 18,
  padding: 18,
} as const;

const styles = StyleSheet.create({
  screenRoot: {
    flex: 1,
    minHeight: 0,
    position: 'relative',
    backgroundColor: '#020202',
  },
  screenBackdrop: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  screenBackdropBase: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.background,
  },
  screenBackdropGlowPrimary: {
    position: 'absolute',
    width: 420,
    height: 420,
    borderRadius: 999,
    backgroundColor: 'rgba(217,161,110,0.12)',
    top: -180,
    right: -120,
  },
  screenBackdropGlowSecondary: {
    position: 'absolute',
    width: 360,
    height: 360,
    borderRadius: 999,
    backgroundColor: 'rgba(122,181,255,0.09)',
    bottom: -180,
    left: -120,
  },
  topActionOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 30,
    paddingTop: 18,
    paddingHorizontal: 16,
    pointerEvents: 'box-none',
  },
  homeChip: {
    alignSelf: 'flex-start',
    minWidth: 48,
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(10,10,10,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeChipText: {
    color: '#fffaf4',
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 24,
  },
  cameraViewport: {
    flex: 1,
  },
  fullscreenCamera: {
    flex: 1,
    width: '100%',
    height: '100%',
    marginBottom: 0,
    borderRadius: 0,
    borderWidth: 0,
  },
  cameraChromeTop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 132,
    backgroundColor: 'transparent',
    pointerEvents: 'none',
  },
  cameraChromeBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 240,
    backgroundColor: 'transparent',
    pointerEvents: 'none',
  },
  screenScroll: {
    flex: 1,
  },
  screenScrollDocked: {
    flex: 1,
    minWidth: 0,
  },
  screenScrollContent: {
    paddingTop: 44,
    paddingBottom: 32,
  },
  contentGap: {
    gap: 16,
  },
  lessonViewport: {
    flex: 1,
  },
  lessonViewportDocked: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 18,
  },
  mobileCameraStage: {
    marginHorizontal: -16,
    marginBottom: 16,
  },
  heroCard: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: 'transparent',
    borderRadius: 28,
    padding: 22,
    minHeight: 320,
    width: '100%',
    alignSelf: 'stretch',
  },
  heroBackdrop: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 28,
    backgroundColor: 'rgba(33,26,21,0.58)',
  },
  heroBackdropGlowPrimary: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 999,
    backgroundColor: 'rgba(208,145,85,0.16)',
    top: -110,
    right: -60,
  },
  heroBackdropGlowSecondary: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 999,
    backgroundColor: 'rgba(247,242,236,0.05)',
    bottom: -120,
    left: -60,
  },
  heroBackdropSheen: {
    position: 'absolute',
    left: 20,
    right: 20,
    top: 18,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  heroIntro: {
    marginBottom: 20,
    maxWidth: 620,
  },
  heroTitle: {
    color: '#f8ecdd',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 12,
    letterSpacing: 0.2,
  },
  leadText: {
    color: '#dcc8b6',
    fontSize: 15,
    lineHeight: 23,
  },
  lessonLayout: {
    gap: 20,
    width: '100%',
  },
  cameraCard: {
    ...sharedPanel,
    flex: 1,
    flexShrink: 1,
    padding: 18,
    minWidth: 0,
    borderRadius: 24,
    backgroundColor: 'rgba(24,19,15,0.92)',
    shadowColor: '#000',
    shadowOpacity: 0.24,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  sideCard: {
    ...sharedPanel,
    backgroundColor: 'transparent',
    padding: 16,
    overflow: 'hidden',
  },
  sideCardDocked: {
    flex: 1,
    alignSelf: 'stretch',
  },
  sideRail: {
    flexShrink: 0,
  },
  sideRailOverlay: {
    position: 'absolute',
    top: 84,
    right: 16,
    bottom: 12,
    zIndex: 18,
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    pointerEvents: 'box-none',
  },
  sideRailOverlayLandscape: {
    left: 16,
    right: undefined,
    alignItems: 'flex-start',
  },
  sideCardFloating: {
    position: 'absolute',
    zIndex: 10,
  },
  sideCardDockedOverlay: {
    alignSelf: 'flex-end',
  },
  sideCardDockedOverlayLandscape: {
    alignSelf: 'flex-start',
  },
  sideCardScroll: {
    flex: 1,
  },
  sideCardContent: {
    paddingBottom: 8,
    flexGrow: 1,
  },
  coachingOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  coachingRestoreWrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    alignItems: 'center',
  },
  coachingRestoreWrapWide: {
    left: undefined,
    right: 0,
    top: 0,
    bottom: undefined,
    alignItems: 'flex-end',
  },
  coachingRestoreWrapLandscape: {
    left: 12,
    right: undefined,
    top: 88,
    bottom: undefined,
    alignItems: 'flex-start',
  },
  coachingRestoreChip: {
    borderRadius: 0,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(8,8,8,0.28)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  coachingRestoreChipText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  panelDragHandle: {
    alignItems: 'center',
    paddingTop: 2,
    paddingBottom: 10,
  },
  panelGrip: {
    alignSelf: 'center',
    width: 48,
    height: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginBottom: 8,
  },
  panelDragHint: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
  },
  coachingHero: {
    display: 'none',
  },
  coachingHeroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 12,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(7,7,7,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.secondary,
  },
  liveBadgeText: {
    color: colors.textAccent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  modePill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(7,7,7,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  modePillText: {
    color: colors.textSoft,
    fontSize: 12,
    fontWeight: '800',
  },
  sideTitle: {
    color: colors.textSoft,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 6,
  },
  sideSubtitle: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  sectionBlock: {
    position: 'relative',
    marginBottom: 10,
    paddingBottom: 2,
    borderBottomWidth: 0,
    borderBottomColor: 'transparent',
  },
  sectionBlockCollapsed: {
    paddingBottom: 0,
    minHeight: 36,
  },
  sectionContentWrap: {
    overflow: 'hidden',
  },
  sectionToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(7,7,7,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
  },
  sectionToggleButtonRound: {
    width: 30,
    height: 30,
    borderRadius: 0,
  },
  sectionToggleButtonFloating: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 5,
  },
  sectionToggleButtonCollapsed: {
    position: 'absolute',
    top: 2,
    right: 2,
    zIndex: 5,
  },
  sectionToggleButtonCollapsedChip: {
    minHeight: 30,
    maxWidth: 180,
    borderRadius: 0,
    paddingHorizontal: 10,
  },
  sectionToggleIcon: {
    color: colors.textSoft,
    fontSize: 15,
    fontWeight: '800',
  },
  sectionToggleLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  reviewWrap: {
    marginTop: 0,
    marginBottom: 14,
    padding: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(7,7,7,0.24)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  sectionCardWithToggleSpace: {
    paddingRight: 54,
  },
  reviewTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 10,
  },
  reviewVideo: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 14,
    backgroundColor: '#000',
    marginBottom: 10,
  },
  reviewHint: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
  },
  modeButtons: {
    flexDirection: 'row',
    gap: 10,
    alignSelf: 'center',
    padding: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(8,8,8,0.42)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  modeStatus: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.surfaceStrong,
    borderWidth: 0,
    borderColor: 'transparent',
    marginTop: 12,
    marginBottom: 12,
  },
  modeButton: {
    flex: 1,
    minWidth: 0,
    borderRadius: 24,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(247, 238, 226, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    gap: 14,
    overflow: 'hidden',
  },
  modeButtonActive: {
    backgroundColor: 'rgba(247, 238, 226, 0.12)',
    borderColor: 'rgba(255,214,160,0.82)',
    shadowColor: '#f4b36b',
    shadowOpacity: 0.24,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  modeButtonDisabled: {
    opacity: 0.48,
  },
  modeButtonArtworkFrame: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 18,
    backgroundColor: '#f7f3eb',
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  modeButtonArtwork: {
    width: '100%',
    height: '100%',
  },
  modeButtonText: {
    color: '#fff8f0',
    fontSize: 18,
    fontWeight: '800',
  },
  modeButtonTextActive: {
    color: '#fff8f0',
  },
  modeStatusText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  cameraControls: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    marginTop: 12,
  },
  bottomControlsOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 24,
    paddingHorizontal: 16,
    paddingBottom: 2,
    pointerEvents: 'box-none',
  },
  bottomControlsOverlayLandscape: {
    top: 0,
    bottom: 0,
    paddingBottom: 0,
  },
  landscapeShutterDock: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 18,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'box-none',
  },
  landscapeUtilityDock: {
    position: 'absolute',
    right: 20,
    bottom: 28,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'box-none',
  },
  bottomControlsStack: {
    width: '100%',
    alignSelf: 'center',
    alignItems: 'center',
    gap: 12,
  },
  bottomControlsStackWide: {
    maxWidth: 760,
  },
  captureControlsRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  captureSideSlot: {
    flex: 1,
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureSidePlaceholder: {
    width: 88,
    height: 40,
  },
  captureButtonStack: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  shutterButton: {
    width: 92,
    height: 92,
    borderRadius: 999,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.82)',
    backgroundColor: 'rgba(10,10,10,0.34)',
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  shutterButtonActive: {
    borderColor: 'rgba(239,68,68,0.96)',
  },
  shutterButtonDisabled: {
    opacity: 0.78,
  },
  shutterButtonInner: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#fff6ed',
  },
  shutterButtonInnerActive: {
    borderRadius: 999,
    backgroundColor: '#ef4444',
  },
  overlayUtilityButton: {
    minWidth: 88,
    minHeight: 40,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: 'rgba(10,10,10,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayUtilityButtonAccent: {
    backgroundColor: 'rgba(255,159,28,0.9)',
    borderColor: 'rgba(255,246,232,0.72)',
  },
  overlayUtilityButtonDanger: {
    backgroundColor: 'rgba(209,77,77,0.9)',
    borderColor: 'rgba(255,233,233,0.52)',
  },
  overlayUtilityButtonText: {
    color: '#fff9f2',
    fontSize: 13,
    fontWeight: '800',
  },
  errorBox: {
    marginBottom: 14,
    padding: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(191, 80, 88, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,215,215,0.14)',
  },
  errorText: {
    color: '#ffd5d5',
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '700',
  },
  tipBox: {
    marginTop: 0,
    padding: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(7,7,7,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 8,
  },
  tipTitle: {
    color: '#ffd8a8',
    fontSize: 15,
    fontWeight: '900',
  },
  tipText: {
    color: '#f0e7de',
    fontSize: 14,
    lineHeight: 21,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.62)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    position: 'relative',
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 0,
    borderColor: 'transparent',
    padding: 20,
  },
  modalCloseButton: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    zIndex: 2,
  },
  modalCloseButtonText: {
    color: colors.textSoft,
    fontSize: 16,
    fontWeight: '900',
    lineHeight: 18,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
  },
  modalStep: {
    color: '#ffd8a8',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 14,
    letterSpacing: 1,
  },
  modalBody: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '700',
    marginBottom: 14,
  },
  modalHint: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 22,
  },
  modePickerOptions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
    marginBottom: 14,
  },
  modePickerHint: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
  },
  countInput: {
    marginTop: 2,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 0,
    borderColor: 'transparent',
    backgroundColor: colors.surfaceStrong,
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  viewSelectRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  viewSelectButton: {
    flex: 1,
    borderRadius: 0,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: colors.surfaceStrong,
    borderWidth: 0,
    borderColor: 'transparent',
  },
  viewSelectButtonActive: {
    backgroundColor: 'rgba(208,145,85,0.18)',
    borderColor: colors.secondary,
  },
  viewSelectTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 4,
  },
  viewSelectCaption: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 22,
  },
  modalGhostButton: {
    borderRadius: 0,
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: colors.surfaceStrong,
    borderWidth: 0,
    borderColor: 'transparent',
  },
  modalGhostButtonText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  modalPrimaryButton: {
    borderRadius: 0,
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: colors.secondary,
  },
  modalPrimaryButtonDisabled: {
    opacity: 0.4,
  },
  modalPrimaryButtonText: {
    color: '#1b130c',
    fontSize: 15,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.9,
  },
});
