export type AppScreen = 'home' | 'lesson' | 'skill' | 'diary';

export type LessonMode = 'dribble' | 'shoot';

export type CalendarCell =
  | {
      type: 'empty';
      key: string;
    }
  | {
      type: 'day';
      key: string;
      date: number;
      dateKey: string;
      status: string;
      variant: 'default' | 'attended' | 'absent';
    };

export type SkillKey = 'shoot' | 'crossover' | 'layup' | 'stepback' | 'spin' | 'defense';

export interface Skill {
  title: string;
  player: string;
  point: string;
  query: string;
}

export interface LessonRecord {
  id: string;
  dateKey: string;
  mode: LessonMode;
  feedback: string;
  videoUri: string;
  createdAt: string;
}

export interface FireworkItem {
  id: string;
  emoji: string;
  left: `${number}%`;
  top: `${number}%`;
}

export type EyeFocusState = 'ball' | 'forward' | 'unknown';
export type DribbleHeightState = 'high' | 'low' | 'balanced' | 'unknown';
export type TorsoPostureState = 'high' | 'low' | 'balanced' | 'unknown';

export interface DribbleAnalysis {
  eyeFocus: EyeFocusState;
  dribbleHeight: DribbleHeightState;
  torsoPosture: TorsoPostureState;
  summary: string;
}

export type ShootArmAngleState = 'narrow' | 'wide' | 'balanced' | 'unknown';
export type ShootReleaseTimingState = 'early' | 'late' | 'balanced' | 'unknown';
export type ShootLegAngleState = 'low' | 'high' | 'balanced' | 'unknown';

export interface ShootAnalysis {
  armAngle: number | null;
  legAngle: number | null;
  releaseVelocity: number | null;
  armAngleState: ShootArmAngleState;
  releaseTiming: ShootReleaseTimingState;
  legAngleState: ShootLegAngleState;
  summary: string;
}
