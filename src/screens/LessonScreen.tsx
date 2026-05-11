import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { WebViewMessageEvent } from 'react-native-webview';
import { SmallButton } from '../components/common/Buttons';
import { Card } from '../components/common/Card';
import { InfoBox } from '../components/common/InfoBox';
import { LessonCamera } from '../components/lesson/LessonCamera';
import { colors } from '../theme/colors';
import type { LessonMode } from '../types/app';

interface LessonScreenProps {
  lessonMode: LessonMode;
  isLessonActive: boolean;
  isCameraReady: boolean;
  debugText: string;
  feedbackText: string;
  cameraError: string;
  onSelectMode: (mode: LessonMode) => void;
  onBeginLesson: () => void;
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

export function LessonScreen({
  lessonMode,
  isLessonActive,
  isCameraReady,
  debugText,
  feedbackText,
  cameraError,
  onSelectMode,
  onBeginLesson,
  onEndLesson,
  onRegisterSuccessfulShot,
  onPoseMessage,
}: LessonScreenProps) {
  const { width } = useWindowDimensions();
  const isWideLayout = width >= 1180;

  return (
    <View style={styles.contentGap}>
      <Card title="AI 레슨 받기" style={styles.heroCard}>
        <Text style={styles.paragraph}>
          실시간 카메라와 MediaPipe로 자세를 분석하고, 선택한 모드 기준에 맞춰 피드백이 바로 바뀌도록 구성했습니다.
        </Text>

        <View style={styles.modeRow}>
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

        <View style={styles.statusBox}>
          <Text style={styles.statusText}>현재 모드: {lessonMode === 'shoot' ? '슛 분석' : '드리블 분석'}</Text>
        </View>

        <View style={[styles.lessonStage, isWideLayout && styles.lessonStageWide]}>
          <View style={[styles.cameraColumn, isWideLayout && styles.cameraColumnWide]}>
            <LessonCamera isLessonActive={isLessonActive} isCameraReady={isCameraReady} onPoseMessage={onPoseMessage} />
          </View>

          <View style={[styles.feedbackColumn, isWideLayout && styles.feedbackColumnWide]}>
            <View style={styles.controlsCard}>
              <View style={[styles.controlsRow, isWideLayout && styles.controlsColumn]}>
                <SmallButton title="레슨 시작" onPress={onBeginLesson} disabled={isLessonActive} />
                {lessonMode === 'shoot' ? (
                  <SmallButton title="슛 성공" onPress={onRegisterSuccessfulShot} variant="dark" />
                ) : null}
                <SmallButton title="레슨 끝내기" onPress={onEndLesson} variant="red" disabled={!isLessonActive} />
              </View>
            </View>

            <InfoBox label="진행 상태" text={debugText} />
            <InfoBox label="실시간 피드백" text={feedbackText} />

            {cameraError ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{cameraError}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </Card>

      <Card title="촬영 팁">
        <View style={styles.tipList}>
          <Text style={styles.tipText}>몸 전체가 화면에 들어오면 어깨, 팔꿈치, 손목, 엉덩이, 무릎, 발을 더 안정적으로 인식합니다.</Text>
          <Text style={styles.tipText}>밝은 장소에서 촬영하고, 팔과 다리가 배경에 겹치지 않도록 서 주면 분석이 더 정확해집니다.</Text>
          <Text style={styles.tipText}>넓은 화면에서는 카메라 옆에 진행 상태와 피드백이 같이 보이도록 배치되어 있습니다.</Text>
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  contentGap: {
    gap: 18,
  },
  heroCard: {
    minHeight: 320,
  },
  paragraph: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 23,
    marginBottom: 18,
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
    backgroundColor: colors.secondary,
    borderColor: '#fff5ec',
  },
  modeButtonDisabled: {
    opacity: 0.5,
  },
  modeButtonText: {
    color: colors.text,
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
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  lessonStage: {
    gap: 16,
  },
  lessonStageWide: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  cameraColumn: {
    width: '100%',
  },
  cameraColumnWide: {
    flex: 0.62,
    maxWidth: 760,
  },
  feedbackColumn: {
    width: '100%',
  },
  feedbackColumnWide: {
    flex: 0.38,
    minWidth: 280,
    maxWidth: 420,
  },
  controlsCard: {
    backgroundColor: colors.cardOverlay,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  controlsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  controlsColumn: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  tipList: {
    gap: 10,
  },
  tipText: {
    color: colors.textSoft,
    fontSize: 15,
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
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
});
