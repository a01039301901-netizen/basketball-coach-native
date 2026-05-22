export type AppScreen = 'home' | 'lesson' | 'skill' | 'diary' | 'settings';

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
export type BallColorOption = 'orange' | 'brown' | 'yellow' | 'white' | 'black' | 'gray' | 'red';
export type BallBrandOption = 'wilson' | 'spalding' | 'molten';

export interface Skill {
  title: string;
  player: string;
  point: string;
  query: string;
}

export interface FeedbackMoment {
  atMs: number;
  text: string;
}

export interface LessonRecord {
  id: string;
  dateKey: string;
  mode: LessonMode;
  feedback: string;
  feedbackTimeline: FeedbackMoment[];
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
export type DribbleStanceState = 'ready' | 'too_upright' | 'too_low' | 'unknown';
export type BounceHeightState = 'too_high' | 'too_low' | 'balanced' | 'unknown';
export type BodyFacingState = 'front' | 'side' | 'unknown';
export type FrontBallLaneState = 'between_legs' | 'outside_legs' | 'unknown';
export type HandBalanceState = 'balanced' | 'unbalanced' | 'unknown';
export type FootSpacingState = 'narrow' | 'wide' | 'balanced' | 'unknown';

export interface DribbleAnalysis {
  dribbleStarted: boolean;
  bodyFacing: BodyFacingState;
  eyeFocus: EyeFocusState;
  dribbleHeight: DribbleHeightState;
  torsoPosture: TorsoPostureState;
  torsoLeanAngle: number | null;
  stanceState: DribbleStanceState;
  frontStanceAngle: number | null;
  bounceHighState: BounceHeightState;
  bounceLowState: BounceHeightState;
  dribbleCount: number;
  leftHandDribbleCount: number;
  rightHandDribbleCount: number;
  handBalanceState: HandBalanceState;
  frontBallLaneState: FrontBallLaneState;
  footSpacingState: FootSpacingState;
  highestBounceY: number | null;
  lowestBounceY: number | null;
  summary: string;
}

export type ShootArmAngleState = 'narrow' | 'wide' | 'balanced' | 'unknown';
export type ShootReleaseTimingState = 'early' | 'late' | 'balanced' | 'unknown';
export type ShootLegAngleState = 'low' | 'high' | 'balanced' | 'unknown';

export interface ShootAnalysis {
  armAngle: number | null;
  legAngle: number | null;
  releaseVelocity: number | null;
  lowestLegAngle: number | null;
  headPeakY: number | null;
  releaseDetected: boolean;
  armAngleState: ShootArmAngleState;
  releaseTiming: ShootReleaseTimingState;
  legAngleState: ShootLegAngleState;
  summary: string;
}
