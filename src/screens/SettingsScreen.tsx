import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SmallButton } from '../components/common/Buttons';
import { Card } from '../components/common/Card';
import { BALL_BRAND_OPTIONS, BALL_COLOR_OPTIONS, POSITION_OPTIONS } from '../constants/settings';
import { colors } from '../theme/colors';
import type { AuthUser, BallBrandOption, BallColorOption, PositionOption } from '../types/app';

interface SettingsScreenProps {
  currentUser: AuthUser;
  selectedBallBrand: BallBrandOption;
  selectedBallColors: BallColorOption[];
  selectedPosition: PositionOption;
  onSelectBallBrand: (brand: BallBrandOption) => void;
  onToggleBallColor: (color: BallColorOption) => void;
  onSelectPosition: (position: PositionOption) => void;
  onLogout: () => void;
}

function formatGenderLabel(gender: AuthUser['gender']) {
  switch (gender) {
    case 'male':
      return '남성';
    case 'female':
      return '여성';
    default:
      return '기타';
  }
}

export function SettingsScreen({
  currentUser,
  selectedBallBrand,
  selectedBallColors,
  selectedPosition,
  onSelectBallBrand,
  onToggleBallColor,
  onSelectPosition,
  onLogout,
}: SettingsScreenProps) {
  const [isPositionOpen, setIsPositionOpen] = useState(false);

  const selectedPositionLabel = useMemo(
    () => POSITION_OPTIONS.find((option) => option.key === selectedPosition)?.label ?? '없음',
    [selectedPosition]
  );

  return (
    <View style={styles.contentGap}>
      <Card title="계정" style={styles.accountCard}>
        <Text style={styles.lead}>현재 로그인한 계정입니다. 다른 계정으로 바꾸려면 로그아웃 후 다시 로그인해 주세요.</Text>

        <View style={styles.accountInfoWrap}>
          <View style={styles.accountInfoRow}>
            <Text style={styles.accountLabel}>이름</Text>
            <Text style={styles.accountValue}>{currentUser.name}</Text>
          </View>
          <View style={styles.accountInfoRow}>
            <Text style={styles.accountLabel}>나이</Text>
            <Text style={styles.accountValue}>{currentUser.age}세</Text>
          </View>
          <View style={styles.accountInfoRow}>
            <Text style={styles.accountLabel}>성별</Text>
            <Text style={styles.accountValue}>{formatGenderLabel(currentUser.gender)}</Text>
          </View>
        </View>

        <View style={styles.logoutWrap}>
          <SmallButton title="로그아웃" onPress={onLogout} variant="red" />
        </View>
      </Card>

      <Card title="인식 설정" style={styles.card}>
        <Text style={styles.lead}>
          사용 중인 포지션과 공 브랜드, 색상을 맞춰 두면 드리블과 슛 분석이 조금 더 자연스럽게 동작합니다.
        </Text>

        <Text style={styles.sectionTitle}>포지션 설정</Text>
        <View style={styles.positionWrap}>
          <Pressable
            onPress={() => setIsPositionOpen((current) => !current)}
            style={({ pressed }) => [styles.positionTrigger, pressed && styles.pressed]}
          >
            <Text style={styles.positionTriggerLabel}>현재 선택</Text>
            <Text style={styles.positionTriggerValue}>{selectedPositionLabel}</Text>
            <Text style={styles.positionTriggerArrow}>{isPositionOpen ? '접기' : '열기'}</Text>
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

        <Text style={[styles.sectionTitle, styles.sectionSpacing]}>농구공 브랜드</Text>
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
        <View style={styles.optionList}>
          {BALL_COLOR_OPTIONS.map((option) => {
            const active = selectedBallColors.includes(option.key);

            return (
              <Pressable
                key={option.key}
                onPress={() => onToggleBallColor(option.key)}
                style={({ pressed }) => [styles.optionButton, active && styles.optionButtonActive, pressed && styles.pressed]}
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
                  <Text style={styles.optionSubtitle}>{active ? '현재 인식 대상에 포함됨' : '이 색상을 인식 목록에 추가'}</Text>
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
  accountCard: {
    minHeight: 0,
  },
  lead: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 23,
    marginBottom: 20,
  },
  accountInfoWrap: {
    gap: 12,
  },
  accountInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  accountLabel: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
  },
  accountValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  logoutWrap: {
    marginTop: 18,
    alignSelf: 'flex-start',
  },
  sectionTitle: {
    color: colors.textSoft,
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 14,
  },
  sectionSpacing: {
    marginTop: 24,
  },
  positionWrap: {
    gap: 10,
  },
  positionTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
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
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    padding: 10,
  },
  positionOption: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  positionOptionActive: {
    backgroundColor: 'rgba(255,159,28,0.2)',
  },
  positionOptionText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '800',
  },
  positionOptionTextActive: {
    color: colors.text,
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
