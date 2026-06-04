import { type AVPlaybackStatus, ResizeMode, Video } from 'expo-av';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SmallButton } from '../components/common/Buttons';
import { Card } from '../components/common/Card';
import { DAY_NAMES } from '../constants/content';
import { colors } from '../theme/colors';
import type { CalendarCell, FeedbackMoment, LessonRecord, ShotGraphDatum } from '../types/app';
import { formatMonthTitle } from '../utils/date';

interface DiaryScreenProps {
  currentDate: Date;
  calendarCells: CalendarCell[];
  selectedDateKey: string;
  selectedDateRecords: LessonRecord[];
  selectedDateShotCount: number;
  shotGraphData: ShotGraphDatum[];
  onChangeMonth: (delta: number) => void;
  onOpenDate: (dateKey: string) => void;
  onDeleteRecord: (recordId: string) => void;
}

function getRecordTitle(mode: LessonRecord['mode']) {
  return mode === 'shoot' ? '슛 분석' : '드리블 분석';
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
  onDeleteRecord,
}: DiaryScreenProps) {
  const { width } = useWindowDimensions();
  const isWide = width >= 1080;
  const [playbackFeedback, setPlaybackFeedback] = useState<Record<string, string>>({});
  const [showAllShotGraphModal, setShowAllShotGraphModal] = useState(false);
  const videoRefs = useRef<Record<string, Video | null>>({});
  const playbackPollersRef = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  const selectedShotGraphDatum = useMemo(
    () => shotGraphData.find((item) => item.dateKey === selectedDateKey) ?? null,
    [selectedDateKey, shotGraphData]
  );

  const selectedGraphMaxValue = useMemo(
    () =>
      selectedShotGraphDatum
        ? Math.max(1, selectedShotGraphDatum.attempts, selectedShotGraphDatum.successes)
        : 1,
    [selectedShotGraphDatum]
  );

  const allShotGraphChart = useMemo(() => {
    const chartHeight = 250;
    const chartWidth = Math.max(320, shotGraphData.length * 90);
    const chartPaddingX = 34;
    const chartPaddingTop = 24;
    const chartBottom = chartHeight - 34;
    const usableWidth = Math.max(1, chartWidth - chartPaddingX * 2);
    const usableHeight = Math.max(1, chartBottom - chartPaddingTop - 16);
    const maxAttempts = Math.max(1, ...shotGraphData.map((item) => item.attempts));

    const points = shotGraphData.map((item, index) => {
      const x =
        shotGraphData.length <= 1
          ? chartWidth / 2
          : chartPaddingX + (usableWidth * index) / Math.max(1, shotGraphData.length - 1);
      const y = chartPaddingTop + ((100 - item.successRate) / 100) * usableHeight;
      const barHeight = item.attempts > 0 ? Math.max(10, (item.attempts / maxAttempts) * usableHeight) : 6;

      return {
        ...item,
        shortDate: item.dateKey.slice(5),
        x,
        y,
        barHeight,
        barTop: chartBottom - barHeight,
      };
    });

    const segments = points.slice(0, -1).map((point, index) => {
      const nextPoint = points[index + 1];
      const deltaX = nextPoint.x - point.x;
      const deltaY = nextPoint.y - point.y;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      const angle = (Math.atan2(deltaY, deltaX) * 180) / Math.PI;

      return {
        key: `${point.dateKey}-${nextPoint.dateKey}`,
        width: distance,
        left: (point.x + nextPoint.x) / 2 - distance / 2,
        top: (point.y + nextPoint.y) / 2 - 2,
        angle,
      };
    });

    return {
      chartWidth,
      chartHeight,
      chartBottom,
      points,
      segments,
    };
  }, [shotGraphData]);

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

  const recordContent = (
    <>
      <Text style={styles.recordsTitle}>
        {selectedDateKey ? `${selectedDateKey} 레슨 기록` : '날짜를 선택하면 레슨 기록을 볼 수 있습니다.'}
      </Text>

      {selectedDateKey ? (
        <View style={styles.recordCard}>
          <Text style={styles.recordMeta}>슛 성공 기록: {selectedDateShotCount}개</Text>
        </View>
      ) : null}

      {selectedDateKey && selectedDateRecords.length === 0 ? (
        <View style={styles.recordCard}>
          <Text style={styles.recordText}>이 날짜에 저장된 레슨 영상이 없습니다.</Text>
        </View>
      ) : null}

      {selectedDateRecords.map((record) => {
        const syncedFeedback = playbackFeedback[record.id] || record.feedback;

        return (
          <View key={record.id} style={styles.recordCard}>
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
  );

  return (
    <Card title="기록일지">
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

          return (
            <Pressable
              key={cell.key}
              onPress={() => onOpenDate(cell.dateKey)}
              style={({ pressed }) => [
                styles.dayCell,
                cell.variant === 'attended' && styles.dayCellAttended,
                cell.variant === 'absent' && styles.dayCellAbsent,
                selectedDateKey === cell.dateKey && styles.dayCellSelected,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.dayNumber}>{cell.date}</Text>
              <Text style={[styles.dayStatus, cell.status === '🔥' && styles.dayStatusFire]}>{cell.status}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.dot, styles.dotGreen]} />
          <Text style={styles.legendText}>출석</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.dot, styles.dotRed]} />
          <Text style={styles.legendText}>결석</Text>
        </View>
      </View>

      <View style={[styles.contentRow, isWide && styles.contentRowWide]}>
        <View style={[styles.graphColumn, isWide && styles.graphColumnWide]}>
          <View style={styles.graphCard}>
            <Text style={styles.graphTitle}>
              {selectedDateKey ? `${selectedDateKey} 슛 성공도` : '날짜별 슛 성공도'}
            </Text>
            <Text style={styles.graphDescription}>
              {selectedDateKey
                ? '선택한 날짜의 슛 시도 수와 슛 성공 수를 비교합니다.'
                : '달력에서 날짜를 선택하면 해당 날짜의 슛 시도 수와 슛 성공 수를 비교해서 보여줍니다.'}
            </Text>

            {!selectedDateKey ? (
              <Text style={styles.graphEmpty}>날짜를 선택하면 해당 날짜의 성공도 그래프가 여기에 표시됩니다.</Text>
            ) : !selectedShotGraphDatum ? (
              <Text style={styles.graphEmpty}>선택한 날짜에는 아직 슛 기록이 없습니다.</Text>
            ) : (
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

                {(() => {
                  const item = selectedShotGraphDatum;
                  const attemptHeight = item.attempts > 0 ? Math.max(18, (item.attempts / selectedGraphMaxValue) * 230) : 10;
                  const successHeight = item.successes > 0 ? Math.max(18, (item.successes / selectedGraphMaxValue) * 230) : 10;
                  const shortDate = item.dateKey.slice(5);

                  return (
                    <View style={styles.graphSingleWrap}>
                      <Text style={styles.graphRateLarge}>성공률 {item.successRate}%</Text>
                      <View style={styles.barAreaLarge}>
                        <View style={styles.barColumn}>
                          <Text style={styles.barValue}>{item.attempts}</Text>
                          <View style={[styles.barLarge, styles.attemptBar, { height: attemptHeight }]} />
                          <Text style={styles.barLabel}>슛 시도</Text>
                        </View>
                        <View style={styles.barColumn}>
                          <Text style={styles.barValue}>{item.successes}</Text>
                          <View style={[styles.barLarge, styles.successBar, { height: successHeight }]} />
                          <Text style={styles.barLabel}>슛 성공</Text>
                        </View>
                      </View>
                      <Text style={styles.graphDateLarge}>{shortDate}</Text>
                    </View>
                  );
                })()}
              </>
            )}
          </View>

          <View style={styles.allGraphButtonRow}>
            <SmallButton title="모든 슛 성공도 보기" onPress={() => setShowAllShotGraphModal(true)} variant="dark" />
          </View>
        </View>

        <View style={[styles.recordsSection, isWide && styles.recordsSectionWide]}>
          {isWide ? (
            <View style={styles.recordsPanel}>
              <ScrollView
                nestedScrollEnabled
                style={styles.recordsScroll}
                contentContainerStyle={styles.recordsScrollContent}
                showsVerticalScrollIndicator
              >
                {recordContent}
              </ScrollView>
            </View>
          ) : (
            recordContent
          )}
        </View>
      </View>

      <Modal
        visible={showAllShotGraphModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAllShotGraphModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>모든 날짜 슛 성공도 변화</Text>
              <Pressable
                onPress={() => setShowAllShotGraphModal(false)}
                style={({ pressed }) => [styles.modalCloseButton, pressed && styles.pressed]}
              >
                <Text style={styles.modalCloseText}>닫기</Text>
              </Pressable>
            </View>

            <Text style={styles.modalDescription}>
              날짜별 성공률 변화는 꺾은선그래프로, 슛 시도 횟수는 막대그래프로 함께 보여줍니다.
            </Text>

            <View style={styles.modalLegend}>
              <View style={styles.legendItem}>
                <View style={styles.modalLegendLine} />
                <Text style={styles.legendText}>성공률 변화</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={styles.modalLegendBar} />
                <Text style={styles.legendText}>슛 시도 횟수</Text>
              </View>
            </View>

            {shotGraphData.length === 0 ? (
              <Text style={styles.graphEmpty}>아직 저장된 슛 레슨 기록이 없습니다.</Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.allGraphScroll}>
                <View style={[styles.lineChartArea, { width: allShotGraphChart.chartWidth, height: allShotGraphChart.chartHeight }]}>
                  <View style={styles.lineChartGuideTop}>
                    <Text style={styles.lineChartGuideText}>100%</Text>
                  </View>
                  <View style={styles.lineChartGuideUpperMid}>
                    <Text style={styles.lineChartGuideText}>75%</Text>
                  </View>
                  <View style={styles.lineChartGuideMid}>
                    <Text style={styles.lineChartGuideText}>50%</Text>
                  </View>
                  <View style={styles.lineChartGuideLowerMid}>
                    <Text style={styles.lineChartGuideText}>25%</Text>
                  </View>
                  <View style={styles.lineChartGuideBottom}>
                    <Text style={styles.lineChartGuideText}>0%</Text>
                  </View>

                  {allShotGraphChart.points.map((point) => (
                    <View
                      key={`${point.dateKey}-bar`}
                      style={[
                        styles.lineBarWrap,
                        {
                          left: point.x - 17,
                          top: point.barTop,
                        },
                      ]}
                    >
                      <Text style={styles.lineBarValue}>{point.attempts}</Text>
                      <View style={[styles.lineBar, { height: point.barHeight }]} />
                    </View>
                  ))}

                  {allShotGraphChart.segments.map((segment) => (
                    <View
                      key={segment.key}
                      style={[
                        styles.lineSegment,
                        {
                          width: segment.width,
                          left: segment.left,
                          top: segment.top,
                          transform: [{ rotate: `${segment.angle}deg` }],
                        },
                      ]}
                    />
                  ))}

                  {allShotGraphChart.points.map((point) => (
                    <View
                      key={point.dateKey}
                      style={[
                        styles.linePointWrap,
                        {
                          left: point.x - 34,
                          top: point.y - 34,
                        },
                      ]}
                    >
                      <Text style={styles.linePointRate}>{point.successRate}%</Text>
                      <View style={styles.linePoint} />
                    </View>
                  ))}

                  {allShotGraphChart.points.map((point) => (
                    <View
                      key={`${point.dateKey}-axis`}
                      style={[
                        styles.lineAxisLabelWrap,
                        {
                          left: point.x - 28,
                          top: allShotGraphChart.chartBottom + 8,
                        },
                      ]}
                    >
                      <Text style={styles.lineAxisLabel}>{point.shortDate}</Text>
                    </View>
                  ))}
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </Card>
  );
}

const styles = StyleSheet.create({
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
    justifyContent: 'space-between',
  },
  dayName: {
    width: '14%',
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
    width: '14%',
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
  dayStatusFire: {
    fontSize: 20,
    lineHeight: 22,
    marginTop: 2,
  },
  legend: {
    flexDirection: 'row',
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
    width: 360,
    flexShrink: 0,
  },
  allGraphButtonRow: {
    marginTop: 12,
    alignItems: 'stretch',
  },
  recordsSection: {
    marginTop: 4,
    gap: 14,
  },
  recordsSectionWide: {
    flex: 1,
    marginTop: 0,
    minHeight: 760,
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
  recordsTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
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
    minHeight: 300,
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
  modalLegend: {
    flexDirection: 'row',
    gap: 18,
    marginBottom: 14,
    flexWrap: 'wrap',
  },
  modalLegendLine: {
    width: 24,
    height: 4,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  modalLegendBar: {
    width: 18,
    height: 14,
    borderRadius: 6,
    backgroundColor: 'rgba(255,159,28,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,159,28,0.7)',
  },
  allGraphScroll: {
    paddingRight: 12,
  },
  lineChartArea: {
    position: 'relative',
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingTop: 10,
    paddingBottom: 24,
  },
  lineChartGuideTop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 18,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  lineChartGuideUpperMid: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '31%',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  lineChartGuideMid: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  lineChartGuideLowerMid: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '69%',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  lineChartGuideBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 26,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  lineChartGuideText: {
    position: 'absolute',
    left: -6,
    top: -10,
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    backgroundColor: '#1a130e',
    paddingHorizontal: 4,
  },
  lineBarWrap: {
    position: 'absolute',
    width: 34,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  lineBar: {
    width: 34,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    backgroundColor: 'rgba(255,159,28,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,159,28,0.7)',
  },
  lineBarValue: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 4,
  },
  lineSegment: {
    position: 'absolute',
    height: 4,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  linePointWrap: {
    position: 'absolute',
    width: 68,
    alignItems: 'center',
  },
  linePointRate: {
    color: colors.textAccent,
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 6,
  },
  linePoint: {
    width: 14,
    height: 14,
    borderRadius: 999,
    backgroundColor: colors.primary,
    borderWidth: 3,
    borderColor: '#ffd6a8',
  },
  linePointDate: {
    color: colors.textSoft,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 8,
  },
  lineAxisLabelWrap: {
    position: 'absolute',
    width: 56,
    alignItems: 'center',
  },
  lineAxisLabel: {
    color: colors.textSoft,
    fontSize: 12,
    fontWeight: '800',
  },
  recordCard: {
    backgroundColor: colors.surfaceStrong,
    borderRadius: 18,
    padding: 16,
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
