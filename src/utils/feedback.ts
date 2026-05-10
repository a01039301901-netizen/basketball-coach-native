import type { LessonMode } from '../types/app';

export function buildFeedbackText(mode: LessonMode, lines: [string, string, string]): string {
  const title = mode === 'shoot' ? '슛 피드백' : '드리블 피드백';
  return `${title}\n1. ${lines[0]}\n2. ${lines[1]}\n3. ${lines[2]}`;
}
