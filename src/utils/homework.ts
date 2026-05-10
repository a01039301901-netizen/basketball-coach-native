import { REQUIRED_HOMEWORK, REQUIRED_SKILL_HOMEWORK } from '../constants/content';
import type { LessonMode } from '../types/app';

export function getHomeworkToShow(homework: string[]): string[] {
  return [REQUIRED_HOMEWORK, REQUIRED_SKILL_HOMEWORK, ...homework].slice(0, 4);
}

export function buildLessonHomework(mode: LessonMode): string {
  return mode === 'shoot' ? '슛 30개 쏴보기' : '드리블 50개 연습하기';
}

export function mergeHomework(homework: string[], nextHomework: string): string[] {
  const merged = homework.includes(nextHomework) ? homework.slice() : [nextHomework, ...homework];

  return merged
    .filter((item) => item !== REQUIRED_HOMEWORK && item !== REQUIRED_SKILL_HOMEWORK)
    .slice(0, 2);
}
