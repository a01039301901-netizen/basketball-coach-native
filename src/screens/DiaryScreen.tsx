import { ResizeMode, Video } from 'expo-av';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { DAY_NAMES } from '../constants/content';
import { Card } from '../components/common/Card';
import { SmallButton } from '../components/common/Buttons';
import { colors } from '../theme/colors';
import type { CalendarCell, LessonRecord } from '../types/app';
import { formatMonthTitle } from '../utils/date';

interface DiaryScreenProps {
  currentDate: Date;
  calendarCells: CalendarCell[];
  selectedDateKey: string;
  selectedDateRecords: LessonRecord[];
  selectedDateShotCount: number;
  onChangeMonth: (delta: number) => void;
  onOpenDate: (dateKey: string) => void;
  onDeleteRecord: (recordId: string) => void;
}

export function DiaryScreen({
  currentDate,
  calendarCells,
  selectedDateKey,
  selectedDateRecords,
  selectedDateShotCount,
  onChangeMonth,
  onOpenDate,
  onDeleteRecord,
}: DiaryScreenProps) {
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
              <Text style={styles.dayStatus}>{cell.status}</Text>
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

      <View style={styles.recordsSection}>
        <Text style={styles.recordsTitle}>
          {selectedDateKey ? `${selectedDateKey} 레슨 기록` : '날짜를 선택하면 레슨 기록이 표시됩니다.'}
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

        {selectedDateRecords.map((record) => (
          <View key={record.id} style={styles.recordCard}>
            <Text style={styles.recordTitle}>{record.mode === 'shoot' ? '슛 분석' : '드리블 분석'}</Text>
            <Text style={styles.recordMeta}>{record.createdAt}</Text>
            {record.videoUri ? (
              <Video
                source={{ uri: record.videoUri }}
                useNativeControls
                shouldPlay={false}
                isLooping={false}
                resizeMode={ResizeMode.COVER}
                style={styles.recordVideo}
              />
            ) : null}
            <Text style={styles.recordText}>{record.feedback}</Text>
            <SmallButton title="기록 삭제" onPress={() => onDeleteRecord(record.id)} variant="red" />
          </View>
        ))}
      </View>
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
  recordsSection: {
    marginTop: 4,
    gap: 14,
  },
  recordsTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
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
    marginBottom: 12,
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
});
