import { type AVPlaybackStatus, ResizeMode, Video } from 'expo-av';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SmallButton } from '../components/common/Buttons';
import { Card } from '../components/common/Card';
import { DAY_NAMES } from '../constants/content';
import { colors } from '../theme/colors';
import type { CalendarCell, DiarySkillInsight, FeedbackMoment, LessonRecord, ShotGraphDatum } from '../types/app';
import { formatDateKey, formatMonthTitle } from '../utils/date';

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
  onToggleShotOutcome: (recordId: string) => void;
  onDeleteRecord: (recordId: string) => void;
}

type RecordFilter = 'all' | 'dribble' | 'shoot' | 'shootSuccess';

function getRecordTitle(mode: LessonRecord['mode']) {
  return mode === 'shoot' ? '슛 분석' : '드리블 분석';
}

function getRecordModeLabel(mode: LessonRecord['mode']) {
  return mode === 'shoot' ? '슛 레슨' : '드리블 레슨';
}

function getShotOutcomeLabel(shotOutcome: LessonRecord['shotOutcome']) {
  return shotOutcome === 'success' ? '성공' : '실패';
}

function getRecordFilterLabel(filter: RecordFilter) {
  if (filter === 'dribble') {
    return '드리블 분석';
  }

  if (filter === 'shoot') {
    return '슛 분석';
  }

  if (filter === 'shootSuccess') {
    return '슛 성공';
  }

  return '전체';
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

function getRecordLevelLabel(level: NonNullable<LessonRecord['evaluation']>['level']) {
  if (level === 'good') {
    return '좋음';
  }

  if (level === 'average') {
    return '보통';
  }

  return '나쁨';
}

function getShotTrendLabel(trend: DiarySkillInsight['shotTrend'], delta: number | null) {
  if (trend === 'up') {
    return `최근 평균보다 ${Math.abs(delta ?? 0)}% 상승`;
  }

  if (trend === 'down') {
    return `최근 평균보다 ${Math.abs(delta ?? 0)}% 하락`;
  }

  if (trend === 'flat') {
    return '최근 평균과 비슷함';
  }

  if (trend === 'insufficient_history') {
    return '비교할 이전 기록이 더 필요함';
  }

  return '연습 기준을 채우면 해석 가능';
}

function getDribbleBalanceLabel(insight: DiarySkillInsight) {
  if (insight.dribbleBalance === 'none') {
    return '좌우 드리블 기록 없음';
  }

  if (insight.dribbleBalance === 'balanced') {
    return `좌우 균형 좋음 (차이 ${insight.dribbleBalanceGap}회)`;
  }

  return insight.dribbleBalance === 'left'
    ? `왼손 드리블이 ${insight.dribbleBalanceGap}회 더 많음`
    : `오른손 드리블이 ${insight.dribbleBalanceGap}회 더 많음`;
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
  onToggleShotOutcome,
  onDeleteRecord,
}: DiaryScreenProps) {
  const { width } = useWindowDimensions();
  const isWide = width >= 980;
  const isCompactMobile = width < 640;
  const [playbackFeedback, setPlaybackFeedback] = useState<Record<string, string>>({});
  const [showAllShotGraph, setShowAllShotGraph] = useState(false);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [recordFilter, setRecordFilter] = useState<RecordFilter>('all');
  const [showRecordFilterMenu, setShowRecordFilterMenu] = useState(false);
  const videoRefs = useRef<Record<string, Video | null>>({});
  const playbackPollersRef = useRef<Record<string, ReturnType<typeof setInterval>>>({});
  const selectedShotGraph = useMemo(
    () => shotGraphData.find((item) => item.dateKey === selectedDateKey) ?? null,
    [selectedDateKey, shotGraphData]
  );
  const practiceShootThreshold = diarySkillInsight.practiceThresholds.shootAttemptCount;
  const graphMaxValue = useMemo(
    () => Math.max(1, selectedShotGraph?.attempts ?? 0, selectedShotGraph?.successes ?? 0),
    [selectedShotGraph]
  );
  const allShotGraphData = useMemo(
    () => shotGraphData.filter((item) => item.attempts >= practiceShootThreshold),
    [practiceShootThreshold, shotGraphData]
  );
  const allGraphChartWidth = useMemo(() => Math.max(320, allShotGraphData.length * 86 + 48), [allShotGraphData.length]);
  const selectedDate = useMemo(() => (selectedDateKey ? parseDateKeyToDate(selectedDateKey) : new Date()), [selectedDateKey]);
  const selectedDateAttendance = useMemo(() => {
    const selectedCell = calendarCells.find((cell) => cell.type === 'day' && cell.dateKey === selectedDateKey);

    if (!selectedCell || selectedCell.type !== 'day') {
      return { icon: '•', label: '미체크', isDefault: true };
    }

    if (selectedCell.variant === 'attended') {
      return { icon: '✅', label: '출석', isDefault: false };
    }

    if (selectedCell.variant === 'absent') {
      return { icon: '❌', label: '결석', isDefault: false };
    }

    return { icon: '•', label: '미체크', isDefault: true };
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

  function renderRecordCard(record: LessonRecord) {
    const syncedFeedback = playbackFeedback[record.id] || record.feedback;
    const evaluation = record.evaluation;

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
              <Text style={styles.shotOutcomeToggleLabel}>슛 결과</Text>
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

        {evaluation ? (
          <View style={styles.evaluationBox}>
            <Text style={styles.evaluationTitle}>기록 평가</Text>
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
                  <Text style={styles.criterionChipValue}>{criterion.isStable ? '안정' : '보완'}</Text>
                </View>
              ))}
            </View>

            <View style={styles.highlightGroup}>
              <Text style={styles.highlightGroupTitle}>잘한 점 다시보기</Text>
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
                <Text style={styles.highlightEmptyText}>아직 표시할 안정 장면이 없습니다.</Text>
              )}
            </View>

            <View style={styles.highlightGroup}>
              <Text style={styles.highlightGroupTitle}>보완할 점 다시보기</Text>
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
                <Text style={styles.highlightEmptyText}>지금은 추가 보완 장면이 없습니다.</Text>
              )}
            </View>
          </View>
        ) : (
          <View style={styles.evaluationEmptyBox}>
            <Text style={styles.evaluationEmptyText}>자세 평가 정보는 새로 저장한 기록부터 함께 표시됩니다.</Text>
          </View>
        )}

        <View style={styles.liveFeedbackBox}>
          <Text style={styles.liveFeedbackLabel}>영상과 함께 보는 실시간 피드백</Text>
          <Text style={styles.liveFeedbackText}>{syncedFeedback}</Text>
        </View>

        <SmallButton title="기록 삭제" onPress={() => onDeleteRecord(record.id)} variant="red" />
      </View>
    );
  }


  return (
    <Card title="기록일지" style={styles.diaryCard}>
      <View style={[styles.dateSelectorRow, isCompactMobile && styles.dateSelectorRowCompact]}>
        <View
          style={[
            styles.dateStatusBadge,
            selectedDateAttendance.isDefault && styles.dateStatusBadgeDefault,
            isCompactMobile && styles.dateStatusBadgeCompact,
          ]}
        >
          <Text style={styles.dateStatusText}>
            {selectedDateAttendance.icon} {selectedDateAttendance.label}
          </Text>
        </View>

        {isCompactMobile ? (
          <View style={styles.dateCalendarButtonWrap}>
            <SmallButton title="달력" onPress={() => setShowCalendarModal(true)} variant="dark" />
          </View>
        ) : null}

        <View style={[styles.dateSelectorMain, isCompactMobile && styles.dateSelectorMainCompact]}>
          <Pressable onPress={() => moveSelectedDate(-1)} style={({ pressed }) => [styles.dateArrowButton, pressed && styles.pressed]}>
            <DateArrowIcon direction="left" />
          </Pressable>
          <Text style={styles.dateSelectorText}>{selectedDateKey || formatDateKey(selectedDate)}</Text>
          <Pressable onPress={() => moveSelectedDate(1)} style={({ pressed }) => [styles.dateArrowButton, pressed && styles.pressed]}>
            <DateArrowIcon direction="right" />
          </Pressable>
        </View>

        {!isCompactMobile ? <SmallButton title="달력" onPress={() => setShowCalendarModal(true)} variant="dark" /> : null}
      </View>

      <View style={styles.recordsSection}>
        <Text style={styles.recordsTitle}>
          {selectedDateKey ? `${selectedDateKey} 레슨 기록` : '날짜를 선택하면 레슨 기록을 볼 수 있습니다.'}
        </Text>

        <View style={[styles.contentRow, isWide && styles.contentRowWide]}>
          <View style={[styles.graphColumn, isWide && styles.graphColumnWide]}>
            <View style={styles.skillInsightCard}>
              <Text style={styles.skillInsightTitle}>실력 해석</Text>
              {!selectedDateKey ? (
                <Text style={styles.skillInsightText}>날짜를 선택하면 최근 평균과 비교한 실력 해석을 볼 수 있습니다.</Text>
              ) : (
                <>
                  <Text style={styles.skillInsightText}>
                    {!diarySkillInsight.isPracticeThresholdMet
                      ? `이 날짜는 드리블 ${selectedDateDribbleCount}회, 슛 ${diarySkillInsight.selectedShotAttempts}회로 비교 기준인 드리블 ${diarySkillInsight.practiceThresholds.dribbleCount}회와 슛 ${diarySkillInsight.practiceThresholds.shootAttemptCount}회를 아직 채우지 못했습니다.`
                      : diarySkillInsight.shotTrend === 'insufficient_history'
                        ? '연습 기준은 충족했지만 비교할 이전 기준 기록이 더 필요합니다.'
                        : `슛 성공률이 ${getShotTrendLabel(
                            diarySkillInsight.shotTrend,
                            diarySkillInsight.shotTrendDelta
                          )} 상태입니다.`}
                  </Text>

                  <View style={styles.skillInsightStats}>
                    <View style={[styles.skillInsightStatCard, styles.skillInsightShotCard]}>
                      <View style={styles.skillInsightShotHeader}>
                        <View style={styles.skillInsightShotTitleWrap}>
                          <Text style={styles.skillInsightStatLabel}>오늘 성공률</Text>
                          <Text style={styles.skillInsightStatHelper}>
                            {selectedShotGraph
                              ? `성공 ${diarySkillInsight.selectedShotSuccesses} / 시도 ${diarySkillInsight.selectedShotAttempts}`
                              : selectedDateKey
                                ? '선택한 날짜의 슛 기록이 아직 없습니다.'
                                : '날짜를 선택하면 성공률 그래프를 볼 수 있습니다.'}
                          </Text>
                        </View>

                        <SmallButton title="모든 슛 성공도 보기" onPress={() => setShowAllShotGraph(true)} variant="dark" />
                      </View>

                      {selectedDateKey && selectedShotGraph ? (
                        <View style={styles.skillInsightShotBody}>
                          <View style={styles.graphTopRow}>
                            <View style={styles.graphLegend}>
                              <View style={styles.legendItem}>
                                <View style={[styles.dot, styles.dotAttempt]} />
                                <Text style={styles.legendText}>슛 시도</Text>
                              </View>
                              <View style={styles.legendItem}>
                                <View style={[styles.dot, styles.dotSuccess]} />
                                <Text style={styles.legendText}>슛 성공</Text>
                              </View>
                            </View>
                          </View>

                          <View style={styles.barAreaLarge}>
                            <View style={styles.graphMetricRow}>
                              <View style={styles.graphMetric}>
                                <Text style={styles.graphMetricLabel}>시도</Text>
                                <Text style={styles.graphMetricValue}>{selectedShotGraph.attempts}</Text>
                              </View>
                              <View style={styles.graphMetric}>
                                <Text style={styles.graphMetricLabel}>성공</Text>
                                <Text style={styles.graphMetricValue}>{selectedShotGraph.successes}</Text>
                              </View>
                            </View>

                            <View style={styles.graphBarRateRow}>
                              <View style={styles.overlapBarWrap}>
                                <View style={styles.overlapBarTrack}>
                                  <View
                                    style={[
                                      styles.barLarge,
                                      styles.attemptBar,
                                      styles.overlapAttemptBar,
                                      {
                                        height:
                                          selectedShotGraph.attempts > 0
                                            ? Math.max(20, (selectedShotGraph.attempts / graphMaxValue) * 260)
                                            : 10,
                                      },
                                    ]}
                                  />
                                  <View
                                    style={[
                                      styles.barLarge,
                                      styles.successBar,
                                      styles.overlapSuccessBar,
                                      {
                                        height:
                                          selectedShotGraph.successes > 0
                                            ? Math.max(20, (selectedShotGraph.successes / graphMaxValue) * 260)
                                            : 10,
                                      },
                                    ]}
                                  />
                                </View>
                              </View>

                              <View style={styles.graphRateSide}>
                                <Text style={styles.graphRateSideLabel}>성공률</Text>
                                <Text style={styles.graphRateSideValue}>{selectedShotGraph.successRate}%</Text>
                              </View>
                            </View>
                          </View>
                        </View>
                      ) : (
                        <Text style={styles.graphEmpty}>
                          {selectedDateKey ? '선택한 날짜에는 아직 슛 기록이 없습니다.' : '날짜를 선택하면 그래프가 표시됩니다.'}
                        </Text>
                      )}
                    </View>

                    <View style={styles.skillInsightStatCard}>
                      <Text style={styles.skillInsightStatLabel}>최근 평균</Text>
                      <Text style={styles.skillInsightStatValue}>
                        {diarySkillInsight.recentAverageShotSuccessRate === null
                          ? '-'
                          : `${diarySkillInsight.recentAverageShotSuccessRate}%`}
                      </Text>
                      <Text style={styles.skillInsightStatHelper}>
                        {diarySkillInsight.recentAverageShotAttempts === null
                          ? '이전 기준 기록 없음'
                          : `슛 ${diarySkillInsight.recentAverageShotAttempts}회 / 드리블 ${diarySkillInsight.recentAverageDribbleCount ?? 0}회`}
                      </Text>
                    </View>

                    <View style={styles.skillInsightStatCard}>
                      <Text style={styles.skillInsightStatLabel}>드리블 균형</Text>
                      <Text style={styles.skillInsightStatValue}>
                        {diarySkillInsight.dribbleBalance === 'balanced'
                          ? '균형'
                          : diarySkillInsight.dribbleBalance === 'left'
                            ? '왼손 우세'
                            : diarySkillInsight.dribbleBalance === 'right'
                              ? '오른손 우세'
                              : '-'}
                      </Text>
                      <Text style={styles.skillInsightStatHelper}>
                        {`${getDribbleBalanceLabel(diarySkillInsight)}\n해당 날짜 드리블 횟수: ${selectedDateDribbleCount}회`}
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
                onPress={() => setShowRecordFilterMenu((current) => !current)}
                style={({ pressed }) => [
                  styles.recordFilterDropdown,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.recordFilterDropdownText}>기록 보기: {getRecordFilterLabel(recordFilter)}</Text>
                <Text style={styles.recordFilterDropdownIcon}>{showRecordFilterMenu ? '▲' : '▼'}</Text>
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
                  nestedScrollEnabled
                  style={styles.recordsScroll}
                  contentContainerStyle={styles.recordsScrollContent}
                  showsVerticalScrollIndicator
                >
                  {selectedDateKey && filteredDateRecords.length === 0 ? (
                    <View style={styles.recordCard}>
                      <Text style={styles.recordText}>
                        {recordFilter === 'all'
                          ? '이 날짜에 저장된 레슨 영상이 없습니다.'
                          : `이 날짜에 저장된 ${getRecordFilterLabel(recordFilter)} 기록이 없습니다.`}
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
                        ? '이 날짜에 저장된 레슨 영상이 없습니다.'
                        : `이 날짜에 저장된 ${getRecordFilterLabel(recordFilter)} 기록이 없습니다.`}
                    </Text>
                  </View>
                ) : null}

                {filteredDateRecords.map(renderRecordCard)}
              </>
            )}
          </View>
        </View>
      </View>

      <Modal visible={showCalendarModal} transparent animationType="fade" onRequestClose={() => setShowCalendarModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, styles.calendarModalCard]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>날짜 선택</Text>
              <Pressable
                onPress={() => setShowCalendarModal(false)}
                style={({ pressed }) => [styles.modalCloseButton, pressed && styles.pressed]}
              >
                <Text style={styles.modalCloseText}>닫기</Text>
              </Pressable>
            </View>

            <View style={styles.calendarTop}>
              <SmallButton title="이전 달" onPress={() => onChangeMonth(-1)} variant="dark" />
              <Text style={styles.monthTitle}>{formatMonthTitle(currentDate)}</Text>
              <SmallButton title="다음 달" onPress={() => onChangeMonth(1)} variant="dark" />
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

                const isFireStatus = cell.status.startsWith('🔥');
                const isCheckStatus = cell.status.startsWith('✔️');
                const isEmojiStatus = isFireStatus || isCheckStatus || cell.status === '💧' || cell.status === '🤦‍♂️';
                const isStreakStatus = cell.status.includes('×(');

                return (
                  <Pressable
                    key={cell.key}
                    onPress={() => {
                      onOpenDate(cell.dateKey);
                      setShowCalendarModal(false);
                    }}
                    style={({ pressed }) => [
                      styles.dayCell,
                      cell.variant === 'attended' && styles.dayCellAttended,
                      cell.variant === 'absent' && styles.dayCellAbsent,
                      selectedDateKey === cell.dateKey && styles.dayCellSelected,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.dayNumber}>{cell.date}</Text>
                    <Text
                      style={[
                        styles.dayStatus,
                        isEmojiStatus && styles.dayStatusEmoji,
                        isFireStatus && styles.dayStatusFire,
                        isCheckStatus && styles.dayStatusCheck,
                        isStreakStatus && styles.dayStatusStreak,
                      ]}
                    >
                      {cell.status}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.legend}>
              <View style={styles.legendItem}>
                <Text style={styles.legendEmoji}>🔥</Text>
                <Text style={styles.legendText}>출석</Text>
              </View>
              <View style={styles.legendItem}>
                <Text style={styles.legendEmoji}>💧</Text>
                <Text style={styles.legendText}>결석</Text>
              </View>
              <View style={styles.legendItem}>
                <Text style={styles.legendEmoji}>🤦‍♂️</Text>
                <Text style={styles.legendText}>연속 출석 후 결석</Text>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showAllShotGraph}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAllShotGraph(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>모든 날짜 슛 성공도</Text>
              <Pressable
                onPress={() => setShowAllShotGraph(false)}
                style={({ pressed }) => [styles.modalCloseButton, pressed && styles.pressed]}
              >
                <Text style={styles.modalCloseText}>닫기</Text>
              </Pressable>
            </View>

            <Text style={styles.modalDescription}>
              가로축은 날짜, 세로축은 각 날짜의 슛 성공률입니다. 막대를 보면 날짜별 성공도를 한눈에 비교할 수 있습니다.
            </Text>

            {allShotGraphData.length === 0 ? (
              <Text style={styles.graphEmpty}>슛 시도 횟수가 {practiceShootThreshold}회 이상인 날짜만 그래프에 표시됩니다.</Text>
            ) : (
              <>
                <View style={styles.modalGuideLegend}>
                  <View style={styles.modalGuideItem}>
                    <View style={styles.modalGuideLine} />
                    <Text style={styles.legendText}>성공률 기준선</Text>
                  </View>
                  <View style={styles.modalGuideItem}>
                    <View style={styles.modalGuideBar} />
                    <Text style={styles.legendText}>날짜별 성공률</Text>
                  </View>
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.allGraphScroll}>
                  <View style={[styles.allGraphArea, { width: allGraphChartWidth }]}>
                    <View style={styles.allGraphGuideTop}>
                      <Text style={styles.allGraphGuideText}>100%</Text>
                    </View>
                    <View style={styles.allGraphGuideUpper}>
                      <Text style={styles.allGraphGuideText}>75%</Text>
                    </View>
                    <View style={styles.allGraphGuideMiddle}>
                      <Text style={styles.allGraphGuideText}>50%</Text>
                    </View>
                    <View style={styles.allGraphGuideLower}>
                      <Text style={styles.allGraphGuideText}>25%</Text>
                    </View>
                    <View style={styles.allGraphGuideBottom}>
                      <Text style={styles.allGraphGuideText}>0%</Text>
                    </View>

                    {allShotGraphData.map((item, index) => {
                      const left = 40 + index * 86;
                      const barHeight = item.successRate > 0 ? Math.max(14, (item.successRate / 100) * 220) : 10;

                      return (
                        <View key={item.dateKey} style={[styles.allGraphBarWrap, { left }]}>
                          <Text style={styles.allGraphBarValue}>{item.successRate}%</Text>
                          <View style={[styles.allGraphBar, { height: barHeight }]} />
                          <Text style={styles.allGraphAxisLabel}>{item.dateKey.slice(5)}</Text>
                        </View>
                      );
                    })}
                  </View>
                </ScrollView>
              </>
            )}
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
    justifyContent: 'center',
    gap: 10,
    width: 320,
    maxWidth: '100%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.surfaceStrong,
  },
  dateSelectorMainCompact: {
    width: '100%',
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
  dateStatusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(208,145,85,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(208,145,85,0.28)',
  },
  dateStatusBadgeCompact: {
    alignSelf: 'flex-start',
  },
  dateStatusBadgeDefault: {
    backgroundColor: colors.surfaceStrong,
    borderColor: colors.border,
  },
  dateStatusText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
  },
  dateSelectorText: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
    minWidth: 0,
    flexShrink: 1,
  },
  dateCalendarButtonWrap: {
    alignSelf: 'flex-end',
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
  dayCellAttended: {
    backgroundColor: colors.green,
  },
  dayCellAbsent: {
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
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  graphColumn: {
    width: '100%',
    gap: 12,
  },
  graphColumnWide: {
    width: 340,
    flexShrink: 0,
  },
  skillInsightCard: {
    backgroundColor: colors.surfaceStrong,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  skillInsightTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
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
    borderWidth: 1,
    borderColor: colors.border,
  },
  skillInsightShotCard: {
    gap: 12,
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
    minWidth: 180,
  },
  skillInsightShotBody: {
    gap: 12,
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
    flex: 1,
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
    borderWidth: 1,
    borderColor: colors.border,
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
    borderWidth: 1,
    borderColor: colors.border,
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
    height: 760,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.surfaceStrong,
    borderWidth: 1,
    borderColor: colors.border,
  },
  recordsScroll: {
    flex: 1,
  },
  recordsScrollContent: {
    gap: 14,
    padding: 12,
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
    minHeight: 320,
    justifyContent: 'space-between',
    gap: 16,
  },
  graphMetricRow: {
    width: '100%',
    flexDirection: 'row',
    gap: 12,
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
    fontSize: 24,
    fontWeight: '900',
  },
  graphBarRateRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  overlapBarWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 260,
  },
  graphRateSide: {
    width: 84,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  graphRateSideLabel: {
    color: colors.textSoft,
    fontSize: 12,
    fontWeight: '800',
  },
  graphRateSideValue: {
    color: colors.textAccent,
    fontSize: 30,
    fontWeight: '900',
  },
  overlapBarTrack: {
    width: '100%',
    maxWidth: 180,
    height: 260,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  barColumn: {
    display: 'none',
  },
  barLarge: {
    width: 64,
    borderRadius: 18,
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
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  recordHeaderBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    flex: 1,
  },
  recordBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
  },
  recordBadgeShoot: {
    backgroundColor: 'rgba(255,159,28,0.16)',
    borderColor: 'rgba(255,159,28,0.45)',
  },
  recordBadgeDribble: {
    backgroundColor: 'rgba(80,180,255,0.14)',
    borderColor: 'rgba(80,180,255,0.38)',
  },
  recordBadgeText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
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
    marginBottom: 4,
  },
  recordMeta: {
    color: '#ffd3ad',
    fontSize: 13,
    marginBottom: 10,
  },
  evaluationBox: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
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
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
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
    borderWidth: 1,
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
    borderWidth: 1,
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
    borderWidth: 1,
    borderColor: colors.border,
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
