import { useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SmallButton } from '../components/common/Buttons';
import { Card } from '../components/common/Card';
import { BALL_BRAND_OPTIONS, BALL_COLOR_OPTIONS } from '../constants/settings';
import { colors } from '../theme/colors';
import type {
  BallBrandOption,
  BallColorOption,
  BallRecognitionPreview,
  BallRecognitionProfile,
  BallTrainingImageSource,
  HomeworkTestState,
} from '../types/app';

const BALL_COLOR_ROWS: BallColorOption[][] = [
  ['yellow', 'orange', 'brown', 'red'],
  ['white', 'gray', 'black'],
];

const CORRECTION_OPTIONS: Array<{
  key: HomeworkTestState['correctionDirection'];
  label: string;
}> = [
  { key: 'none', label: '없음' },
  { key: 'left', label: '왼손 드리블 10회' },
  { key: 'right', label: '오른손 드리블 10회' },
];

interface SettingsScreenProps {
  selectedBallBrand: BallBrandOption;
  selectedBallColors: BallColorOption[];
  ballRecognitionProfile: BallRecognitionProfile | null;
  ballRecognitionPreviews: BallRecognitionPreview[];
  isBallRecognitionTraining: boolean;
  homeworkTestState: HomeworkTestState;
  onSelectBallBrand: (brand: BallBrandOption) => void;
  onToggleBallColor: (color: BallColorOption) => void;
  onTrainBallRecognitionFromCamera: () => void;
  onTrainBallRecognitionFromLibrary: () => void;
  onTrainBallRecognitionFromUrls: (rawUrls: string) => void;
  onResetBallRecognition: () => void;
  onApplyHomeworkTestState: (nextState: HomeworkTestState) => void;
}

function getCorrectionDirectionLabel(direction: HomeworkTestState['correctionDirection']) {
  return CORRECTION_OPTIONS.find((option) => option.key === direction)?.label ?? '없음';
}

function parseNumberInput(value: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return 0;
  }

  const parsed = Number(trimmedValue);
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;
}

function formatTrainingDate(value: string) {
  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return '최근 학습';
  }

  return `${parsedDate.getMonth() + 1}.${parsedDate.getDate()} 학습 완료`;
}

function getPreviewSourceLabel(source: BallTrainingImageSource) {
  if (source === 'camera') {
    return '카메라';
  }

  if (source === 'url') {
    return '웹';
  }

  return '갤러리';
}

export function SettingsScreen({
  selectedBallBrand,
  selectedBallColors,
  ballRecognitionProfile,
  ballRecognitionPreviews,
  isBallRecognitionTraining,
  homeworkTestState,
  onSelectBallBrand,
  onToggleBallColor,
  onTrainBallRecognitionFromCamera,
  onTrainBallRecognitionFromLibrary,
  onTrainBallRecognitionFromUrls,
  onResetBallRecognition,
  onApplyHomeworkTestState,
}: SettingsScreenProps) {
  const [isCorrectionOpen, setIsCorrectionOpen] = useState(false);
  const [ballRecognitionUrlInput, setBallRecognitionUrlInput] = useState('');
  const [dribbleCountInput, setDribbleCountInput] = useState(String(homeworkTestState.dribbleCount));
  const [shootAttemptInput, setShootAttemptInput] = useState(String(homeworkTestState.shootAttemptCount));
  const [shotSuccessInput, setShotSuccessInput] = useState(String(homeworkTestState.shotSuccessCount));
  const [skillVideoInput, setSkillVideoInput] = useState(String(homeworkTestState.skillVideoOpenCount));
  const [leftHandInput, setLeftHandInput] = useState(String(homeworkTestState.leftHandTotal));
  const [rightHandInput, setRightHandInput] = useState(String(homeworkTestState.rightHandTotal));
  const [correctionProgressInput, setCorrectionProgressInput] = useState(String(homeworkTestState.correctionProgress));
  const [isStage2Unlocked, setIsStage2Unlocked] = useState(homeworkTestState.isStage2Unlocked);
  const [correctionDirection, setCorrectionDirection] = useState<HomeworkTestState['correctionDirection']>(
    homeworkTestState.correctionDirection
  );

  const correctionDirectionLabel = useMemo(
    () => getCorrectionDirectionLabel(correctionDirection),
    [correctionDirection]
  );
  const ballColorOptionsByKey = useMemo(
    () => new Map<BallColorOption, (typeof BALL_COLOR_OPTIONS)[number]>(BALL_COLOR_OPTIONS.map((option) => [option.key, option])),
    []
  );
  const learnedColors = ballRecognitionProfile?.learnedColors ?? [];
  const learnedColorOptions = learnedColors
    .map((colorKey) => ballColorOptionsByKey.get(colorKey))
    .filter((option): option is (typeof BALL_COLOR_OPTIONS)[number] => Boolean(option));

  function handleApplyHomeworkTestState() {
    onApplyHomeworkTestState({
      dribbleCount: parseNumberInput(dribbleCountInput),
      shootAttemptCount: parseNumberInput(shootAttemptInput),
      shotSuccessCount: parseNumberInput(shotSuccessInput),
      skillVideoOpenCount: parseNumberInput(skillVideoInput),
      leftHandTotal: parseNumberInput(leftHandInput),
      rightHandTotal: parseNumberInput(rightHandInput),
      isStage2Unlocked,
      correctionDirection,
      correctionProgress: parseNumberInput(correctionProgressInput),
    });
  }

  function handleResetHomeworkTestState() {
    onApplyHomeworkTestState({
      dribbleCount: 0,
      shootAttemptCount: 0,
      shotSuccessCount: 0,
      skillVideoOpenCount: 0,
      leftHandTotal: 0,
      rightHandTotal: 0,
      isStage2Unlocked: false,
      correctionDirection: 'none',
      correctionProgress: 0,
    });
    setDribbleCountInput('0');
    setShootAttemptInput('0');
    setShotSuccessInput('0');
    setSkillVideoInput('0');
    setLeftHandInput('0');
    setRightHandInput('0');
    setCorrectionProgressInput('0');
    setIsStage2Unlocked(false);
    setCorrectionDirection('none');
  }

  return (
    <View style={styles.contentGap}>
      <View style={styles.sectionBlock}>
        <Text style={styles.sectionHeader}>인식 설정</Text>
        <Card style={[styles.compactCard, styles.borderlessCard]}>
          <Text style={styles.sectionTitle}>농구공 브랜드</Text>
          <View style={styles.optionList}>
            {BALL_BRAND_OPTIONS.map((option) => {
              const active = selectedBallBrand === option.key;

              return (
                <Pressable
                  key={option.key}
                  onPress={() => onSelectBallBrand(option.key)}
                  style={({ pressed }) => [styles.optionButton, active && styles.optionButtonActive, pressed && styles.pressed]}
                >
                  <View style={styles.optionTextWrap}>
                    <Text style={styles.optionTitle}>{option.label}</Text>
                    <Text style={styles.optionSubtitle}>{option.description}</Text>
                  </View>
                  <View style={[styles.checkBadge, active && styles.checkBadgeActive]}>
                    <Text style={styles.checkBadgeText}>{active ? '선택됨' : '선택'}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.sectionTitle, styles.sectionSpacing]}>공 색상 조정</Text>
          <View style={styles.colorSection}>
            {BALL_COLOR_ROWS.map((row, rowIndex) => (
              <View key={`row-${rowIndex}`} style={styles.colorRow}>
                {row.map((colorKey) => {
                  const option = ballColorOptionsByKey.get(colorKey);

                  if (!option) {
                    return null;
                  }

                  const active = selectedBallColors.includes(option.key);

                  return (
                    <Pressable
                      key={option.key}
                      onPress={() => onToggleBallColor(option.key)}
                      style={({ pressed }) => [
                        styles.colorOptionButton,
                        active && styles.colorOptionButtonActive,
                        pressed && styles.pressed,
                      ]}
                    >
                      <View
                        style={[
                          styles.swatch,
                          styles.colorOptionSwatch,
                          {
                            backgroundColor: option.accent,
                            borderColor: option.key === 'white' ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.12)',
                          },
                        ]}
                      />
                      <Text style={[styles.colorOptionLabel, active && styles.colorOptionLabelActive]}>{option.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>

          <View style={styles.trainingSection}>
            <Text style={styles.sectionTitle}>공 이미지 학습</Text>
            <Text style={styles.trainingLead}>
              공 사진을 1~3장 등록하면 현재 공 색상에 맞춘 보정 밴드와 줄무늬 패턴 변형을 만들어 레슨 공 인식에 먼저 반영합니다. 세로 줄무늬가 보이는 사진, 가로 줄무늬가 보이는 사진, 비스듬한 사진을 함께 넣으면 여러 방향에서 더 안정적으로 인식할 수 있습니다.
            </Text>

            <View style={styles.trainingActionStack}>
              <SmallButton
                title={isBallRecognitionTraining ? '학습 준비 중' : '카메라로 촬영'}
                onPress={onTrainBallRecognitionFromCamera}
                disabled={isBallRecognitionTraining}
              />
              <SmallButton
                title={isBallRecognitionTraining ? '학습 준비 중' : '갤러리에서 선택'}
                onPress={onTrainBallRecognitionFromLibrary}
                variant="dark"
                disabled={isBallRecognitionTraining}
              />
              <View style={styles.urlTrainingBlock}>
                <TextInput
                  value={ballRecognitionUrlInput}
                  onChangeText={setBallRecognitionUrlInput}
                  style={[styles.testInput, styles.urlTrainingInput]}
                  placeholder="https://example.com/ball-1.jpg&#10;https://example.com/ball-2.jpg"
                  placeholderTextColor={colors.textMuted}
                  multiline
                  autoCapitalize="none"
                  autoCorrect={false}
                  textAlignVertical="top"
                />
                <Text style={styles.urlTrainingHint}>인터넷 이미지 주소를 한 줄에 하나씩 넣으면 최대 3장까지 학습합니다. 세로, 가로, 비스듬한 방향 사진을 함께 넣을수록 방향별 학습이 좋아집니다.</Text>
                <SmallButton
                  title={isBallRecognitionTraining ? '인터넷 이미지 준비 중' : '인터넷 이미지 학습'}
                  onPress={() => onTrainBallRecognitionFromUrls(ballRecognitionUrlInput)}
                  variant="dark"
                  disabled={isBallRecognitionTraining || !ballRecognitionUrlInput.trim()}
                />
              </View>
              <SmallButton
                title="학습 삭제"
                onPress={onResetBallRecognition}
                variant="red"
                disabled={isBallRecognitionTraining || (ballRecognitionPreviews.length === 0 && !ballRecognitionProfile)}
              />
            </View>

            {isBallRecognitionTraining ? (
              <View style={styles.trainingStatusCard}>
                <ActivityIndicator color={colors.secondary} />
                <Text style={styles.trainingStatusText}>공 이미지를 분석해서 인식 보정값을 만들고 있습니다.</Text>
              </View>
            ) : null}

            {ballRecognitionProfile ? (
              <View style={styles.trainingSummary}>
                <Text style={styles.trainingSummaryTitle}>{formatTrainingDate(ballRecognitionProfile.trainedAt)}</Text>
                <View style={styles.learnedColorRow}>
                  {learnedColorOptions.map((option) => (
                    <View key={option.key} style={styles.learnedColorChip}>
                      <View
                        style={[
                          styles.swatch,
                          styles.learnedColorSwatch,
                          {
                            backgroundColor: option.accent,
                            borderColor: option.key === 'white' ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.08)',
                          },
                        ]}
                      />
                      <Text style={styles.learnedColorText}>{option.label}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {ballRecognitionPreviews.length > 0 ? (
              <View style={styles.previewGrid}>
                {ballRecognitionPreviews.map((preview) => (
                  <View key={preview.id} style={styles.previewCard}>
                    <Image source={{ uri: preview.uri }} style={styles.previewImage} resizeMode="cover" />
                    <Text style={styles.previewLabel}>{preview.source === 'camera' ? '카메라' : '갤러리'}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        </Card>
      </View>

      <Card title="숙제 테스트 조절" style={styles.card}>
        <Text style={styles.lead}>
          오늘 숙제 진행도를 테스트용으로 직접 바꿀 수 있습니다. 값을 입력하고 적용하면 메인 숙제 창에 바로 반영됩니다.
        </Text>

        <View style={styles.testFieldGrid}>
          <View style={styles.testField}>
            <Text style={styles.testLabel}>오늘 드리블 횟수</Text>
            <TextInput value={dribbleCountInput} onChangeText={setDribbleCountInput} style={styles.testInput} keyboardType="number-pad" />
          </View>
          <View style={styles.testField}>
            <Text style={styles.testLabel}>오늘 슛 발사 횟수</Text>
            <TextInput value={shootAttemptInput} onChangeText={setShootAttemptInput} style={styles.testInput} keyboardType="number-pad" />
          </View>
          <View style={styles.testField}>
            <Text style={styles.testLabel}>오늘 슛 성공 횟수</Text>
            <TextInput value={shotSuccessInput} onChangeText={setShotSuccessInput} style={styles.testInput} keyboardType="number-pad" />
          </View>
          <View style={styles.testField}>
            <Text style={styles.testLabel}>오늘 기술 영상 열기 횟수</Text>
            <TextInput value={skillVideoInput} onChangeText={setSkillVideoInput} style={styles.testInput} keyboardType="number-pad" />
          </View>
          <View style={styles.testField}>
            <Text style={styles.testLabel}>왼손 드리블 누적</Text>
            <TextInput value={leftHandInput} onChangeText={setLeftHandInput} style={styles.testInput} keyboardType="number-pad" />
          </View>
          <View style={styles.testField}>
            <Text style={styles.testLabel}>오른손 드리블 누적</Text>
            <TextInput value={rightHandInput} onChangeText={setRightHandInput} style={styles.testInput} keyboardType="number-pad" />
          </View>
          <Pressable
            onPress={() => setIsStage2Unlocked((current) => !current)}
            style={({ pressed }) => [
              styles.testToggle,
              isStage2Unlocked && styles.testToggleActive,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.testToggleTitle}>2단계 숙제 잠금 해제</Text>
            <Text style={styles.testToggleValue}>{isStage2Unlocked ? '켜짐' : '꺼짐'}</Text>
          </Pressable>
          <View style={styles.testField}>
            <Text style={styles.testLabel}>보정 숙제 진행도</Text>
            <TextInput
              value={correctionProgressInput}
              onChangeText={setCorrectionProgressInput}
              style={styles.testInput}
              keyboardType="number-pad"
            />
          </View>
        </View>

        <View style={styles.positionWrap}>
          <Pressable
            onPress={() => setIsCorrectionOpen((current) => !current)}
            style={({ pressed }) => [styles.positionTrigger, pressed && styles.pressed]}
          >
            <Text style={styles.positionTriggerLabel}>보정 숙제</Text>
            <Text style={styles.positionTriggerValue}>{correctionDirectionLabel}</Text>
            <Text style={styles.positionTriggerArrow}>{isCorrectionOpen ? '닫기' : '열기'}</Text>
          </Pressable>

          {isCorrectionOpen ? (
            <View style={styles.positionDropdown}>
              {CORRECTION_OPTIONS.map((option) => {
                const active = correctionDirection === option.key;

                return (
                  <Pressable
                    key={option.key}
                    onPress={() => {
                      setCorrectionDirection(option.key);
                      setIsCorrectionOpen(false);
                    }}
                    style={({ pressed }) => [
                      styles.positionOption,
                      active && styles.positionOptionActive,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={[styles.positionOptionText, active && styles.positionOptionTextActive]}>{option.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>

        <View style={styles.actionRow}>
          <SmallButton title="테스트 값 적용" onPress={handleApplyHomeworkTestState} />
          <SmallButton title="오늘 숙제 초기화" onPress={handleResetHomeworkTestState} variant="dark" />
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  contentGap: {
    gap: 16,
  },
  card: {
    minHeight: 320,
  },
  compactCard: {
    minHeight: 0,
  },
  sectionBlock: {
    gap: 10,
  },
  sectionHeader: {
    color: colors.textSoft,
    fontSize: 20,
    fontWeight: '800',
    paddingHorizontal: 18,
  },
  borderlessCard: {
    borderWidth: 0,
    borderColor: 'transparent',
  },
  lead: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 21,
    marginBottom: 18,
  },
  sectionTitle: {
    color: colors.textSoft,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 12,
  },
  sectionSpacing: {
    marginTop: 20,
  },
  optionList: {
    gap: 10,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 0,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.surfaceStrong,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionButtonActive: {
    backgroundColor: 'rgba(208,145,85,0.18)',
    borderColor: 'rgba(208,145,85,0.32)',
  },
  optionTextWrap: {
    flex: 1,
  },
  optionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  optionSubtitle: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 4,
  },
  checkBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.surface,
  },
  checkBadgeActive: {
    backgroundColor: colors.secondary,
  },
  checkBadgeText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  swatch: {
    width: 28,
    height: 28,
    borderRadius: 999,
    borderWidth: 2,
  },
  colorSection: {
    gap: 10,
  },
  colorRow: {
    flexDirection: 'row',
    gap: 10,
  },
  colorOptionButton: {
    flex: 1,
    minHeight: 84,
    borderRadius: 0,
    paddingHorizontal: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.surfaceStrong,
    borderWidth: 1,
    borderColor: colors.border,
  },
  colorOptionButtonActive: {
    backgroundColor: 'rgba(208,145,85,0.18)',
    borderColor: 'rgba(208,145,85,0.32)',
  },
  colorOptionSwatch: {
    width: 34,
    height: 34,
  },
  colorOptionLabel: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '800',
  },
  colorOptionLabelActive: {
    color: colors.text,
  },
  trainingSection: {
    marginTop: 22,
  },
  trainingLead: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  trainingActionStack: {
    gap: 10,
  },
  urlTrainingBlock: {
    gap: 10,
  },
  urlTrainingInput: {
    minHeight: 112,
    paddingTop: 12,
  },
  urlTrainingHint: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  trainingStatusCard: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 0,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: colors.surfaceStrong,
    borderWidth: 1,
    borderColor: colors.border,
  },
  trainingStatusText: {
    flex: 1,
    color: colors.textSoft,
    fontSize: 13,
    lineHeight: 19,
  },
  trainingSummary: {
    marginTop: 14,
    gap: 10,
  },
  trainingSummaryTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  learnedColorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  learnedColorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: colors.surfaceStrong,
    borderWidth: 1,
    borderColor: colors.border,
  },
  learnedColorSwatch: {
    width: 18,
    height: 18,
  },
  learnedColorText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  previewGrid: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 10,
  },
  previewCard: {
    flex: 1,
    gap: 8,
  },
  previewImage: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: colors.surfaceStrong,
    borderWidth: 1,
    borderColor: colors.border,
  },
  previewLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  testFieldGrid: {
    gap: 12,
  },
  testField: {
    gap: 8,
  },
  testLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  testInput: {
    borderRadius: 0,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceStrong,
    color: colors.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: '700',
  },
  testToggle: {
    borderRadius: 0,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceStrong,
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 6,
  },
  testToggleActive: {
    backgroundColor: 'rgba(208,145,85,0.18)',
    borderColor: 'rgba(208,145,85,0.32)',
  },
  testToggleTitle: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  testToggleValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  positionWrap: {
    gap: 10,
    marginTop: 12,
  },
  positionTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 0,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: colors.surfaceStrong,
    borderWidth: 1,
    borderColor: colors.border,
  },
  positionTriggerLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  positionTriggerValue: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'center',
  },
  positionTriggerArrow: {
    color: colors.textSoft,
    fontSize: 12,
    fontWeight: '900',
  },
  positionDropdown: {
    gap: 8,
    borderRadius: 14,
    backgroundColor: colors.surfaceStrong,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 8,
  },
  positionOption: {
    borderRadius: 0,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.surface,
  },
  positionOptionActive: {
    backgroundColor: 'rgba(208,145,85,0.18)',
  },
  positionOptionText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
  },
  positionOptionTextActive: {
    color: colors.text,
  },
  actionRow: {
    gap: 10,
    marginTop: 16,
  },
  pressed: {
    opacity: 0.9,
  },
});
