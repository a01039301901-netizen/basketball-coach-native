import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card } from '../components/common/Card';
import { BALL_BRAND_OPTIONS, BALL_COLOR_OPTIONS } from '../constants/settings';
import { colors } from '../theme/colors';
import type {
  BallBrandOption,
  BallColorOption,
} from '../types/app';

const BALL_COLOR_ROWS: BallColorOption[][] = [
  ['yellow', 'orange', 'brown', 'red'],
  ['white', 'gray', 'black'],
];

interface SettingsScreenProps {
  isDrawer?: boolean;
  selectedBallBrand: BallBrandOption;
  selectedBallColors: BallColorOption[];
  onSelectBallBrand: (brand: BallBrandOption) => void;
  onToggleBallColor: (color: BallColorOption) => void;
}

export function SettingsScreen({
  isDrawer = false,
  selectedBallBrand,
  selectedBallColors,
  onSelectBallBrand,
  onToggleBallColor,
}: SettingsScreenProps) {
  const ballColorOptionsByKey = useMemo(
    () => new Map<BallColorOption, (typeof BALL_COLOR_OPTIONS)[number]>(BALL_COLOR_OPTIONS.map((option) => [option.key, option])),
    []
  );

  return (
    <View style={styles.contentGap}>
      <View style={styles.sectionBlock}>
        <Card style={[styles.compactCard, styles.borderlessCard, styles.recognitionCard, isDrawer && styles.recognitionCardDrawer]}>
          <View style={styles.brandPanel}>
            <Text style={[styles.sectionTitle, styles.recognitionSectionTitle]}>농구공 브랜드</Text>
            <View style={styles.optionList}>
              {BALL_BRAND_OPTIONS.map((option) => {
                const active = selectedBallBrand === option.key;

                return (
                  <Pressable
                  key={option.key}
                  onPress={() => onSelectBallBrand(option.key)}
                  style={({ pressed }) => [
                    styles.optionButton,
                    option.key === 'wilson' && styles.wilsonOptionButton,
                    option.key === 'spalding' && styles.spaldingOptionButton,
                    option.key === 'molten' && styles.moltenOptionButton,
                    active && styles.optionButtonActive,
                    pressed && styles.pressed,
                  ]}
                  >
                    <View style={styles.optionTextWrap}>
                      <Text style={styles.optionTitle}>{option.label}</Text>
                      <Text style={styles.optionSubtitle}>{option.description}</Text>
                    </View>
                    <View style={[styles.checkBadge, active && styles.checkBadgeActive]}>
                      <Text style={styles.checkBadgeText}>{active ? '✓' : ''}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.panelSpacer} />

          <View style={styles.colorPanel}>
            <Text style={[styles.sectionTitle, styles.recognitionSectionTitle, styles.colorPanelTitle]}>공 색상 조정</Text>
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
          </View>

        </Card>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  contentGap: {
    flex: 1,
    gap: 16,
  },
  compactCard: {
    minHeight: 0,
  },
  sectionBlock: {
    flex: 1,
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
  recognitionCard: {
    flex: 1,
    padding: 0,
    borderRadius: 0,
    overflow: 'visible',
  },
  recognitionCardDrawer: {
    marginHorizontal: -18,
  },
  sectionTitle: {
    color: colors.textSoft,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 12,
  },
  recognitionSectionTitle: {
    paddingHorizontal: 16,
  },
  brandPanel: {
    paddingTop: 16,
    backgroundColor: 'rgba(74,74,74,0.84)',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    overflow: 'hidden',
  },
  panelSpacer: {
    flex: 1,
    minHeight: 24,
  },
  optionList: {
    gap: 10,
    paddingHorizontal: 16,
    borderRadius: 14,
    overflow: 'hidden',
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
  },
  wilsonOptionButton: {
    backgroundColor: '#78512f',
  },
  spaldingOptionButton: {
    backgroundColor: '#bd6d2a',
  },
  moltenOptionButton: {
    backgroundColor: '#9f3f42',
  },
  optionButtonActive: {
    borderColor: 'rgba(255,255,255,0.7)',
    borderWidth: 2,
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
    width: 24,
    height: 24,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.45)',
  },
  checkBadgeActive: {
    backgroundColor: colors.secondary,
    borderColor: colors.secondary,
  },
  checkBadgeText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: '900',
    lineHeight: 18,
  },
  swatch: {
    width: 28,
    height: 28,
    borderRadius: 999,
    borderWidth: 2,
  },
  colorSection: {
    gap: 0,
  },
  colorPanel: {
    paddingTop: 16,
    backgroundColor: 'rgba(74,74,74,0.84)',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    overflow: 'hidden',
  },
  colorPanelTitle: {
    color: colors.textSoft,
  },
  colorRow: {
    flexDirection: 'row',
  },
  colorOptionButton: {
    flex: 1,
    minHeight: 84,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.surfaceStrong,
    borderWidth: 1,
    borderColor: '#8a8a8a',
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  colorOptionButtonActive: {
    backgroundColor: 'rgba(208,145,85,0.18)',
    borderColor: '#8a8a8a',
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
  pressed: {
    opacity: 0.9,
  },
});
