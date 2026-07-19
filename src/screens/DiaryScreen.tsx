import { type AVPlaybackStatus, ResizeMode, Video } from 'expo-av';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SmallButton } from '../components/common/Buttons';
import { Card } from '../components/common/Card';
import { DAY_NAMES } from '../constants/content';
import { colors } from '../theme/colors';
import type { CalendarCell, DiarySkillInsight, FeedbackMoment, LessonRecord, ShotGraphDatum } from '../types/app';
import { formatDateKey, formatMonthTitle } from '../utils/date';
import { getDesktopMobileFrameWidth, shouldUseDesktopMobileLayout } from '../utils/layout';

interface DiaryScreenProps {
  currentDate: Date;
  calendarCells: CalendarCell[];
  selectedDateKey: string;
  selectedDateRecords: LessonRecord[];
  selectedDateDribbleCount: number;
  diarySkillInsight: DiarySkillInsight;
  shotGraphData: ShotGraphDatum[];
  onChangeMonth: (delta: number) => void;
  onOpenDate: (dateKey: string) => void;
  onGoBack: () => void;
  onToggleShotOutcome: (recordId: string) => void;
  onDeleteRecord: (recordId: string) => void;
}

type RecordFilter = 'all' | 'dribble' | 'shoot' | 'shootSuccess';
type SuccessRateRange = 'daily' | 'weekly' | 'monthly' | 'yearly';

const SUCCESS_RATE_COMPARE_TRACK_HEIGHT = 150;
const SUCCESS_RATE_COMPARE_BAR_MIN_HEIGHT = 12;
const SUCCESS_RATE_COMPARE_EMPTY_HEIGHT = 8;
const SUCCESS_RATE_COMPARE_VALUE_OFFSET = 30;
const SUCCESS_RATE_COMPARE_MIN_ATTEMPTS = 20;

interface SuccessRateComparisonFrame {
  label: string;
  detail: string;
  start: Date;
  end: Date;
}

function getRecordTitle(mode: LessonRecord['mode']) {
  return mode === 'shoot' ? '\uC29B \uBD84\uC11D' : '\uB4DC\uB9AC\uBE14 \uBD84\uC11D';
}

function getRecordModeLabel(mode: LessonRecord['mode']) {
  return mode === 'shoot' ? '\uC29B \uB808\uC2A8' : '\uB4DC\uB9AC\uBE14 \uB808\uC2A8';
}

function getShotOutcomeLabel(shotOutcome: LessonRecord['shotOutcome']) {
  return shotOutcome === 'success' ? '\uC131\uACF5' : '\uC2E4\uD328';
}

function getRecordFilterLabel(filter: RecordFilter) {
  if (filter === 'dribble') {
    return '\uB4DC\uB9AC\uBE14 \uBD84\uC11D';
  }

  if (filter === 'shoot') {
    return '\uC29B \uBD84\uC11D';
  }

  if (filter === 'shootSuccess') {
    return '\uC29B \uC131\uACF5';
  }

  return '\uC804\uCCB4';
}

function getSuccessRateRangeLabel(range: SuccessRateRange) {
  if (range === 'yearly') {
    return '\uC5F0\uAC04';
  }

  if (range === 'monthly') {
    return '\uC6D4\uAC04';
  }

  if (range === 'weekly') {
    return '\uC8FC\uAC04';
  }

  return '\uC77C\uAC04';
}

function getSuccessRateRangeSummaryText(range: SuccessRateRange) {
  if (range === 'yearly') {
    return '\uC774\uBC88 \uD574\uC640 \uC9C1\uC804 2\uB144 \uC804\uCCB4';
  }

  if (range === 'monthly') {
    return '\uC774\uBC88\uB2EC\uACFC \uC9C1\uC804 2\uAC1C\uC6D4 \uC804\uCCB4';
  }

  if (range === 'weekly') {
    return '\uC774\uBC88\uC8FC\uC640 \uC9C1\uC804 2\uC8FC \uC804\uCCB4';
  }

  return '\uC624\uB298\uACFC \uC9C1\uC804 2\uC77C';
}

function parseDateKeyToDate(dateKey: string) {
  const [yearText, monthText, dayText] = dateKey.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return new Date();
  }

  return new Date(year, month - 1, day);
}

function getStartOfWeek(date: Date) {
  const nextDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = nextDate.getDay();
  const diff = day === 0 ? -6 : 1 - day;

  nextDate.setDate(nextDate.getDate() + diff);
  return nextDate;
}

function buildSuccessRateComparisonFrames(anchorDate: Date, range: SuccessRateRange): SuccessRateComparisonFrame[] {
  if (range === 'yearly') {
    return [-2, -1, 0].map((offset) => {
      const start = new Date(anchorDate.getFullYear() + offset, 0, 1);
      const end = new Date(start.getFullYear() + 1, 0, 0, 23, 59, 59, 999);

      return {
        label: offset === 0 ? '\uC774\uBC88 \uD574' : `${Math.abs(offset)}\uB144 \uC804`,
        detail: '',
        start,
        end,
      };
    });
  }

  if (range === 'monthly') {
    return [-2, -1, 0].map((offset) => {
      const start = new Date(anchorDate.getFullYear(), anchorDate.getMonth() + offset, 1);
      const end = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59, 999);

      return {
        label: offset === 0 ? '\uC774\uBC88\uB2EC' : `${Math.abs(offset)}\uAC1C\uC6D4 \uC804`,
        detail: '',
        start,
        end,
      };
    });
  }

  if (range === 'weekly') {
    const currentWeekStart = getStartOfWeek(anchorDate);

    return [-2, -1, 0].map((offset) => {
      const start = new Date(
        currentWeekStart.getFullYear(),
        currentWeekStart.getMonth(),
        currentWeekStart.getDate() + offset * 7
      );
      const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6, 23, 59, 59, 999);

      return {
        label: offset === 0 ? '\uC774\uBC88\uC8FC' : `${Math.abs(offset)}\uC8FC \uC804`,
        detail: '',
        start,
        end,
      };
    });
  }

  return [-2, -1, 0].map((offset) => {
    const start = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), anchorDate.getDate() + offset);
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 23, 59, 59, 999);

    return {
      label: offset === 0 ? '\uC624\uB298' : `${Math.abs(offset)}\uC77C \uC804`,
      detail: `${start.getMonth() + 1}/${start.getDate()}`,
      start,
      end,
    };
  });
}

function getSyncedFeedback(timeline: FeedbackMoment[], fallback: string, positionMillis: number) {
  if (timeline.length === 0) {
    return fallback;
  }

  let activeText = timeline[0]?.text || fallback;

  for (const item of timeline) {
    if (item.atMs <= positionMillis) {
      activeText = item.text;
      continue;
    }

    break;
  }

  return activeText || fallback;
}

function DateArrowIcon({ direction }: { direction: 'left' | 'right' }) {
  return (
    <View
      style={[
        styles.dateArrowIcon,
        direction === 'left' ? styles.dateArrowIconLeft : styles.dateArrowIconRight,
      ]}
    />
  );
}

/* interface RecordEvaluationDropdownProps {
  isMenuOpen: boolean;
  isEvaluationVisible: boolean;
  onToggleMenu: () => void;
  onSelectVisibility: (isVisible: boolean) => void;
  title?: string;
  onPress?: () => void;
  variant?: string;
} */

/* function RecordEvaluationDropdown({
  isMenuOpen,
  isEvaluationVisible,
  onToggleMenu,
  onSelectVisibility,
}: RecordEvaluationDropdownProps) {
  const slideAnimation = useRef(new Animated.Value(isMenuOpen ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(slideAnimation, {
      toValue: isMenuOpen ? 1 : 0,
      duration: isMenuOpen ? 220 : 180,
      easing: isMenuOpen ? Easing.out(Easing.cubic) : Easing.inOut(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [isMenuOpen, slideAnimation]);

  const animatedHeight = slideAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 96],
  });
  const animatedOpacity = slideAnimation.interpolate({
    inputRange: [0, 0.35, 1],
    outputRange: [0, 0.2, 1],
  });
  const animatedTranslateY = slideAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [-8, 0],
  });

  return (
    <View style={styles.evaluationDropdownWrap}>
      <Pressable
        onPress={onToggleMenu}
        style={({ pressed }) => [styles.recordFilterDropdown, styles.evaluationDropdownButton, pressed && styles.pressed]}
      >
        <Text style={styles.recordFilterDropdownText}>{`湲곕줉 ?됯?: ${isEvaluationVisible ? '蹂닿린' : '?④?'}`}</Text>
        <Text style={styles.recordFilterDropdownIcon}>{isMenuOpen ? '?? : '??}</Text>
      </Pressable>

      <Animated.View
        pointerEvents={isMenuOpen ? 'auto' : 'none'}
        style={[
          styles.evaluationDropdownMenuWrap,
          {
            height: animatedHeight,
            opacity: animatedOpacity,
            transform: [{ translateY: animatedTranslateY }],
          },
        ]}
      >
        <View style={styles.evaluationDropdownMenu}>
          {([
            { label: '蹂닿린', value: true },
            { label: '?④린湲?, value: false },
          ] as const).map((option) => (
            <Pressable
              key={option.label}
              onPress={() => onSelectVisibility(option.value)}
              style={({ pressed }) => [
                styles.evaluationDropdownMenuItem,
                isEvaluationVisible === option.value && styles.evaluationDropdownMenuItemActive,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.evaluationDropdownMenuText,
                  isEvaluationVisible === option.value && styles.evaluationDropdownMenuTextActive,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          ))}
      </Animated.View>
    </View>
  );
} */

interface CollapsibleRecordSectionProps {
  expanded: boolean;
  children: React.ReactNode;
}

/* function CollapsibleRecordSection({
  title,
  expanded,
  onToggle,
  children,
}: CollapsibleRecordSectionProps) {
  const contentAnimation = useRef(new Animated.Value(expanded ? 1 : 0)).current;
  const [contentHeight, setContentHeight] = useState(0);
  const sectionTitle = '湲곕줉 ?됯?';

  useEffect(() => {
    Animated.timing(contentAnimation, {
      toValue: expanded ? 1 : 0,
      duration: expanded ? 280 : 220,
      easing: expanded ? Easing.out(Easing.cubic) : Easing.bezier(0.35, 0, 0.2, 1),
      useNativeDriver: false,
    }).start();
  }, [contentAnimation, expanded]);

  const animatedHeight = contentAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, Math.max(contentHeight, 1)],
  });
  const animatedOpacity = contentAnimation.interpolate({
    inputRange: [0, 0.32, 1],
    outputRange: [0, 0.14, 1],
  });
  const animatedTranslateY = contentAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [-10, 0],
  });

  return (
    <View style={[styles.evaluationSection, !expanded && styles.evaluationSectionCollapsed]}>
      <Pressable
        accessibilityLabel={expanded ? `${sectionTitle} ?④린湲? : `${sectionTitle} ?쇱튂湲?}
        onPress={onToggle}
        style={({ pressed }) => [
          styles.evaluationSectionToggle,
          expanded ? styles.evaluationSectionToggleFloating : styles.evaluationSectionToggleCollapsed,
          expanded ? styles.evaluationSectionToggleRound : styles.evaluationSectionToggleChip,
          pressed && styles.pressed,
        ]}
      >
        <Text style={styles.evaluationSectionToggleIcon}>{expanded ? 'v' : '^'}</Text>
        {!expanded ? <Text style={styles.evaluationSectionToggleLabel}>{sectionTitle}</Text> : null}
      </Pressable>
      <Animated.View
        pointerEvents={expanded ? 'auto' : 'none'}
        style={[
          styles.evaluationSectionContentWrap,
          {
            height: animatedHeight,
            opacity: animatedOpacity,
            transform: [{ translateY: animatedTranslateY }],
          },
        ]}
      >
        <View
          onLayout={(event) => {
            const nextHeight = Math.max(1, Math.ceil(event.nativeEvent.layout.height));
            setContentHeight((current) => (current === nextHeight ? current : nextHeight));
          }}
        >
          {children}
      </Animated.View>
    </View>
  );
} */

function CollapsibleRecordSection({
  expanded,
  children,
}: CollapsibleRecordSectionProps) {
  const contentAnimation = useRef(new Animated.Value(expanded ? 1 : 0)).current;
  const [contentHeight, setContentHeight] = useState(0);

  useEffect(() => {
    Animated.timing(contentAnimation, {
      toValue: expanded ? 1 : 0,
      duration: expanded ? 280 : 220,
      easing: expanded ? Easing.out(Easing.cubic) : Easing.bezier(0.35, 0, 0.2, 1),
      useNativeDriver: false,
    }).start();
  }, [contentAnimation, expanded]);

  const animatedHeight = contentAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, Math.max(contentHeight, 1)],
  });
  const animatedOpacity = contentAnimation.interpolate({
    inputRange: [0, 0.32, 1],
    outputRange: [0, 0.14, 1],
  });
  const animatedTranslateY = contentAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [-10, 0],
  });

  return (
    <View style={[styles.evaluationSection, !expanded && styles.evaluationSectionCollapsed]}>
      <Animated.View
        pointerEvents={expanded ? 'auto' : 'none'}
        style={[
          styles.evaluationSectionContentWrap,
          {
            height: animatedHeight,
            opacity: animatedOpacity,
            transform: [{ translateY: animatedTranslateY }],
          },
        ]}
      >
        <View
          onLayout={(event) => {
            const nextHeight = Math.max(1, Math.ceil(event.nativeEvent.layout.height));
            setContentHeight((current) => (current === nextHeight ? current : nextHeight));
          }}
        >
          {children}
        </View>
      </Animated.View>
    </View>
  );
}

function getRecordLevelLabel(level: NonNullable<LessonRecord['evaluation']>['level']) {
  if (level === 'good') {
    return '\uC88B\uC74C';
  }

  if (level === 'average') {
    return '\uBCF4\uD1B5';
  }

  return '\uB098\uC068';
}


function getDribbleBalanceNarration(insight: DiarySkillInsight, totalCount: number) {
  const trackedCount = insight.leftDribbleCount + insight.rightDribbleCount;

  if (totalCount === 0) {
    return '\uC624\uB298\uC740 \uC544\uC9C1 \uB4DC\uB9AC\uBE14 \uADE0\uD615\uC744 \uD574\uC11D\uD560 \uAE30\uB85D\uC774 \uC5C6\uC5B4\uC694.';
  }

  if (trackedCount === 0) {
    return `\uC624\uB298 \uB4DC\uB9AC\uBE14\uC740 ${totalCount}\uD68C \uAE30\uB85D\uB410\uC9C0\uB9CC, \uC88C\uC6B0 \uADE0\uD615\uC744 \uD574\uC11D\uD560 \uC815\uBCF4\uB294 \uC544\uC9C1 \uBD80\uC871\uD574\uC694.`;
  }

  if (insight.dribbleBalance === 'balanced') {
    return `\uC624\uB298\uC740 \uC67C\uC190\uACFC \uC624\uB978\uC190 \uB4DC\uB9AC\uBE14\uC744 \uACE0\uB974\uAC8C \uC5F0\uC2B5\uD558\uC168\uAD70\uC694. \uC88C\uC6B0 \uCC28\uC774\uAC00 ${insight.dribbleBalanceGap}\uD68C\uB85C \uADE0\uD615\uC774 \uC88B\uC2B5\uB2C8\uB2E4.`;
  }

  return insight.dribbleBalance === 'left'
    ? `\uC624\uB298\uC740 \uC67C\uC190 \uB4DC\uB9AC\uBE14\uC744 \uB354 \uB9CE\uC774 \uC5F0\uC2B5\uD558\uC168\uAD70\uC694. \uC624\uB978\uC190\uBCF4\uB2E4 ${insight.dribbleBalanceGap}\uD68C \uB354 \uB9CE\uC558\uC2B5\uB2C8\uB2E4.`
    : `\uC624\uB298\uC740 \uC624\uB978\uC190 \uB4DC\uB9AC\uBE14\uC744 \uB354 \uB9CE\uC774 \uC5F0\uC2B5\uD558\uC168\uAD70\uC694. \uC67C\uC190\uBCF4\uB2E4 ${insight.dribbleBalanceGap}\uD68C \uB354 \uB9CE\uC558\uC2B5\uB2C8\uB2E4.`;
}

function getDribbleBalanceSummary(insight: DiarySkillInsight, totalCount: number) {
  const trackedCount = insight.leftDribbleCount + insight.rightDribbleCount;

  if (trackedCount === 0) {
    return `\uD574\uB2F9 \uB0A0\uC9DC \uB4DC\uB9AC\uBE14 \uD69F\uC218: ${totalCount}\uD68C`;
  }

  if (trackedCount < totalCount) {
    return `\uC804\uCCB4 ${totalCount}\uD68C \uC911 \uC67C\uC190 ${insight.leftDribbleCount}\uD68C, \uC624\uB978\uC190 ${insight.rightDribbleCount}\uD68C\uAC00 \uAD6C\uBD84\uB418\uC5B4 \uAE30\uB85D\uB410\uC2B5\uB2C8\uB2E4.`;
  }

  return `\uC804\uCCB4 ${totalCount}\uD68C \uC911 \uC67C\uC190 ${insight.leftDribbleCount}\uD68C, \uC624\uB978\uC190 ${insight.rightDribbleCount}\uD68C\uC785\uB2C8\uB2E4.`;
}

function formatDiarySummaryDateLabel(dateKey: string) {
  const date = parseDateKeyToDate(dateKey);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function getPracticeComparisonSentence(label: string, delta: number) {
  if (delta > 0) {
    return `${label}\uBCF4\uB2E4 ${Math.abs(delta)}\uD68C \uB354 \uB9CE\uC2B5\uB2C8\uB2E4.`;
  }

  if (delta < 0) {
    return `${label}\uBCF4\uB2E4 ${Math.abs(delta)}\uD68C \uB354 \uC801\uC2B5\uB2C8\uB2E4.`;
  }

  return `${label}\uBCF4\uB2E4 \uAC19\uC2B5\uB2C8\uB2E4.`;
}

function getDailySummaryPracticeText(insight: DiarySkillInsight, selectedDateDribbleCount: number) {
  const selectedPracticeTotal = selectedDateDribbleCount + insight.selectedShotAttempts;
  const summaryParts = [
    `\uC624\uB298 \uC5F0\uC2B5\uB7C9\uC740 \uB4DC\uB9AC\uBE14 ${selectedDateDribbleCount}\uD68C\uC640 \uC29B ${insight.selectedShotAttempts}\uD68C\uB85C \uCD1D ${selectedPracticeTotal}\uD68C\uC785\uB2C8\uB2E4.`,
    getPracticeComparisonSentence('\uC5B4\uC81C', selectedPracticeTotal - insight.yesterdayPracticeTotal),
  ];

  if (insight.previousPracticeDateKey) {
    summaryParts.push(
      getPracticeComparisonSentence(
        `\uC774\uC804 \uC5F0\uC2B5\uC77C(${formatDiarySummaryDateLabel(insight.previousPracticeDateKey)})`,
        selectedPracticeTotal - insight.previousPracticeTotal
      )
    );
  }

  return summaryParts.join(' ');
}

function getDailySummaryEvaluationText(insight: DiarySkillInsight) {
  const { good, average, bad } = insight.evaluationCounts;
  const totalEvaluatedCount = good + average + bad;

  if (totalEvaluatedCount === 0) {
    return '\uC624\uB298 \uB808\uC2A8 \uAE30\uB85D\uC740 \uC544\uC9C1 \uD3C9\uAC00 \uC815\uBCF4\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.';
  }

  if (insight.evaluationDominantLevel === 'good') {
    return `\uC624\uB298 \uB808\uC2A8 \uAE30\uB85D\uC740 \uB300\uCCB4\uB85C \uC88B\uC740 \uD750\uB984\uC785\uB2C8\uB2E4. \uC88B\uC74C ${good}\uAC1C, \uBCF4\uD1B5 ${average}\uAC1C, \uB098\uC068 ${bad}\uAC1C\uC785\uB2C8\uB2E4.`;
  }

  if (insight.evaluationDominantLevel === 'average') {
    return `\uC624\uB298 \uB808\uC2A8 \uAE30\uB85D\uC740 \uB300\uCCB4\uB85C \uBCF4\uD1B5 \uD750\uB984\uC785\uB2C8\uB2E4. \uC88B\uC74C ${good}\uAC1C, \uBCF4\uD1B5 ${average}\uAC1C, \uB098\uC068 ${bad}\uAC1C\uC785\uB2C8\uB2E4.`;
  }

  if (insight.evaluationDominantLevel === 'bad') {
    return `\uC624\uB298 \uB808\uC2A8 \uAE30\uB85D\uC740 \uB300\uCCB4\uB85C \uBCF4\uC644\uC774 \uB354 \uD544\uC694\uD569\uB2C8\uB2E4. \uC88B\uC74C ${good}\uAC1C, \uBCF4\uD1B5 ${average}\uAC1C, \uB098\uC068 ${bad}\uAC1C\uC785\uB2C8\uB2E4.`;
  }

  return `\uC624\uB298 \uB808\uC2A8 \uAE30\uB85D\uC740 \uC88B\uC740 \uC810\uACFC \uBCF4\uC644\uD560 \uC810\uC774 \uD568\uAED8 \uBCF4\uC785\uB2C8\uB2E4. \uC88B\uC74C ${good}\uAC1C, \uBCF4\uD1B5 ${average}\uAC1C, \uB098\uC068 ${bad}\uAC1C\uC785\uB2C8\uB2E4.`;
}

function getDailySummaryShotText(insight: DiarySkillInsight) {
  return `\uC624\uB298 \uC29B \uC131\uACF5\uB960\uC740 ${insight.selectedShotSuccessRate}%\uC785\uB2C8\uB2E4. ${insight.selectedShotAttempts}\uD68C \uC911 ${insight.selectedShotSuccesses}\uD68C \uC131\uACF5\uD588\uC2B5\uB2C8\uB2E4.`;
}

function getDailySummaryDribbleText(insight: DiarySkillInsight, selectedDateDribbleCount: number) {
  const trackedDribbleCount = insight.leftDribbleCount + insight.rightDribbleCount;

  if (trackedDribbleCount === 0) {
    return `\uC624\uB298 \uB4DC\uB9AC\uBE14\uC740 ${selectedDateDribbleCount}\uD68C\uC600\uC9C0\uB9CC \uC88C\uC6B0 \uAD6C\uBD84 \uAE30\uB85D\uC740 \uC544\uC9C1 \uBD80\uC871\uD569\uB2C8\uB2E4.`;
  }

  if (insight.dribbleBalance === 'balanced') {
    return `\uC624\uB298\uC740 \uC67C\uC190\uACFC \uC624\uB978\uC190 \uB4DC\uB9AC\uBE14\uC744 \uACE0\uB974\uAC8C \uC5F0\uC2B5\uD588\uC2B5\uB2C8\uB2E4. \uC67C\uC190 ${insight.leftDribbleCount}\uD68C, \uC624\uB978\uC190 ${insight.rightDribbleCount}\uD68C\uC785\uB2C8\uB2E4.`;
  }

  if (insight.dribbleBalance === 'left') {
    return `\uC624\uB298\uC740 \uC67C\uC190 \uB4DC\uB9AC\uBE14\uC744 \uB354 \uB9CE\uC774 \uCC64\uC2B5\uB2C8\uB2E4. \uC67C\uC190 ${insight.leftDribbleCount}\uD68C, \uC624\uB978\uC190 ${insight.rightDribbleCount}\uD68C\uC785\uB2C8\uB2E4.`;
  }

  if (insight.dribbleBalance === 'right') {
    return `\uC624\uB298\uC740 \uC624\uB978\uC190 \uB4DC\uB9AC\uBE14\uC744 \uB354 \uB9CE\uC774 \uCC64\uC2B5\uB2C8\uB2E4. \uC67C\uC190 ${insight.leftDribbleCount}\uD68C, \uC624\uB978\uC190 ${insight.rightDribbleCount}\uD68C\uC785\uB2C8\uB2E4.`;
  }

  return `\uC624\uB298 \uB4DC\uB9AC\uBE14\uC740 ${selectedDateDribbleCount}\uD68C\uC600\uC2B5\uB2C8\uB2E4.`;
}

export function DiaryScreen({
  currentDate,
  calendarCells,
  selectedDateKey,
  selectedDateRecords,
  selectedDateDribbleCount,
  diarySkillInsight,
  shotGraphData,
  onChangeMonth,
  onOpenDate,
  onGoBack,
  onToggleShotOutcome,
  onDeleteRecord,
}: DiaryScreenProps) {
  const { width } = useWindowDimensions();
  const layoutWidth = shouldUseDesktopMobileLayout(width) ? getDesktopMobileFrameWidth(width) : width;
  const isWide = layoutWidth >= 980;
  const isCompactMobile = layoutWidth < 640;
  const recordCardWidth = isWide
    ? Math.min(420, Math.max(360, Math.floor(layoutWidth * 0.34)))
    : Math.max(280, Math.min(layoutWidth - 40, 336));
  const [playbackFeedback, setPlaybackFeedback] = useState<Record<string, string>>({});
  const [visibleRecordEvaluations, setVisibleRecordEvaluations] = useState<Record<string, boolean>>({});
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [recordFilter, setRecordFilter] = useState<RecordFilter>('all');
  const [showRecordFilterMenu, setShowRecordFilterMenu] = useState(false);
  const [successRateRange, setSuccessRateRange] = useState<SuccessRateRange>('daily');
  const [showSuccessRateRangeMenu, setShowSuccessRateRangeMenu] = useState(false);
  const videoRefs = useRef<Record<string, Video | null>>({});
  const playbackPollersRef = useRef<Record<string, ReturnType<typeof setInterval>>>({});
  const dribbleGraphTotal = Math.max(
    selectedDateDribbleCount,
    diarySkillInsight.leftDribbleCount + diarySkillInsight.rightDribbleCount
  );
  const isLeftDribbleDominant = diarySkillInsight.leftDribbleCount > diarySkillInsight.rightDribbleCount;
  const isRightDribbleDominant = diarySkillInsight.rightDribbleCount > diarySkillInsight.leftDribbleCount;
  const leftDribbleGraphWidth: `${number}%` = dribbleGraphTotal > 0
    ? `${(diarySkillInsight.leftDribbleCount / dribbleGraphTotal) * 100}%`
    : '0%';
  const rightDribbleGraphWidth: `${number}%` = dribbleGraphTotal > 0
    ? `${(diarySkillInsight.rightDribbleCount / dribbleGraphTotal) * 100}%`
    : '0%';
  const selectedDate = useMemo(() => (selectedDateKey ? parseDateKeyToDate(selectedDateKey) : new Date()), [selectedDateKey]);
  const successRateComparisonFrames = useMemo(
    () => buildSuccessRateComparisonFrames(selectedDate, successRateRange),
    [selectedDate, successRateRange]
  );
  const successRateComparisonData = useMemo(
    () =>
      successRateComparisonFrames.map((frame) => {
        let attempts = 0;
        let successes = 0;

        for (const item of shotGraphData) {
          const itemTime = parseDateKeyToDate(item.dateKey).getTime();

          if (
            item.attempts >= SUCCESS_RATE_COMPARE_MIN_ATTEMPTS
            && itemTime >= frame.start.getTime()
            && itemTime <= frame.end.getTime()
          ) {
            attempts += item.attempts;
            successes += item.successes;
          }
        }

        return {
          ...frame,
          attempts,
          successes,
          successRate: attempts > 0 ? Math.min(100, Math.round((successes / attempts) * 100)) : 0,
        };
      }),
    [shotGraphData, successRateComparisonFrames]
  );
  const hasSuccessRateComparisonData = successRateComparisonData.some((item) => item.attempts > 0);
  const selectedDateRecordState = useMemo(() => {
    const selectedCell = calendarCells.find((cell) => cell.type === 'day' && cell.dateKey === selectedDateKey);

    if (!selectedCell || selectedCell.type !== 'day') {
      return { status: 'default' as const };
    }

    if (selectedCell.variant === 'good') {
      return { status: 'good' as const };
    }

    if (selectedCell.variant === 'average') {
      return { status: 'average' as const };
    }

    if (selectedCell.variant === 'bad') {
      return { status: 'bad' as const };
    }

    return { status: 'default' as const };
  }, [calendarCells, selectedDateKey]);
  const filteredDateRecords = useMemo(() => {
    if (recordFilter === 'all') {
      return selectedDateRecords;
    }

    if (recordFilter === 'shootSuccess') {
      return selectedDateRecords.filter((record) => record.mode === 'shoot' && record.shotOutcome === 'success');
    }

    return selectedDateRecords.filter((record) => record.mode === recordFilter);
  }, [recordFilter, selectedDateRecords]);

  const moveSelectedDate = useCallback(
    (delta: number) => {
      const nextDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate() + delta);
      onOpenDate(formatDateKey(nextDate));
    },
    [onOpenDate, selectedDate]
  );

  useEffect(() => {
    setPlaybackFeedback((current) => {
      const next = { ...current };

      for (const record of selectedDateRecords) {
        if (!next[record.id]) {
          next[record.id] = getSyncedFeedback(record.feedbackTimeline, record.feedback, 0);
        }
      }

      for (const recordId of Object.keys(next)) {
        if (!selectedDateRecords.some((record) => record.id === recordId)) {
          delete next[recordId];
        }
      }

      return next;
    });
  }, [selectedDateRecords]);

  useEffect(() => {
    setVisibleRecordEvaluations((current) => {
      const visibleRecordIds = new Set(selectedDateRecords.map((record) => record.id));
      let hasChanged = false;
      const next: Record<string, boolean> = {};

      for (const [recordId, isVisible] of Object.entries(current)) {
        if (isVisible && visibleRecordIds.has(recordId)) {
          next[recordId] = true;
          continue;
        }

        hasChanged = true;
      }

      return hasChanged ? next : current;
    });
  }, [selectedDateRecords]);

  useEffect(() => {
    const pollers = playbackPollersRef.current;

    return () => {
      for (const poller of Object.values(pollers)) {
        clearInterval(poller);
      }
    };
  }, []);

  const syncFeedbackFromPosition = useCallback((record: LessonRecord, positionMillis: number) => {
    const nextFeedback = getSyncedFeedback(record.feedbackTimeline, record.feedback, positionMillis);

    setPlaybackFeedback((current) => {
      if (current[record.id] === nextFeedback) {
        return current;
      }

      return {
        ...current,
        [record.id]: nextFeedback,
      };
    });
  }, []);

  const stopPlaybackPolling = useCallback((recordId: string) => {
    const poller = playbackPollersRef.current[recordId];

    if (!poller) {
      return;
    }

    clearInterval(poller);
    delete playbackPollersRef.current[recordId];
  }, []);

  const startPlaybackPolling = useCallback(
    (record: LessonRecord) => {
      if (playbackPollersRef.current[record.id]) {
        return;
      }

      playbackPollersRef.current[record.id] = setInterval(() => {
        const video = videoRefs.current[record.id];

        if (!video) {
          return;
        }

        void video.getStatusAsync().then((status) => {
          if (!status.isLoaded) {
            return;
          }

          const positionMillis = typeof status.positionMillis === 'number' ? status.positionMillis : 0;
          syncFeedbackFromPosition(record, positionMillis);

          if (!status.isPlaying) {
            stopPlaybackPolling(record.id);
          }
        });
      }, 200);
    },
    [stopPlaybackPolling, syncFeedbackFromPosition]
  );

  function handlePlaybackStatus(record: LessonRecord, status: AVPlaybackStatus) {
    if (!status.isLoaded) {
      return;
    }

    const positionMillis = typeof status.positionMillis === 'number' ? status.positionMillis : 0;
    syncFeedbackFromPosition(record, positionMillis);

    if (status.isPlaying) {
      startPlaybackPolling(record);
    } else {
      stopPlaybackPolling(record.id);
    }

    if (status.didJustFinish) {
      syncFeedbackFromPosition(record, 0);
    }
  }

  const jumpToHighlight = useCallback(
    async (record: LessonRecord, startAtMs: number) => {
      const video = videoRefs.current[record.id];

      if (!video) {
        return;
      }

      syncFeedbackFromPosition(record, startAtMs);
      await video.playFromPositionAsync(Math.max(0, startAtMs));
      startPlaybackPolling(record);
    },
    [startPlaybackPolling, syncFeedbackFromPosition]
  );

  const toggleRecordEvaluation = useCallback((recordId: string) => {
    setVisibleRecordEvaluations((current) => {
      const next = { ...current };

      if (next[recordId]) {
        delete next[recordId];
      } else {
        next[recordId] = true;
      }

      return next;
    });
  }, []);

  /* function renderRecordCard(record: LessonRecord) {
    const syncedFeedback = playbackFeedback[record.id] || record.feedback;
    const evaluation = record.evaluation;
    const isEvaluationVisible = Boolean(visibleRecordEvaluations[record.id]);

    return (
      <View
        key={record.id}
        style={[
          styles.recordCard,
          record.mode === 'shoot' ? styles.recordCardShoot : styles.recordCardDribble,
        ]}
      >
        <View style={styles.recordHeader}>
          <View style={styles.recordHeaderBadges}>
            <View
              style={[
                styles.recordBadge,
                record.mode === 'shoot' ? styles.recordBadgeShoot : styles.recordBadgeDribble,
              ]}
            >
              <Text style={styles.recordBadgeText}>{getRecordModeLabel(record.mode)}</Text>
            </View>

            {evaluation ? (
              <View
                style={[
                  styles.recordLevelBadge,
                  evaluation.level === 'good'
                    ? styles.recordLevelBadgeGood
                    : evaluation.level === 'average'
                      ? styles.recordLevelBadgeAverage
                      : styles.recordLevelBadgeBad,
                ]}
              >
                <Text style={styles.recordLevelBadgeText}>{getRecordLevelLabel(evaluation.level)}</Text>
              </View>
          )}
          </CollapsibleRecordSection>
        </View>
          </CollapsibleRecordSection>
        </View>

          {record.mode === 'shoot' ? (
            <Pressable
              onPress={() => onToggleShotOutcome(record.id)}
              style={({ pressed }) => [
                styles.shotOutcomeToggle,
                record.shotOutcome === 'success'
                  ? styles.shotOutcomeToggleSuccess
                  : styles.shotOutcomeToggleFailure,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.shotOutcomeToggleLabel}>{'\uC29B \uACB0\uACFC'}</Text>
              <Text style={styles.shotOutcomeToggleValue}>{getShotOutcomeLabel(record.shotOutcome)}</Text>
            </Pressable>
          ) : null}
        </View>
        <Text style={styles.recordTitle}>{getRecordTitle(record.mode)}</Text>
        <Text style={styles.recordMeta}>{record.createdAt}</Text>

        {record.videoUri ? (
          <Video
            ref={(instance) => {
              videoRefs.current[record.id] = instance;
            }}
            source={{ uri: record.videoUri }}
            useNativeControls
            shouldPlay={false}
            isLooping={false}
            progressUpdateIntervalMillis={200}
            resizeMode={ResizeMode.COVER}
            style={styles.recordVideo}
            onPlaybackStatusUpdate={(status) => handlePlaybackStatus(record, status)}
          />
        ) : null}

        <View style={styles.evaluationToggleRow}>
          <CollapsibleRecordSection
            expanded={isEvaluationVisible}
            onToggle={() => toggleRecordEvaluation(record.id)}
            title={isEvaluationVisible ? '湲곕줉 ?됯? ?④린湲? : '湲곕줉 ?됯? 蹂닿린'}
          >

            {evaluation ? (
            <View style={styles.evaluationBox}>
              <Text style={styles.evaluationTitle}>湲곕줉 ?됯?</Text>
              <Text style={styles.evaluationSummary}>{evaluation.summary}</Text>

              <View style={styles.criteriaRow}>
                {evaluation.criteria.map((criterion) => (
                  <View
                    key={`${record.id}-${criterion.key}`}
                    style={[
                      styles.criterionChip,
                      criterion.isStable ? styles.criterionChipStable : styles.criterionChipUnstable,
                    ]}
                  >
                    <Text style={styles.criterionChipLabel}>{criterion.label}</Text>
                    <Text style={styles.criterionChipValue}>{criterion.isStable ? '?덉젙' : '蹂댁셿'}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.highlightGroup}>
                <Text style={styles.highlightGroupTitle}>?섑븳 ???ㅼ떆蹂닿린</Text>
                {evaluation.strengths.length > 0 ? (
                  evaluation.strengths.map((highlight, index) => (
                    <Pressable
                      key={`${record.id}-strength-${index}`}
                      onPress={() => void jumpToHighlight(record, highlight.startAtMs)}
                      style={({ pressed }) => [styles.highlightButton, styles.highlightButtonGood, pressed && styles.pressed]}
                    >
                      <Text style={styles.highlightButtonLabel}>{highlight.label}</Text>
                      <Text style={styles.highlightButtonDetail}>{highlight.detail}</Text>
                    </Pressable>
                  ))
                ) : (
                  <Text style={styles.highlightEmptyText}>?꾩쭅 ?쒖떆???덉젙 ?λ㈃???놁뒿?덈떎.</Text>
                )}
              </View>

              <View style={styles.highlightGroup}>
                <Text style={styles.highlightGroupTitle}>蹂댁셿?????ㅼ떆蹂닿린</Text>
                {evaluation.improvements.length > 0 ? (
                  evaluation.improvements.map((highlight, index) => (
                    <Pressable
                      key={`${record.id}-improvement-${index}`}
                      onPress={() => void jumpToHighlight(record, highlight.startAtMs)}
                      style={({ pressed }) => [styles.highlightButton, styles.highlightButtonBad, pressed && styles.pressed]}
                    >
                      <Text style={styles.highlightButtonLabel}>{highlight.label}</Text>
                      <Text style={styles.highlightButtonDetail}>{highlight.detail}</Text>
                    </Pressable>
                  ))
                ) : (
                  <Text style={styles.highlightEmptyText}>吏湲덉? 異붽? 蹂댁셿 ?λ㈃???놁뒿?덈떎.</Text>
                )}
              </View>
            </View>
          ) : (
            <View style={styles.evaluationEmptyBox}>
              <Text style={styles.evaluationEmptyText}>?먯꽭 ?됯? ?뺣낫???덈줈 ??ν븳 湲곕줉遺???④퍡 ?쒖떆?⑸땲??</Text>
            </View>
            )}
          </CollapsibleRecordSection>
        </View>

        <View style={styles.liveFeedbackBox}>
          <Text style={styles.liveFeedbackLabel}>{'\uC2E4\uC2DC\uAC04 \uD53C\uB4DC\uBC31'}</Text>
          <Text style={styles.liveFeedbackText}>{syncedFeedback}</Text>
        </View>

        <SmallButton title="湲곕줉 ??젣" onPress={() => onDeleteRecord(record.id)} variant="red" />
      </View>
    );
  } */

  function renderRecordCard(record: LessonRecord) {
    const syncedFeedback = playbackFeedback[record.id] || record.feedback;
    const evaluation = record.evaluation;
    const isEvaluationVisible = Boolean(visibleRecordEvaluations[record.id]);

    return (
      <Pressable
        onPress={() => toggleRecordEvaluation(record.id)}
        key={record.id}
        style={({ pressed }) => [
          styles.recordCard,
          styles.recordCardHorizontal,
          record.mode === 'shoot' ? styles.recordCardShoot : styles.recordCardDribble,
          { width: recordCardWidth },
          pressed && styles.pressed,
        ]}
      >
        <View style={styles.recordHeader}>
          <View style={styles.recordTitleRow}>
            <Text style={styles.recordTitle}>{getRecordTitle(record.mode)}</Text>

            {evaluation ? (
              <View
                style={[
                  styles.recordLevelBadge,
                  evaluation.level === 'good'
                    ? styles.recordLevelBadgeGood
                    : evaluation.level === 'average'
                      ? styles.recordLevelBadgeAverage
                      : styles.recordLevelBadgeBad,
                ]}
              >
                <Text style={styles.recordLevelBadgeText}>{getRecordLevelLabel(evaluation.level)}</Text>
              </View>
            ) : null}
          </View>

          {record.mode === 'shoot' ? (
            <Pressable
              onPress={() => onToggleShotOutcome(record.id)}
              style={({ pressed }) => [
                styles.shotOutcomeToggle,
                record.shotOutcome === 'success'
                  ? styles.shotOutcomeToggleSuccess
                  : styles.shotOutcomeToggleFailure,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.shotOutcomeToggleLabel}>{'\uC29B \uACB0\uACFC'}</Text>
              <Text style={styles.shotOutcomeToggleValue}>{getShotOutcomeLabel(record.shotOutcome)}</Text>
            </Pressable>
          ) : null}
        </View>

        <Text style={styles.recordMeta}>{record.createdAt}</Text>

        {record.videoUri ? (
          <Video
            ref={(instance) => {
              videoRefs.current[record.id] = instance;
            }}
            source={{ uri: record.videoUri }}
            useNativeControls
            shouldPlay={false}
            isLooping={false}
            progressUpdateIntervalMillis={200}
            resizeMode={ResizeMode.COVER}
            style={styles.recordVideo}
            onPlaybackStatusUpdate={(status) => handlePlaybackStatus(record, status)}
          />
        ) : null}

        <View style={styles.evaluationToggleRow}>
          <CollapsibleRecordSection expanded={isEvaluationVisible}>
            {evaluation ? (
              <View style={styles.evaluationBox}>
                <Text style={styles.evaluationTitle}>{'\uAE30\uB85D \uD3C9\uAC00'}</Text>
                <Text style={styles.evaluationSummary}>{evaluation.summary}</Text>

                <View style={styles.criteriaRow}>
                  {evaluation.criteria.map((criterion) => (
                    <View
                      key={`${record.id}-${criterion.key}`}
                      style={[
                        styles.criterionChip,
                        criterion.isStable ? styles.criterionChipStable : styles.criterionChipUnstable,
                      ]}
                    >
                      <Text style={styles.criterionChipLabel}>{criterion.label}</Text>
                      <Text style={styles.criterionChipValue}>
                        {criterion.isStable ? '\uC548\uC815' : '\uBCF4\uC644'}
                      </Text>
                    </View>
                  ))}
                </View>

                <View style={styles.highlightGroup}>
                  <Text style={styles.highlightGroupTitle}>{'\uC798\uD55C \uC7A5\uBA74 \uB2E4\uC2DC\uBCF4\uAE30'}</Text>
                  {evaluation.strengths.length > 0 ? (
                    evaluation.strengths.map((highlight, index) => (
                      <Pressable
                        key={`${record.id}-strength-${index}`}
                        onPress={() => void jumpToHighlight(record, highlight.startAtMs)}
                        style={({ pressed }) => [styles.highlightButton, styles.highlightButtonGood, pressed && styles.pressed]}
                      >
                        <Text style={styles.highlightButtonLabel}>{highlight.label}</Text>
                        <Text style={styles.highlightButtonDetail}>{highlight.detail}</Text>
                      </Pressable>
                    ))
                  ) : (
                    <Text style={styles.highlightEmptyText}>{'\uC544\uC9C1 \uD45C\uC2DC\uD560 \uC548\uC815 \uC7A5\uBA74\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.'}</Text>
                  )}
                </View>

                <View style={styles.highlightGroup}>
                  <Text style={styles.highlightGroupTitle}>{'\uBCF4\uC644 \uC7A5\uBA74 \uB2E4\uC2DC\uBCF4\uAE30'}</Text>
                  {evaluation.improvements.length > 0 ? (
                    evaluation.improvements.map((highlight, index) => (
                      <Pressable
                        key={`${record.id}-improvement-${index}`}
                        onPress={() => void jumpToHighlight(record, highlight.startAtMs)}
                        style={({ pressed }) => [styles.highlightButton, styles.highlightButtonBad, pressed && styles.pressed]}
                      >
                        <Text style={styles.highlightButtonLabel}>{highlight.label}</Text>
                        <Text style={styles.highlightButtonDetail}>{highlight.detail}</Text>
                      </Pressable>
                    ))
                  ) : (
                    <Text style={styles.highlightEmptyText}>{'\uC9C0\uAE08\uC740 \uCD94\uAC00\uB85C \uBCF4\uC5EC\uC904 \uBCF4\uC644 \uC7A5\uBA74\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.'}</Text>
                  )}
                </View>
              </View>
            ) : (
              <View style={styles.evaluationEmptyBox}>
                <Text style={styles.evaluationEmptyText}>{'\uC790\uC138 \uD3C9\uAC00 \uC815\uBCF4\uB294 AI\uB85C \uBD84\uC11D\uD55C \uAE30\uB85D\uBD80\uD130 \uD655\uC778 \uAC00\uB2A5\uD569\uB2C8\uB2E4.'}</Text>
              </View>
            )}
          </CollapsibleRecordSection>
        </View>

        <View style={styles.liveFeedbackBox}>
          <Text style={styles.liveFeedbackLabel}>{'\uC2E4\uC2DC\uAC04 \uD53C\uB4DC\uBC31'}</Text>
          <Text style={styles.liveFeedbackText}>{syncedFeedback}</Text>
        </View>

        <SmallButton title={'\uAE30\uB85D \uC0AD\uC81C'} onPress={() => onDeleteRecord(record.id)} variant="red" />
      </Pressable>
    );
  }

  return (
    <Card style={styles.diaryCard}>
      <View style={styles.diaryTopBar}>
        <Pressable onPress={onGoBack} style={({ pressed }) => [styles.diaryBackButton, pressed && styles.pressed]}>
          <Text style={styles.diaryBackButtonText}>{'<'}</Text>
        </Pressable>
        <View pointerEvents="none" style={styles.diaryTopBarTitleWrap}>
          <Text style={styles.diaryScreenTitle}>{'\uAE30\uB85D\uC77C\uC9C0'}</Text>
        </View>
      </View>
      <View style={[styles.dateSelectorRow, isCompactMobile && styles.dateSelectorRowCompact]}>
        <Pressable
          onPress={() => setShowCalendarModal(true)}
          style={[
            styles.dateSelectorMain,
            selectedDateRecordState.status === 'good' && styles.dateSelectorMainGood,
            selectedDateRecordState.status === 'average' && styles.dateSelectorMainAverage,
            selectedDateRecordState.status === 'bad' && styles.dateSelectorMainBad,
            isCompactMobile && styles.dateSelectorMainCompact,
          ]}
        >
          <View style={styles.dateSelectorCenter}>
            <Pressable onPress={() => moveSelectedDate(-1)} style={({ pressed }) => [styles.dateArrowButton, pressed && styles.pressed]}>
              <DateArrowIcon direction="left" />
            </Pressable>
            <Text style={styles.dateSelectorText}>{selectedDateKey || formatDateKey(selectedDate)}</Text>
            <Pressable onPress={() => moveSelectedDate(1)} style={({ pressed }) => [styles.dateArrowButton, pressed && styles.pressed]}>
              <DateArrowIcon direction="right" />
            </Pressable>
          </View>
        </Pressable>
      </View>

      <View style={styles.recordsSection}>
        <View style={[styles.contentRow, isWide && styles.contentRowWide]}>
          <View style={[styles.graphColumn, isWide && styles.graphColumnWide]}>
            <View style={styles.skillInsightCard}>
              {!selectedDateKey ? (
                <Text style={styles.skillInsightText}>{'\uB0A0\uC9DC\uB97C \uC120\uD0DD\uD558\uBA74 \uAE30\uB85D \uD574\uC11D\uC744 \uBCFC \uC218 \uC788\uC2B5\uB2C8\uB2E4.'}</Text>
              ) : (
                <>
                  <View style={styles.skillInsightStats}>
                    {diarySkillInsight.canShowDailySummary ? (
                      <View style={[styles.skillInsightStatCard, styles.dailySummaryCard]}>
                        <Text style={styles.skillInsightStatLabel}>{'\uD558\uB8E8 \uCD1D\uD3C9'}</Text>
                        <Text style={styles.dailySummaryLine}>
                          {getDailySummaryPracticeText(diarySkillInsight, selectedDateDribbleCount)}
                        </Text>
                        <Text style={styles.dailySummaryLine}>{getDailySummaryEvaluationText(diarySkillInsight)}</Text>
                        <Text style={styles.dailySummaryLine}>{getDailySummaryShotText(diarySkillInsight)}</Text>
                        <Text style={styles.dailySummaryLine}>
                          {getDailySummaryDribbleText(diarySkillInsight, selectedDateDribbleCount)}
                        </Text>
                      </View>
                    ) : null}

                    <View style={[styles.skillInsightStatCard, styles.skillInsightShotCard]}>
                      <View style={styles.skillInsightShotHeader}>
                        <View style={styles.skillInsightShotTitleWrap}>
                          <Text style={styles.skillInsightStatLabel}>{'\uC131\uACF5\uB960'}</Text>
                          <Text style={styles.skillInsightStatHelper}>
                            {selectedDateKey
                              ? `${getSuccessRateRangeSummaryText(successRateRange)} \uC2DC\uB3C4 ${SUCCESS_RATE_COMPARE_MIN_ATTEMPTS}\uD68C \uC774\uC0C1 \uAE30\uB85D\uB9CC \uBE44\uAD50`
                              : `\uB0A0\uC9DC\uB97C \uC120\uD0DD\uD558\uBA74 \uC2DC\uB3C4 ${SUCCESS_RATE_COMPARE_MIN_ATTEMPTS}\uD68C \uC774\uC0C1 \uAE30\uB85D\uC758 \uC131\uACF5\uB960 \uBE44\uAD50 \uADF8\uB798\uD504\uB97C \uBCFC \uC218 \uC788\uC2B5\uB2C8\uB2E4.`}
                          </Text>
                        </View>

                        <View style={styles.successRateRangeWrap}>
                          <Pressable
                            onPress={() => {
                              setShowSuccessRateRangeMenu((current) => !current);
                              setShowRecordFilterMenu(false);
                            }}
                            style={({ pressed }) => [styles.successRateRangeButton, pressed && styles.pressed]}
                          >
                            <Text style={styles.successRateRangeButtonText}>{'\uBE44\uAD50: '}{getSuccessRateRangeLabel(successRateRange)}</Text>
                            <Text style={styles.successRateRangeButtonIcon}>{showSuccessRateRangeMenu ? '\u25B2' : '\u25BC'}</Text>
                          </Pressable>

                          {showSuccessRateRangeMenu ? (
                            <View style={styles.successRateRangeMenu}>
                              {(['daily', 'weekly', 'monthly', 'yearly'] as SuccessRateRange[]).map((rangeOption) => (
                                <Pressable
                                  key={rangeOption}
                                  onPress={() => {
                                    setSuccessRateRange(rangeOption);
                                    setShowSuccessRateRangeMenu(false);
                                  }}
                                  style={({ pressed }) => [
                                    styles.successRateRangeMenuItem,
                                    successRateRange === rangeOption && styles.successRateRangeMenuItemActive,
                                    pressed && styles.pressed,
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.successRateRangeMenuText,
                                      successRateRange === rangeOption && styles.successRateRangeMenuTextActive,
                                    ]}
                                  >
                                    {getSuccessRateRangeLabel(rangeOption)}
                                  </Text>
                                </Pressable>
                              ))}
                            </View>
                          ) : null}
                        </View>
                      </View>

                      {selectedDateKey && hasSuccessRateComparisonData ? (
                        <View style={styles.skillInsightShotBody}>
                          <View style={styles.successRateComparePanel}>
                            <View style={styles.successRateCompareChart}>
                              <View style={[styles.successRateCompareGuide, styles.successRateCompareGuideTop]} />
                              <View style={[styles.successRateCompareGuide, styles.successRateCompareGuideMiddle]} />
                              <View style={[styles.successRateCompareGuide, styles.successRateCompareGuideBottom]} />

                              {successRateComparisonData.map((item, index) => {
                                const nextItem = successRateComparisonData[index + 1];
                                const currentBarHeight =
                                  item.attempts > 0
                                    ? Math.max(
                                        SUCCESS_RATE_COMPARE_BAR_MIN_HEIGHT,
                                        (item.successRate / 100) * SUCCESS_RATE_COMPARE_TRACK_HEIGHT,
                                      )
                                    : SUCCESS_RATE_COMPARE_EMPTY_HEIGHT;
                                const nextBarHeight = nextItem
                                  ? nextItem.attempts > 0
                                    ? Math.max(
                                        SUCCESS_RATE_COMPARE_BAR_MIN_HEIGHT,
                                        (nextItem.successRate / 100) * SUCCESS_RATE_COMPARE_TRACK_HEIGHT,
                                      )
                                    : SUCCESS_RATE_COMPARE_EMPTY_HEIGHT
                                  : 0;
                                const delta = nextItem ? nextItem.successRate - item.successRate : 0;
                                const shouldShowDelta = delta !== 0;
                                const deltaMagnitude = Math.abs(delta);
                                const deltaArrowHeight = nextItem
                                  ? Math.max(20, Math.round(Math.abs(nextBarHeight - currentBarHeight)))
                                  : 0;
                                const deltaIndicatorTop = nextItem
                                  ? SUCCESS_RATE_COMPARE_VALUE_OFFSET +
                                    SUCCESS_RATE_COMPARE_TRACK_HEIGHT -
                                    Math.max(currentBarHeight, nextBarHeight)
                                  : 0;
                                const deltaTextSize = Math.min(16, 10 + Math.round((deltaMagnitude / 100) * 10));

                                return (
                                  <View key={`${item.label}-${item.detail}`} style={styles.successRateCompareColumn}>
                                    <View style={styles.successRateCompareBarRow}>
                                      <View style={styles.successRateCompareBarStack}>
                                        <Text style={styles.successRateCompareValue}>{item.successRate}%</Text>
                                        <View style={styles.successRateCompareTrack}>
                                          <View
                                            style={[
                                              styles.successRateCompareFill,
                                              index === 0
                                                ? styles.successRateCompareFillOldest
                                                : index === 1
                                                  ? styles.successRateCompareFillPrevious
                                                  : styles.successRateCompareFillCurrent,
                                              {
                                                height: currentBarHeight,
                                              },
                                            ]}
                                          />
                                        </View>
                                      </View>

                                      {nextItem ? (
                                        <View
                                          style={[
                                            styles.successRateCompareDeltaGap,
                                            {
                                              top: deltaIndicatorTop,
                                              height: deltaArrowHeight,
                                            },
                                          ]}
                                        >
                                          {shouldShowDelta ? (
                                            <View style={styles.successRateCompareDeltaWrap}>
                                              <View
                                                style={[
                                                  styles.successRateCompareDeltaArrowVisual,
                                                  {
                                                    height: deltaArrowHeight,
                                                  },
                                                ]}
                                              >
                                                {delta > 0 ? (
                                                  <>
                                                    <View
                                                      style={[
                                                        styles.successRateCompareDeltaHeadUp,
                                                        styles.successRateCompareDeltaHeadUpColor,
                                                      ]}
                                                    />
                                                    <View
                                                      style={[
                                                        styles.successRateCompareDeltaStem,
                                                        styles.successRateCompareDeltaStemUp,
                                                        {
                                                          height: Math.max(8, deltaArrowHeight - 10),
                                                        },
                                                      ]}
                                                    />
                                                  </>
                                                ) : (
                                                  <>
                                                    <View
                                                      style={[
                                                        styles.successRateCompareDeltaStem,
                                                        styles.successRateCompareDeltaStemDown,
                                                        {
                                                          height: Math.max(8, deltaArrowHeight - 10),
                                                        },
                                                      ]}
                                                    />
                                                    <View
                                                      style={[
                                                        styles.successRateCompareDeltaHeadDown,
                                                        styles.successRateCompareDeltaHeadDownColor,
                                                      ]}
                                                    />
                                                  </>
                                                )}
                                              </View>
                                              <Text
                                                style={[
                                                  styles.successRateCompareDeltaText,
                                                  delta > 0
                                                    ? styles.successRateCompareDeltaTextUp
                                                    : styles.successRateCompareDeltaTextDown,
                                                  {
                                                    fontSize: deltaTextSize,
                                                    lineHeight: deltaTextSize,
                                                  },
                                                ]}
                                              >
                                                {Math.abs(delta)}%
                                              </Text>
                                            </View>
                                          ) : null}
                                        </View>
                                      ) : null}
                                    </View>

                                      <Text style={styles.successRateCompareLabel}>{item.label}</Text>
                                      {item.detail ? <Text style={styles.successRateCompareDetail}>{item.detail}</Text> : null}
                                      <Text style={styles.successRateCompareMeta}>
                                        {item.attempts > 0 ? `\uC131\uACF5 ${item.successes} / \uC2DC\uB3C4 ${item.attempts}` : '\uAE30\uB85D \uC5C6\uC74C'}
                                      </Text>
                                  </View>
                                );
                              })}
                            </View>
                          </View>
                        </View>
                      ) : (
                        <Text style={styles.graphEmpty}>
                          {selectedDateKey
                            ? '\uC120\uD0DD\uD55C \uAD6C\uAC04\uC5D0\uB294 \uC544\uC9C1 \uC29B \uAE30\uB85D\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.'
                            : '\uB0A0\uC9DC\uB97C \uC120\uD0DD\uD558\uBA74 \uC131\uACF5\uB960 \uBE44\uAD50 \uADF8\uB798\uD504\uB97C \uBCFC \uC218 \uC788\uC2B5\uB2C8\uB2E4.'}
                        </Text>
                      )}
                    </View>

                    <View style={styles.skillInsightStatCard}>
                      <Text style={styles.skillInsightStatLabel}>{'\uB4DC\uB9AC\uBE14 \uADE0\uD615'}</Text>
                      <Text style={styles.skillInsightNarration}>
                        {getDribbleBalanceNarration(diarySkillInsight, dribbleGraphTotal)}
                      </Text>
                      <View style={styles.dribbleBalanceLegendRow}>
                        <View style={styles.dribbleBalanceLegendItem}>
                          <View
                            style={[
                              styles.dribbleBalanceLegendDot,
                              isLeftDribbleDominant
                                ? styles.dribbleBalanceLegendDotDominant
                                : styles.dribbleBalanceLegendDotSubtle,
                            ]}
                          />
                          <Text style={styles.dribbleBalanceLegendText}>{`\uC67C\uC190 ${diarySkillInsight.leftDribbleCount}\uD68C`}</Text>
                        </View>
                        <View style={styles.dribbleBalanceLegendItem}>
                          <View
                            style={[
                              styles.dribbleBalanceLegendDot,
                              isRightDribbleDominant
                                ? styles.dribbleBalanceLegendDotDominant
                                : styles.dribbleBalanceLegendDotSubtle,
                            ]}
                          />
                          <Text style={styles.dribbleBalanceLegendText}>{`\uC624\uB978\uC190 ${diarySkillInsight.rightDribbleCount}\uD68C`}</Text>
                        </View>
                      </View>
                      <View style={styles.dribbleBalanceTrack}>
                        {diarySkillInsight.leftDribbleCount > 0 ? (
                          <View
                            style={[
                              styles.dribbleBalanceFill,
                              isLeftDribbleDominant
                                ? styles.dribbleBalanceFillDominant
                                : styles.dribbleBalanceFillSubtle,
                              styles.dribbleBalanceFillLeftEdge,
                              { width: leftDribbleGraphWidth },
                              diarySkillInsight.rightDribbleCount === 0 && styles.dribbleBalanceFillSolo,
                            ]}
                          />
                        ) : null}
                        {diarySkillInsight.rightDribbleCount > 0 ? (
                          <View
                            style={[
                              styles.dribbleBalanceFill,
                              isRightDribbleDominant
                                ? styles.dribbleBalanceFillDominant
                                : styles.dribbleBalanceFillSubtle,
                              styles.dribbleBalanceFillRightEdge,
                              { width: rightDribbleGraphWidth },
                              diarySkillInsight.leftDribbleCount === 0 && styles.dribbleBalanceFillSolo,
                            ]}
                          />
                        ) : null}
                      </View>
                      <Text style={styles.skillInsightStatHelper}>
                        {getDribbleBalanceSummary(diarySkillInsight, dribbleGraphTotal)}
                      </Text>
                    </View>
                  </View>
                </>
              )}
            </View>
          </View>

          <View style={[styles.recordsColumn, isWide && styles.recordsColumnWide]}>
            <View style={styles.recordFilterWrap}>
              <Pressable
                onPress={() => {
                  setShowRecordFilterMenu((current) => !current);
                  setShowSuccessRateRangeMenu(false);
                }}
                style={({ pressed }) => [
                  styles.recordFilterDropdown,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.recordFilterDropdownText}>{'\uAE30\uB85D \uBCF4\uAE30: '}{getRecordFilterLabel(recordFilter)}</Text>
                <Text style={styles.recordFilterDropdownIcon}>{showRecordFilterMenu ? '\u25B2' : '\u25BC'}</Text>
              </Pressable>

              {showRecordFilterMenu ? (
                  <View style={styles.recordFilterMenu}>
                  {(['all', 'dribble', 'shoot', 'shootSuccess'] as RecordFilter[]).map((filterOption) => (
                    <Pressable
                      key={filterOption}
                      onPress={() => {
                        setRecordFilter(filterOption);
                        setShowRecordFilterMenu(false);
                      }}
                      style={({ pressed }) => [
                        styles.recordFilterMenuItem,
                        recordFilter === filterOption && styles.recordFilterMenuItemActive,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.recordFilterMenuText,
                          recordFilter === filterOption && styles.recordFilterMenuTextActive,
                        ]}
                      >
                        {getRecordFilterLabel(filterOption)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>

            {isWide ? (
              <View style={styles.recordsPanel}>
                <ScrollView
                  horizontal
                  nestedScrollEnabled
                  style={styles.recordsScroll}
                  contentContainerStyle={styles.recordsScrollContent}
                  showsHorizontalScrollIndicator
                >
                  {selectedDateKey && filteredDateRecords.length === 0 ? (
                    <View style={styles.recordCard}>
                      <Text style={styles.recordText}>
                        {recordFilter === 'all'
                          ? '\uC774 \uB0A0\uC9DC\uC5D0 \uC800\uC7A5\uB41C \uB808\uC2A8 \uC601\uC0C1\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.'
                          : `\uC774 \uB0A0\uC9DC\uC5D0 \uC800\uC7A5\uB41C ${getRecordFilterLabel(recordFilter)} \uAE30\uB85D\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.`}
                      </Text>
                    </View>
                  ) : null}

                  {filteredDateRecords.map(renderRecordCard)}
                </ScrollView>
              </View>
            ) : (
              <>
                {selectedDateKey && filteredDateRecords.length === 0 ? (
                  <View style={styles.recordCard}>
                    <Text style={styles.recordText}>
                      {recordFilter === 'all'
                        ? '\uC774 \uB0A0\uC9DC\uC5D0 \uC800\uC7A5\uB41C \uB808\uC2A8 \uC601\uC0C1\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.'
                        : `\uC774 \uB0A0\uC9DC\uC5D0 \uC800\uC7A5\uB41C ${getRecordFilterLabel(recordFilter)} \uAE30\uB85D\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.`}
                    </Text>
                  </View>
                ) : null}

                <ScrollView
                  horizontal
                  nestedScrollEnabled
                  style={styles.recordsScroll}
                  contentContainerStyle={styles.recordsScrollContent}
                  showsHorizontalScrollIndicator
                >
                  {filteredDateRecords.map(renderRecordCard)}
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </View>

      <Modal visible={showCalendarModal} transparent animationType="fade" onRequestClose={() => setShowCalendarModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, styles.calendarModalCard]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{'\uB0A0\uC9DC \uC120\uD0DD'}</Text>
              <Pressable
                onPress={() => setShowCalendarModal(false)}
                style={({ pressed }) => [styles.modalCloseButton, pressed && styles.pressed]}
              >
                <Text style={styles.modalCloseText}>{'\uB2EB\uAE30'}</Text>
              </Pressable>
            </View>

            <View style={styles.calendarTop}>
              <SmallButton title="<" onPress={() => onChangeMonth(-1)} variant="dark" />
              <Text style={styles.monthTitle}>{formatMonthTitle(currentDate)}</Text>
              <SmallButton title=">" onPress={() => onChangeMonth(1)} variant="dark" />
            </View>

            <View style={styles.calendarGrid}>
              {DAY_NAMES.map((name) => (
                <View key={name} style={styles.dayName}>
                  <Text style={styles.dayNameText}>{name}</Text>
                </View>
              ))}

              {calendarCells.map((cell) => {
                if (cell.type === 'empty') {
                  return <View key={cell.key} style={[styles.dayCell, styles.dayCellEmpty]} />;
                }

                return (
                  <Pressable
                    key={cell.key}
                    onPress={() => {
                      onOpenDate(cell.dateKey);
                      setShowCalendarModal(false);
                    }}
                    style={({ pressed }) => [
                      styles.dayCell,
                      cell.variant === 'good' && styles.dayCellGood,
                      cell.variant === 'average' && styles.dayCellAverage,
                      cell.variant === 'bad' && styles.dayCellBad,
                      selectedDateKey === cell.dateKey && styles.dayCellSelected,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.dayNumber}>{cell.date}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.legend}>
              <View style={styles.legendItem}>
                <View style={[styles.dot, styles.dotGood]} />
                <Text style={styles.legendText}>{'\uC88B\uC74C'}</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.dot, styles.dotAverage]} />
                <Text style={styles.legendText}>{'\uBCF4\uD1B5'}</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.dot, styles.dotBad]} />
                <Text style={styles.legendText}>{'\uB098\uC068'}</Text>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </Card>
  );
}

const styles = StyleSheet.create({
  diaryCard: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    padding: 0,
    overflow: 'visible',
  },
  diaryTopBar: {
    position: 'relative',
    alignItems: 'flex-start',
    justifyContent: 'center',
    minHeight: 44,
    marginTop: 8,
    marginBottom: 14,
  },
  diaryTopBarTitleWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 64,
  },
  diaryBackButton: {
    minWidth: 48,
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.lightButton,
    borderWidth: 1,
    borderColor: colors.border,
  },
  diaryBackButtonText: {
    color: colors.lightButtonText,
    fontSize: 24,
    fontWeight: '900',
    lineHeight: 24,
  },
  diaryScreenTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: 0,
    marginBottom: 0,
  },
  dateSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 16,
  },
  dateSelectorRowCompact: {
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'stretch',
  },
  dateSelectorMain: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    width: '100%',
    maxWidth: 560,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.surfaceStrong,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dateSelectorMainGood: {
    backgroundColor: colors.green,
    borderColor: 'rgba(111,191,129,0.55)',
  },
  dateSelectorMainAverage: {
    backgroundColor: 'rgba(214,186,92,0.32)',
    borderColor: 'rgba(233,201,96,0.52)',
  },
  dateSelectorMainBad: {
    backgroundColor: colors.red,
    borderColor: 'rgba(225,121,130,0.5)',
  },
  dateSelectorMainCompact: {
    width: '100%',
  },
  dateSelectorCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    minWidth: 0,
  },
  dateArrowButton: {
    width: 38,
    height: 38,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dateArrowIcon: {
    width: 11,
    height: 11,
    borderLeftWidth: 2.5,
    borderBottomWidth: 2.5,
    borderColor: colors.text,
  },
  dateArrowIconLeft: {
    transform: [{ rotate: '45deg' }],
  },
  dateArrowIconRight: {
    transform: [{ rotate: '-135deg' }],
  },
  dateSelectorText: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
    minWidth: 0,
    flexShrink: 1,
  },
  calendarTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 18,
  },
  monthTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
    flex: 1,
    textAlign: 'center',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  dayName: {
    width: '14.2857%',
    minHeight: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  dayNameText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  dayCell: {
    width: '14.2857%',
    minHeight: 78,
    borderRadius: 0,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderWidth: 2,
    borderColor: 'transparent',
    marginBottom: 8,
  },
  dayCellEmpty: {
    opacity: 0,
  },
  dayCellGood: {
    backgroundColor: colors.green,
  },
  dayCellAverage: {
    backgroundColor: 'rgba(214,186,92,0.32)',
  },
  dayCellBad: {
    backgroundColor: colors.red,
  },
  dayCellSelected: {
    borderColor: '#fff6ed',
  },
  dayNumber: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  dayStatus: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 6,
  },
  dayStatusEmoji: {
    fontSize: 24,
    lineHeight: 28,
    marginTop: 1,
  },
  dayStatusFire: {
    fontSize: 26,
  },
  dayStatusCheck: {
    fontSize: 24,
  },
  dayStatusStreak: {
    fontSize: 18,
    lineHeight: 22,
    marginTop: 3,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginTop: 18,
    marginBottom: 18,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  legendText: {
    color: colors.text,
    fontSize: 14,
  },
  legendEmoji: {
    fontSize: 18,
    lineHeight: 20,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 999,
  },
  dotGood: {
    backgroundColor: '#6fcb7d',
  },
  dotAverage: {
    backgroundColor: '#e6c45f',
  },
  dotBad: {
    backgroundColor: '#d46d75',
  },
  dotGreen: {
    backgroundColor: 'limegreen',
  },
  dotRed: {
    backgroundColor: colors.danger,
  },
  dotAttempt: {
    backgroundColor: colors.secondary,
  },
  dotSuccess: {
    backgroundColor: '#32cd32',
  },
  recordsSection: {
    marginTop: 4,
    gap: 12,
  },
  recordsTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  contentRow: {
    gap: 14,
  },
  contentRowWide: {
    flexDirection: 'column',
  },
  graphColumn: {
    width: '100%',
    gap: 12,
  },
  graphColumnWide: {
    width: '100%',
    flexShrink: 0,
  },
  skillInsightCard: {
    backgroundColor: colors.surfaceStrong,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  skillInsightText: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 22,
  },
  skillInsightStats: {
    gap: 10,
  },
  skillInsightStatCard: {
    borderRadius: 14,
    padding: 12,
    backgroundColor: colors.surface,
    borderWidth: 0,
    borderColor: 'transparent',
  },
  dailySummaryCard: {
    gap: 8,
  },
  dailySummaryLine: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '700',
  },
  skillInsightShotCard: {
    gap: 12,
    padding: 12,
    borderRadius: 22,
  },
  skillInsightShotHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  skillInsightShotTitleWrap: {
    flex: 1,
    minWidth: 160,
  },
  successRateRangeWrap: {
    position: 'relative',
    width: 122,
    zIndex: 14,
  },
  successRateRangeButton: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: colors.surfaceStrong,
    borderWidth: 0,
    borderColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  successRateRangeButtonText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
  successRateRangeButtonIcon: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  successRateRangeMenu: {
    position: 'absolute',
    top: 46,
    left: 0,
    right: 0,
    borderRadius: 14,
    padding: 6,
    backgroundColor: colors.surfaceStrong,
    borderWidth: 0,
    borderColor: 'transparent',
    gap: 4,
  },
  successRateRangeMenuItem: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  successRateRangeMenuItemActive: {
    backgroundColor: 'rgba(208,145,85,0.18)',
  },
  successRateRangeMenuText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
  },
  successRateRangeMenuTextActive: {
    color: colors.text,
  },
  skillInsightShotButtonRow: {
    alignItems: 'stretch',
  },
  skillInsightShotBody: {
    gap: 12,
  },
  successRateComparePanel: {
    borderRadius: 22,
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 12,
    backgroundColor: colors.surfaceStrong,
    borderWidth: 0,
    borderColor: 'transparent',
  },
  successRateCompareChart: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
    minHeight: 236,
  },
  successRateCompareGuide: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  successRateCompareGuideTop: {
    top: 46,
  },
  successRateCompareGuideMiddle: {
    top: 96,
  },
  successRateCompareGuideBottom: {
    top: 146,
  },
  successRateCompareColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    minWidth: 0,
    position: 'relative',
  },
  successRateCompareBarRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    width: '100%',
    position: 'relative',
  },
  successRateCompareBarStack: {
    alignItems: 'center',
    minWidth: 0,
    width: '100%',
  },
  successRateCompareValue: {
    color: colors.textAccent,
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 6,
  },
  successRateCompareTrack: {
    width: '100%',
    maxWidth: 64,
    height: SUCCESS_RATE_COMPARE_TRACK_HEIGHT,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  successRateCompareFill: {
    width: '100%',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
  successRateCompareFillOldest: {
    backgroundColor: 'rgba(208,145,85,0.42)',
  },
  successRateCompareFillPrevious: {
    backgroundColor: 'rgba(208,145,85,0.68)',
  },
  successRateCompareFillCurrent: {
    backgroundColor: colors.secondary,
  },
  successRateCompareDeltaGap: {
    position: 'absolute',
    left: '100%',
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -16,
    zIndex: 2,
  },
  successRateCompareDeltaWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  successRateCompareDeltaArrowVisual: {
    width: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  successRateCompareDeltaStem: {
    width: 2,
    borderRadius: 999,
  },
  successRateCompareDeltaStemUp: {
    backgroundColor: '#6fcb7d',
  },
  successRateCompareDeltaStemDown: {
    backgroundColor: '#d46d75',
  },
  successRateCompareDeltaHeadUp: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderBottomWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  successRateCompareDeltaHeadUpColor: {
    borderBottomColor: '#6fcb7d',
  },
  successRateCompareDeltaHeadDown: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  successRateCompareDeltaHeadDownColor: {
    borderTopColor: '#d46d75',
  },
  successRateCompareDeltaText: {
    fontWeight: '800',
  },
  successRateCompareDeltaTextUp: {
    color: '#6fcb7d',
  },
  successRateCompareDeltaTextDown: {
    color: '#d46d75',
  },
  successRateCompareLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
    marginTop: 10,
    textAlign: 'center',
  },
  successRateCompareDetail: {
    color: colors.textSoft,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
    textAlign: 'center',
  },
  successRateCompareMeta: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 6,
    textAlign: 'center',
  },
  skillInsightStatLabel: {
    color: colors.textSoft,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 4,
  },
  skillInsightStatValue: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  skillInsightNarration: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '700',
    marginTop: 2,
  },
  dribbleBalanceLegendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
    flexWrap: 'wrap',
  },
  dribbleBalanceLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dribbleBalanceLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  dribbleBalanceLegendDotDominant: {
    backgroundColor: colors.secondary,
  },
  dribbleBalanceLegendDotSubtle: {
    backgroundColor: 'rgba(127,156,191,0.72)',
  },
  dribbleBalanceLegendText: {
    color: colors.textSoft,
    fontSize: 12,
    fontWeight: '800',
  },
  dribbleBalanceTrack: {
    width: '100%',
    height: 22,
    marginTop: 10,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.08)',
    flexDirection: 'row',
  },
  dribbleBalanceFill: {
    height: '100%',
  },
  dribbleBalanceFillDominant: {
    backgroundColor: colors.secondary,
  },
  dribbleBalanceFillSubtle: {
    backgroundColor: 'rgba(127,156,191,0.72)',
  },
  dribbleBalanceFillLeftEdge: {
    borderTopLeftRadius: 999,
    borderBottomLeftRadius: 999,
  },
  dribbleBalanceFillRightEdge: {
    borderTopRightRadius: 999,
    borderBottomRightRadius: 999,
  },
  dribbleBalanceFillSolo: {
    borderRadius: 999,
  },
  skillInsightStatHelper: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
  },
  recordsColumn: {
    gap: 14,
  },
  recordsColumnWide: {
    width: '100%',
    minHeight: 760,
  },
  recordFilterWrap: {
    position: 'relative',
    alignSelf: 'flex-start',
    minWidth: 170,
    zIndex: 10,
  },
  recordFilterDropdown: {
    borderRadius: 0,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: colors.surfaceStrong,
    borderWidth: 0,
    borderColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  recordFilterDropdownText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  recordFilterDropdownIcon: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  recordFilterMenu: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    borderRadius: 14,
    padding: 6,
    backgroundColor: colors.surfaceStrong,
    borderWidth: 0,
    borderColor: 'transparent',
    gap: 4,
  },
  recordFilterMenuItem: {
    borderRadius: 0,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  recordFilterMenuItemActive: {
    backgroundColor: 'rgba(208,145,85,0.18)',
  },
  recordFilterMenuText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
  },
  recordFilterMenuTextActive: {
    color: colors.text,
  },
  recordsPanel: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.surfaceStrong,
    borderWidth: 0,
    borderColor: 'transparent',
  },
  recordsScroll: {
    width: '100%',
  },
  recordsScrollContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    padding: 12,
    paddingRight: 20,
  },
  graphLegend: {
    flexDirection: 'row',
    gap: 14,
    flexWrap: 'wrap',
  },
  graphTopRow: {
    alignItems: 'flex-end',
  },
  barAreaLarge: {
    width: '100%',
    minHeight: 276,
    justifyContent: 'space-between',
    gap: 12,
  },
  graphMetricRow: {
    width: '100%',
    flexDirection: 'row',
    gap: 10,
  },
  graphMetric: {
    flex: 1,
    alignItems: 'center',
  },
  graphMetricLabel: {
    color: colors.textSoft,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 4,
  },
  graphMetricValue: {
    color: colors.text,
    fontSize: 21,
    fontWeight: '900',
  },
  graphBarRateRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  overlapBarWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 220,
  },
  graphRateSide: {
    width: 76,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  graphRateSideLabel: {
    color: colors.textSoft,
    fontSize: 12,
    fontWeight: '800',
  },
  graphRateSideValue: {
    color: colors.textAccent,
    fontSize: 26,
    fontWeight: '900',
  },
  overlapBarTrack: {
    width: '100%',
    maxWidth: 160,
    height: 220,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  barColumn: {
    display: 'none',
  },
  barLarge: {
    width: 56,
    borderRadius: 16,
  },
  barValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 10,
  },
  barLabel: {
    color: colors.textSoft,
    fontSize: 14,
    fontWeight: '800',
    marginTop: 12,
  },
  attemptBar: {
    backgroundColor: colors.secondary,
  },
  successBar: {
    backgroundColor: '#32cd32',
  },
  overlapAttemptBar: {
    position: 'absolute',
    bottom: 0,
    width: 120,
    opacity: 0.55,
  },
  overlapSuccessBar: {
    position: 'absolute',
    bottom: 0,
    width: 120,
    zIndex: 1,
  },
  graphEmpty: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 22,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.62)',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 28,
  },
  modalCard: {
    maxHeight: '88%',
    borderRadius: 18,
    padding: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  calendarModalCard: {
    maxWidth: 960,
    width: '100%',
    alignSelf: 'center',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  modalTitle: {
    flex: 1,
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  modalCloseButton: {
    borderRadius: 0,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.surfaceStrong,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalCloseText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  modalDescription: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 22,
    marginTop: 10,
    marginBottom: 16,
  },
  modalGuideLegend: {
    flexDirection: 'row',
    gap: 18,
    marginBottom: 14,
    flexWrap: 'wrap',
  },
  modalGuideItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  modalGuideLine: {
    width: 24,
    height: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  modalGuideBar: {
    width: 18,
    height: 14,
    borderRadius: 6,
    backgroundColor: 'rgba(255,159,28,0.42)',
    borderWidth: 1,
    borderColor: 'rgba(255,159,28,0.78)',
  },
  allGraphScroll: {
    paddingRight: 12,
  },
  allGraphArea: {
    height: 320,
    position: 'relative',
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingTop: 14,
    paddingBottom: 34,
  },
  allGraphGuideTop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 22,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  allGraphGuideUpper: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '32%',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  allGraphGuideMiddle: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '52%',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  allGraphGuideLower: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '72%',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  allGraphGuideBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 34,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  allGraphGuideText: {
    position: 'absolute',
    left: -6,
    top: -10,
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    backgroundColor: '#1a130e',
    paddingHorizontal: 4,
  },
  allGraphBarWrap: {
    position: 'absolute',
    bottom: 42,
    width: 56,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  allGraphBarValue: {
    color: colors.textAccent,
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 8,
  },
  allGraphBar: {
    width: 42,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    backgroundColor: 'rgba(255,159,28,0.42)',
    borderWidth: 1,
    borderColor: 'rgba(255,159,28,0.78)',
  },
  allGraphAxisLabel: {
    color: colors.textSoft,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 10,
  },
  recordCard: {
    backgroundColor: colors.surfaceStrong,
    borderRadius: 16,
    padding: 14,
  },
  recordCardHorizontal: {
    flexShrink: 0,
  },
  recordCardShoot: {
    borderColor: 'rgba(208,145,85,0.28)',
    backgroundColor: colors.surfaceStrong,
  },
  recordCardDribble: {
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: colors.surfaceStrong,
  },
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 8,
  },
  recordTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    flex: 1,
    minWidth: 0,
    paddingRight: 4,
  },
  recordLevelBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
  },
  recordLevelBadgeGood: {
    backgroundColor: 'rgba(50,205,50,0.14)',
    borderColor: 'rgba(50,205,50,0.42)',
  },
  recordLevelBadgeAverage: {
    backgroundColor: 'rgba(217,161,110,0.14)',
    borderColor: 'rgba(217,161,110,0.42)',
  },
  recordLevelBadgeBad: {
    backgroundColor: 'rgba(191,80,88,0.14)',
    borderColor: 'rgba(191,80,88,0.42)',
  },
  recordLevelBadgeText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
  },
  shotOutcomeToggle: {
    minWidth: 86,
    borderRadius: 0,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shotOutcomeToggleSuccess: {
    backgroundColor: 'rgba(50,205,50,0.14)',
    borderColor: 'rgba(50,205,50,0.45)',
  },
  shotOutcomeToggleFailure: {
    backgroundColor: 'rgba(255,99,71,0.14)',
    borderColor: 'rgba(255,99,71,0.45)',
  },
  shotOutcomeToggleLabel: {
    color: colors.textSoft,
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 2,
  },
  shotOutcomeToggleValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  recordTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 0,
    flexShrink: 1,
  },
  recordMeta: {
    color: '#ffd3ad',
    fontSize: 13,
    marginBottom: 10,
  },
  evaluationToggleRow: {
    position: 'relative',
    alignItems: 'stretch',
    marginBottom: 12,
    zIndex: 2,
  },
  evaluationSection: {
    position: 'relative',
    paddingBottom: 2,
  },
  evaluationSectionCollapsed: {
    paddingBottom: 0,
    minHeight: 36,
  },
  evaluationSectionContentWrap: {
    overflow: 'hidden',
  },
  evaluationSectionToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    borderWidth: 0,
    borderColor: 'transparent',
    justifyContent: 'center',
  },
  evaluationSectionToggleRound: {
    width: 30,
    height: 30,
    borderRadius: 0,
  },
  evaluationSectionToggleFloating: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 5,
  },
  evaluationSectionToggleCollapsed: {
    position: 'absolute',
    top: 2,
    right: 2,
    zIndex: 5,
  },
  evaluationSectionToggleChip: {
    minHeight: 30,
    maxWidth: 180,
    borderRadius: 0,
    paddingHorizontal: 10,
  },
  evaluationSectionToggleIcon: {
    color: colors.textSoft,
    fontSize: 15,
    fontWeight: '800',
  },
  evaluationSectionToggleLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  evaluationDropdownWrap: {
    width: '100%',
    gap: 8,
  },
  evaluationDropdownButton: {
    width: '100%',
    alignSelf: 'stretch',
  },
  evaluationDropdownMenuWrap: {
    overflow: 'hidden',
  },
  evaluationDropdownMenu: {
    borderRadius: 14,
    padding: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  evaluationDropdownMenuItem: {
    borderRadius: 0,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  evaluationDropdownMenuItemActive: {
    backgroundColor: 'rgba(208,145,85,0.18)',
  },
  evaluationDropdownMenuText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
  },
  evaluationDropdownMenuTextActive: {
    color: colors.text,
  },
  evaluationBox: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 0,
    borderWidth: 0,
    borderColor: 'transparent',
    gap: 12,
  },
  evaluationTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  evaluationSummary: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
  },
  evaluationEmptyBox: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 0,
    borderWidth: 0,
    borderColor: 'transparent',
  },
  evaluationEmptyText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
  },
  criteriaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  criterionChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 0,
    minWidth: 88,
  },
  criterionChipStable: {
    backgroundColor: 'rgba(50,205,50,0.12)',
    borderColor: 'rgba(50,205,50,0.34)',
  },
  criterionChipUnstable: {
    backgroundColor: 'rgba(191,80,88,0.12)',
    borderColor: 'rgba(191,80,88,0.34)',
  },
  criterionChipLabel: {
    color: colors.textSoft,
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 2,
  },
  criterionChipValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  highlightGroup: {
    gap: 8,
  },
  highlightGroupTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  highlightButton: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 0,
    gap: 4,
  },
  highlightButtonGood: {
    backgroundColor: 'rgba(50,205,50,0.1)',
    borderColor: 'rgba(50,205,50,0.28)',
  },
  highlightButtonBad: {
    backgroundColor: 'rgba(191,80,88,0.1)',
    borderColor: 'rgba(191,80,88,0.28)',
  },
  highlightButtonLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  highlightButtonDetail: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  highlightEmptyText: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  recordVideo: {
    width: '100%',
    height: 260,
    borderRadius: 16,
    backgroundColor: '#111111',
    marginBottom: 12,
  },
  recordText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 22,
  },
  liveFeedbackBox: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 0,
    borderColor: 'transparent',
    minHeight: 96,
  },
  liveFeedbackLabel: {
    color: colors.textSoft,
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 8,
  },
  liveFeedbackText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 22,
  },
  pressed: {
    opacity: 0.9,
  },
});
