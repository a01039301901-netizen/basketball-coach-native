export function formatDateKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

export function formatMonthTitle(date: Date): string {
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
}
