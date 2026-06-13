import { type AVPlaybackStatus, ResizeMode, Video } from 'expo-av';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SmallButton } from '../components/common/Buttons';
import { Card } from '../components/common/Card';
import { DAY_NAMES } from '../constants/content';
import { colors } from '../theme/colors';
import type { CalendarCell, FeedbackMoment, LessonRecord, ShotGraphDatum } from '../types/app';
import { formatDateKey, formatMonthTitle } from '../utils/date';

interface DiaryScreenProps {
  currentDate: Date;
  calendarCells: CalendarCell[];
  selectedDateKey: string;
  selectedDateRecords: LessonRecord[];
  selectedDateShotCount: number;
  shotGraphData: ShotGraphDatum[];
  onChangeMonth: (delta: number) => void;
  onOpenDate: (dateKey: string) => void;
  onAdjustShotSuccess: (delta: number) => void;
  onDeleteRecord: (recordId: string) => void;
}

type RecordFilter = 'all' | 'dribble' | 'shoot';

function getRecordTitle(mode: LessonRecord['mode']) {
  return mode === 'shoot' ? '슛 분석' : '드리블 분석';
}

function getRecordModeLabel(mode: LessonRecord['mode']) {
  return mode === 'shoot' ? '슛 레슨' : '드리블 레슨';
}

function getRecordFilterLabel(filter: RecordFilter) {
  if (filter === 'dribble') {
    return '드리블 분석';
  }

  if (filter === 'shoot') {
    return '슛 분석';
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

export function DiaryScreen({
  currentDate,
  calendarCells,
  selectedDateKey,
  selectedDateRecords,
  selectedDateShotCount,
  shotGraphData,
  onChangeMonth,
  onOpenDate,
  onAdjustShotSuccess,
  onDeleteRecord,
}: DiaryScreenProps) {
  const { width } = useWindowDimensions();
  const isWide = width >= 980;
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
  const graphMaxValue = useMemo(
    () => Math.max(1, selectedShotGraph?.attempts ?? 0, selectedShotGraph?.successes ?? 0),
    [selectedShotGraph]
  );
  const allShotGraphData = useMemo(() => shotGraphData.filter((item) => item.attempts >= 10), [shotGraphData]);
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

  return (
    <Card title="기록일지">
      <View style={styles.dateSelectorRow}>
        <View style={[styles.dateStatusBadge, selectedDateAttendance.isDefault && styles.dateStatusBadgeDefault]}>
          <Text style={styles.dateStatusText}>
            {selectedDateAttendance.icon} {selectedDateAttendance.label}
          </Text>
        </View>

        <View style={styles.dateSelectorMain}>
          <Pressable onPress={() => moveSelectedDate(-1)} style={({ pressed }) => [styles.dateArrowButton, pressed && styles.pressed]}>
            <Text style={styles.dateArrowText}>{'<'}</Text>
          </Pressable>
          <Text style={styles.dateSelectorText}>{selectedDateKey || formatDateKey(selectedDate)}</Text>
          <Pressable onPress={() => moveSelectedDate(1)} style={({ pressed }) => [styles.dateArrowButton, pressed && styles.pressed]}>
            <Text style={styles.dateArrowText}>{'>'}</Text>
          </Pressable>
        </View>

        <SmallButton title="달력" onPress={() => setShowCalendarModal(true)} variant="dark" />
      </View>

      <View style={styles.recordsSection}>
        <Text style={styles.recordsTitle}>
          {selectedDateKey ? `${selectedDateKey} 레슨 기록` : '날짜를 선택하면 레슨 기록을 볼 수 있습니다.'}
        </Text>

        <View style={[styles.contentRow, isWide && styles.contentRowWide]}>
          <View style={[styles.graphColumn, isWide && styles.graphColumnWide]}>
            <View style={styles.graphCard}>
              <Text style={styles.graphTitle}>{selectedDateKey ? `${selectedDateKey} 슛 성공도` : '슛 성공도 그래프'}</Text>
              <Text style={styles.graphDescription}>
                {selectedDateKey
                  ? '선택한 날짜의 슛 시도 수와 성공 수를 바로 확인할 수 있습니다.'
                  : '날짜를 선택하면 해당 날짜의 슛 성공도 그래프가 여기에 표시됩니다.'}
              </Text>

              {selectedDateKey && selectedShotGraph ? (
                <>
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

                  <View style={styles.graphSingleWrap}>
                    <Text style={styles.graphRateLarge}>성공률 {selectedShotGraph.successRate}%</Text>
                    <View style={styles.barAreaLarge}>
                      <View style={styles.barColumn}>
                        <Text style={styles.barValue}>{selectedShotGraph.attempts}</Text>
                        <View
                          style={[
                            styles.barLarge,
                            styles.attemptBar,
                            {
                              height:
                                selectedShotGraph.attempts > 0
                                  ? Math.max(18, (selectedShotGraph.attempts / graphMaxValue) * 220)
                                  : 10,
                            },
                          ]}
                        />
                        <Text style={styles.barLabel}>슛 시도</Text>
                      </View>

                      <View style={styles.barColumn}>
                        <Text style={styles.barValue}>{selectedShotGraph.successes}</Text>
                        <View
                          style={[
                            styles.barLarge,
                            styles.successBar,
                            {
                              height:
                                selectedShotGraph.successes > 0
                                  ? Math.max(18, (selectedShotGraph.successes / graphMaxValue) * 220)
                                  : 10,
                            },
                          ]}
                        />
                        <Text style={styles.barLabel}>슛 성공</Text>
                      </View>
                    </View>
                    <Text style={styles.graphDateLarge}>{selectedShotGraph.dateKey.slice(5)}</Text>
                    <View style={styles.shotAdjustRow}>
                      <Text style={styles.graphCount}>슛 성공 기록: {selectedDateShotCount}개</Text>
                      <View style={styles.shotAdjustControls}>
                        <Pressable
                          onPress={() => onAdjustShotSuccess(-1)}
                          disabled={selectedDateShotCount <= 0}
                          style={({ pressed }) => [
                            styles.shotAdjustButton,
                            selectedDateShotCount <= 0 && styles.shotAdjustButtonDisabled,
                            pressed && selectedDateShotCount > 0 && styles.pressed,
                          ]}
                        >
                          <Text style={styles.shotAdjustButtonText}>-</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => onAdjustShotSuccess(1)}
                          disabled={selectedDateShotCount >= selectedShotGraph.attempts}
                          style={({ pressed }) => [
                            styles.shotAdjustButton,
                            selectedDateShotCount >= selectedShotGraph.attempts && styles.shotAdjustButtonDisabled,
                            pressed && selectedDateShotCount < selectedShotGraph.attempts && styles.pressed,
                          ]}
                        >
                          <Text style={styles.shotAdjustButtonText}>+</Text>
                        </Pressable>
                      </View>
                    </View>
                  </View>
                </>
              ) : selectedDateKey ? (
                <Text style={styles.graphEmpty}>선택한 날짜에는 아직 슛 기록이 없습니다.</Text>
              ) : (
                <Text style={styles.graphEmpty}>날짜를 선택하면 그래프가 표시됩니다.</Text>
              )}

              <View style={styles.allGraphButtonRow}>
                <SmallButton title="모든 슛 성공도 보기" onPress={() => setShowAllShotGraph(true)} variant="dark" />
              </View>
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
                  {(['all', 'dribble', 'shoot'] as RecordFilter[]).map((filterOption) => (
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
                          : `이 날짜에 저장된 ${recordFilter === 'shoot' ? '슛 분석' : '드리블 분석'} 영상이 없습니다.`}
                      </Text>
                    </View>
                  ) : null}

                  {filteredDateRecords.map((record) => {
                    const syncedFeedback = playbackFeedback[record.id] || record.feedback;

                    return (
                      <View
                        key={record.id}
                        style={[
                          styles.recordCard,
                          record.mode === 'shoot' ? styles.recordCardShoot : styles.recordCardDribble,
                        ]}
                      >
                        <View style={styles.recordHeader}>
                          <View
                            style={[
                              styles.recordBadge,
                              record.mode === 'shoot' ? styles.recordBadgeShoot : styles.recordBadgeDribble,
                            ]}
                          >
                            <Text style={styles.recordBadgeText}>{getRecordModeLabel(record.mode)}</Text>
                          </View>
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

                        <View style={styles.liveFeedbackBox}>
                          <Text style={styles.liveFeedbackLabel}>영상과 함께 보는 실시간 피드백</Text>
                          <Text style={styles.liveFeedbackText}>{syncedFeedback}</Text>
                        </View>

                        <SmallButton title="기록 삭제" onPress={() => onDeleteRecord(record.id)} variant="red" />
                      </View>
                    );
                  })}
                </ScrollView>
              </View>
            ) : (
              <>
                {selectedDateKey && filteredDateRecords.length === 0 ? (
                  <View style={styles.recordCard}>
                    <Text style={styles.recordText}>
                      {recordFilter === 'all'
                        ? '이 날짜에 저장된 레슨 영상이 없습니다.'
                        : `이 날짜에 저장된 ${recordFilter === 'shoot' ? '슛 분석' : '드리블 분석'} 영상이 없습니다.`}
                    </Text>
                  </View>
                ) : null}

                {filteredDateRecords.map((record) => {
                  const syncedFeedback = playbackFeedback[record.id] || record.feedback;

                  return (
                    <View
                      key={record.id}
                      style={[
                        styles.recordCard,
                        record.mode === 'shoot' ? styles.recordCardShoot : styles.recordCardDribble,
                      ]}
                    >
                      <View style={styles.recordHeader}>
                        <View
                          style={[
                            styles.recordBadge,
                            record.mode === 'shoot' ? styles.recordBadgeShoot : styles.recordBadgeDribble,
                          ]}
                        >
                          <Text style={styles.recordBadgeText}>{getRecordModeLabel(record.mode)}</Text>
                        </View>
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

                      <View style={styles.liveFeedbackBox}>
                        <Text style={styles.liveFeedbackLabel}>영상과 함께 보는 실시간 피드백</Text>
                        <Text style={styles.liveFeedbackText}>{syncedFeedback}</Text>
                      </View>

                      <SmallButton title="기록 삭제" onPress={() => onDeleteRecord(record.id)} variant="red" />
                    </View>
                  );
                })}
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
              <Text style={styles.graphEmpty}>슛 시도 횟수가 10회 이상인 날짜만 그래프에 표시됩니다.</Text>
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
  dateSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 18,
  },
  dateSelectorMain: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    width: 320,
    maxWidth: '100%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  dateArrowButton: {
    width: 38,
    height: 38,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  dateArrowText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  dateStatusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: 'rgba(255,159,28,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,159,28,0.35)',
  },
  dateStatusBadgeDefault: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.1)',
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
    borderRadius: 14,
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
    gap: 14,
  },
  recordsTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  contentRow: {
    gap: 16,
  },
  contentRowWide: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  graphColumn: {
    width: '100%',
  },
  graphColumnWide: {
    width: 340,
    flexShrink: 0,
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
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
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
    borderRadius: 16,
    padding: 6,
    backgroundColor: '#241a14',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    gap: 4,
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
  },
  recordFilterMenuItem: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  recordFilterMenuItemActive: {
    backgroundColor: 'rgba(255,159,28,0.18)',
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
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  recordsScroll: {
    flex: 1,
  },
  recordsScrollContent: {
    gap: 14,
    padding: 12,
  },
  graphCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    minHeight: 430,
  },
  graphTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 8,
  },
  graphDescription: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 12,
  },
  graphLegend: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 12,
  },
  graphSingleWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 290,
  },
  allGraphButtonRow: {
    marginTop: 12,
    alignItems: 'stretch',
  },
  graphRateLarge: {
    color: colors.textAccent,
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 8,
  },
  barAreaLarge: {
    width: '100%',
    minHeight: 280,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.18)',
    paddingHorizontal: 24,
    paddingVertical: 18,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'flex-end',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  barColumn: {
    flex: 1,
    maxWidth: 110,
    alignItems: 'center',
    justifyContent: 'flex-end',
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
  graphDateLarge: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
    marginTop: 14,
  },
  graphCount: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: 4,
  },
  shotAdjustRow: {
    marginTop: 6,
    alignItems: 'center',
    gap: 10,
  },
  shotAdjustControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  shotAdjustButton: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  shotAdjustButtonDisabled: {
    opacity: 0.4,
  },
  shotAdjustButtonText: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
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
    borderRadius: 24,
    padding: 20,
    backgroundColor: '#1a130e',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
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
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
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
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
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
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  recordCardShoot: {
    borderColor: 'rgba(255,159,28,0.5)',
    backgroundColor: 'rgba(255,159,28,0.09)',
  },
  recordCardDribble: {
    borderColor: 'rgba(80,180,255,0.45)',
    backgroundColor: 'rgba(80,180,255,0.08)',
  },
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginBottom: 10,
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
    backgroundColor: 'rgba(0,0,0,0.22)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
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
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
});
