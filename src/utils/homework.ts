import type { HomeworkProgressItem } from '../types/app';

export const DAILY_DRIBBLE_HOMEWORK_TITLE = '드리블 50개 연습하기';
export const DAILY_SHOOT_HOMEWORK_TITLE = '슛 10번 연습하기';
export const DAILY_DRIBBLE_TARGET = 50;
export const DAILY_SHOOT_TARGET = 10;

function clampProgress(current: number, target: number) {
  if (target <= 0) {
    return 0;
  }

  return Math.min(target, Math.max(0, current));
}

function toProgressItem(
  id: HomeworkProgressItem['id'],
  title: string,
  current: number,
  target: number
): HomeworkProgressItem {
  const safeCurrent = clampProgress(current, target);
  const progressPercent = Math.round((safeCurrent / target) * 100);
  const isCompleted = safeCurrent >= target;

  return {
    id,
    title,
    current: safeCurrent,
    target,
    progressPercent,
    isCompleted,
    progressText: `${progressPercent}% (${safeCurrent}/${target})`,
    completionText: isCompleted ? '숙제 완수' : '진행 중',
  };
}

export function buildDailyHomeworkProgress(dribbleCount: number, shootAttempts: number): HomeworkProgressItem[] {
  return [
    toProgressItem('dribble', DAILY_DRIBBLE_HOMEWORK_TITLE, dribbleCount, DAILY_DRIBBLE_TARGET),
    toProgressItem('shoot', DAILY_SHOOT_HOMEWORK_TITLE, shootAttempts, DAILY_SHOOT_TARGET),
  ];
}

export function getHomeworkCompletionMessage(type: HomeworkProgressItem['id']): string {
  return type === 'dribble'
    ? `${DAILY_DRIBBLE_HOMEWORK_TITLE} 숙제를 완수했어요.`
    : `${DAILY_SHOOT_HOMEWORK_TITLE} 숙제를 완수했어요.`;
}
