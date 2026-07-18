import { type AVPlaybackStatus, ResizeMode, Video } from 'expo-av';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Modal, PanResponder, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import type { WebViewMessageEvent } from 'react-native-webview';
import { InfoBox } from '../components/common/InfoBox';
import { LessonCamera } from '../components/lesson/LessonCamera';
import { colors } from '../theme/colors';
import type { BallBrandOption, BallColorOption, DribbleLessonView, LessonMode, LessonReviewClip } from '../types/app';
import { getDesktopMobileFrameWidth, shouldUseDesktopMobileLayout } from '../utils/layout';

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
  active: boolean;
  disabled: boolean;
  onPress: () => void;
}

function ModeButton({ title, active, disabled, onPress }: ModeButtonProps) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.modeButton,
        active && styles.modeButtonActive,
        disabled && styles.modeButtonDisabled,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.modeButtonText, active && styles.modeButtonTextActive]}>{title}</Text>
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
  busy: boolean;
  disabled: boolean;
  onPress: () => void;
}

function CameraShutterButton({ busy, disabled, onPress }: CameraShutterButtonProps) {
  return (
    <Pressable
      accessibilityLabel={busy ? '레슨 진행 중' : '레슨 시작'}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.shutterButton,
        busy && styles.shutterButtonBusy,
        disabled && styles.shutterButtonDisabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <View style={[styles.shutterButtonInner, busy && styles.shutterButtonInnerBusy]} />
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
          <InfoBox label="드리블 횟수" text={`${currentDribbleCount}회`} reserveToggleSpace={allowSectionCollapse} />
        </CoachingSection>
      ) : null}

      <CoachingSection
        title="핵심 피드백"
        collapsed={hiddenSections.feedback}
        allowCollapse={allowSectionCollapse}
        onToggle={() => toggleSection('feedback')}
      >
        <InfoBox label="실시간 피드백" text={feedbackText} reserveToggleSpace={allowSectionCollapse} />
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
  const isSideDockedCoaching = isWideLayout || isLandscapeMobileLayout;
  const isLessonSessionBusy = isLessonActive || isCameraActive;
  const allowPanelDragHide = !isSideDockedCoaching;
  const bottomControlsInset = 170;
  const floatingCoachingHeight = isSideDockedCoaching
    ? Math.max(320, Math.min(height - bottomControlsInset - 24, 760))
    : Math.max(240, Math.min(height * 0.36, 320));
  const floatingCoachingWidth = isWideLayout
    ? Math.max(320, Math.min(layoutWidth * 0.32, 420))
    : isLandscapeMobileLayout
      ? Math.max(280, Math.min(layoutWidth * 0.34, 360))
      : Math.min(layoutWidth - 24, 420);
  const coachingHiddenOffset = floatingCoachingHeight + 48;
  const coachingHideThreshold = Math.min(120, Math.max(72, floatingCoachingHeight * 0.24));
  const coachingPanelTranslateY = useRef(new Animated.Value(allowPanelDragHide ? coachingHiddenOffset : 0)).current;
  const coachingPanelTranslateYRef = useRef(0);
  const coachingPanelDragStartRef = useRef(0);

  const [showDribbleGuide, setShowDribbleGuide] = useState(false);
  const [dribbleGuideStep, setDribbleGuideStep] = useState(0);
  const [showShootGuide, setShowShootGuide] = useState(false);
  const [shootGuideStep, setShootGuideStep] = useState(0);
  const [dribbleCountInput, setDribbleCountInput] = useState('10');
  const [isCoachingPanelHidden, setIsCoachingPanelHidden] = useState(allowPanelDragHide);

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
    if (lessonMode !== 'dribble' || isLessonActive) {
      setShowDribbleGuide(false);
      setDribbleGuideStep(0);
    }

    if (lessonMode !== 'shoot' || isLessonActive) {
      setShowShootGuide(false);
      setShootGuideStep(0);
    }
  }, [isLessonActive, lessonMode]);

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
      setIsCoachingPanelHidden(false);
      coachingPanelTranslateY.stopAnimation();
      coachingPanelTranslateY.setValue(0);
      return;
    }

    if (isCoachingPanelHidden) {
      coachingPanelTranslateY.setValue(coachingHiddenOffset);
    }
  }, [allowPanelDragHide, coachingHiddenOffset, coachingPanelTranslateY, isCoachingPanelHidden]);

  function restoreCoachingPanel() {
    setIsCoachingPanelHidden(false);
    Animated.spring(coachingPanelTranslateY, {
      toValue: 0,
      damping: 24,
      stiffness: 220,
      mass: 0.9,
      useNativeDriver: true,
    }).start();
  }

  function hideCoachingPanel() {
    setIsCoachingPanelHidden(true);
    Animated.timing(coachingPanelTranslateY, {
      toValue: coachingHiddenOffset,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }

  function finishCoachingPanelDrag(dy: number, vy: number) {
    const dragDistance = Math.max(0, coachingPanelDragStartRef.current + dy);
    const shouldHide = dragDistance >= coachingHideThreshold || vy >= 0.9;

    if (shouldHide) {
      hideCoachingPanel();
      return;
    }

    restoreCoachingPanel();
  }

  function finishCoachingPanelRestoreDrag(dy: number, vy: number) {
    const dragDistance = Math.max(0, Math.min(coachingHiddenOffset, coachingPanelDragStartRef.current + dy));
    const restoredDistance = coachingHiddenOffset - dragDistance;
    const shouldRestore = restoredDistance >= coachingHideThreshold || vy <= -0.9;

    if (shouldRestore) {
      restoreCoachingPanel();
      return;
    }

    hideCoachingPanel();
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

  function openLessonStart() {
    if (isLessonSessionBusy) {
      return;
    }

    if (lessonMode === 'dribble') {
      setDribbleGuideStep(0);
      setShowDribbleGuide(true);
      return;
    }

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

      {isSideDockedCoaching ? (
        <View pointerEvents="box-none" style={styles.sideRailOverlay}>
          <View style={[styles.sideCard, styles.sideCardDockedOverlay, { width: floatingCoachingWidth, maxHeight: floatingCoachingHeight }]}>
            <ScrollView contentContainerStyle={styles.sideCardContent} showsVerticalScrollIndicator={false} nestedScrollEnabled>
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

      {!isSideDockedCoaching ? (
        <View pointerEvents="box-none" style={styles.coachingOverlay}>
          <Animated.View
            pointerEvents={allowPanelDragHide && isCoachingPanelHidden ? 'none' : 'auto'}
            style={[
              styles.sideCard,
              styles.sideCardFloating,
              {
                left: 12,
                right: 12,
                bottom: bottomControlsInset,
                maxHeight: floatingCoachingHeight,
              },
              allowPanelDragHide
                ? {
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
            <ScrollView contentContainerStyle={styles.sideCardContent} showsVerticalScrollIndicator={false} nestedScrollEnabled>
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
                { bottom: bottomControlsInset },
                isLandscapeMobileLayout ? styles.coachingRestoreWrapWide : null,
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

      <View pointerEvents="box-none" style={styles.bottomControlsOverlay}>
        <View style={[styles.bottomControlsStack, isWideLayout ? styles.bottomControlsStackWide : null]}>
          <View style={styles.modeButtons}>
            <ModeButton
              title="드리블 분석"
              active={lessonMode === 'dribble'}
              disabled={isLessonSessionBusy}
              onPress={() => onSelectMode('dribble')}
            />
            <ModeButton
              title="슛 분석"
              active={lessonMode === 'shoot'}
              disabled={isLessonSessionBusy}
              onPress={() => onSelectMode('shoot')}
            />
          </View>

          <View style={styles.captureModeChip}>
            <Text style={styles.captureModeChipText}>{lessonMode === 'shoot' ? '슛 분석' : dribbleViewLabel}</Text>
          </View>

          <View style={styles.captureControlsRow}>
            <View style={styles.captureSideSlot}>
              {isLessonActive || isCameraActive ? (
                <OverlayUtilityButton title="레슨 종료" onPress={onEndLesson} variant="danger" />
              ) : (
                <View style={styles.captureSidePlaceholder} />
              )}
            </View>

            <View style={styles.captureButtonStack}>
              <CameraShutterButton busy={isLessonSessionBusy} disabled={isLessonSessionBusy} onPress={openLessonStart} />
              <Text style={styles.captureButtonLabel}>{isLessonSessionBusy ? '레슨 진행 중' : '레슨 시작'}</Text>
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
      </View>

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
    backgroundColor: 'rgba(10,10,10,0.52)',
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
    backgroundColor: 'rgba(0,0,0,0.18)',
    pointerEvents: 'none',
  },
  cameraChromeBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 240,
    backgroundColor: 'rgba(0,0,0,0.24)',
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
    backgroundColor: colors.surfaceStrong,
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
    bottom: 190,
    zIndex: 18,
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    pointerEvents: 'box-none',
  },
  sideCardFloating: {
    position: 'absolute',
    zIndex: 10,
  },
  sideCardDockedOverlay: {
    alignSelf: 'flex-end',
  },
  sideCardContent: {
    paddingBottom: 8,
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
  coachingRestoreChip: {
    borderRadius: 0,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.surfaceStrong,
    borderWidth: 1,
    borderColor: colors.border,
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
    marginBottom: 16,
    padding: 14,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 0,
    borderColor: 'transparent',
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
    backgroundColor: colors.surfaceStrong,
    borderWidth: 0,
    borderColor: 'transparent',
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
    backgroundColor: colors.surfaceStrong,
    borderWidth: 0,
    borderColor: 'transparent',
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
    backgroundColor: colors.surface,
    borderWidth: 0,
    borderColor: 'transparent',
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
    backgroundColor: colors.surface,
    borderWidth: 0,
    borderColor: 'transparent',
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
    minWidth: 118,
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
  },
  modeButtonActive: {
    backgroundColor: 'rgba(255,159,28,0.92)',
    borderColor: 'rgba(255,246,232,0.72)',
  },
  modeButtonDisabled: {
    opacity: 0.48,
  },
  modeButtonText: {
    color: '#fff8f0',
    fontSize: 14,
    fontWeight: '800',
  },
  modeButtonTextActive: {
    color: '#27170a',
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
    paddingBottom: 26,
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
  captureModeChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(10,10,10,0.46)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  captureModeChipText: {
    color: '#f7efe7',
    fontSize: 13,
    fontWeight: '800',
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
  },
  captureButtonLabel: {
    marginTop: 10,
    color: '#fff6ed',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.2,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
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
  shutterButtonBusy: {
    borderColor: 'rgba(255,159,28,0.92)',
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
  shutterButtonInnerBusy: {
    borderRadius: 24,
    backgroundColor: '#ff9f1c',
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
    backgroundColor: 'rgba(191, 80, 88, 0.12)',
    borderWidth: 0,
    borderColor: 'transparent',
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
    backgroundColor: colors.surface,
    borderWidth: 0,
    borderColor: 'transparent',
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
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 0,
    borderColor: 'transparent',
    padding: 20,
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
