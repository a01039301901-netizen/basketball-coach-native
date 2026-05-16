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
  const isWideLayout = width >= 1080;

  return (
    <View style={styles.contentGap}>
      <Card title="AI 레슨 받기" style={styles.heroCard}>
        <Text style={styles.leadText}>
          실시간 자세 분석을 통해 드리블과 슛 폼을 확인하고, 현재 움직임에 맞는 코칭 피드백을 바로 확인할 수 있습니다.
        </Text>

        <View style={[styles.lessonLayout, isWideLayout && styles.lessonLayoutWide]}>
          <View style={styles.cameraCard}>
            <View style={styles.modeButtons}>
              <ModeButton
                title="🏀 드리블 분석"
                active={lessonMode === 'dribble'}
                disabled={isLessonActive}
                onPress={() => onSelectMode('dribble')}
              />
              <ModeButton
                title="🎯 슛 분석"
                active={lessonMode === 'shoot'}
                disabled={isLessonActive}
                onPress={() => onSelectMode('shoot')}
              />
            </View>

            <View style={styles.modeStatus}>
              <Text style={styles.modeStatusText}>현재 모드: {lessonMode === 'shoot' ? '슛 분석' : '드리블 분석'}</Text>
            </View>

            <LessonCamera
              lessonMode={lessonMode}
              isLessonActive={isLessonActive}
              isCameraReady={isCameraReady}
              onPoseMessage={onPoseMessage}
            />


            <View style={styles.cameraControls}>
              <SmallButton title="레슨 시작" onPress={onBeginLesson} disabled={isLessonActive} />
              {lessonMode === 'shoot' ? (
                <SmallButton title="슛 성공" onPress={onRegisterSuccessfulShot} variant="dark" />
              ) : null}
              <SmallButton title="레슨 끝내기" onPress={onEndLesson} variant="red" disabled={!isLessonActive} />
            </View>
          </View>

          <View style={styles.sideCard}>
            <Text style={styles.sideTitle}>실시간 코칭</Text>
            <InfoBox label="진행 상태" text={debugText} />
            <InfoBox label="피드백" text={feedbackText} />

            {cameraError ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{cameraError}</Text>
              </View>
            ) : null}

            <View style={styles.tipBox}>
              <Text style={styles.tipTitle}>촬영 팁</Text>
              <Text style={styles.tipText}>몸 전체가 화면에 들어오면 어깨, 팔꿈치, 손목, 엉덩이, 무릎, 발을 더 안정적으로 인식합니다.</Text>
              <Text style={styles.tipText}>밝은 장소에서 촬영하고, 팔과 다리가 배경에 겹치지 않도록 서 주면 분석이 더 정확해집니다.</Text>
              <Text style={styles.tipText}>슛 분석은 어깨부터 발까지, 드리블 분석은 손목과 상체가 특히 잘 보이도록 맞춰 주세요.</Text>
            </View>
          </View>
        </View>
      </Card>
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
    flex: 0.8,
  },
  sideTitle: {
    color: colors.textSoft,
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 14,
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
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 16,
  },
  tipBox: {
    marginTop: 8,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  tipTitle: {
    color: colors.textSoft,
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 10,
  },
  tipText: {
    color: colors.textSoft,
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 8,
  },
  errorBox: {
    borderRadius: 14,
    backgroundColor: 'rgba(216,58,77,0.22)',
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
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
