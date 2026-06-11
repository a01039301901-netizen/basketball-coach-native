export type AppScreen = 'home' | 'lesson' | 'skill' | 'diary' | 'settings' | 'rules';
export type AuthMode = 'login' | 'signup';
export type AccountGender = 'male' | 'female' | 'other';

export type LessonMode = 'dribble' | 'shoot';
export type DribbleLessonView = 'front' | 'side';

export interface UserAccount {
  id: string;
  name: string;
  age: number;
  gender: AccountGender;
  password: string;
  createdAt: string;
}

export interface AuthUser {
  id: string;
  name: string;
  age: number;
  gender: AccountGender;
}

export interface AuthSession {
  userId: string;
}

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
export type PositionOption = 'none' | 'defense' | 'offense';

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
  reviewFeedback?: string;
  reviewStartAtMs?: number;
  reviewDurationMs?: number;
}

export interface LessonReviewClip {
  videoUri: string;
  feedback: string;
  startAtMs: number;
  durationMs: number;
  title: string;
}

export interface FireworkItem {
  id: string;
  emoji: string;
  left: `${number}%`;
  top: `${number}%`;
}

export interface ShotGraphDatum {
  dateKey: string;
  attempts: number;
  successes: number;
  successRate: number;
}

export interface HomeworkProgressItem {
  id: 'dribble' | 'shoot';
  title: string;
  current: number;
  target: number;
  progressPercent: number;
  isCompleted: boolean;
  progressText: string;
  completionText: string;
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
  ballNearShootingHand: boolean;
  shootingHandRaised: boolean;
  readyPoseDetected: boolean;
  armAngleState: ShootArmAngleState;
  releaseTiming: ShootReleaseTimingState;
  legAngleState: ShootLegAngleState;
  summary: string;
}
