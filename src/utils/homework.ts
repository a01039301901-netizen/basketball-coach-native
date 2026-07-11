import type {
  CorrectionHomeworkState,
  DailyHomeworkState,
  HomeworkCorrectionSide,
  HomeworkFeedbackCategory,
  HomeworkProgressItem,
  HomeworkStateRecord,
  HomeworkUnlockSnapshot,
  LessonRecord,
  PositionOption,
  SkillKey,
} from '../types/app';

export const DAILY_DRIBBLE_HOMEWORK_TITLE = '드리블 50회 튀기기';
export const DAILY_SHOOT_HOMEWORK_TITLE = '슛 발사 20회 도전';
export const DAILY_DRIBBLE_TARGET = 50;
export const DAILY_SHOOT_TARGET = 20;
export const POSITION_DRIBBLE_TARGET = 50;
export const POSITION_SHOOT_SUCCESS_TARGET = 10;
export const POSITION_SKILL_VIDEO_TARGET = 1;
export const POSITION_FEEDBACK_RETRY_TARGET = 1;
export const CORRECTION_DRIBBLE_TARGET = 10;
export const FRONT_DRIBBLE_CORRECTION_MIN_TOTAL = 20;
export const FRONT_DRIBBLE_CORRECTION_MIN_GAP = 6;

export const DEFENSE_FOLLOWUP_SKILL_KEYS: SkillKey[] = ['defense', 'crossover'];
export const OFFENSE_FOLLOWUP_SKILL_KEYS: SkillKey[] = ['layup', 'shoot'];

const POSITIVE_FEEDBACK_KEYWORDS = ['좋습니다', '좋아요', '안정적', '균형이 좋습니다', '타이밍이 안정적', '준비 자세가 좋습니다'];

interface BuildHomeworkProgressInput {
  dateKey: string;
  dailyDribbleCount: number;
  shootAttemptCount: number;
  shotSuccessCount: number;
  lessonRecords: LessonRecord[];
  dailyState: DailyHomeworkState;
}

function clampProgress(current: number, target: number) {
  if (target <= 0) {
    return {
      progress: 0,
      progressPercent: 0,
      isCompleted: false,
    };
  }

  const safeProgress = Math.min(target, Math.max(0, current));

  return {
    progress: safeProgress,
    progressPercent: Math.round((safeProgress / target) * 100),
    isCompleted: safeProgress >= target,
  };
}

function buildProgressItem(
  id: string,
  title: string,
  stage: HomeworkProgressItem['stage'],
  source: HomeworkProgressItem['source'],
  current: number,
  target: number
): HomeworkProgressItem {
  const { progress, progressPercent, isCompleted } = clampProgress(current, target);

  return {
    id,
    title,
    stage,
    source,
    current: progress,
    target,
    progress,
    progressPercent,
    isCompleted,
    progressText: `${progressPercent}% (${progress}/${target})`,
    completionText: isCompleted ? '숙제 완수' : '진행 중',
  };
}

function getTodayLessonCount(dateKey: string, lessonRecords: LessonRecord[]) {
  return lessonRecords.filter((record) => record.dateKey === dateKey).length;
}

function countRelevantSkillVideoEvents(
  dailyState: DailyHomeworkState,
  skillKeys: SkillKey[],
  unlockedAt: string
) {
  return dailyState.skillVideoEvents.filter(
    (event) => skillKeys.includes(event.skillKey) && event.openedAt >= unlockedAt
  ).length;
}

function isPositiveFeedbackText(text: string) {
  return POSITIVE_FEEDBACK_KEYWORDS.some((keyword) => text.includes(keyword));
}

export function getHomeworkFeedbackCategoryLabel(category: HomeworkFeedbackCategory) {
  switch (category) {
    case 'dribble_balance':
      return '좌우 드리블 균형';
    case 'torso_posture':
      return '상체 기울기와 자세';
    case 'shoot_arm_angle':
      return '슛 팔 각도';
    case 'shoot_release_timing':
      return '슛 발사 타이밍';
    case 'leg_angle':
      return '하체 각도';
    default:
      return '약점';
  }
}

export function inferHomeworkFeedbackCategoryFromText(text: string): HomeworkFeedbackCategory | null {
  if (!text || isPositiveFeedbackText(text)) {
    return null;
  }

  if (text.includes('왼손') || text.includes('오른손') || text.includes('양손') || text.includes('불균형') || text.includes('균형')) {
    return 'dribble_balance';
  }

  if (text.includes('팔 각도') || text.includes('팔을 조금 더') || text.includes('팔을') || text.includes('팔꿈치')) {
    return 'shoot_arm_angle';
  }

  if (text.includes('발사') || text.includes('타이밍') || text.includes('최고점') || text.includes('빨리') || text.includes('늦게')) {
    return 'shoot_release_timing';
  }

  if (text.includes('하체') || text.includes('무릎') || text.includes('점프 준비 자세') || text.includes('엉덩이-무릎-발')) {
    return 'leg_angle';
  }

  if (
    text.includes('상체') ||
    text.includes('기울기') ||
    text.includes('자세') ||
    text.includes('발 간격') ||
    text.includes('발-무릎-엉덩이') ||
    text.includes('다리 사이')
  ) {
    return 'torso_posture';
  }

  return null;
}

export function getRepresentativeHomeworkFeedbackCategory(record: LessonRecord): HomeworkFeedbackCategory | null {
  if (record.representativeFeedbackCategory) {
    return record.representativeFeedbackCategory;
  }

  return inferHomeworkFeedbackCategoryFromText(record.reviewFeedback || record.feedback);
}

export function getMostFrequentHomeworkFeedbackCategory(
  lessonRecords: LessonRecord[],
  recentLimit = 3
): HomeworkFeedbackCategory | null {
  const counts = new Map<HomeworkFeedbackCategory, number>();
  const recentRecords = lessonRecords.slice(-recentLimit);

  for (const record of recentRecords) {
    const category = getRepresentativeHomeworkFeedbackCategory(record);

    if (!category) {
      continue;
    }

    counts.set(category, (counts.get(category) || 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }

      return left[0].localeCompare(right[0]);
    })[0]?.[0] ?? null;
}

function buildNoPositionFollowupTitle(category: HomeworkFeedbackCategory | null) {
  if (!category) {
    return '최근 3회 레슨에서 가장 자주 나온 약점 고쳐 레슨 다시 해보기';
  }

  return `최근 3회 레슨에서 가장 자주 나온 약점인 ${getHomeworkFeedbackCategoryLabel(category)} 고쳐 레슨 다시 해보기`;
}

function buildBaseHomeworkItems(dribbleCount: number, shootAttemptCount: number) {
  return [
    buildProgressItem('base-dribble', DAILY_DRIBBLE_HOMEWORK_TITLE, 'base', 'daily', dribbleCount, DAILY_DRIBBLE_TARGET),
    buildProgressItem('base-shoot', DAILY_SHOOT_HOMEWORK_TITLE, 'base', 'daily', shootAttemptCount, DAILY_SHOOT_TARGET),
  ];
}

function buildPositionFollowupHomeworkItems(
  input: BuildHomeworkProgressInput,
  stage2Unlock: HomeworkUnlockSnapshot
) {
  const followupDribbleCount = Math.max(0, input.dailyDribbleCount - stage2Unlock.dribbleCount);
  const followupShotSuccessCount = Math.max(0, input.shotSuccessCount - stage2Unlock.shotSuccessCount);
  const followupLessonCount = Math.max(0, getTodayLessonCount(input.dateKey, input.lessonRecords) - stage2Unlock.lessonCount);

  if (stage2Unlock.position === 'defense') {
    return [
      buildProgressItem(
        'position-defense-dribble',
        '드리블 50회 더 해보기',
        'position_followup',
        'position',
        followupDribbleCount,
        POSITION_DRIBBLE_TARGET
      ),
      buildProgressItem(
        'position-defense-skill',
        '새로운 기술 배우기에서 수비자세 또는 크로스오버 배워보기',
        'position_followup',
        'position',
        countRelevantSkillVideoEvents(input.dailyState, DEFENSE_FOLLOWUP_SKILL_KEYS, stage2Unlock.unlockedAt),
        POSITION_SKILL_VIDEO_TARGET
      ),
    ];
  }

  if (stage2Unlock.position === 'offense') {
    return [
      buildProgressItem(
        'position-offense-shoot-success',
        '슛 성공 10회 도전하기',
        'position_followup',
        'position',
        followupShotSuccessCount,
        POSITION_SHOOT_SUCCESS_TARGET
      ),
      buildProgressItem(
        'position-offense-skill',
        '새로운 기술 배우기에서 레이업 또는 슛폼 배우기',
        'position_followup',
        'position',
        countRelevantSkillVideoEvents(input.dailyState, OFFENSE_FOLLOWUP_SKILL_KEYS, stage2Unlock.unlockedAt),
        POSITION_SKILL_VIDEO_TARGET
      ),
    ];
  }

  const weakCategory = getMostFrequentHomeworkFeedbackCategory(input.lessonRecords, 3);

  return [
    buildProgressItem(
      'position-none-feedback',
      buildNoPositionFollowupTitle(weakCategory),
      'position_followup',
      'feedback',
      followupLessonCount,
      POSITION_FEEDBACK_RETRY_TARGET
    ),
  ];
}

function buildCorrectionHomeworkItem(correctionTask: CorrectionHomeworkState | null, dailyState: DailyHomeworkState) {
  if (!correctionTask) {
    return null;
  }

  const currentCount =
    correctionTask.direction === 'left'
      ? dailyState.handDribbleTotals.left
      : dailyState.handDribbleTotals.right;
  const progress = Math.max(0, currentCount - correctionTask.baselineCount);
  const title =
    correctionTask.direction === 'left' ? '왼쪽 드리블 10회 더 해보기' : '오른쪽 드리블 10회 더 해보기';

  return buildProgressItem(
    `correction-${correctionTask.direction}`,
    title,
    'correction',
    'dribble_balance',
    progress,
    CORRECTION_DRIBBLE_TARGET
  );
}

export function buildDailyHomeworkProgress(input: BuildHomeworkProgressInput): HomeworkProgressItem[] {
  const baseItems = buildBaseHomeworkItems(input.dailyDribbleCount, input.shootAttemptCount);
  const correctionItem = buildCorrectionHomeworkItem(input.dailyState.correctionTask, input.dailyState);
  const stage2Unlock = input.dailyState.stage2Unlock;

  if (!stage2Unlock) {
    return correctionItem ? [...baseItems, correctionItem] : baseItems;
  }

  const followupItems = buildPositionFollowupHomeworkItems(input, stage2Unlock);
  return correctionItem ? [...followupItems, correctionItem] : followupItems;
}

export function createEmptyDailyHomeworkState(): DailyHomeworkState {
  return {
    stage2Unlock: null,
    skillVideoEvents: [],
    handDribbleTotals: {
      left: 0,
      right: 0,
    },
    correctionTask: null,
  };
}

export function getDailyHomeworkState(homeworkState: HomeworkStateRecord, dateKey: string): DailyHomeworkState {
  return homeworkState[dateKey] ?? createEmptyDailyHomeworkState();
}

export function isDailyBaseHomeworkCompleted(dribbleCount: number, shootAttemptCount: number) {
  return dribbleCount >= DAILY_DRIBBLE_TARGET && shootAttemptCount >= DAILY_SHOOT_TARGET;
}

export function buildStage2UnlockSnapshot(
  position: PositionOption,
  dribbleCount: number,
  shootAttemptCount: number,
  shotSuccessCount: number,
  lessonCount: number
): HomeworkUnlockSnapshot {
  return {
    unlockedAt: new Date().toISOString(),
    position,
    dribbleCount,
    shootAttemptCount,
    shotSuccessCount,
    lessonCount,
  };
}

export function getCorrectionHomeworkTitle(direction: HomeworkCorrectionSide) {
  return direction === 'left' ? '왼쪽 드리블 10회 더 해보기' : '오른쪽 드리블 10회 더 해보기';
}

export function buildCorrectionHomeworkState(
  leftHandDribbleCount: number,
  rightHandDribbleCount: number,
  currentTotals: DailyHomeworkState['handDribbleTotals']
): CorrectionHomeworkState | null {
  const safeLeftCount = Math.max(0, leftHandDribbleCount);
  const safeRightCount = Math.max(0, rightHandDribbleCount);
  const totalCount = safeLeftCount + safeRightCount;
  const gap = Math.abs(safeLeftCount - safeRightCount);

  if (totalCount < FRONT_DRIBBLE_CORRECTION_MIN_TOTAL || gap < FRONT_DRIBBLE_CORRECTION_MIN_GAP) {
    return null;
  }

  const direction: HomeworkCorrectionSide = safeLeftCount > safeRightCount ? 'right' : 'left';
  const baselineCount = direction === 'left' ? currentTotals.left : currentTotals.right;

  return {
    direction,
    baselineCount,
    createdAt: new Date().toISOString(),
  };
}

export function getHomeworkCompletionMessage(type: 'dribble' | 'shoot') {
  return type === 'dribble'
    ? `${DAILY_DRIBBLE_HOMEWORK_TITLE} 숙제를 완수했어요.`
    : `${DAILY_SHOOT_HOMEWORK_TITLE} 숙제를 완수했어요.`;
}
