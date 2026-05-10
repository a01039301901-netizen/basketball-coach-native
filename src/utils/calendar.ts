import type { CalendarCell } from '../types/app';

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

    if (attendance[dateKey] === 'attended') {
      status = '출석';
      variant = 'attended';
    } else if (targetDate < todayFloor) {
      status = '결석';
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
