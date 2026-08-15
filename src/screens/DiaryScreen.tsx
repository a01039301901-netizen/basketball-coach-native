import { type AVPlaybackStatus, ResizeMode, Video } from 'expo-av';
import { memo, type MutableRefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SmallButton } from '../components/common/Buttons';
import { Card } from '../components/common/Card';
import { DAY_NAMES } from '../constants/content';
import { colors } from '../theme/colors';
import type {
  CalendarCell,
  DiarySkillInsight,
  FeedbackMoment,
  LessonRecord,
  LessonRecordCriterion,
  LessonRecordHighlight,
  ShotGraphDatum,
} from '../types/app';
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

interface SelectedImprovementInsight {
  recordId: string;
  label: string;
  detail: string;
}

interface RankedDiaryRecordInsight {
  record: LessonRecord;
  level: NonNullable<LessonRecord['evaluation']>['level'];
  stableCount: number;
  totalCount: number;
  scoreRatio: number;
  ratioValuesDesc: number[];
  ratioValuesAsc: number[];
  createdAtTime: number;
}

interface RecordEvaluationVideoPlayerProps {
  recordId: string;
  source: { uri: string };
  height: number;
  videoRef: MutableRefObject<Video | null>;
  onPlaybackStatusUpdate: (status: AVPlaybackStatus) => void;
}

const SUCCESS_RATE_COMPARE_TRACK_HEIGHT = 126;
const SUCCESS_RATE_COMPARE_BAR_MIN_HEIGHT = 12;
const SUCCESS_RATE_COMPARE_EMPTY_HEIGHT = 8;
const SUCCESS_RATE_COMPARE_VALUE_OFFSET = 26;
const SUCCESS_RATE_COMPARE_MIN_ATTEMPTS = 20;
const RECORD_LIST_GAP = 14;
const RECORD_LIST_HORIZONTAL_PADDING = 12;
const DIARY_NEUTRAL_SURFACE = '#2b2e33';
const DIARY_NEUTRAL_SURFACE_ALT = '#23262a';
const DIARY_NEUTRAL_SURFACE_SOFT = '#1d2024';
const DIARY_NEUTRAL_ACTIVE = 'rgba(255,255,255,0.08)';
const DIARY_NEUTRAL_BORDER = 'rgba(255,255,255,0.1)';
const DIARY_RECORD_GOOD_SURFACE = 'rgba(76,175,80,0.18)';
const DIARY_RECORD_GOOD_BORDER = 'rgba(76,175,80,0.46)';
const DIARY_RECORD_AVERAGE_SURFACE = 'rgba(217,161,110,0.18)';
const DIARY_RECORD_AVERAGE_BORDER = 'rgba(217,161,110,0.46)';
const DIARY_RECORD_BAD_SURFACE = 'rgba(191,80,88,0.18)';
const DIARY_RECORD_BAD_BORDER = 'rgba(191,80,88,0.46)';
const EMPTY_LESSON_RECORDS: LessonRecord[] = [];

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
    return '\uB4DC\uB9AC\uBE14';
  }

  if (filter === 'shoot') {
    return '\uC29B';
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

const RecordEvaluationVideoPlayer = memo(function RecordEvaluationVideoPlayer({
  recordId: _recordId,
  source,
  height,
  videoRef,
  onPlaybackStatusUpdate,
}: RecordEvaluationVideoPlayerProps) {
  return (
    <Video
      ref={(instance) => {
        videoRef.current = instance;
      }}
      source={source}
      useNativeControls
      shouldPlay={false}
      isLooping={false}
      progressUpdateIntervalMillis={200}
      resizeMode={ResizeMode.CONTAIN}
      style={[styles.recordEvaluationVideo, { height }]}
      onPlaybackStatusUpdate={onPlaybackStatusUpdate}
    />
  );
}, (prevProps, nextProps) => (
  prevProps.recordId === nextProps.recordId &&
  prevProps.source.uri === nextProps.source.uri &&
  prevProps.height === nextProps.height
));

const RecordVideoThumbnail = memo(function RecordVideoThumbnail({ thumbnailUri }: { thumbnailUri: string }) {
  if (thumbnailUri.trim()) {
    return <Image source={{ uri: thumbnailUri }} resizeMode="cover" style={styles.recordVideoPreviewImage} />;
  }

  return (
    <View style={[styles.recordVideoPreview, styles.recordVideoPreviewEmpty]}>
      <Text style={styles.recordVideoPreviewCaption}>{'썸네일을 준비하고 있습니다.'}</Text>
    </View>
  );
});

function isAllowedDiaryTextCodePoint(codePoint: number) {
  return (
    (codePoint >= 0x20 && codePoint <= 0x7e) ||
    (codePoint >= 0x1100 && codePoint <= 0x11ff) ||
    (codePoint >= 0x3130 && codePoint <= 0x318f) ||
    (codePoint >= 0xac00 && codePoint <= 0xd7af) ||
    codePoint === 0x09 ||
    codePoint === 0x0a ||
    codePoint === 0x0d
  );
}

function isBrokenDiaryText(text: string) {
  if (!text) {
    return false;
  }

  if (text.includes('\uFFFD')) {
    return true;
  }

  if (text.includes('??')) {
    return true;
  }

  let suspiciousGlyphCount = 0;

  for (const character of text) {
    const codePoint = character.codePointAt(0) ?? 0;

    if (isAllowedDiaryTextCodePoint(codePoint)) {
      continue;
    }

    suspiciousGlyphCount += 1;

    if (suspiciousGlyphCount >= 2) {
      return true;
    }
  }

  return false;
}

function buildDiaryFeedbackFallback(record: LessonRecord) {
  const visibleCriteria = record.evaluation
    ? record.mode === 'dribble'
      ? getDisplayedDribbleCriteria(record, record.evaluation)
      : record.evaluation.criteria
    : [];
  const unstableCriteria = visibleCriteria
    .filter((criterion) => !criterion.isStable)
    .map((criterion) => getDiaryCriterionDisplayLabel(criterion));

  if (unstableCriteria.length > 0) {
    return `${getRecordModeLabel(record.mode)} \uD53C\uB4DC\uBC31\n\uBCF4\uC644\uC774 \uD544\uC694\uD55C \uAE30\uC900: ${unstableCriteria.join(', ')}\n\uAE30\uB85D \uD3C9\uAC00\uC5D0\uC11C \uC790\uC138\uD55C \uB0B4\uC6A9\uC744 \uD655\uC778\uD574 \uC8FC\uC138\uC694.`;
  }

  return `${getRecordModeLabel(record.mode)} \uD53C\uB4DC\uBC31\uC744 \uB2E4\uC2DC \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.`;
}

function getReadableDiaryFeedback(record: LessonRecord, text: string) {
  return isBrokenDiaryText(text) ? buildDiaryFeedbackFallback(record) : text;
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

function renderRecordLevelBadge(level?: NonNullable<LessonRecord['evaluation']>['level']) {
  if (!level) {
    return null;
  }

  return (
    <View
      style={[
        styles.recordLevelBadge,
        level === 'good'
          ? styles.recordLevelBadgeGood
          : level === 'average'
            ? styles.recordLevelBadgeAverage
            : styles.recordLevelBadgeBad,
      ]}
    >
      <Text style={styles.recordLevelBadgeText}>{getRecordLevelLabel(level)}</Text>
    </View>
  );
}


function formatSignedCountDelta(delta: number) {
  return `${delta > 0 ? '+' : ''}${delta}`;
}

function getDribbleBalanceHeadline(insight: DiarySkillInsight, totalCount: number) {
  const trackedCount = insight.leftDribbleCount + insight.rightDribbleCount;

  if (totalCount === 0) {
    return '\uB4DC\uB9AC\uBE14 \uADE0\uD615 \uAE30\uB85D \uC5C6\uC74C';
  }

  if (trackedCount === 0) {
    return '\uC88C\uC6B0 \uAD6C\uBD84 \uAE30\uB85D \uBD80\uC871';
  }

  if (insight.dribbleBalance === 'balanced') {
    return (
      <>
        <Text style={styles.skillInsightNarrationEmphasis}>{'\uC67C\uC190\uACFC \uC624\uB978\uC190 \uB4DC\uB9AC\uBE14'}</Text>
        {` \uADE0\uD615 \u00B7 \uC67C\uC190 ${insight.leftDribbleCount} / \uC624\uB978\uC190 ${insight.rightDribbleCount}`}
      </>
    );
  }

  return insight.dribbleBalance === 'left'
    ? (
        <>
          <Text style={styles.skillInsightNarrationEmphasis}>{'\uC67C\uC190 \uB4DC\uB9AC\uBE14'}</Text>
          {` \uC6B0\uC138 \u00B7 \uC67C\uC190 ${insight.leftDribbleCount} / \uC624\uB978\uC190 ${insight.rightDribbleCount}`}
        </>
      )
    : (
        <>
          <Text style={styles.skillInsightNarrationEmphasis}>{'\uC624\uB978\uC190 \uB4DC\uB9AC\uBE14'}</Text>
          {` \uC6B0\uC138 \u00B7 \uC67C\uC190 ${insight.leftDribbleCount} / \uC624\uB978\uC190 ${insight.rightDribbleCount}`}
        </>
      );
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

function getDailySummaryPracticeText(
  insight: DiarySkillInsight,
  selectedDateDribbleCount: number
) {
  const baseText = `\uB4DC\uB9AC\uBE14 ${selectedDateDribbleCount}\uD68C / \uC29B ${insight.selectedShotAttempts}\uD68C`;

  if (!insight.previousPracticeDateKey) {
    return baseText;
  }

  const dribbleDelta = selectedDateDribbleCount - insight.previousPracticeDribbleCount;
  const shootDelta = insight.selectedShotAttempts - insight.previousPracticeShotAttempts;
  return `${baseText} \u00B7 ${formatDiarySummaryDateLabel(insight.previousPracticeDateKey)} \uB300\uBE44 \uB4DC\uB9AC\uBE14 ${formatSignedCountDelta(dribbleDelta)}, \uC29B ${formatSignedCountDelta(shootDelta)}`;
}

function getDailySummaryEvaluationText(insight: DiarySkillInsight) {
  const { good, average, bad } = insight.evaluationCounts;
  const totalEvaluatedCount = good + average + bad;

  if (totalEvaluatedCount === 0) {
    return '\uD3C9\uAC00 \uC815\uBCF4 \uC5C6\uC74C';
  }

  if (insight.evaluationDominantLevel === 'good') {
    return `\uB300\uCCB4\uB85C \uC88B\uC2B5\uB2C8\uB2E4 \u00B7 \uC88B\uC74C ${good}, \uBCF4\uD1B5 ${average}, \uB098\uC068 ${bad}`;
  }

  if (insight.evaluationDominantLevel === 'average') {
    return `\uB300\uCCB4\uB85C \uB098\uC058\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4 \u00B7 \uC88B\uC74C ${good}, \uBCF4\uD1B5 ${average}, \uB098\uC068 ${bad}`;
  }

  if (insight.evaluationDominantLevel === 'bad') {
    return `\uB300\uCCB4\uB85C \uBCF4\uC644\uC774 \uB354 \uD544\uC694\uD569\uB2C8\uB2E4 \u00B7 \uC88B\uC74C ${good}, \uBCF4\uD1B5 ${average}, \uB098\uC068 ${bad}`;
  }

  return `\uB300\uCCB4\uB85C \uB098\uC058\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4 \u00B7 \uC88B\uC74C ${good}, \uBCF4\uD1B5 ${average}, \uB098\uC068 ${bad}`;
}

function getDailySummaryEvaluationCountText(insight: DiarySkillInsight) {
  const { good, average, bad } = insight.evaluationCounts;
  return `\uB098\uC068 : ${bad}\uAC1C   \uBCF4\uD1B5 : ${average}\uAC1C   \uC88B\uC74C : ${good}\uAC1C`;
}

function getRecordCardLevelStyle(level?: NonNullable<LessonRecord['evaluation']>['level']) {
  if (level === 'good') {
    return {
      backgroundColor: DIARY_RECORD_GOOD_SURFACE,
      borderColor: DIARY_RECORD_GOOD_BORDER,
    };
  }

  if (level === 'average') {
    return {
      backgroundColor: DIARY_RECORD_AVERAGE_SURFACE,
      borderColor: DIARY_RECORD_AVERAGE_BORDER,
    };
  }

  if (level === 'bad') {
    return {
      backgroundColor: DIARY_RECORD_BAD_SURFACE,
      borderColor: DIARY_RECORD_BAD_BORDER,
    };
  }

  return null;
}

function renderEvaluationCountSummary(insight: DiarySkillInsight) {
  const { good, average, bad } = insight.evaluationCounts;

  return (
    <Text style={styles.recordFilterCountsText}>
      <Text style={styles.recordFilterCountBad}>{`\uB098\uC068 : ${bad}\uAC1C`}</Text>
      <Text style={styles.recordFilterCountsSpacer}>{'   '}</Text>
      <Text style={styles.recordFilterCountAverage}>{`\uBCF4\uD1B5 : ${average}\uAC1C`}</Text>
      <Text style={styles.recordFilterCountsSpacer}>{'   '}</Text>
      <Text style={styles.recordFilterCountGood}>{`\uC88B\uC74C : ${good}\uAC1C`}</Text>
    </Text>
  );
}

function getDailySummaryToggleHeadline(insight: DiarySkillInsight) {
  const { good, average, bad } = insight.evaluationCounts;
  const totalEvaluatedCount = good + average + bad;

  if (totalEvaluatedCount === 0) {
    return '\uC624\uB298 \uB808\uC2A8 \uC0C1\uD0DC\uB97C \uB354 \uAE30\uB85D\uD574 \uBCF4\uC138\uC694';
  }

  if (insight.evaluationDominantLevel === 'good') {
    return '\uC624\uB298\uC740 \uB300\uCCB4\uB85C \uC88B\uC74C\uC774 \uB9CE\uC544\uC694';
  }

  if (insight.evaluationDominantLevel === 'average') {
    return '\uC624\uB298\uC740 \uB300\uCCB4\uB85C \uBCF4\uD1B5\uC774 \uB9CE\uC544\uC694';
  }

  if (insight.evaluationDominantLevel === 'bad') {
    return '\uC624\uB298\uC740 \uB300\uCCB4\uB85C \uB098\uC068\uC774 \uB9CE\uC544\uC694';
  }

  return '\uC624\uB298 \uB808\uC2A8 \uC0C1\uD0DC\uB97C \uD655\uC778\uD574 \uBCF4\uC138\uC694';
}

function getDiaryCriterionDisplayLabel(criterion: LessonRecordCriterion) {
  if (criterion.key === 'shoot-leg-angle') {
    return '\uBB34\uB98E \uAC01\uB3C4';
  }

  if (criterion.key === 'shoot-release-timing') {
    return '\uD0C0\uC774\uBC0D';
  }

  if (criterion.key === 'shoot-release-point') {
    return '\uC29B \uD0C0\uC810';
  }

  if (criterion.key === 'shoot-release-duration') {
    return '\uB9B4\uB9AC\uC988 \uC2DC\uAC04';
  }

  if (criterion.key === 'shoot-result') {
    return '\uC131\uACF5 \uC5EC\uBD80';
  }

  if (criterion.key === 'dribble-front-stance-angle') {
    return '\uBB34\uB98E \uAC01\uB3C4';
  }

  if (criterion.key === 'dribble-front-ball-lane') {
    return '\uACF5 \uB77C\uC778';
  }

  if (criterion.key === 'dribble-front-hand-balance') {
    return '\uC591\uC190 \uADE0\uD615';
  }

  if (criterion.key === 'dribble-front-foot-spacing') {
    return '\uBC1C \uAC04\uACA9';
  }

  if (criterion.key === 'dribble-torso-posture') {
    return '\uC0C1\uCCB4 \uAE30\uC6B8\uAE30';
  }

  if (criterion.key === 'dribble-height' || criterion.key === 'dribble-height-appropriate') {
    return '\uB4DC\uB9AC\uBE14 \uB192\uC774';
  }

  if (criterion.key === 'dribble-eye-focus') {
    return '\uC2DC\uC120 \uCC98\uB9AC';
  }

  if (criterion.key === 'dribble-rhythm') {
    return '\uB4DC\uB9AC\uBE14 \uB9AC\uB4EC';
  }

  if (criterion.key === 'dribble-position-stability') {
    return '\uB4DC\uB9AC\uBE14 \uC704\uCE58 \uC548\uC815\uC131';
  }

  if (criterion.key === 'dribble-height-stability') {
    return '\uB4DC\uB9AC\uBE14 \uB192\uC774 \uC548\uC815\uC131';
  }

  if (criterion.key === 'dribble-tempo-stability') {
    return '\uB4DC\uB9AC\uBE14 \uB9AC\uB4EC \uC548\uC815\uC131';
  }

  return criterion.label;
}

function getDiaryCriterionInsightText(criterion: LessonRecordCriterion) {
  const detail = criterion.detail.trim();

  return detail;
}

function getShootImprovementTitle(criterionKey: string) {
  if (criterionKey === 'shoot-leg-angle') {
    return '\uBB34\uB98E \uAC01\uB3C4 \uBCF4\uC644\uC774 \uD544\uC694\uD569\uB2C8\uB2E4.';
  }

  if (criterionKey === 'shoot-release-timing') {
    return '\uC29B \uD0C0\uC774\uBC0D \uBCF4\uC644\uC774 \uD544\uC694\uD569\uB2C8\uB2E4.';
  }

  if (criterionKey === 'shoot-release-point') {
    return '\uC29B \uD0C0\uC810(\uC704\uCE58) \uBCF4\uC644\uC774 \uD544\uC694\uD569\uB2C8\uB2E4.';
  }

  if (criterionKey === 'shoot-release-duration') {
    return '\uB9B4\uB9AC\uC988 \uC18D\uB3C4 \uBCF4\uC644\uC774 \uD544\uC694\uD569\uB2C8\uB2E4.';
  }

  return '';
}

function findMatchingShootImprovementHighlight(
  improvements: LessonRecordHighlight[],
  criterionKey: string
) {
  return improvements.find((highlight) => {
    const label = highlight.label;

    if (criterionKey === 'shoot-leg-angle') {
      return label.includes('\uBB34\uB98E');
    }

    if (criterionKey === 'shoot-release-timing') {
      return label.includes('\uD0C0\uC774\uBC0D');
    }

    if (criterionKey === 'shoot-release-point') {
      return label.includes('\uD0C0\uC810') || label.includes('\uB192\uC774');
    }

    if (criterionKey === 'shoot-release-duration') {
      return label.includes('\uC18D\uB3C4') || label.includes('\uC2DC\uAC04');
    }

    return false;
  });
}

function getShootImprovementHighlights(evaluation: NonNullable<LessonRecord['evaluation']>) {
  const orderedKeys = [
    'shoot-leg-angle',
    'shoot-release-timing',
    'shoot-release-point',
    'shoot-release-duration',
  ];

  return orderedKeys.reduce<LessonRecordHighlight[]>((accumulator, criterionKey) => {
    const criterion = evaluation.criteria.find((item) => item.key === criterionKey && !item.isStable);

    if (!criterion) {
      return accumulator;
    }

    const existingHighlight = findMatchingShootImprovementHighlight(evaluation.improvements, criterionKey);
    const title = getShootImprovementTitle(criterionKey);

    accumulator.push({
      label: title || criterion.label,
      detail: existingHighlight?.detail || criterion.detail,
      startAtMs: existingHighlight?.startAtMs ?? 0,
      durationMs: existingHighlight?.durationMs ?? 2200,
    });

    return accumulator;
  }, []);
}

function getDribbleImprovementTitle(criterionKey: string, dribbleView?: LessonRecord['dribbleView']) {
  if (criterionKey === 'dribble-front-stance-angle') {
    return '\uBB34\uB98E \uAC01\uB3C4 \uBCF4\uC644';
  }

  if (criterionKey === 'dribble-front-ball-lane') {
    return '\uACF5 \uB77C\uC778 \uBCF4\uC644';
  }

  if (criterionKey === 'dribble-front-hand-balance') {
    return '\uC591\uC190 \uADE0\uD615 \uBCF4\uC644';
  }

  if (criterionKey === 'dribble-front-foot-spacing') {
    return '\uBC1C \uAC04\uACA9 \uBCF4\uC644';
  }

  if (criterionKey === 'dribble-torso-posture') {
    return '\uC0C1\uCCB4 \uAE30\uC6B8\uAE30 \uBCF4\uC644';
  }

  if (criterionKey === 'dribble-height-appropriate') {
    return '\uB4DC\uB9AC\uBE14 \uB192\uC774 \uC870\uC808';
  }

  if (criterionKey === 'dribble-eye-focus') {
    return '\uC2DC\uC120 \uCC98\uB9AC \uBCF4\uC644';
  }

  if (criterionKey === 'dribble-rhythm') {
    return '\uB9AC\uB4EC \uBCF4\uC644';
  }

  if (criterionKey === 'dribble-position-stability') {
    return dribbleView === 'side' ? '\uACF5 \uC704\uCE58 \uBCF4\uC644' : '\uACF5 \uB77C\uC778 \uBCF4\uC644';
  }

  if (criterionKey === 'dribble-height-stability') {
    return '\uB192\uC774 \uC548\uC815\uC131 \uBCF4\uC644';
  }

  if (criterionKey === 'dribble-tempo-stability') {
    return '\uB9AC\uB4EC \uBCF4\uC644';
  }

  return '';
}

function findMatchingDribbleImprovementHighlight(
  improvements: LessonRecordHighlight[],
  criterionKey: string,
  dribbleView?: LessonRecord['dribbleView']
) {
  return improvements.find((highlight) => {
    const label = highlight.label;

    if (criterionKey === 'dribble-front-stance-angle') {
      return label.includes('\uBB34\uB98E');
    }

    if (criterionKey === 'dribble-front-ball-lane') {
      return label.includes('\uACF5 \uB77C\uC778') || label.includes('\uACF5 \uC704\uCE58');
    }

    if (criterionKey === 'dribble-front-hand-balance') {
      return label.includes('\uC591\uC190') || label.includes('\uADE0\uD615');
    }

    if (criterionKey === 'dribble-front-foot-spacing') {
      return label.includes('\uBC1C \uAC04\uACA9');
    }

    if (criterionKey === 'dribble-torso-posture') {
      return label.includes('\uC0C1\uCCB4');
    }

    if (criterionKey === 'dribble-height-appropriate') {
      return label.includes('\uB4DC\uB9AC\uBE14 \uB192\uC774');
    }

    if (criterionKey === 'dribble-eye-focus') {
      return label.includes('\uC2DC\uC120');
    }

    if (criterionKey === 'dribble-rhythm') {
      return label.includes('\uB9AC\uB4EC');
    }

    if (criterionKey === 'dribble-position-stability') {
      return dribbleView === 'side'
        ? label.includes('\uACF5 \uC704\uCE58')
        : label.includes('\uACF5 \uB77C\uC778') || label.includes('\uC704\uCE58');
    }

    if (criterionKey === 'dribble-height-stability') {
      return label.includes('\uB192\uC774 \uC548\uC815');
    }

    if (criterionKey === 'dribble-tempo-stability') {
      return label.includes('\uB9AC\uB4EC');
    }

    return false;
  });
}

function buildLegacyDribbleImprovementDetail(criterionKey: string, dribbleView?: LessonRecord['dribbleView']) {
  if (criterionKey === 'dribble-front-stance-angle') {
    return '\uC608\uC804 \uAE30\uB85D\uC774\uB77C \uBB34\uB98E \uAC01\uB3C4 \uAE30\uC900 \uB370\uC774\uD130\uAC00 \uCDA9\uBD84\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uB2E4\uC74C \uC55E\uBAA8\uC2B5 \uB4DC\uB9AC\uBE14 \uAE30\uB85D\uBD80\uD130 \uC790\uC138\uD788 \uD655\uC778\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.';
  }

  if (criterionKey === 'dribble-front-ball-lane') {
    return '\uC608\uC804 \uAE30\uB85D\uC774\uB77C \uACF5 \uB77C\uC778 \uAE30\uC900 \uB370\uC774\uD130\uAC00 \uCDA9\uBD84\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uB2E4\uC74C \uC55E\uBAA8\uC2B5 \uB4DC\uB9AC\uBE14 \uAE30\uB85D\uBD80\uD130 \uC790\uC138\uD788 \uD655\uC778\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.';
  }

  if (criterionKey === 'dribble-front-hand-balance') {
    return '\uC608\uC804 \uAE30\uB85D\uC774\uB77C \uC591\uC190 \uADE0\uD615 \uAE30\uC900 \uB370\uC774\uD130\uAC00 \uCDA9\uBD84\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uB2E4\uC74C \uC55E\uBAA8\uC2B5 \uB4DC\uB9AC\uBE14 \uAE30\uB85D\uBD80\uD130 \uC790\uC138\uD788 \uD655\uC778\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.';
  }

  if (criterionKey === 'dribble-front-foot-spacing') {
    return '\uC608\uC804 \uAE30\uB85D\uC774\uB77C \uBC1C \uAC04\uACA9 \uAE30\uC900 \uB370\uC774\uD130\uAC00 \uCDA9\uBD84\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uB2E4\uC74C \uC55E\uBAA8\uC2B5 \uB4DC\uB9AC\uBE14 \uAE30\uB85D\uBD80\uD130 \uC790\uC138\uD788 \uD655\uC778\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.';
  }

  if (criterionKey === 'dribble-torso-posture') {
    return '\uC608\uC804 \uAE30\uB85D\uC774\uB77C \uC0C1\uCCB4 \uC790\uC138 \uAE30\uC900 \uB370\uC774\uD130\uAC00 \uCDA9\uBD84\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uB2E4\uC74C \uB4DC\uB9AC\uBE14 \uAE30\uB85D\uBD80\uD130 \uC790\uC138\uD788 \uD655\uC778\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.';
  }

  if (criterionKey === 'dribble-height-appropriate') {
    return '\uC608\uC804 \uAE30\uB85D\uC774\uB77C \uB4DC\uB9AC\uBE14 \uB192\uC774 \uAE30\uC900 \uB370\uC774\uD130\uAC00 \uCDA9\uBD84\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uB2E4\uC74C \uB4DC\uB9AC\uBE14 \uAE30\uB85D\uBD80\uD130 \uC790\uC138\uD788 \uD655\uC778\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.';
  }

  if (criterionKey === 'dribble-eye-focus') {
    return '\uC608\uC804 \uAE30\uB85D\uC774\uB77C \uC2DC\uC120 \uCC98\uB9AC \uAE30\uC900 \uB370\uC774\uD130\uAC00 \uCDA9\uBD84\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uB2E4\uC74C \uB4DC\uB9AC\uBE14 \uAE30\uB85D\uBD80\uD130 \uC790\uC138\uD788 \uD655\uC778\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.';
  }

  if (criterionKey === 'dribble-rhythm') {
    return '\uC608\uC804 \uAE30\uB85D\uC774\uB77C \uB4DC\uB9AC\uBE14 \uB9AC\uB4EC \uAE30\uC900 \uB370\uC774\uD130\uAC00 \uCDA9\uBD84\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uB2E4\uC74C \uB4DC\uB9AC\uBE14 \uAE30\uB85D\uBD80\uD130 \uC790\uC138\uD788 \uD655\uC778\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.';
  }

  if (criterionKey === 'dribble-position-stability') {
    return dribbleView === 'side'
      ? '\uC608\uC804 \uAE30\uB85D\uC774\uB77C \uACF5 \uC55E\uB4A4 \uC704\uCE58 \uC548\uC815\uC131 \uAE30\uC900 \uB370\uC774\uD130\uAC00 \uCDA9\uBD84\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uB2E4\uC74C \uC606\uBAA8\uC2B5 \uB4DC\uB9AC\uBE14 \uAE30\uB85D\uBD80\uD130 \uC790\uC138\uD788 \uD655\uC778\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.'
      : '\uC608\uC804 \uAE30\uB85D\uC774\uB77C \uACF5 \uC88C\uC6B0 \uB77C\uC778 \uC548\uC815\uC131 \uAE30\uC900 \uB370\uC774\uD130\uAC00 \uCDA9\uBD84\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uB2E4\uC74C \uC55E\uBAA8\uC2B5 \uB4DC\uB9AC\uBE14 \uAE30\uB85D\uBD80\uD130 \uC790\uC138\uD788 \uD655\uC778\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.';
  }

  if (criterionKey === 'dribble-height-stability') {
    return '\uC608\uC804 \uAE30\uB85D\uC774\uB77C \uB4DC\uB9AC\uBE14 \uB192\uC774 \uC548\uC815\uC131 \uAE30\uC900 \uB370\uC774\uD130\uAC00 \uCDA9\uBD84\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uB2E4\uC74C \uB4DC\uB9AC\uBE14 \uAE30\uB85D\uBD80\uD130 \uC790\uC138\uD788 \uD655\uC778\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.';
  }

  if (criterionKey === 'dribble-tempo-stability') {
    return '\uC608\uC804 \uAE30\uB85D\uC774\uB77C \uB4DC\uB9AC\uBE14 \uB9AC\uB4EC \uC548\uC815\uC131 \uAE30\uC900 \uB370\uC774\uD130\uAC00 \uCDA9\uBD84\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uB2E4\uC74C \uB4DC\uB9AC\uBE14 \uAE30\uB85D\uBD80\uD130 \uC790\uC138\uD788 \uD655\uC778\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.';
  }

  return '\uC608\uC804 \uAE30\uB85D\uC774\uB77C \uC790\uC138\uD55C \uAE30\uC900 \uB370\uC774\uD130\uAC00 \uBD80\uC871\uD569\uB2C8\uB2E4.';
}

function getDribbleImprovementHighlights(
  record: LessonRecord,
  evaluation: NonNullable<LessonRecord['evaluation']>
) {
  const orderedCriteria: Array<{ key: string; legacyKeys: string[] }> = record.dribbleView === 'front'
    ? [
        {
          key: 'dribble-front-stance-angle',
          legacyKeys: ['dribble-front-stance-angle'],
        },
        {
          key: 'dribble-front-ball-lane',
          legacyKeys: ['dribble-front-ball-lane'],
        },
        {
          key: 'dribble-eye-focus',
          legacyKeys: ['dribble-eye-focus'],
        },
        {
          key: 'dribble-rhythm',
          legacyKeys: ['dribble-rhythm'],
        },
        {
          key: 'dribble-front-foot-spacing',
          legacyKeys: ['dribble-front-foot-spacing'],
        },
      ]
    : [
        {
          key: 'dribble-torso-posture',
          legacyKeys: ['dribble-torso-posture'],
        },
        {
          key: 'dribble-height-appropriate',
          legacyKeys: ['dribble-height-appropriate', 'dribble-height'],
        },
        {
          key: 'dribble-eye-focus',
          legacyKeys: ['dribble-eye-focus'],
        },
        {
          key: 'dribble-rhythm',
          legacyKeys: ['dribble-rhythm'],
        },
      ];

  return orderedCriteria.reduce<LessonRecordHighlight[]>((accumulator, entry) => {
    const criterion = evaluation.criteria.find((item) => entry.legacyKeys.includes(item.key));

    if (criterion?.isStable) {
      return accumulator;
    }

    const existingHighlight = findMatchingDribbleImprovementHighlight(
      evaluation.improvements,
      entry.key,
      record.dribbleView
    );
    const title = getDribbleImprovementTitle(entry.key, record.dribbleView);

    accumulator.push({
      label: title || criterion?.label || entry.key,
      detail:
        existingHighlight?.detail ||
        criterion?.detail ||
        buildLegacyDribbleImprovementDetail(entry.key, record.dribbleView),
      startAtMs: existingHighlight?.startAtMs ?? 0,
      durationMs: existingHighlight?.durationMs ?? 2200,
    });

    return accumulator;
  }, []);
}

function getDisplayedDribbleCriteria(
  record: LessonRecord,
  evaluation: NonNullable<LessonRecord['evaluation']>
) {
  const orderedCriteria: Array<{ key: string; legacyKeys: string[] }> = record.dribbleView === 'front'
    ? [
        {
          key: 'dribble-front-stance-angle',
          legacyKeys: ['dribble-front-stance-angle'],
        },
        {
          key: 'dribble-front-ball-lane',
          legacyKeys: ['dribble-front-ball-lane'],
        },
        {
          key: 'dribble-eye-focus',
          legacyKeys: ['dribble-eye-focus'],
        },
        {
          key: 'dribble-rhythm',
          legacyKeys: ['dribble-rhythm'],
        },
        {
          key: 'dribble-front-foot-spacing',
          legacyKeys: ['dribble-front-foot-spacing'],
        },
      ]
    : [
        {
          key: 'dribble-torso-posture',
          legacyKeys: ['dribble-torso-posture'],
        },
        {
          key: 'dribble-height-appropriate',
          legacyKeys: ['dribble-height-appropriate', 'dribble-height'],
        },
        {
          key: 'dribble-eye-focus',
          legacyKeys: ['dribble-eye-focus'],
        },
        {
          key: 'dribble-rhythm',
          legacyKeys: ['dribble-rhythm'],
        },
      ];

  return orderedCriteria
    .map((entry) => evaluation.criteria.find((criterion) => entry.legacyKeys.includes(criterion.key)) ?? null)
    .filter((criterion): criterion is LessonRecordCriterion => Boolean(criterion));
}

function getDiaryCorrectionCategoryLabel(record: LessonRecord) {
  if (record.mode === 'shoot') {
    return '\uC29B';
  }

  if (record.dribbleView === 'front') {
    return '\uC55E \uB4DC\uB9AC\uBE14';
  }

  if (record.dribbleView === 'side') {
    return '\uC606 \uB4DC\uB9AC\uBE14';
  }

  return '\uB4DC\uB9AC\uBE14';
}

function getDailySummaryCorrectionText(records: LessonRecord[]) {
  const correctionCounts = new Map<string, { label: string; count: number }>();
  let hasEvaluation = false;

  for (const record of records) {
    const criteria = record.evaluation
      ? record.mode === 'dribble'
        ? getDisplayedDribbleCriteria(record, record.evaluation)
        : record.evaluation.criteria
      : [];

    if (criteria.length > 0) {
      hasEvaluation = true;
    }

    for (const criterion of criteria) {
      if (criterion.isStable) {
        continue;
      }

      const categoryLabel = getDiaryCorrectionCategoryLabel(record);
      const criterionLabel = getDiaryCriterionDisplayLabel(criterion);
      const correctionKey = `${categoryLabel}:${criterion.key}`;
      const current = correctionCounts.get(correctionKey);
      const label = `${categoryLabel} ${criterionLabel}`;

      if (current) {
        current.count += 1;
        continue;
      }

      correctionCounts.set(correctionKey, {
        label,
        count: 1,
      });
    }
  }

  const topCorrection = [...correctionCounts.values()].sort((left, right) => right.count - left.count)[0] ?? null;

  if (topCorrection) {
    return `${topCorrection.label} \uD53C\uB4DC\uBC31\uC774 \uAC00\uC7A5 \uB9CE\uC544\uC694. \uC774 \uBD80\uBD84\uC744 \uACE0\uCCD0\uBD10\uC694.`;
  }

  if (hasEvaluation) {
    return '\uC624\uB298\uC740 \uD06C\uAC8C \uACE0\uCCD0\uBCFC \uD53C\uB4DC\uBC31\uC774 \uB9CE\uC9C0 \uC54A\uC544\uC694.';
  }

  return '\uC544\uC9C1 \uD53C\uB4DC\uBC31 \uAE30\uB85D\uC774 \uB354 \uD544\uC694\uD574\uC694.';
}

function getDailySummaryShotText(insight: DiarySkillInsight) {
  if (insight.previousShotDateKey === null || insight.previousShotSuccessRate === null) {
    return `\uC131\uACF5\uB960 ${insight.selectedShotSuccessRate}%`;
  }

  const delta = insight.selectedShotSuccessRate - insight.previousShotSuccessRate;
  const deltaText = delta === 0 ? '\uBCC0\uD654 \uC5C6\uC74C' : `${formatSignedCountDelta(delta)}%`;
  return `\uC131\uACF5\uB960 ${insight.selectedShotSuccessRate}% \u00B7 ${formatDiarySummaryDateLabel(insight.previousShotDateKey)} \uB300\uBE44 ${deltaText}`;
}

function getDailySummaryDribbleText(insight: DiarySkillInsight, selectedDateDribbleCount: number) {
  const trackedDribbleCount = insight.leftDribbleCount + insight.rightDribbleCount;

  if (trackedDribbleCount === 0) {
    return `\uC88C\uC6B0 \uAD6C\uBD84 \uAE30\uB85D \uBD80\uC871 \u00B7 \uB4DC\uB9AC\uBE14 ${selectedDateDribbleCount}\uD68C`;
  }

  if (insight.dribbleBalance === 'balanced') {
    return `\uB4DC\uB9AC\uBE14 \uADE0\uD615 \u00B7 \uC67C\uC190 ${insight.leftDribbleCount} / \uC624\uB978\uC190 ${insight.rightDribbleCount}`;
  }

  if (insight.dribbleBalance === 'left') {
    return `\uC67C\uC190 \uB4DC\uB9AC\uBE14 \uC6B0\uC138 \u00B7 \uC67C\uC190 ${insight.leftDribbleCount} / \uC624\uB978\uC190 ${insight.rightDribbleCount}`;
  }

  if (insight.dribbleBalance === 'right') {
    return `\uC624\uB978\uC190 \uB4DC\uB9AC\uBE14 \uC6B0\uC138 \u00B7 \uC67C\uC190 ${insight.leftDribbleCount} / \uC624\uB978\uC190 ${insight.rightDribbleCount}`;
  }

  return `\uB4DC\uB9AC\uBE14 ${selectedDateDribbleCount}\uD68C`;
}

function getRankableRecordCriteria(record: LessonRecord) {
  if (!record.evaluation) {
    return [] as LessonRecordCriterion[];
  }

  if (record.mode === 'shoot') {
    return record.evaluation.criteria.filter((criterion) => criterion.key !== 'shoot-result');
  }

  return getDisplayedDribbleCriteria(record, record.evaluation);
}

function getRankedRecordCategoryLabel(record: LessonRecord) {
  if (record.mode === 'shoot') {
    return '\uC29B';
  }

  if (record.dribbleView === 'side') {
    return '\uC606 \uB4DC\uB9AC\uBE14';
  }

  if (record.dribbleView === 'front') {
    return '\uC55E \uB4DC\uB9AC\uBE14';
  }

  return '\uB4DC\uB9AC\uBE14';
}

function getRecordLevelWeight(level: NonNullable<LessonRecord['evaluation']>['level']) {
  if (level === 'good') {
    return 3;
  }

  if (level === 'average') {
    return 2;
  }

  return 1;
}

function compareRatioValueLists(
  leftValues: number[],
  rightValues: number[],
  direction: 'best' | 'worst'
) {
  const maxLength = Math.max(leftValues.length, rightValues.length);

  for (let index = 0; index < maxLength; index += 1) {
    const leftValue = leftValues[index];
    const rightValue = rightValues[index];

    if (leftValue === undefined && rightValue === undefined) {
      return 0;
    }

    if (leftValue === undefined) {
      return 1;
    }

    if (rightValue === undefined) {
      return -1;
    }

    if (leftValue === rightValue) {
      continue;
    }

    return direction === 'best' ? rightValue - leftValue : leftValue - rightValue;
  }

  return 0;
}

function buildRankedDiaryRecordInsight(record: LessonRecord): RankedDiaryRecordInsight | null {
  const level = record.evaluation?.level;
  const criteria = getRankableRecordCriteria(record);

  if (!level || criteria.length === 0) {
    return null;
  }

  const stableCount = criteria.reduce((count, criterion) => count + (criterion.isStable ? 1 : 0), 0);
  const ratioValues = criteria
    .map((criterion) =>
      typeof criterion.stableRatio === 'number' && Number.isFinite(criterion.stableRatio)
        ? Math.max(0, Math.min(1, criterion.stableRatio))
        : null
    )
    .filter((ratio): ratio is number => ratio !== null);
  const createdAtTime = new Date(record.createdAt).getTime();

  return {
    record,
    level,
    stableCount,
    totalCount: criteria.length,
    scoreRatio: criteria.length > 0 ? stableCount / criteria.length : 0,
    ratioValuesDesc: [...ratioValues].sort((left, right) => right - left),
    ratioValuesAsc: [...ratioValues].sort((left, right) => left - right),
    createdAtTime: Number.isFinite(createdAtTime) ? createdAtTime : 0,
  };
}

function compareRankedDiaryRecordsForBest(left: RankedDiaryRecordInsight, right: RankedDiaryRecordInsight) {
  const levelDelta = getRecordLevelWeight(right.level) - getRecordLevelWeight(left.level);

  if (levelDelta !== 0) {
    return levelDelta;
  }

  if (right.stableCount !== left.stableCount) {
    return right.stableCount - left.stableCount;
  }

  const ratioDelta = compareRatioValueLists(left.ratioValuesDesc, right.ratioValuesDesc, 'best');

  if (ratioDelta !== 0) {
    return ratioDelta;
  }

  if (right.scoreRatio !== left.scoreRatio) {
    return right.scoreRatio - left.scoreRatio;
  }

  return right.createdAtTime - left.createdAtTime;
}

function compareRankedDiaryRecordsForWorst(left: RankedDiaryRecordInsight, right: RankedDiaryRecordInsight) {
  const levelDelta = getRecordLevelWeight(left.level) - getRecordLevelWeight(right.level);

  if (levelDelta !== 0) {
    return levelDelta;
  }

  if (left.stableCount !== right.stableCount) {
    return left.stableCount - right.stableCount;
  }

  const ratioDelta = compareRatioValueLists(left.ratioValuesAsc, right.ratioValuesAsc, 'worst');

  if (ratioDelta !== 0) {
    return ratioDelta;
  }

  if (left.scoreRatio !== right.scoreRatio) {
    return left.scoreRatio - right.scoreRatio;
  }

  return right.createdAtTime - left.createdAtTime;
}

function getSuccessRateHeadline(
  comparisonData: Array<{ label: string; attempts: number; successRate: number }>
) {
  const currentItem = comparisonData[comparisonData.length - 1] ?? null;

  if (!currentItem || currentItem.attempts <= 0) {
    return '\uC131\uACF5\uB960 \uBE44\uAD50 \uAE30\uB85D \uC5C6\uC74C';
  }

  const previousItem = [...comparisonData]
    .slice(0, -1)
    .reverse()
    .find((item) => item.attempts > 0);

  if (!previousItem) {
    return `\uC131\uACF5\uB960 ${currentItem.successRate}%`;
  }

  const delta = currentItem.successRate - previousItem.successRate;
  const deltaText = delta === 0 ? '\uBCC0\uD654 \uC5C6\uC74C' : `${formatSignedCountDelta(delta)}%`;
  return `\uC131\uACF5\uB960 ${currentItem.successRate}% \u00B7 ${previousItem.label} \uB300\uBE44 ${deltaText}`;
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
  const recordListItemWidth = recordCardWidth + RECORD_LIST_GAP;
  const recordEvaluationVideoHeight = isCompactMobile ? 320 : isWide ? 420 : 360;
  const [playbackFeedback, setPlaybackFeedback] = useState<Record<string, string>>({});
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [recordFilter, setRecordFilter] = useState<RecordFilter>('all');
  const [showRecordFilterMenu, setShowRecordFilterMenu] = useState(false);
  const [showDailySummary, setShowDailySummary] = useState(false);
  const [successRateRange, setSuccessRateRange] = useState<SuccessRateRange>('daily');
  const [showSuccessRateRangeMenu, setShowSuccessRateRangeMenu] = useState(false);
  const [openedEvaluationRecordId, setOpenedEvaluationRecordId] = useState<string | null>(null);
  const [selectedImprovementInsight, setSelectedImprovementInsight] = useState<SelectedImprovementInsight | null>(null);
  const [pendingDeleteRecordId, setPendingDeleteRecordId] = useState<string | null>(null);
  const evaluationVideoRef = useRef<Video | null>(null);
  const playbackPollersRef = useRef<Record<string, ReturnType<typeof setInterval>>>({});
  const menuOpenSpacerHeight = showSuccessRateRangeMenu ? 220 : 0;
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

  useEffect(() => {
    setShowDailySummary(false);
  }, [selectedDateKey]);

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
  const dailySummaryCorrectionText = useMemo(
    () => getDailySummaryCorrectionText(selectedDateRecords),
    [selectedDateRecords]
  );
  const dailyRecordRanking = useMemo(() => {
    const rankedRecords = filteredDateRecords
      .map((record) => buildRankedDiaryRecordInsight(record))
      .filter((record): record is RankedDiaryRecordInsight => Boolean(record));
    const sortedForBest = [...rankedRecords].sort(compareRankedDiaryRecordsForBest);
    const best = sortedForBest[0] ?? null;
    const sortedForWorst = [...rankedRecords].sort(compareRankedDiaryRecordsForWorst);
    const worst =
      sortedForWorst.find((record) => record.record.id !== best?.record.id) ??
      (rankedRecords.length > 1 ? sortedForWorst[0] ?? null : null);

    return {
      totalCount: rankedRecords.length,
      best,
      worst,
    };
  }, [filteredDateRecords]);
  const openedEvaluationRecord = useMemo(
    () => (openedEvaluationRecordId ? selectedDateRecords.find((record) => record.id === openedEvaluationRecordId) ?? null : null),
    [openedEvaluationRecordId, selectedDateRecords]
  );
  const openedEvaluationVideoSource = useMemo(
    () => (openedEvaluationRecord?.videoUri ? { uri: openedEvaluationRecord.videoUri } : null),
    [openedEvaluationRecord?.videoUri]
  );
  const recordListData = selectedDateKey ? filteredDateRecords : EMPTY_LESSON_RECORDS;
  const recordListExtraData = useMemo(
    () => ({
      playbackFeedback,
      bestRecordId: dailyRecordRanking.best?.record.id ?? null,
      worstRecordId: dailyRecordRanking.worst?.record.id ?? null,
      openedEvaluationRecordId,
      recordCardWidth,
    }),
    [
      dailyRecordRanking.best?.record.id,
      dailyRecordRanking.worst?.record.id,
      openedEvaluationRecordId,
      playbackFeedback,
      recordCardWidth,
    ]
  );

  const getPlaybackVideoRef = useCallback(
    (record: LessonRecord) => {
      if (openedEvaluationRecordId === record.id) {
        return evaluationVideoRef.current;
      }

      return null;
    },
    [openedEvaluationRecordId]
  );

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
          next[record.id] = record.feedback;
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
    if (openedEvaluationRecordId && !selectedDateRecords.some((record) => record.id === openedEvaluationRecordId)) {
      setOpenedEvaluationRecordId(null);
    }
  }, [openedEvaluationRecordId, selectedDateRecords]);

  useEffect(() => {
    setSelectedImprovementInsight(null);
  }, [openedEvaluationRecordId]);

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
        const video = getPlaybackVideoRef(record);

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
    [getPlaybackVideoRef, stopPlaybackPolling, syncFeedbackFromPosition]
  );

  const handlePlaybackStatus = useCallback((record: LessonRecord, status: AVPlaybackStatus) => {
    if (!status.isLoaded) {
      return;
    }

    const positionMillis = typeof status.positionMillis === 'number' ? status.positionMillis : 0;

    if (status.isPlaying) {
      syncFeedbackFromPosition(record, positionMillis);
      startPlaybackPolling(record);
    } else {
      stopPlaybackPolling(record.id);
    }

    if (status.didJustFinish) {
      setPlaybackFeedback((current) => {
        if (current[record.id] === record.feedback) {
          return current;
        }

        return {
          ...current,
          [record.id]: record.feedback,
        };
      });
    }
  }, [startPlaybackPolling, stopPlaybackPolling, syncFeedbackFromPosition]);

  const jumpToHighlight = useCallback(
    async (record: LessonRecord, startAtMs: number) => {
      const video = getPlaybackVideoRef(record);

      if (!video) {
        return;
      }

      syncFeedbackFromPosition(record, startAtMs);
      await video.playFromPositionAsync(Math.max(0, startAtMs));
      startPlaybackPolling(record);
    },
    [getPlaybackVideoRef, startPlaybackPolling, syncFeedbackFromPosition]
  );

  const openRecordEvaluation = useCallback((recordId: string) => {
    setOpenedEvaluationRecordId(recordId);
  }, []);

  const closeRecordEvaluation = useCallback(() => {
    setSelectedImprovementInsight(null);
    setOpenedEvaluationRecordId(null);
  }, []);

  const handleOpenedEvaluationPlaybackStatus = useCallback(
    (status: AVPlaybackStatus) => {
      if (!openedEvaluationRecord) {
        return;
      }

      handlePlaybackStatus(openedEvaluationRecord, status);
    },
    [handlePlaybackStatus, openedEvaluationRecord]
  );

  useEffect(() => {
    if (!openedEvaluationRecordId) {
      evaluationVideoRef.current = null;
      return;
    }

    for (const recordId of Object.keys(playbackPollersRef.current)) {
      stopPlaybackPolling(recordId);
    }

    return () => {
      stopPlaybackPolling(openedEvaluationRecordId);
      evaluationVideoRef.current = null;
    };
  }, [openedEvaluationRecordId, stopPlaybackPolling]);

  const openDeleteConfirm = useCallback((recordId: string) => {
    setPendingDeleteRecordId(recordId);
  }, []);

  const closeDeleteConfirm = useCallback(() => {
    setPendingDeleteRecordId(null);
  }, []);

  const confirmDeleteRecord = useCallback(() => {
    if (!pendingDeleteRecordId) {
      return;
    }

    if (openedEvaluationRecordId === pendingDeleteRecordId) {
      closeRecordEvaluation();
    }

    onDeleteRecord(pendingDeleteRecordId);
    setPendingDeleteRecordId(null);
  }, [closeRecordEvaluation, onDeleteRecord, openedEvaluationRecordId, pendingDeleteRecordId]);

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

          {renderRecordLevelBadge(evaluation?.level)}
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

  function renderRecordEvaluationContent(record: LessonRecord) {
    const evaluation = record.evaluation;

    if (!evaluation) {
      return (
        <View style={styles.evaluationEmptyBox}>
          <Text style={styles.evaluationEmptyText}>{'\uC790\uC138 \uD3C9\uAC00 \uC815\uBCF4\uB294 AI\uB85C \uBD84\uC11D\uD55C \uAE30\uB85D\uBD80\uD130 \uD655\uC778 \uAC00\uB2A5\uD569\uB2C8\uB2E4.'}</Text>
        </View>
      );
    }

    const strengthHighlights =
      record.mode === 'shoot'
        ? evaluation.strengths.filter((highlight) => highlight.label !== '\uC29B \uC131\uACF5 \uC7A5\uBA74')
        : evaluation.strengths.filter(
            (highlight) =>
              !(
                record.dribbleView === 'front' &&
                (highlight.label.includes('\uC591\uC190 \uADE0\uD615') ||
                  (highlight.label.includes('\uC591\uC190') && highlight.label.includes('\uADE0\uD615')))
              )
          );
    const improvementHighlights =
      record.mode === 'shoot'
        ? getShootImprovementHighlights(evaluation)
        : getDribbleImprovementHighlights(record, evaluation);
    const displayedCriteria = record.mode === 'dribble' ? getDisplayedDribbleCriteria(record, evaluation) : evaluation.criteria;

    return (
      <View style={styles.evaluationBox}>
        <Text style={styles.evaluationTitle}>{'\uAE30\uB85D \uD3C9\uAC00'}</Text>

        {displayedCriteria.length > 0 ? (
          <View style={styles.criteriaList}>
            {displayedCriteria.map((criterion) => (
              <View key={`${record.id}-${criterion.key}`} style={styles.criteriaListItem}>
                <View
                  style={[
                    styles.criteriaListBadge,
                    criterion.isStable ? styles.criteriaListBadgeStable : styles.criteriaListBadgeUnstable,
                  ]}
                >
                  <Text style={styles.criteriaListBadgeText}>{getDiaryCriterionDisplayLabel(criterion)}</Text>
                </View>

                <View style={styles.criteriaListTextWrap}>
                  <Text
                    style={[
                      styles.criteriaListStatus,
                      criterion.isStable ? styles.criteriaListStatusStable : styles.criteriaListStatusUnstable,
                    ]}
                  >
                    {criterion.isStable ? '\uC798\uD55C \uC810' : '\uBCF4\uC644'}
                  </Text>
                  <Text style={styles.criteriaListDescription}>{getDiaryCriterionInsightText(criterion)}</Text>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.highlightGroup}>
          <Text style={styles.highlightGroupTitle}>{'\uC798\uD55C \uC810'}</Text>
          {strengthHighlights.length > 0 ? (
            strengthHighlights.map((highlight, index) => (
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
            <Text style={styles.highlightEmptyText}>{'\uC544\uC9C1 \uD45C\uC2DC\uD560 \uC798\uD55C \uC810\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.'}</Text>
          )}
        </View>

        <View style={styles.highlightGroup}>
          <Text style={styles.highlightGroupTitle}>{'\uBCF4\uC644\uD560 \uC810'}</Text>
          {improvementHighlights.length > 0 ? (
            improvementHighlights.map((highlight, index) => (
              <Pressable
                key={`${record.id}-improvement-${index}`}
                onPress={() => {
                  setSelectedImprovementInsight((current) =>
                    current?.recordId === record.id && current.label === highlight.label
                      ? null
                      : {
                          recordId: record.id,
                          label: highlight.label,
                          detail: highlight.detail,
                        }
                  );
                  void jumpToHighlight(record, highlight.startAtMs);
                }}
                style={({ pressed }) => [styles.improvementTriggerButton, pressed && styles.pressed]}
              >
                <Text style={[styles.highlightButtonLabel, styles.highlightButtonLabelBad]}>{highlight.label}</Text>
              </Pressable>
            ))
          ) : (
            <Text style={styles.highlightEmptyText}>{'\uC9C0\uAE08\uC740 \uCD94\uAC00\uB85C \uBCF4\uC5EC\uC904 \uBCF4\uC644 \uC7A5\uBA74\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.'}</Text>
          )}
        </View>
      </View>
    );
  }

  const renderRecordCard = useCallback((record: LessonRecord) => {
    const syncedFeedback = getReadableDiaryFeedback(record, playbackFeedback[record.id] || record.feedback);
    const evaluation = record.evaluation;
    const recordCardLevelStyle = getRecordCardLevelStyle(evaluation?.level);
    const shouldShowRankingMarkers = dailyRecordRanking.totalCount > 1;
    const isBestRecord = shouldShowRankingMarkers && dailyRecordRanking.best?.record.id === record.id;
    const isWorstRecord = shouldShowRankingMarkers && dailyRecordRanking.worst?.record.id === record.id;

    return (
      <View
        key={record.id}
        style={[
          styles.recordCard,
          styles.recordCardHorizontal,
          record.mode === 'shoot' ? styles.recordCardShoot : styles.recordCardDribble,
          recordCardLevelStyle,
          { width: recordCardWidth },
        ]}
      >
        <View style={styles.recordHeader}>
          <Pressable
            onPress={() => openRecordEvaluation(record.id)}
            style={({ pressed }) => [styles.recordTitlePressable, pressed && styles.pressed]}
          >
            <View style={styles.recordTitleRow}>
              <Text style={styles.recordTitle}>{getRecordTitle(record.mode)}</Text>
              {isBestRecord ? (
                <Text style={[styles.recordRankingMarker, styles.recordRankingMarkerBest]}>{'BEST'}</Text>
              ) : null}
              {isWorstRecord ? (
                <Text style={[styles.recordRankingMarker, styles.recordRankingMarkerWorst]}>{'WORST'}</Text>
              ) : null}
            </View>
          </Pressable>

          {renderRecordLevelBadge(evaluation?.level)}
        </View>

        <Pressable
          onPress={() => openRecordEvaluation(record.id)}
          style={({ pressed }) => [styles.recordBodyPressable, pressed && styles.pressed]}
        >
          <Text style={styles.recordMeta}>{record.createdAt}</Text>

          {record.videoUri ? (
            <RecordVideoThumbnail thumbnailUri={record.thumbnailUri} />
          ) : (
            <View style={[styles.recordVideoPreview, styles.recordVideoPreviewEmpty]}>
              <Text style={styles.recordVideoPreviewCaption}>{'저장된 영상이 없습니다.'}</Text>
            </View>
          )}

          <View style={styles.liveFeedbackBox}>
            <Text style={styles.liveFeedbackLabel}>{'\uC2E4\uC2DC\uAC04 \uD53C\uB4DC\uBC31'}</Text>
            <Text style={styles.liveFeedbackText}>{syncedFeedback}</Text>
          </View>
        </Pressable>

        <SmallButton title={'\uAE30\uB85D \uC0AD\uC81C'} onPress={() => openDeleteConfirm(record.id)} variant="red" />
      </View>
    );
  }, [
    dailyRecordRanking.best?.record.id,
    dailyRecordRanking.worst?.record.id,
    openDeleteConfirm,
    openRecordEvaluation,
    playbackFeedback,
    recordCardWidth,
  ]);

  const renderRecordEmptyState = useCallback(() => {
    if (!selectedDateKey) {
      return null;
    }

    return (
      <View style={[styles.recordCard, styles.recordCardHorizontal, { width: recordCardWidth }]}>
        <Text style={styles.recordText}>
          {recordFilter === 'all'
            ? '\uC774 \uB0A0\uC9DC\uC5D0 \uC800\uC7A5\uB41C \uB808\uC2A8 \uC601\uC0C1\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.'
            : `\uC774 \uB0A0\uC9DC\uC5D0 \uC800\uC7A5\uB41C ${getRecordFilterLabel(recordFilter)} \uAE30\uB85D\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.`}
        </Text>
      </View>
    );
  }, [recordCardWidth, recordFilter, selectedDateKey]);

  const renderRecordCardItem = useCallback(
    ({ item }: { item: LessonRecord }) => renderRecordCard(item),
    [renderRecordCard]
  );

  const getRecordItemLayout = useCallback(
    (_: ArrayLike<LessonRecord> | null | undefined, index: number) => ({
      length: recordListItemWidth,
      offset: RECORD_LIST_HORIZONTAL_PADDING + recordListItemWidth * index,
      index,
    }),
    [recordListItemWidth]
  );

  const renderRecordList = useCallback(
    () => (
      <FlatList
        horizontal
        nestedScrollEnabled
        data={recordListData}
        extraData={recordListExtraData}
        renderItem={renderRecordCardItem}
        keyExtractor={(item) => item.id}
        getItemLayout={getRecordItemLayout}
        style={styles.recordsScroll}
        contentContainerStyle={styles.recordsScrollContent}
        showsHorizontalScrollIndicator
        ListEmptyComponent={renderRecordEmptyState}
        initialNumToRender={2}
        maxToRenderPerBatch={2}
        windowSize={3}
        updateCellsBatchingPeriod={16}
      />
    ),
    [getRecordItemLayout, recordListData, recordListExtraData, renderRecordCardItem, renderRecordEmptyState]
  );

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
            <Text style={styles.dateSelectorText}>
              {selectedDateKey || formatDateKey(selectedDate)}
            </Text>
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
                <View style={[styles.skillInsightStatCard, styles.skillInsightEmptyCard]}>
                  <Text style={styles.skillInsightText}>{'\uB0A0\uC9DC\uB97C \uC120\uD0DD\uD558\uBA74 \uAE30\uB85D \uD574\uC11D\uC744 \uBCFC \uC218 \uC788\uC2B5\uB2C8\uB2E4.'}</Text>
                </View>
              ) : (
                <>
                  <View style={styles.skillInsightStats}>
                    {diarySkillInsight.canShowDailySummary ? (
                      <View style={styles.dailySummarySection}>
                        <Pressable
                          onPress={() => setShowDailySummary((current) => !current)}
                          style={({ pressed }) => [styles.dailySummaryToggle, pressed && styles.pressed]}
                        >
                          <View style={styles.dailySummaryToggleTextWrap}>
                            <Text style={styles.dailySummaryToggleText}>
                              {getDailySummaryToggleHeadline(diarySkillInsight)}
                            </Text>
                            <Text style={styles.dailySummaryToggleSubtext}>{dailySummaryCorrectionText}</Text>
                            {!showDailySummary ? (
                              <Text style={styles.dailySummaryToggleHint}>{'\uB354 \uBCF4\uAE30'}</Text>
                            ) : null}
                          </View>
                        </Pressable>

                        {showDailySummary ? (
                          <>
                            <View style={[styles.skillInsightStatCard, styles.dailySummaryCard]}>
                            <View style={styles.summaryBoardRow}>
                              <Text style={styles.summaryBoardLabel}>{'\uC5F0\uC2B5\uB7C9'}</Text>
                              <Text style={styles.summaryBoardValue}>
                                {getDailySummaryPracticeText(diarySkillInsight, selectedDateDribbleCount)}
                              </Text>
                            </View>
                            <View style={styles.summaryBoardRow}>
                              <Text style={styles.summaryBoardLabel}>{'\uC29B \uC131\uACF5\uB960'}</Text>
                              <Text style={[styles.summaryBoardValue, styles.summaryBoardValueSuccessRate]}>
                                {getDailySummaryShotText(diarySkillInsight)}
                              </Text>
                            </View>
                            <View style={styles.summaryBoardRow}>
                              <Text style={styles.summaryBoardLabel}>{'\uB4DC\uB9AC\uBE14 \uADE0\uD615'}</Text>
                              <Text style={styles.summaryBoardValue}>
                                {getDailySummaryDribbleText(diarySkillInsight, selectedDateDribbleCount)}
                              </Text>
                            </View>
                            </View>

                            <Pressable
                              onPress={() => setShowDailySummary(false)}
                              style={({ pressed }) => [styles.dailySummaryCollapseButton, pressed && styles.pressed]}
                            >
                              <Text style={styles.dailySummaryCollapseText}>{'\uC811\uAE30'}</Text>
                            </Pressable>
                          </>
                        ) : null}
                      </View>
                    ) : null}

                    <View style={[styles.skillInsightStatCard, styles.skillInsightShotCard]}>
                      <View style={styles.skillInsightShotHeader}>
                        <View style={styles.skillInsightShotTitleWrap}>
                          <Text style={styles.skillInsightStatLabel}>{'\uC131\uACF5\uB960 \uBE44\uAD50'}</Text>
                          {!selectedDateKey ? (
                            <Text style={styles.skillInsightStatHelper}>
                              {`\uB0A0\uC9DC\uB97C \uC120\uD0DD\uD558\uBA74 \uC2DC\uB3C4 ${SUCCESS_RATE_COMPARE_MIN_ATTEMPTS}\uD68C \uC774\uC0C1 \uAE30\uB85D\uC758 \uC131\uACF5\uB960 \uBE44\uAD50 \uADF8\uB798\uD504\uB97C \uBCFC \uC218 \uC788\uC2B5\uB2C8\uB2E4.`}
                            </Text>
                          ) : null}
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
                        {getDribbleBalanceHeadline(diarySkillInsight, dribbleGraphTotal)}
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
                          <Text style={styles.dribbleBalanceLegendText}>
                            {`\uC67C\uC190 ${diarySkillInsight.leftDribbleCount}\uD68C`}
                          </Text>
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
                          <Text style={styles.dribbleBalanceLegendText}>
                            {`\uC624\uB978\uC190 ${diarySkillInsight.rightDribbleCount}\uD68C`}
                          </Text>
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
                    </View>
                  </View>
                </>
              )}
            </View>
          </View>

          <View style={[styles.recordsColumn, isWide && styles.recordsColumnWide]}>
            <View style={styles.recordFilterHeaderRow}>
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

              {selectedDateKey ? renderEvaluationCountSummary(diarySkillInsight) : null}
            </View>

            {isWide ? (
              <View style={styles.recordsPanel}>
                {renderRecordList()}
              </View>
            ) : (
              renderRecordList()
            )}
          </View>
        </View>
      </View>

      {menuOpenSpacerHeight > 0 ? <View style={[styles.menuOpenSpacer, { height: menuOpenSpacerHeight }]} /> : null}

      <Modal
        visible={openedEvaluationRecord !== null}
        transparent
        animationType="slide"
        hardwareAccelerated
        statusBarTranslucent
        onRequestClose={closeRecordEvaluation}
      >
        <View style={[styles.modalOverlay, styles.recordEvaluationModalOverlay]}>
          <Pressable
            style={styles.modalBackdropPressable}
            onPress={closeRecordEvaluation}
          />
          <View style={[styles.modalCard, styles.recordEvaluationModalCard]}>
            <View style={styles.recordEvaluationHeader}>
              <Pressable
                onPress={closeRecordEvaluation}
                style={({ pressed }) => [styles.recordEvaluationBackButton, pressed && styles.pressed]}
              >
                <Text style={styles.recordEvaluationBackButtonText}>{'<'}</Text>
              </Pressable>
              <View style={styles.recordEvaluationHeaderTitleWrap}>
                <Text style={styles.recordEvaluationModalTitle}>{'\uAE30\uB85D \uD3C9\uAC00'}</Text>
              </View>
            </View>

            {openedEvaluationRecord ? (
              <ScrollView
                style={[styles.recordEvaluationScroll, styles.recordEvaluationLayout]}
                contentContainerStyle={styles.recordEvaluationScrollContent}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.recordEvaluationMediaSection}>
                  <View style={styles.recordHeader}>
                    <View style={styles.recordTitleRow}>
                      <Text style={styles.recordTitle}>{getRecordTitle(openedEvaluationRecord.mode)}</Text>
                    </View>

                    {renderRecordLevelBadge(openedEvaluationRecord.evaluation?.level)}
                  </View>

                  <Text style={styles.recordMeta}>{openedEvaluationRecord.createdAt}</Text>

                  {openedEvaluationVideoSource ? (
                    <RecordEvaluationVideoPlayer
                      recordId={openedEvaluationRecord.id}
                      source={openedEvaluationVideoSource}
                      height={recordEvaluationVideoHeight}
                      videoRef={evaluationVideoRef}
                      onPlaybackStatusUpdate={handleOpenedEvaluationPlaybackStatus}
                    />
                  ) : null}
                </View>

                <View style={styles.recordEvaluationDetailSection}>
                  {selectedImprovementInsight?.recordId === openedEvaluationRecord.id ? (
                    <View style={styles.selectedImprovementBox}>
                      <Text style={[styles.selectedImprovementLabel, styles.highlightButtonLabelBad]}>
                        {selectedImprovementInsight.label}
                      </Text>
                      <Text style={styles.selectedImprovementDetail}>{selectedImprovementInsight.detail}</Text>
                    </View>
                  ) : null}

                  {renderRecordEvaluationContent(openedEvaluationRecord)}

                  <View style={styles.liveFeedbackBox}>
                    <Text style={styles.liveFeedbackLabel}>{'\uC2E4\uC2DC\uAC04 \uD53C\uB4DC\uBC31'}</Text>
                    <Text style={styles.liveFeedbackText}>
                      {getReadableDiaryFeedback(
                        openedEvaluationRecord,
                        playbackFeedback[openedEvaluationRecord.id] || openedEvaluationRecord.feedback
                      )}
                    </Text>
                  </View>

                  <SmallButton
                    title={'\uAE30\uB85D \uC0AD\uC81C'}
                    onPress={() => openDeleteConfirm(openedEvaluationRecord.id)}
                    variant="red"
                  />
                </View>
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>

      <Modal
        visible={pendingDeleteRecordId !== null}
        transparent
        animationType="fade"
        onRequestClose={closeDeleteConfirm}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdropPressable}
            onPress={closeDeleteConfirm}
          />
          <View style={[styles.modalCard, styles.deleteConfirmModalCard]}>
            <Text style={styles.deleteConfirmTitle}>{'\uAE30\uB85D\uC744 \uC0AD\uC81C\uD560\uAE4C\uC694?'}</Text>
            <Text style={styles.deleteConfirmDescription}>
              {'\uC0AD\uC81C\uD558\uBA74 \uB2E4\uC2DC \uB418\uB3CC\uB9B4 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.'}
            </Text>
            <View style={styles.deleteConfirmActions}>
              <Pressable
                onPress={closeDeleteConfirm}
                style={({ pressed }) => [styles.deleteConfirmButton, styles.deleteConfirmCancelButton, pressed && styles.pressed]}
              >
                <Text style={styles.deleteConfirmCancelText}>{'\uC544\uB2C8\uC624'}</Text>
              </Pressable>
              <Pressable
                onPress={confirmDeleteRecord}
                style={({ pressed }) => [styles.deleteConfirmButton, styles.deleteConfirmSubmitButton, pressed && styles.pressed]}
              >
                <Text style={styles.deleteConfirmSubmitText}>{'\uC608'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showCalendarModal} transparent animationType="fade" onRequestClose={() => setShowCalendarModal(false)}>
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdropPressable}
            onPress={() => setShowCalendarModal(false)}
          />
          <View style={[styles.modalCard, styles.calendarModalCard]}>
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
    backgroundColor: DIARY_NEUTRAL_SURFACE,
    borderWidth: 1,
    borderColor: DIARY_NEUTRAL_BORDER,
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
    backgroundColor: DIARY_NEUTRAL_SURFACE_ALT,
    borderWidth: 1,
    borderColor: DIARY_NEUTRAL_BORDER,
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
    marginBottom: 12,
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
    overflow: 'hidden',
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderColor: DIARY_NEUTRAL_BORDER,
  },
  dayName: {
    width: '14.2857%',
    minHeight: 36,
    borderRadius: 0,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: DIARY_NEUTRAL_BORDER,
  },
  dayNameText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  dayCell: {
    width: '14.2857%',
    minHeight: 66,
    borderRadius: 0,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: DIARY_NEUTRAL_BORDER,
  },
  dayCellEmpty: {
    opacity: 1,
    backgroundColor: 'transparent',
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
    marginTop: 12,
    marginBottom: 8,
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
  menuOpenSpacer: {
    width: '100%',
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
    backgroundColor: 'transparent',
    borderRadius: 0,
    padding: 0,
    gap: 14,
  },
  skillInsightText: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 22,
  },
  skillInsightStats: {
    gap: 14,
  },
  skillInsightStatCard: {
    borderRadius: 18,
    padding: 16,
    backgroundColor: DIARY_NEUTRAL_SURFACE,
    borderWidth: 0,
    borderColor: 'transparent',
  },
  skillInsightEmptyCard: {
    minHeight: 88,
    justifyContent: 'center',
  },
  dailySummarySection: {
    gap: 12,
    borderRadius: 18,
    padding: 16,
    backgroundColor: DIARY_NEUTRAL_SURFACE,
  },
  dailySummaryToggle: {
    width: '100%',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 0,
    paddingVertical: 0,
    borderRadius: 0,
    backgroundColor: 'transparent',
  },
  dailySummaryToggleTextWrap: {
    gap: 6,
  },
  dailySummaryToggleText: {
    color: colors.text,
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '800',
  },
  dailySummaryToggleSubtext: {
    color: colors.textSoft,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '700',
  },
  dailySummaryToggleHint: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  dailySummaryCollapseButton: {
    alignSelf: 'flex-start',
    paddingTop: 2,
  },
  dailySummaryCollapseText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  dailySummaryCard: {
    borderRadius: 0,
    padding: 0,
    backgroundColor: 'transparent',
    gap: 10,
  },
  summaryBoardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  summaryBoardLabel: {
    width: 78,
    color: colors.textSoft,
    fontSize: 12,
    lineHeight: 20,
    fontWeight: '800',
  },
  summaryBoardValue: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '800',
  },
  summaryBoardValueSuccessRate: {
    color: '#32cd32',
  },
  skillInsightShotCard: {
    gap: 10,
    padding: 14,
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
    backgroundColor: DIARY_NEUTRAL_SURFACE_ALT,
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
    backgroundColor: DIARY_NEUTRAL_SURFACE,
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
    backgroundColor: DIARY_NEUTRAL_ACTIVE,
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
    gap: 10,
  },
  successRateComparePanel: {
    borderRadius: 0,
    paddingHorizontal: 0,
    paddingTop: 8,
    paddingBottom: 0,
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderColor: 'transparent',
  },
  successRateCompareChart: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
    minHeight: 204,
  },
  successRateCompareGuide: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  successRateCompareGuideTop: {
    top: 38,
  },
  successRateCompareGuideMiddle: {
    top: 80,
  },
  successRateCompareGuideBottom: {
    top: 122,
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
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 4,
  },
  successRateCompareTrack: {
    width: '100%',
    maxWidth: 58,
    height: SUCCESS_RATE_COMPARE_TRACK_HEIGHT,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  successRateCompareFill: {
    width: '100%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
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
    fontSize: 12,
    fontWeight: '900',
    marginTop: 8,
    textAlign: 'center',
  },
  successRateCompareDetail: {
    color: colors.textSoft,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 3,
    textAlign: 'center',
  },
  successRateCompareMeta: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 4,
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
  skillInsightHeadline: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '700',
    marginTop: 2,
  },
  skillInsightNarration: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '500',
    marginTop: 2,
  },
  skillInsightNarrationEmphasis: {
    fontWeight: '900',
    color: colors.text,
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
    overflow: 'visible',
  },
  recordsColumnWide: {
    width: '100%',
    minHeight: 760,
  },
  recordFilterHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  recordFilterWrap: {
    position: 'relative',
    alignSelf: 'flex-start',
    minWidth: 170,
    zIndex: 20,
  },
  recordFilterCountsText: {
    color: colors.textSoft,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '800',
    flexShrink: 1,
  },
  recordFilterCountsSpacer: {
    color: colors.textMuted,
  },
  recordFilterCountBad: {
    color: '#d46d75',
  },
  recordFilterCountAverage: {
    color: '#d9a16e',
  },
  recordFilterCountGood: {
    color: '#57c26a',
  },
  recordFilterChipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  recordFilterChip: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: DIARY_NEUTRAL_SURFACE,
  },
  recordFilterChipActive: {
    backgroundColor: DIARY_NEUTRAL_ACTIVE,
  },
  recordFilterChipText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
  },
  recordFilterChipTextActive: {
    color: colors.text,
  },
  recordFilterDropdown: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: DIARY_NEUTRAL_SURFACE,
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
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 8,
    borderRadius: 14,
    padding: 6,
    backgroundColor: DIARY_NEUTRAL_SURFACE,
    borderWidth: 0,
    borderColor: 'transparent',
    gap: 4,
    zIndex: 30,
    elevation: 12,
  },
  recordFilterMenuItem: {
    borderRadius: 0,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  recordFilterMenuItemActive: {
    backgroundColor: DIARY_NEUTRAL_ACTIVE,
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
    backgroundColor: DIARY_NEUTRAL_SURFACE,
    borderWidth: 0,
    borderColor: 'transparent',
    zIndex: 0,
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
    position: 'relative',
    backgroundColor: 'rgba(0,0,0,0.62)',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 28,
  },
  modalBackdropPressable: {
    ...StyleSheet.absoluteFillObject,
  },
  recordEvaluationModalOverlay: {
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  modalCard: {
    maxHeight: '88%',
    borderRadius: 18,
    padding: 20,
    backgroundColor: DIARY_NEUTRAL_SURFACE_SOFT,
    borderWidth: 1,
    borderColor: DIARY_NEUTRAL_BORDER,
  },
  calendarModalCard: {
    maxWidth: 960,
    width: '100%',
    alignSelf: 'center',
    paddingTop: 16,
    paddingBottom: 12,
  },
  recordEvaluationModalCard: {
    maxWidth: '100%',
    maxHeight: '100%',
    width: '100%',
    height: '100%',
    alignSelf: 'stretch',
    borderRadius: 0,
    borderWidth: 0,
    paddingTop: 16,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  deleteConfirmModalCard: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    gap: 16,
  },
  deleteConfirmTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
  },
  deleteConfirmDescription: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
  deleteConfirmActions: {
    flexDirection: 'row',
    gap: 10,
  },
  deleteConfirmButton: {
    flex: 1,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 0,
  },
  deleteConfirmCancelButton: {
    backgroundColor: DIARY_NEUTRAL_SURFACE,
  },
  deleteConfirmSubmitButton: {
    backgroundColor: 'rgba(191,80,88,0.18)',
  },
  deleteConfirmCancelText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  deleteConfirmSubmitText: {
    color: '#d46d75',
    fontSize: 14,
    fontWeight: '900',
  },
  recordEvaluationHeader: {
    position: 'relative',
    minHeight: 44,
    justifyContent: 'center',
  },
  recordEvaluationHeaderTitleWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 64,
  },
  recordEvaluationModalTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
  },
  recordEvaluationBackButton: {
    position: 'absolute',
    left: 0,
    top: 0,
    minWidth: 48,
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DIARY_NEUTRAL_SURFACE_SOFT,
    borderWidth: 0,
    borderColor: 'transparent',
  },
  recordEvaluationBackButtonText: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 22,
  },
  recordEvaluationLayout: {
    marginTop: 16,
    gap: 16,
    flexShrink: 1,
  },
  recordEvaluationMediaSection: {
    gap: 14,
  },
  recordEvaluationScroll: {
    flexShrink: 1,
  },
  recordEvaluationScrollContent: {
    paddingBottom: 8,
    gap: 16,
  },
  recordEvaluationDetailSection: {
    gap: 14,
  },
  recordEvaluationBody: {
    gap: 14,
  },
  recordEvaluationVideo: {
    width: '100%',
    height: 260,
    borderRadius: 0,
    backgroundColor: '#000',
  },
  recordEvaluationVideoSection: {
    gap: 10,
  },
  recordEvaluationControls: {
    gap: 8,
  },
  recordEvaluationControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  recordEvaluationPlayButton: {
    backgroundColor: DIARY_NEUTRAL_SURFACE_SOFT,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  recordEvaluationPlayButtonText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  recordEvaluationTimeText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  recordEvaluationSeekTrackWrap: {
    paddingVertical: 6,
  },
  recordEvaluationSeekTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
    overflow: 'visible',
  },
  recordEvaluationSeekTrackFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.textAccent,
  },
  recordEvaluationSeekThumb: {
    position: 'absolute',
    top: '50%',
    width: 16,
    height: 16,
    marginLeft: -8,
    marginTop: -8,
    borderRadius: 999,
    backgroundColor: colors.textAccent,
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
    backgroundColor: DIARY_NEUTRAL_SURFACE_ALT,
    borderWidth: 1,
    borderColor: DIARY_NEUTRAL_BORDER,
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
    backgroundColor: DIARY_NEUTRAL_SURFACE,
    borderRadius: 0,
    padding: 14,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  recordCardHorizontal: {
    flexShrink: 0,
  },
  recordCardShoot: {
    borderColor: DIARY_NEUTRAL_BORDER,
    backgroundColor: DIARY_NEUTRAL_SURFACE,
  },
  recordCardDribble: {
    borderColor: DIARY_NEUTRAL_BORDER,
    backgroundColor: DIARY_NEUTRAL_SURFACE,
  },
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 8,
  },
  recordTitlePressable: {
    flex: 1,
    minWidth: 0,
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
  recordRankingMarker: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  recordRankingMarkerBest: {
    color: '#57c26a',
  },
  recordRankingMarkerWorst: {
    color: '#d46d75',
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
    color: colors.textMuted,
    fontSize: 13,
    marginBottom: 10,
  },
  recordBodyPressable: {
    gap: 0,
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
    backgroundColor: DIARY_NEUTRAL_SURFACE_ALT,
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
    backgroundColor: DIARY_NEUTRAL_SURFACE_ALT,
    borderWidth: 1,
    borderColor: DIARY_NEUTRAL_BORDER,
    gap: 4,
  },
  evaluationDropdownMenuItem: {
    borderRadius: 0,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  evaluationDropdownMenuItemActive: {
    backgroundColor: DIARY_NEUTRAL_ACTIVE,
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
    backgroundColor: DIARY_NEUTRAL_SURFACE_ALT,
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
    backgroundColor: DIARY_NEUTRAL_SURFACE_ALT,
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
  criteriaList: {
    gap: 10,
  },
  criteriaListItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  criteriaListBadge: {
    minWidth: 96,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 0,
  },
  criteriaListBadgeStable: {
    backgroundColor: 'rgba(50,205,50,0.12)',
  },
  criteriaListBadgeUnstable: {
    backgroundColor: 'rgba(191,80,88,0.12)',
  },
  criteriaListBadgeText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'center',
  },
  criteriaListTextWrap: {
    flex: 1,
    gap: 3,
    paddingTop: 1,
  },
  criteriaListStatus: {
    fontSize: 12,
    fontWeight: '900',
  },
  criteriaListStatusStable: {
    color: '#57c26a',
  },
  criteriaListStatusUnstable: {
    color: '#d46d75',
  },
  criteriaListDescription: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
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
  improvementTriggerButton: {
    paddingVertical: 4,
    paddingHorizontal: 0,
    alignSelf: 'flex-start',
  },
  highlightButtonLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  highlightButtonLabelBad: {
    color: '#d46d75',
  },
  highlightButtonDetail: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  selectedImprovementBox: {
    backgroundColor: DIARY_NEUTRAL_SURFACE_ALT,
    borderRadius: 0,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 6,
  },
  selectedImprovementLabel: {
    fontSize: 13,
    fontWeight: '900',
  },
  selectedImprovementDetail: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  highlightEmptyText: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  recordVideoPreview: {
    width: '100%',
    height: 260,
    borderRadius: 0,
    backgroundColor: '#111111',
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  recordVideoPreviewEmpty: {
    backgroundColor: '#161616',
  },
  recordVideoPreviewImage: {
    width: '100%',
    height: 260,
    marginBottom: 12,
    backgroundColor: '#111111',
  },
  recordVideoPreviewCaption: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  recordVideo: {
    width: '100%',
    height: 260,
    borderRadius: 0,
    backgroundColor: '#111111',
    marginBottom: 12,
  },
  recordText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 22,
  },
  liveFeedbackBox: {
    backgroundColor: DIARY_NEUTRAL_SURFACE_ALT,
    borderRadius: 0,
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
