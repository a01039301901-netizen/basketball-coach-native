import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SmallButton } from '../components/common/Buttons';
import { Card } from '../components/common/Card';
import { BALL_BRAND_OPTIONS, BALL_COLOR_OPTIONS, POSITION_OPTIONS } from '../constants/settings';
import { colors } from '../theme/colors';
import type { BallBrandOption, BallColorOption, HomeworkTestState, PositionOption } from '../types/app';

const BALL_COLOR_ROWS: BallColorOption[][] = [
  ['yellow', 'orange', 'brown', 'red'],
  ['white', 'gray', 'black'],
];

const CORRECTION_OPTIONS: Array<{
  key: HomeworkTestState['correctionDirection'];
  label: string;
}> = [
  { key: 'none', label: '없음' },
  { key: 'left', label: '왼쪽 드리블 10회' },
  { key: 'right', label: '오른쪽 드리블 10회' },
];

interface SettingsScreenProps {
  selectedBallBrand: BallBrandOption;
  selectedBallColors: BallColorOption[];
  selectedPosition: PositionOption;
  homeworkTestState: HomeworkTestState;
  onSelectBallBrand: (brand: BallBrandOption) => void;
  onToggleBallColor: (color: BallColorOption) => void;
  onSelectPosition: (position: PositionOption) => void;
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

export function SettingsScreen({
  selectedBallBrand,
  selectedBallColors,
  selectedPosition,
  homeworkTestState,
  onSelectBallBrand,
  onToggleBallColor,
  onSelectPosition,
  onApplyHomeworkTestState,
}: SettingsScreenProps) {
  const [isPositionOpen, setIsPositionOpen] = useState(false);
  const [isCorrectionOpen, setIsCorrectionOpen] = useState(false);
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

  const selectedPositionLabel = useMemo(
    () => POSITION_OPTIONS.find((option) => option.key === selectedPosition)?.label ?? '없음',
    [selectedPosition]
  );
  const correctionDirectionLabel = useMemo(
    () => getCorrectionDirectionLabel(correctionDirection),
    [correctionDirection]
  );
  const ballColorOptionsByKey = useMemo(
    () => new Map<BallColorOption, (typeof BALL_COLOR_OPTIONS)[number]>(BALL_COLOR_OPTIONS.map((option) => [option.key, option])),
    []
  );

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
        <Text style={styles.sectionHeader}>사용자 포지션</Text>
        <Card style={[styles.compactCard, styles.borderlessCard]}>
          <View style={styles.positionWrap}>
            <Pressable
              onPress={() => setIsPositionOpen((current) => !current)}
              style={({ pressed }) => [styles.positionTrigger, pressed && styles.pressed]}
            >
              <Text style={styles.positionTriggerValue}>{selectedPositionLabel}</Text>
              <Text style={styles.positionTriggerArrow}>{isPositionOpen ? '▴' : '▾'}</Text>
            </Pressable>

            {isPositionOpen ? (
              <View style={styles.positionDropdown}>
                {POSITION_OPTIONS.map((option) => {
                  const active = selectedPosition === option.key;

                  return (
                    <Pressable
                      key={option.key}
                      onPress={() => {
                        onSelectPosition(option.key);
                        setIsPositionOpen(false);
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
        </Card>
      </View>

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
  positionWrap: {
    gap: 10,
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
  testFieldGrid: {
    gap: 10,
  },
  testField: {
    gap: 8,
  },
  testLabel: {
    color: colors.textSoft,
    fontSize: 14,
    fontWeight: '700',
  },
  testInput: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceStrong,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  testToggle: {
    borderRadius: 0,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: colors.surfaceStrong,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  testToggleActive: {
    backgroundColor: 'rgba(208,145,85,0.18)',
    borderColor: 'rgba(208,145,85,0.32)',
  },
  testToggleTitle: {
    color: colors.textSoft,
    fontSize: 14,
    fontWeight: '700',
  },
  testToggleValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 16,
  },
  pressed: {
    opacity: 0.9,
  },
});
