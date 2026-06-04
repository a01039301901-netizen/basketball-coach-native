import type { CalendarCell } from '../types/app';

function formatAttendanceKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function getAttendanceStreak(targetDate: Date, attendance: Record<string, string>) {
  let streak = 0;
  const cursor = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());

  while (attendance[formatAttendanceKey(cursor)] === 'attended') {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

function isPastDate(targetDate: Date, todayFloor: Date) {
  return targetDate.getTime() < todayFloor.getTime();
}

function getAbsenceStatus(targetDate: Date, attendance: Record<string, string>, todayFloor: Date) {
  const previousDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate() - 1);
  const previousKey = formatAttendanceKey(previousDate);

  if (attendance[previousKey] === 'attended') {
    return '🤦‍♂️';
  }

  let cursor = previousDate;

  while (isPastDate(cursor, todayFloor)) {
    const cursorKey = formatAttendanceKey(cursor);

    if (attendance[cursorKey] === 'attended') {
      return '💧';
    }

    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() - 1);
  }

  return '결석';
}

export function getCalendarCells(currentDate: Date, attendance: Record<string, string>): CalendarCell[] {
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
    let streakCount: number | undefined;

    if (attendance[dateKey] === 'attended') {
      status = '🔥';
      variant = 'attended';
      streakCount = getAttendanceStreak(targetDate, attendance);
    } else if (isPastDate(targetDate, todayFloor)) {
      status = getAbsenceStatus(targetDate, attendance, todayFloor);
      variant = 'absent';
    }

    cells.push({
      type: 'day',
      key: dateKey,
      date,
      dateKey,
      status,
      streakCount,
      variant,
    });
  }

  return cells;
}
