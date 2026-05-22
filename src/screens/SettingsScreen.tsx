import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card } from '../components/common/Card';
import { BALL_BRAND_OPTIONS, BALL_COLOR_OPTIONS } from '../constants/settings';
import { colors } from '../theme/colors';
import type { BallBrandOption, BallColorOption } from '../types/app';

interface SettingsScreenProps {
  selectedBallBrand: BallBrandOption;
  selectedBallColors: BallColorOption[];
  onSelectBallBrand: (brand: BallBrandOption) => void;
  onToggleBallColor: (color: BallColorOption) => void;
}

export function SettingsScreen({
  selectedBallBrand,
  selectedBallColors,
  onSelectBallBrand,
  onToggleBallColor,
}: SettingsScreenProps) {
  return (
    <View style={styles.contentGap}>
      <Card title="공 인식 설정" style={styles.card}>
        <Text style={styles.lead}>
          사용하는 농구공 브랜드를 먼저 고르면 해당 브랜드에 맞는 공 색과 이음선 기준으로 인식을 보강합니다.
          아래 색상은 세부 조정용이라 여러 개를 함께 켤 수 있습니다.
        </Text>

        <Text style={styles.sectionTitle}>농구공 브랜드</Text>
        <View style={styles.optionList}>
          {BALL_BRAND_OPTIONS.map((option) => {
            const active = selectedBallBrand === option.key;

            return (
              <Pressable
                key={option.key}
                onPress={() => onSelectBallBrand(option.key)}
                style={({ pressed }) => [
                  styles.optionButton,
                  active && styles.optionButtonActive,
                  pressed && styles.pressed,
                ]}
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

        <Text style={[styles.sectionTitle, styles.colorsTitle]}>세부 색상 조정</Text>
        <View style={styles.optionList}>
          {BALL_COLOR_OPTIONS.map((option) => {
            const active = selectedBallColors.includes(option.key);

            return (
              <Pressable
                key={option.key}
                onPress={() => onToggleBallColor(option.key)}
                style={({ pressed }) => [
                  styles.optionButton,
                  active && styles.optionButtonActive,
                  pressed && styles.pressed,
                ]}
              >
                <View
                  style={[
                    styles.swatch,
                    {
                      backgroundColor: option.accent,
                      borderColor: active ? '#ffffff' : 'rgba(255,255,255,0.15)',
                    },
                  ]}
                />
                <View style={styles.optionTextWrap}>
                  <Text style={styles.optionTitle}>{option.label}</Text>
                  <Text style={styles.optionSubtitle}>{active ? '현재 인식 색상에 포함됨' : '탭해서 인식 색상에 추가'}</Text>
                </View>
                <View style={[styles.checkBadge, active && styles.checkBadgeActive]}>
                  <Text style={styles.checkBadgeText}>{active ? 'ON' : 'OFF'}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  contentGap: {
    gap: 18,
  },
  card: {
    minHeight: 320,
  },
  lead: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 23,
    marginBottom: 20,
  },
  sectionTitle: {
    color: colors.textSoft,
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 14,
  },
  colorsTitle: {
    marginTop: 24,
  },
  optionList: {
    gap: 14,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 16,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  optionButtonActive: {
    backgroundColor: 'rgba(255,159,28,0.18)',
    borderColor: 'rgba(255,255,255,0.28)',
  },
  swatch: {
    width: 28,
    height: 28,
    borderRadius: 999,
    borderWidth: 2,
  },
  optionTextWrap: {
    flex: 1,
  },
  optionTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  optionSubtitle: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 4,
  },
  checkBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  checkBadgeActive: {
    backgroundColor: colors.secondary,
  },
  checkBadgeText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
});
