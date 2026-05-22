import type { BallBrandOption, BallColorOption } from '../types/app';

export const BALL_COLOR_OPTIONS: Array<{ key: BallColorOption; label: string; accent: string }> = [
  { key: 'orange', label: '주황색', accent: '#ff9f1c' },
  { key: 'brown', label: '갈색', accent: '#8b5a2b' },
  { key: 'yellow', label: '노란색', accent: '#ffd60a' },
  { key: 'white', label: '흰색', accent: '#f8f9fa' },
  { key: 'black', label: '검은색', accent: '#1f1f1f' },
  { key: 'gray', label: '회색', accent: '#8d99ae' },
  { key: 'red', label: '빨간색', accent: '#ff4d5a' },
];

export const BALL_BRAND_OPTIONS: Array<{
  key: BallBrandOption;
  label: string;
  description: string;
}> = [
  { key: 'wilson', label: 'Wilson', description: '갈색 가죽 공과 검은 이음선 기준' },
  { key: 'spalding', label: 'Spalding', description: '주황색 공과 검은 이음선 기준' },
  { key: 'molten', label: 'Molten', description: '빨강, 흰색 패널과 검은 이음선 기준' },
];

export const BALL_BRAND_PRESETS: Record<BallBrandOption, BallColorOption[]> = {
  wilson: ['brown', 'orange', 'black'],
  spalding: ['orange', 'brown', 'black'],
  molten: ['red', 'white', 'black'],
};

export const DEFAULT_BALL_BRAND: BallBrandOption = 'wilson';
export const DEFAULT_BALL_COLORS: BallColorOption[] = BALL_BRAND_PRESETS[DEFAULT_BALL_BRAND];
