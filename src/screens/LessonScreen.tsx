import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { WebViewMessageEvent } from 'react-native-webview';
import { Card } from '../components/common/Card';
import { SmallButton } from '../components/common/Buttons';
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
  return (
    <View style={styles.contentGap}>
      <Card title="AI 레슨 받기" style={styles.heroCard}>
        <Text style={styles.paragraph}>
          inner.html처럼 MediaPipe가 카메라 영상 위에서 직접 관절 포인트를 분석하도록 구성했습니다. 레슨 시작 후 진행 상태에 오류가 뜨면 그 메시지를 그대로 확인해 주세요.
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

        <LessonCamera isLessonActive={isLessonActive} isCameraReady={isCameraReady} onPoseMessage={onPoseMessage} />

        <View style={styles.controlsRow}>
          <SmallButton title="레슨 시작" onPress={onBeginLesson} disabled={isLessonActive} />
          {lessonMode === 'shoot' ? (
            <SmallButton title="슛 성공" onPress={onRegisterSuccessfulShot} variant="dark" />
          ) : null}
          <SmallButton title="레슨 종료" onPress={onEndLesson} variant="red" disabled={!isLessonActive} />
        </View>

        <InfoBox label="진행 상태" text={debugText} />
        <InfoBox label="코칭 피드백" text={feedbackText} />

        {cameraError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{cameraError}</Text>
          </View>
        ) : null}
      </Card>

      <Card title="촬영 팁">
        <View style={styles.tipList}>
          <Text style={styles.tipText}>전신이 화면 안에 들어오면 목, 어깨, 엉덩이, 무릎, 발 인식이 더 안정적입니다.</Text>
          <Text style={styles.tipText}>양손과 팔꿈치가 잘 보이도록 배경과 겹치지 않는 밝은 장소에서 촬영해 주세요.</Text>
          <Text style={styles.tipText}>카메라가 켜지지 않으면 진행 상태 박스에 표시된 오류 문구를 그대로 알려주시면 다음 수정이 빨라집니다.</Text>
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
  controlsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
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
