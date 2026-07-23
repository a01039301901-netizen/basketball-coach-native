export type AppScreen = 'home' | 'lesson' | 'skill' | 'diary' | 'settings' | 'rules';
export type AuthMode = 'login' | 'signup';

export type LessonMode = 'dribble' | 'shoot';
export type DribbleLessonView = 'front' | 'side';
export type ShotOutcome = 'success' | 'failure';

export interface UserAccount {
  id: string;
  nickname: string;
  password: string;
  createdAt: string;
}

export interface AuthUser {
  id: string;
  nickname: string;
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
      variant: 'default' | 'good' | 'average' | 'bad';
    };

export type SkillKey = 'shoot' | 'crossover' | 'layup' | 'stepback' | 'spin' | 'defense';
export type BallColorOption = 'orange' | 'brown' | 'yellow' | 'white' | 'black' | 'gray' | 'red';
export type BallBrandOption = 'wilson' | 'spalding' | 'molten';
export type PositionOption = 'none' | 'defense' | 'offense';
export type HomeworkStage = 'base' | 'position_followup' | 'correction';
export type HomeworkSource = 'daily' | 'position' | 'feedback' | 'dribble_balance';
export type HomeworkFeedbackCategory =
  | 'dribble_balance'
  | 'torso_posture'
  | 'shoot_arm_angle'
  | 'shoot_release_timing'
  | 'leg_angle';
export type HomeworkCorrectionSide = 'left' | 'right';
export type HomeworkTestCorrectionDirection = 'none' | HomeworkCorrectionSide;

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
  shotOutcome?: ShotOutcome;
  feedback: string;
  feedbackTimeline: FeedbackMoment[];
  videoUri: string;
  createdAt: string;
  reviewFeedback?: string;
  reviewStartAtMs?: number;
  reviewDurationMs?: number;
  dribbleView?: DribbleLessonView;
  leftHandDribbleCount?: number;
  rightHandDribbleCount?: number;
  representativeFeedbackCategory?: HomeworkFeedbackCategory;
  evaluation?: LessonRecordEvaluation;
}

export interface LessonReviewClip {
  videoUri: string;
  feedback: string;
  startAtMs: number;
  durationMs: number;
  title: string;
}

export type LessonRecordLevel = 'good' | 'average' | 'bad';

export interface LessonRecordCriterion {
  key: string;
  label: string;
  isStable: boolean;
  stableRatio?: number;
  detail: string;
}

export interface LessonRecordHighlight {
  label: string;
  detail: string;
  startAtMs: number;
  durationMs: number;
}

export interface LessonRecordEvaluation {
  level: LessonRecordLevel;
  summary: string;
  criteria: LessonRecordCriterion[];
  strengths: LessonRecordHighlight[];
  improvements: LessonRecordHighlight[];
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

export interface DiarySkillInsight {
  selectedShotAttempts: number;
  selectedShotSuccesses: number;
  selectedShotSuccessRate: number;
  leftDribbleCount: number;
  rightDribbleCount: number;
  dribbleBalance: 'balanced' | 'left' | 'right' | 'none';
  dribbleBalanceGap: number;
  canShowDailySummary: boolean;
  yesterdayDribbleCount: number;
  yesterdayShotAttempts: number;
  previousPracticeDateKey: string | null;
  previousPracticeDribbleCount: number;
  previousPracticeShotAttempts: number;
  previousShotDateKey: string | null;
  previousShotSuccessRate: number | null;
  evaluationCounts: Record<LessonRecordLevel, number>;
  evaluationDominantLevel: LessonRecordLevel | 'mixed' | 'none';
}

export interface HomeworkProgressItem {
  id: string;
  title: string;
  stage: HomeworkStage;
  source: HomeworkSource;
  current: number;
  target: number;
  progress: number;
  progressPercent: number;
  isCompleted: boolean;
  progressText: string;
  completionText: string;
}

export interface SkillVideoOpenEvent {
  skillKey: SkillKey;
  openedAt: string;
}

export interface HomeworkUnlockSnapshot {
  unlockedAt: string;
  position: PositionOption;
  dribbleCount: number;
  shootAttemptCount: number;
  shotSuccessCount: number;
  lessonCount: number;
}

export interface CorrectionHomeworkState {
  direction: HomeworkCorrectionSide;
  baselineCount: number;
  createdAt: string;
}

export interface DailyHomeworkState {
  stage2Unlock: HomeworkUnlockSnapshot | null;
  skillVideoEvents: SkillVideoOpenEvent[];
  handDribbleTotals: {
    left: number;
    right: number;
  };
  correctionTask: CorrectionHomeworkState | null;
}

export type HomeworkStateRecord = Record<string, DailyHomeworkState>;

export interface HomeworkTestState {
  dribbleCount: number;
  shootAttemptCount: number;
  shotSuccessCount: number;
  skillVideoOpenCount: number;
  leftHandTotal: number;
  rightHandTotal: number;
  isStage2Unlocked: boolean;
  correctionDirection: HomeworkTestCorrectionDirection;
  correctionProgress: number;
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
