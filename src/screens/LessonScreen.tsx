import { type AVPlaybackStatus, ResizeMode, Video } from 'expo-av';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import type { WebViewMessageEvent } from 'react-native-webview';
import { SmallButton } from '../components/common/Buttons';
import { Card } from '../components/common/Card';
import { InfoBox } from '../components/common/InfoBox';
import { LessonCamera } from '../components/lesson/LessonCamera';
import { colors } from '../theme/colors';
import type { BallBrandOption, BallColorOption, DribbleLessonView, LessonMode, LessonReviewClip } from '../types/app';

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
      <Text style={styles.modeButtonText}>{title}</Text>
    </Pressable>
  );
}

interface ReviewClipPlayerProps {
  clip: LessonReviewClip;
}

function ReviewClipPlayer({ clip }: ReviewClipPlayerProps) {
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
    <View style={styles.reviewWrap}>
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
  debugText: string;
  currentDribbleCount: number;
  feedbackText: string;
  lessonReview: LessonReviewClip | null;
  cameraError: string;
  isWideLayout: boolean;
}

type CoachingSectionKey = 'status' | 'dribbleCount' | 'feedback' | 'review' | 'camera' | 'tips';

interface CoachingSectionProps {
  title: string;
  hidden: boolean;
  onHide: () => void;
  children: React.ReactNode;
}

function CoachingSection({ title, hidden, onHide, children }: CoachingSectionProps) {
  if (hidden) {
    return null;
  }

  return (
    <View style={styles.sectionBlock}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionLabel}>{title}</Text>
        <Pressable onPress={onHide} style={({ pressed }) => [styles.sectionHideButton, pressed && styles.pressed]}>
          <Text style={styles.sectionHideButtonText}>숨기기</Text>
        </Pressable>
      </View>
      {children}
    </View>
  );
}

function RealtimeCoachingPanel({
  lessonMode,
  debugText,
  currentDribbleCount,
  feedbackText,
  lessonReview,
  cameraError,
  isWideLayout,
}: RealtimeCoachingPanelProps) {
  const modeLabel = lessonMode === 'shoot' ? '슛 분석' : '드리블 분석';
  const modeSummary =
    lessonMode === 'shoot'
      ? '준비자세와 발사 흐름을 보면서 바로 고치면 좋은 점을 알려드려요.'
      : '드리블 리듬과 자세를 따라가며 지금 바로 바꾸면 좋은 점을 알려드려요.';
  const [hiddenSections, setHiddenSections] = useState<Record<CoachingSectionKey, boolean>>({
    status: false,
    dribbleCount: false,
    feedback: false,
    review: false,
    camera: false,
    tips: false,
  });

  const availableHiddenSectionLabels = [
    hiddenSections.status ? { key: 'status' as const, label: '현재 흐름' } : null,
    hiddenSections.dribbleCount && lessonMode === 'dribble' ? { key: 'dribbleCount' as const, label: '드리블 횟수' } : null,
    hiddenSections.feedback ? { key: 'feedback' as const, label: '핵심 피드백' } : null,
    hiddenSections.review && lessonReview ? { key: 'review' as const, label: '문제 장면 복기' } : null,
    hiddenSections.camera && cameraError ? { key: 'camera' as const, label: '카메라 알림' } : null,
    hiddenSections.tips ? { key: 'tips' as const, label: '촬영 팁' } : null,
  ].filter((item): item is { key: CoachingSectionKey; label: string } => Boolean(item));

  function hideSection(sectionKey: CoachingSectionKey) {
    setHiddenSections((current) => ({
      ...current,
      [sectionKey]: true,
    }));
  }

  function showSection(sectionKey: CoachingSectionKey) {
    setHiddenSections((current) => ({
      ...current,
      [sectionKey]: false,
    }));
  }

  return (
    <>
      {!isWideLayout ? <View style={styles.panelGrip} /> : null}

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

      {availableHiddenSectionLabels.length > 0 ? (
        <View style={styles.hiddenSectionWrap}>
          <Text style={styles.hiddenSectionLabel}>숨긴 창 다시 보기</Text>
          <View style={styles.hiddenSectionChipRow}>
            {availableHiddenSectionLabels.map((item) => (
              <Pressable
                key={item.key}
                onPress={() => showSection(item.key)}
                style={({ pressed }) => [styles.hiddenSectionChip, pressed && styles.pressed]}
              >
                <Text style={styles.hiddenSectionChipText}>{item.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      <CoachingSection title="현재 흐름" hidden={hiddenSections.status} onHide={() => hideSection('status')}>
        <InfoBox label="진행 상태" text={debugText} />
      </CoachingSection>

      {lessonMode === 'dribble' ? (
        <CoachingSection title="드리블 횟수" hidden={hiddenSections.dribbleCount} onHide={() => hideSection('dribbleCount')}>
          <InfoBox label="드리블 횟수" text={`${currentDribbleCount}회`} />
        </CoachingSection>
      ) : null}

      <CoachingSection title="핵심 피드백" hidden={hiddenSections.feedback} onHide={() => hideSection('feedback')}>
        <InfoBox label="실시간 피드백" text={feedbackText} />
      </CoachingSection>

      {lessonReview ? (
        <CoachingSection title="문제 장면 복기" hidden={hiddenSections.review} onHide={() => hideSection('review')}>
          <ReviewClipPlayer clip={lessonReview} />
        </CoachingSection>
      ) : null}

      {cameraError ? (
        <CoachingSection title="카메라 알림" hidden={hiddenSections.camera} onHide={() => hideSection('camera')}>
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{cameraError}</Text>
          </View>
        </CoachingSection>
      ) : null}

      <CoachingSection title="촬영 팁" hidden={hiddenSections.tips} onHide={() => hideSection('tips')}>
        <View style={styles.tipBox}>
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
  const isWideLayout = width >= 1080;
  const floatingCoachingHeight = isWideLayout ? Math.max(420, Math.min(height - 40, 760)) : Math.max(260, Math.min(height * 0.42, 380));
  const floatingCoachingWidth = isWideLayout ? Math.max(320, Math.min(width * 0.32, 420)) : Math.min(width - 24, 420);

  const [showDribbleGuide, setShowDribbleGuide] = useState(false);
  const [dribbleGuideStep, setDribbleGuideStep] = useState(0);
  const [showShootGuide, setShowShootGuide] = useState(false);
  const [shootGuideStep, setShootGuideStep] = useState(0);
  const [dribbleCountInput, setDribbleCountInput] = useState('10');

  const parsedDribbleCount = useMemo(() => {
    const nextValue = Number.parseInt(dribbleCountInput, 10);
    return Number.isFinite(nextValue) && nextValue > 0 ? nextValue : 0;
  }, [dribbleCountInput]);

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

  function openLessonStart() {
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

    setShowShootGuide(false);
    setShootGuideStep(0);
    onBeginLesson();
  }

  const dribbleConfirmLabel = dribbleGuideStep === 3 ? '레슨 시작' : '확인';
  const shootConfirmLabel = shootGuideStep === 2 ? '레슨 시작' : '확인';

  return (
    <View style={styles.screenRoot}>
      <View pointerEvents="box-none" style={styles.topActionOverlay}>
        <Pressable onPress={onGoHome} style={({ pressed }) => [styles.homeChip, pressed && styles.pressed]}>
          <Text style={styles.homeChipText}>메인으로</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.screenScroll}
        contentContainerStyle={[
          styles.contentGap,
          styles.screenScrollContent,
          isWideLayout ? styles.screenScrollContentWide : null,
          !isWideLayout ? { paddingBottom: floatingCoachingHeight + 36 } : null,
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Card title="AI 레슨 받기" style={styles.heroCard}>
          <Text style={styles.leadText}>
            실시간 자세 분석을 통해 드리블과 슛 동작을 확인하고, 지금 움직임에 맞는 코칭 피드백을 바로 볼 수 있습니다.
          </Text>

          <View style={[styles.lessonLayout, isWideLayout && styles.lessonLayoutWide]}>
            <View style={styles.cameraCard}>
              <View style={styles.modeButtons}>
                <ModeButton
                  title="드리블 분석"
                  active={lessonMode === 'dribble'}
                  disabled={isLessonActive}
                  onPress={() => onSelectMode('dribble')}
                />
                <ModeButton
                  title="슛 분석"
                  active={lessonMode === 'shoot'}
                  disabled={isLessonActive}
                  onPress={() => onSelectMode('shoot')}
                />
              </View>

              <View style={styles.modeStatus}>
                <Text style={styles.modeStatusText}>현재 모드: {lessonMode === 'shoot' ? '슛 분석' : '드리블 분석'}</Text>
              </View>

              <LessonCamera
                key={cameraSessionKey}
                lessonMode={lessonMode}
                selectedBallBrand={selectedBallBrand}
                selectedBallColors={selectedBallColors}
                isCameraActive={isCameraActive}
                isCameraPreviewHidden={isCameraPreviewHidden}
                isLessonActive={isLessonActive}
                isCameraReady={isCameraReady}
                countdownValue={countdownValue}
                dribbleResetToken={dribbleResetToken}
                shootResetToken={shootResetToken}
                recordingStartToken={recordingStartToken}
                recordingStopToken={recordingStopToken}
                onPoseMessage={onPoseMessage}
              />

              <View style={styles.cameraControls}>
                <SmallButton title="레슨 시작" onPress={openLessonStart} disabled={isLessonActive} />
                {lessonMode === 'shoot' && isShootSuccessButtonVisible ? (
                  <SmallButton title="슛 성공" onPress={onRegisterSuccessfulShot} variant="dark" />
                ) : null}
                <SmallButton
                  title="레슨 끝내기"
                  onPress={onEndLesson}
                  variant="red"
                  disabled={!isLessonActive && !isCameraActive}
                />
              </View>
            </View>

            {isWideLayout ? <View style={[styles.sideCardSpacer, { width: floatingCoachingWidth }]} /> : null}
          </View>
        </Card>
      </ScrollView>

      <View pointerEvents="box-none" style={styles.coachingOverlay}>
        <View
          style={[
            styles.sideCard,
            styles.sideCardFloating,
            isWideLayout
              ? { top: 0, right: 0, width: floatingCoachingWidth, maxHeight: floatingCoachingHeight }
              : {
                  left: 12,
                  right: 12,
                  bottom: 12,
                  maxHeight: floatingCoachingHeight,
                },
          ]}
        >
          <ScrollView contentContainerStyle={styles.sideCardContent} showsVerticalScrollIndicator={false} nestedScrollEnabled>
            <RealtimeCoachingPanel
              lessonMode={lessonMode}
              debugText={debugText}
              currentDribbleCount={currentDribbleCount}
              feedbackText={feedbackText}
              lessonReview={lessonReview}
              cameraError={cameraError}
              isWideLayout={isWideLayout}
            />
          </ScrollView>
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
  backgroundColor: 'rgba(255,255,255,0.12)',
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.18)',
  borderRadius: 24,
  padding: 24,
} as const;

const styles = StyleSheet.create({
  screenRoot: {
    flex: 1,
    minHeight: 0,
    position: 'relative',
  },
  topActionOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    paddingTop: 2,
    paddingHorizontal: 4,
    pointerEvents: 'box-none',
  },
  homeChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.72)',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  homeChipText: {
    color: colors.lightButtonText,
    fontSize: 13,
    fontWeight: '800',
  },
  screenScroll: {
    flex: 1,
  },
  screenScrollContent: {
    paddingTop: 44,
    paddingBottom: 32,
  },
  screenScrollContentWide: {
    paddingRight: 12,
  },
  contentGap: {
    gap: 18,
  },
  heroCard: {
    minHeight: 320,
  },
  leadText: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 23,
    marginBottom: 20,
  },
  lessonLayout: {
    gap: 24,
  },
  lessonLayoutWide: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  cameraCard: {
    ...sharedPanel,
    flex: 1.2,
  },
  sideCard: {
    ...sharedPanel,
    backgroundColor: 'rgba(22, 15, 11, 0.96)',
    borderColor: 'rgba(255, 216, 168, 0.14)',
    padding: 18,
    overflow: 'hidden',
  },
  sideCardFloating: {
    position: 'absolute',
    zIndex: 10,
    shadowColor: '#000',
    shadowOpacity: 0.34,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 12,
  },
  sideCardSpacer: {
    minHeight: 1,
  },
  sideCardContent: {
    paddingBottom: 8,
  },
  coachingOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  panelGrip: {
    alignSelf: 'center',
    width: 52,
    height: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.22)',
    marginBottom: 14,
  },
  coachingHero: {
    marginBottom: 18,
    padding: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 145, 77, 0.11)',
    borderWidth: 1,
    borderColor: 'rgba(255, 216, 168, 0.14)',
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
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(12, 8, 6, 0.34)',
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
    color: '#ffe0bc',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  modePill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
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
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 8,
  },
  sideSubtitle: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
  },
  hiddenSectionWrap: {
    marginBottom: 16,
    padding: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  hiddenSectionLabel: {
    color: '#ffe0bc',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 10,
    letterSpacing: 0.8,
  },
  hiddenSectionChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  hiddenSectionChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,145,77,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,216,168,0.14)',
  },
  hiddenSectionChipText: {
    color: colors.textSoft,
    fontSize: 12,
    fontWeight: '800',
  },
  sectionBlock: {
    marginBottom: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  sectionLabel: {
    color: '#ffd8a8',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  sectionHideButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  sectionHideButtonText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
  },
  reviewWrap: {
    marginTop: 0,
    marginBottom: 14,
    padding: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  reviewTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
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
    gap: 12,
    marginBottom: 16,
  },
  modeButton: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
  },
  modeButtonActive: {
    backgroundColor: colors.secondary,
    borderColor: '#ffffff',
  },
  modeButtonDisabled: {
    opacity: 0.5,
  },
  modeButtonText: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  modeStatus: {
    marginBottom: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
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
    justifyContent: 'space-between',
  },
  errorBox: {
    marginBottom: 14,
    padding: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 77, 79, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255, 77, 79, 0.45)',
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
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
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
    borderRadius: 24,
    backgroundColor: '#1a1511',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    padding: 24,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 10,
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
    fontSize: 17,
    lineHeight: 26,
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
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    backgroundColor: 'rgba(255,255,255,0.08)',
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
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  viewSelectButtonActive: {
    backgroundColor: 'rgba(255,159,28,0.18)',
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
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  modalGhostButtonText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  modalPrimaryButton: {
    borderRadius: 14,
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
    opacity: 0.86,
    transform: [{ scale: 0.99 }],
  },
});
