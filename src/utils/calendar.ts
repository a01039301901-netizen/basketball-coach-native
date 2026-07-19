import type { CalendarCell, LessonRecordLevel } from '../types/app';

export function getCalendarCells(
  currentDate: Date,
  dominantRecordLevelsByDate: Partial<Record<string, LessonRecordLevel>>
): CalendarCell[] {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const lastDate = new Date(year, month + 1, 0).getDate();
  const cells: CalendarCell[] = [];

  for (let i = 0; i < firstDay; i += 1) {
    cells.push({ type: 'empty', key: `empty-${i}` });
  }

  for (let date = 1; date <= lastDate; date += 1) {
    const dateKey = `${year}-${month + 1}-${date}`;

    cells.push({
      type: 'day',
      key: dateKey,
      date,
      dateKey,
      status: '',
      variant: dominantRecordLevelsByDate[dateKey] ?? 'default',
    });
  }

  return cells;
}
