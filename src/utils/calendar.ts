import type { CalendarCell } from '../types/app';
import { DAILY_DRIBBLE_TARGET, DAILY_SHOOT_TARGET } from './homework';

function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function getAttendanceStreak(date: Date, attendance: Record<string, string>) {
  let streak = 0;
  const cursor = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  while (attendance[formatDateKey(cursor)] === 'attended') {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

function hasCompletedHomework(
  dateKey: string,
  dailyDribbleRecords: Record<string, number>,
  shotAttemptRecords: Record<string, number>
) {
  return (dailyDribbleRecords[dateKey] || 0) >= DAILY_DRIBBLE_TARGET && (shotAttemptRecords[dateKey] || 0) >= DAILY_SHOOT_TARGET;
}

function buildAttendanceStatus(baseEmoji: '✔️' | '🔥', streak: number) {
  return streak >= 2 ? `${baseEmoji}×(${streak})` : baseEmoji;
}

export function getCalendarCells(
  currentDate: Date,
  attendance: Record<string, string>,
  dailyDribbleRecords: Record<string, number>,
  shotAttemptRecords: Record<string, number>
): CalendarCell[] {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const lastDate = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const todayFloor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const cells: CalendarCell[] = [];

  for (let i = 0; i < firstDay; i += 1) {
    cells.push({ type: 'empty', key: `empty-${i}` });
  }

  for (let date = 1; date <= lastDate; date += 1) {
    const dateKey = `${year}-${month + 1}-${date}`;
    const targetDate = new Date(year, month, date);
    let status = '미체크';
    let variant: 'default' | 'attended' | 'absent' = 'default';

    if (attendance[dateKey] === 'attended') {
      const streak = getAttendanceStreak(targetDate, attendance);
      const baseEmoji = hasCompletedHomework(dateKey, dailyDribbleRecords, shotAttemptRecords) ? '🔥' : '✔️';
      status = buildAttendanceStatus(baseEmoji, streak);
      variant = 'attended';
    } else if (targetDate < todayFloor) {
      const previousDate = new Date(year, month, date - 1);
      const previousStreak = getAttendanceStreak(previousDate, attendance);

      status = previousStreak >= 2 ? '🤦‍♂️' : '💧';
      variant = 'absent';
    }

    cells.push({
      type: 'day',
      key: dateKey,
      date,
      dateKey,
      status,
      variant,
    });
  }

  return cells;
}
