import { type AVPlaybackStatus, ResizeMode, Video } from 'expo-av';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import type { WebViewMessageEvent } from 'react-native-webview';
import { SmallButton } from '../components/common/Buttons';
import { Card } from '../components/common/Card';
import { InfoBox } from '../components/common/InfoBox';
import { LessonCamera } from '../components/lesson/LessonCamera';
import { colors } from '../theme/colors';
import type {
  BallBrandOption,
  BallColorOption,
  DribbleLessonView,
  LessonMode,
  LessonReviewClip,
} from '../types/app';

interface LessonScreenProps {
  lessonMode: LessonMode;
  dribbleLessonView: DribbleLessonView;
  selectedBallBrand: BallBrandOption;
  selectedBallColors: BallColorOption[];
  isCameraActive: boolean;
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
  onSelectMode: (mode: LessonMode) => void;
  onSelectDribbleLessonView: (view: DribbleLessonView) => void;
  onBeginLesson: (dribbleTargetCount?: number) => void;
  onEndLesson: () => void;
  onRegisterSuccessfulShot: () => void;
  onPoseMessage: (event: WebViewMessageEvent) => void;
}

interface ModeButtonProps {
  title: string;
  active: boolean;
  disabled: boolean;
  onPress: () => void;
}

interface LessonViewButtonProps {
  title: string;
  active: boolean;
  disabled: boolean;
  onPress: () => void;
}

interface ReviewClipPlayerProps {
  clip: LessonReviewClip;
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
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text style={styles.modeButtonText}>{title}</Text>
    </Pressable>
  );
}

function LessonViewButton({ title, active, disabled, onPress }: LessonViewButtonProps) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.lessonViewButton,
        active && styles.lessonViewButtonActive,
        disabled && styles.lessonViewButtonDisabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text style={styles.lessonViewButtonText}>{title}</Text>
    </Pressable>
  );
}

function ReviewClipPlayer({ clip }: ReviewClipPlayerProps) {
  const videoRef = useRef<Video | null>(null);
  const [durationMillis, setDurationMillis] = useState(clip.durationMs);
  const loopEndMs = Math.max(clip.startAtMs + 250, Math.min(clip.startAtMs + clip.durationMs, durationMillis));

  useEffect(() => {
    setDurationMillis(clip.durationMs);
    void videoRef.current?.setPositionAsync(clip.startAtMs);
    void videoRef.current?.playAsync();
  }, [clip.durationMs, clip.startAtMs, clip.videoUri]);

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
      <Text style={styles.reviewHint}>가장 문제가 많이 나타난 3초 구간을 반복해서 보여주고 있습니다.</Text>
    </View>
  );
}

const DRIBBLE_GUIDE_STEPS = [
  '드리블을 몇 번 하고 레슨을 끝낼 것인지 정해주세요.',
  '상체를 낮춰 드리블 준비 자세로 맞춰 주세요. 그러면 카운트가 시작됩니다.',
  '카운트가 끝나면 드리블을 시작해 주세요.',
  '정해준 드리블 횟수 동안 영상을 녹화해 레슨하겠습니다.',
] as const;

const SHOOT_GUIDE_STEPS = [
  '슛을 하기 위한 준비 자세로 공을 90도로 들어 주세요. 그러면 카운트가 시작됩니다.',
  '카운트가 끝나면 슛을 발사해 주세요.',
  '또한 카운트가 끝나면 녹화를 시작해 레슨하겠습니다.',
] as const;

export function LessonScreen({
  lessonMode,
  dribbleLessonView,
  selectedBallBrand,
  selectedBallColors,
  isCameraActive,
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
  onSelectMode,
  onSelectDribbleLessonView,
  onBeginLesson,
  onEndLesson,
  onRegisterSuccessfulShot,
  onPoseMessage,
}: LessonScreenProps) {
  const { width } = useWindowDimensions();
  const isWideLayout = width >= 1080;

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

    if (dribbleGuideStep < DRIBBLE_GUIDE_STEPS.length - 1) {
      setDribbleGuideStep((current) => current + 1);
      return;
    }

    setShowDribbleGuide(false);
    setDribbleGuideStep(0);
    onBeginLesson(parsedDribbleCount);
  }

  function closeShootGuide() {
    setShowShootGuide(false);
    setShootGuideStep(0);
  }

  function confirmShootGuideStep() {
    if (shootGuideStep < SHOOT_GUIDE_STEPS.length - 1) {
      setShootGuideStep((current) => current + 1);
      return;
    }

    setShowShootGuide(false);
    setShootGuideStep(0);
    onBeginLesson();
  }

  const dribbleGuideConfirmLabel = dribbleGuideStep === DRIBBLE_GUIDE_STEPS.length - 1 ? '레슨 시작' : '확인';
  const shootGuideConfirmLabel = shootGuideStep === SHOOT_GUIDE_STEPS.length - 1 ? '레슨 시작' : '확인';
  const disableLessonViewChange = isLessonActive || isCameraActive;

  return (
    <View style={styles.contentGap}>
      <Card title="AI에게 레슨 받기" style={styles.heroCard}>
        <Text style={styles.leadText}>
          실시간 자세 분석을 통해 드리블과 슛 동작을 확인하고, 지금 움직임에 맞는 코칭 피드백을 바로 받아보세요.
        </Text>

        <View style={[styles.lessonLayout, isWideLayout && styles.lessonLayoutWide]}>
          <View style={styles.cameraCard}>
            <View style={styles.modeButtons}>
              <ModeButton
                title="드리블 레슨"
                active={lessonMode === 'dribble'}
                disabled={isLessonActive}
                onPress={() => onSelectMode('dribble')}
              />
              <ModeButton
                title="슛 레슨"
                active={lessonMode === 'shoot'}
                disabled={isLessonActive}
                onPress={() => onSelectMode('shoot')}
              />
            </View>

            <View style={styles.modeStatus}>
              <Text style={styles.modeStatusText}>
                현재 모드: {lessonMode === 'shoot' ? '슛 레슨' : dribbleLessonView === 'front' ? '앞모습 드리블 레슨' : '옆모습 드리블 레슨'}
              </Text>
            </View>

            <LessonCamera
              key={cameraSessionKey}
              lessonMode={lessonMode}
              dribbleLessonView={dribbleLessonView}
              selectedBallBrand={selectedBallBrand}
              selectedBallColors={selectedBallColors}
              isCameraActive={isCameraActive}
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
              {lessonMode === 'shoot' ? (
                <SmallButton title="슛 성공" onPress={onRegisterSuccessfulShot} variant="dark" />
              ) : null}
              <SmallButton title="레슨 끝내기" onPress={onEndLesson} variant="red" disabled={!isLessonActive && !isCameraActive} />
            </View>
          </View>

          <View style={styles.sideCard}>
            <Text style={styles.sideTitle}>실시간 코칭</Text>

            {lessonMode === 'dribble' ? (
              <View style={styles.lessonViewBox}>
                <Text style={styles.lessonViewLabel}>드리블 레슨 선택</Text>
                <View style={styles.lessonViewButtons}>
                  <LessonViewButton
                    title="옆모습 레슨"
                    active={dribbleLessonView === 'side'}
                    disabled={disableLessonViewChange}
                    onPress={() => onSelectDribbleLessonView('side')}
                  />
                  <LessonViewButton
                    title="앞모습 레슨"
                    active={dribbleLessonView === 'front'}
                    disabled={disableLessonViewChange}
                    onPress={() => onSelectDribbleLessonView('front')}
                  />
                </View>
                <Text style={styles.lessonViewHint}>
                  레슨이 시작되면 선택을 잠깁니다. 다른 레슨으로 바꾸려면 현재 카메라 세션을 먼저 종료해 주세요.
                </Text>
              </View>
            ) : null}

            <InfoBox label="진행 상태" text={debugText} />
            {lessonMode === 'dribble' ? <InfoBox label="드리블 횟수" text={`${currentDribbleCount}회`} /> : null}
            <InfoBox label="실시간 피드백" text={feedbackText} />

            {lessonReview ? <ReviewClipPlayer clip={lessonReview} /> : null}

            {cameraError ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{cameraError}</Text>
              </View>
            ) : null}

            <View style={styles.tipBox}>
              <Text style={styles.tipTitle}>촬영 팁</Text>
              <Text style={styles.tipText}>몸 전체와 공이 함께 보이도록 거리를 맞추면 관절, 공, 드리블 높이를 더 안정적으로 분석할 수 있습니다.</Text>
              <Text style={styles.tipText}>밝은 장소에서 촬영하고, 배경과 공 색이 겹치지 않도록 하면 공 인식이 더 잘 됩니다.</Text>
              <Text style={styles.tipText}>슛은 어깨부터 발끝까지, 드리블은 손목과 상체가 함께 보이도록 맞춰 주세요.</Text>
            </View>
          </View>
        </View>
      </Card>

      <Modal visible={showDribbleGuide} transparent animationType="fade" onRequestClose={closeDribbleGuide}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>드리블 레슨 안내</Text>
            <Text style={styles.modalStep}>STEP {dribbleGuideStep + 1} / {DRIBBLE_GUIDE_STEPS.length}</Text>

            <Text style={styles.modalBody}>{DRIBBLE_GUIDE_STEPS[dribbleGuideStep]}</Text>

            {dribbleGuideStep === 0 ? (
              <>
                <TextInput
                  value={dribbleCountInput}
                  onChangeText={(value) => setDribbleCountInput(value.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                  placeholder="예: 10"
                  placeholderTextColor="rgba(255,255,255,0.45)"
                  style={styles.countInput}
                  maxLength={3}
                />
                <Text style={styles.modalHint}>입력한 횟수만큼 드리블하면 자동으로 녹화를 멈추고 리뷰를 준비합니다.</Text>
              </>
            ) : (
              <Text style={styles.modalHint}>
                {dribbleLessonView === 'front'
                  ? '앞모습 레슨은 무릎-엉덩이-무릎 각도, 공 위치, 양손 균형, 발 간격을 기준으로 분석합니다.'
                  : '옆모습 레슨은 상체 기울기, 시선, 공 높이를 기준으로 분석합니다.'}
              </Text>
            )}

            <View style={styles.modalActions}>
              <SmallButton title="닫기" onPress={closeDribbleGuide} variant="dark" />
              <SmallButton
                title={dribbleGuideConfirmLabel}
                onPress={confirmDribbleGuideStep}
                disabled={dribbleGuideStep === 0 && parsedDribbleCount <= 0}
              />
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showShootGuide} transparent animationType="fade" onRequestClose={closeShootGuide}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>슛 레슨 안내</Text>
            <Text style={styles.modalStep}>STEP {shootGuideStep + 1} / {SHOOT_GUIDE_STEPS.length}</Text>
            <Text style={styles.modalBody}>{SHOOT_GUIDE_STEPS[shootGuideStep]}</Text>
            <Text style={styles.modalHint}>슛 레슨은 준비 자세 카운트가 끝난 뒤 녹화를 시작하고, 발사 후 촬영된 영상을 바탕으로 결과를 정리합니다.</Text>
            <View style={styles.modalActions}>
              <SmallButton title="닫기" onPress={closeShootGuide} variant="dark" />
              <SmallButton title={shootGuideConfirmLabel} onPress={confirmShootGuideStep} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  contentGap: {
    gap: 18,
  },
  heroCard: {
    gap: 18,
  },
  leadText: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 24,
  },
  lessonLayout: {
    gap: 18,
  },
  lessonLayoutWide: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  cameraCard: {
    flex: 1.4,
    gap: 14,
  },
  sideCard: {
    flex: 1,
    gap: 2,
    minWidth: 320,
  },
  modeButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  modeButton: {
    flex: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  modeButtonActive: {
    backgroundColor: colors.primary,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  modeButtonDisabled: {
    opacity: 0.5,
  },
  modeButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'center',
  },
  modeStatus: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.24)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  modeStatusText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  cameraControls: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  sideTitle: {
    color: colors.textSoft,
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 10,
  },
  lessonViewBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  lessonViewLabel: {
    color: colors.textAccent,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 10,
    letterSpacing: 1,
  },
  lessonViewButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  lessonViewButton: {
    flex: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  lessonViewButtonActive: {
    backgroundColor: 'rgba(255,139,43,0.22)',
    borderColor: 'rgba(255,159,28,0.7)',
  },
  lessonViewButtonDisabled: {
    opacity: 0.48,
  },
  lessonViewButtonText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  lessonViewHint: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 10,
  },
  reviewWrap: {
    backgroundColor: 'rgba(0,0,0,0.28)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  reviewTitle: {
    color: colors.textAccent,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 10,
  },
  reviewVideo: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 14,
    backgroundColor: colors.cameraBg,
  },
  reviewHint: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 10,
  },
  errorBox: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    backgroundColor: 'rgba(216,58,77,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(216,58,77,0.44)',
  },
  errorText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 21,
  },
  tipBox: {
    borderRadius: 18,
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  tipTitle: {
    color: colors.textSoft,
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 10,
  },
  tipText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 21,
    marginBottom: 8,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.56)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    borderRadius: 24,
    backgroundColor: '#1e140e',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 22,
  },
  modalTitle: {
    color: colors.textSoft,
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 10,
  },
  modalStep: {
    color: colors.textAccent,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 16,
    letterSpacing: 1,
  },
  modalBody: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 26,
    marginBottom: 14,
  },
  modalHint: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 21,
  },
  countInput: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 22,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
});
