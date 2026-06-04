import { REQUIRED_HOMEWORK, REQUIRED_SKILL_HOMEWORK } from '../constants/content';
import type { LessonMode } from '../types/app';

const DEFAULT_HOMEWORK = [REQUIRED_HOMEWORK, REQUIRED_SKILL_HOMEWORK];

export function normalizeHomework(homework: string[]): string[] {
  const uniqueHomework = homework.filter((item, index, array) => array.indexOf(item) === index);
  const missingDefaults = DEFAULT_HOMEWORK.filter((item) => !uniqueHomework.includes(item));

  if (missingDefaults.length === 0) {
    return uniqueHomework.slice(0, 4);
  }

  return [...DEFAULT_HOMEWORK, ...uniqueHomework.filter((item) => !DEFAULT_HOMEWORK.includes(item))].slice(0, 4);
}

export function getHomeworkToShow(homework: string[]): string[] {
  return homework.slice(0, 4);
}

export function buildLessonHomework(mode: LessonMode): string {
  return mode === 'shoot' ? '슛 30개 연습하기' : '드리블 50개 연습하기';
}

export function mergeHomework(homework: string[], nextHomework: string): string[] {
  const pinnedItems = homework.filter((item) => DEFAULT_HOMEWORK.includes(item));
  const customItems = homework.filter((item) => !DEFAULT_HOMEWORK.includes(item) && item !== nextHomework);

  return [...pinnedItems, nextHomework, ...customItems].slice(0, 4);
}

export function removeHomework(homework: string[], targetHomework: string): string[] {
  return homework.filter((item) => item !== targetHomework);
}
