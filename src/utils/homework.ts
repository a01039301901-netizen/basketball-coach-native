import type {
  CorrectionHomeworkState,
  DailyHomeworkState,
  HomeworkDiaryLinkContext,
  HomeworkCorrectionSide,
  HomeworkFeedbackCategory,
  HomeworkLinkedRecordPreview,
  HomeworkProgressItem,
  HomeworkStateRecord,
  HomeworkUnlockSnapshot,
  LessonRecord,
  PositionOption,
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
const DEFAULT_HOMEWORK_DETAIL_TOGGLE_TEXT = '이유 자세히 보기';
const LEGACY_STAGE2_REASON_TEXT = '반복된 약점을 다시 확인하고 교정이 반영됐는지 보기 위한 추가 레슨 숙제예요.';
const LEGACY_STAGE2_DETAIL_TEXT =
  '기존 저장 데이터에는 숙제가 만들어질 때의 피드백 근거가 남아 있지 않아 일반 설명을 보여주고 있어요. 레슨을 1회 더 진행해 오늘 교정이 실제로 반영됐는지 확인하는 단계입니다.';
const LEGACY_CORRECTION_REASON_TEXT = '앞모습 드리블에서 좌우 사용량 차이가 커 보여 보정 숙제가 생성됐어요.';
const LEGACY_CORRECTION_DETAIL_TEXT =
  '기존 저장 데이터에는 숙제가 만들어질 때의 좌우 차이 값이 남아 있지 않아 일반 설명을 보여주고 있어요. 덜 사용한 쪽 드리블을 10회 더 연습해 좌우 밸런스를 맞추는 단계입니다.';

const POSITIVE_FEEDBACK_KEYWORDS = ['좋습니다', '좋아요', '안정적', '균형이 좋습니다', '타이밍이 안정적', '준비 자세가 좋습니다'];

interface BuildHomeworkProgressInput {
  dateKey: string;
  dailyDribbleCount: number;
  shootAttemptCount: number;
  shotSuccessCount: number;
  lessonRecords: LessonRecord[];
  dailyState: DailyHomeworkState;
}

interface HomeworkProgressItemOptions {
  reasonText?: HomeworkProgressItem['reasonText'];
  detailToggleText?: HomeworkProgressItem['detailToggleText'];
  detailText?: HomeworkProgressItem['detailText'];
  linkedDiaryContext?: HomeworkProgressItem['linkedDiaryContext'];
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
  target: number,
  options: HomeworkProgressItemOptions = {}
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
    reasonText: options.reasonText,
    detailToggleText: options.detailText ? options.detailToggleText ?? DEFAULT_HOMEWORK_DETAIL_TOGGLE_TEXT : undefined,
    detailText: options.detailText,
    linkedDiaryContext: options.linkedDiaryContext ?? null,
  };
}

function getRemainingCount(current: number, target: number) {
  return Math.max(0, target - Math.max(0, Math.trunc(current)));
}

function buildBaseDribbleReasonText(current: number, target: number) {
  const safeCurrent = Math.min(target, Math.max(0, Math.trunc(current)));
  return `오늘 드리블 ${safeCurrent}/${target}회가 기록돼 있어요.`;
}

function buildBaseDribbleDetailText(current: number, target: number) {
  const safeCurrent = Math.min(target, Math.max(0, Math.trunc(current)));
  if (safeCurrent >= target) {
    return `기록일지에서 전체적인 평가를 하기 위해서는 드리블 ${target}회면 충분해요. 오늘 기준 연습량을 이미 채워서 손 교대와 리듬을 더 안정적으로 비교할 수 있어요.`;
  }

  return `기록일지에서 전체적인 평가를 하기 위해서는 드리블 ${target}회면 충분해요. 드리블 레슨으로 들어가서 드리블 ${target}회를 도전해봐요.`;
}

function buildBaseShootReasonText(current: number, target: number) {
  const safeCurrent = Math.min(target, Math.max(0, Math.trunc(current)));
  return `오늘 슛 발사 ${safeCurrent}/${target}회가 기록돼 있어요.`;
}

function buildBaseShootDetailText(current: number, target: number) {
  const safeCurrent = Math.min(target, Math.max(0, Math.trunc(current)));
  if (safeCurrent >= target) {
    return `기록일지에서 전체적인 평가를 하기 위해서는 슛 발사 ${target}번이면 충분해요. 오늘 기준 연습량을 이미 채워서 발사 타이밍과 슛 자세를 더 안정적으로 비교할 수 있어요.`;
  }

  return `기록일지에서 전체적인 평가를 하기 위해서는 슛 발사 ${target}번이면 충분해요. 슛 레슨으로 들어가서 슛 발사 ${target}번을 도전해봐요.`;
}

function getTodayLessonCount(dateKey: string, lessonRecords: LessonRecord[]) {
  return lessonRecords.filter((record) => record.dateKey === dateKey).length;
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

  if (
    text.includes('발사') ||
    text.includes('타이밍') ||
    text.includes('최고점') ||
    text.includes('빨리') ||
    text.includes('늦게') ||
    text.includes('타점') ||
    text.includes('릴리즈 시간') ||
    text.includes('0.6초')
  ) {
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
  return getMostFrequentHomeworkFeedbackSummary(lessonRecords, recentLimit).category;
}

export function getMostFrequentHomeworkFeedbackSummary(
  lessonRecords: LessonRecord[],
  recentLimit = 3
) {
  const counts = new Map<HomeworkFeedbackCategory, number>();
  const recentRecords = lessonRecords.slice(-recentLimit);

  for (const record of recentRecords) {
    const category = getRepresentativeHomeworkFeedbackCategory(record);

    if (!category) {
      continue;
    }

    counts.set(category, (counts.get(category) || 0) + 1);
  }

  const topEntry = [...counts.entries()]
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }

      return left[0].localeCompare(right[0]);
    })[0] ?? null;

  return {
    category: topEntry?.[0] ?? null,
    count: topEntry?.[1] ?? 0,
  };
}

function buildStage2FeedbackReasonText(category: HomeworkFeedbackCategory | null, count: number) {
  if (!category || count <= 0) {
    return '최근 레슨에서 가장 많이 나온 피드백을 정리하고 있어요.';
  }

  return `최근 레슨에서 ${getHomeworkFeedbackCategoryLabel(category)} 피드백이 ${count}번 정도로 가장 많이 나왔습니다.`;
}

function buildStage2FeedbackCoachingText(category: HomeworkFeedbackCategory | null) {
  switch (category) {
    case 'shoot_release_timing':
      return '슛 타이밍은 무릎과 손을 동시에 벌려야 좋은 것입니다. 슛 타이밍을 더욱 신경 써서 슛 레슨을 도전해보세요.';
    case 'shoot_arm_angle':
      return '슛 팔 각도는 팔꿈치와 손목이 자연스럽게 위로 뻗어야 좋은 것입니다. 팔 각도를 더욱 신경 써서 슛 레슨을 도전해보세요.';
    case 'leg_angle':
      return '하체 각도는 무릎을 적절히 굽히고 힘을 실어야 좋은 것입니다. 하체 각도를 더욱 신경 써서 슛 레슨을 도전해보세요.';
    case 'dribble_balance':
      return '좌우 드리블 균형은 양손 사용량이 비슷해야 좋은 것입니다. 덜 익숙한 손을 더욱 신경 써서 드리블 레슨을 도전해보세요.';
    case 'torso_posture':
      return '상체 자세는 허리와 시선이 함께 안정되어야 좋은 것입니다. 자세를 더욱 신경 써서 드리블 레슨을 도전해보세요.';
    default:
      return '가장 많이 나온 피드백을 의식하면서 다시 레슨을 도전해보세요.';
  }
}

function buildHomeworkLinkedRecordPreview(record: LessonRecord): HomeworkLinkedRecordPreview {
  return {
    recordId: record.id,
    dateKey: record.dateKey,
    mode: record.mode,
    thumbnailUri: record.thumbnailUri,
    createdAt: record.createdAt,
  };
}

function buildStage2FeedbackLinkedDiaryContext(
  lessonRecords: LessonRecord[],
  stage2Unlock: HomeworkUnlockSnapshot
): HomeworkDiaryLinkContext | null {
  const feedbackCategory = stage2Unlock.feedbackCategory ?? null;

  if (!feedbackCategory) {
    return null;
  }

  const recordsAtUnlock = lessonRecords.slice(0, Math.max(0, Math.trunc(stage2Unlock.lessonCount)));
  const recentRecordsAtUnlock = recordsAtUnlock.slice(-3);

  if (recentRecordsAtUnlock.length === 0) {
    return null;
  }

  const groupedRecords = new Map<
    string,
    {
      records: LessonRecord[];
      lastMatchIndex: number;
    }
  >();

  recentRecordsAtUnlock.forEach((record, index) => {
    if (getRepresentativeHomeworkFeedbackCategory(record) !== feedbackCategory) {
      return;
    }

    const currentGroup = groupedRecords.get(record.dateKey);

    if (currentGroup) {
      currentGroup.records.push(record);
      currentGroup.lastMatchIndex = index;
      return;
    }

    groupedRecords.set(record.dateKey, {
      records: [record],
      lastMatchIndex: index,
    });
  });

  const selectedGroup =
    [...groupedRecords.entries()]
      .sort((left, right) => {
        if (right[1].records.length !== left[1].records.length) {
          return right[1].records.length - left[1].records.length;
        }

        if (right[1].lastMatchIndex !== left[1].lastMatchIndex) {
          return right[1].lastMatchIndex - left[1].lastMatchIndex;
        }

        return right[0].localeCompare(left[0]);
      })[0] ?? null;

  if (!selectedGroup) {
    return null;
  }

  const [dateKey, group] = selectedGroup;
  const feedbackLabel = getHomeworkFeedbackCategoryLabel(feedbackCategory);
  const previewRecords = [...group.records]
    .slice(-3)
    .reverse()
    .map((record) => buildHomeworkLinkedRecordPreview(record));

  return {
    dateKey,
    title: '피드백 기록 보기',
    feedbackLabel,
    recordIds: group.records.map((record) => record.id),
    previewRecords,
  };
}

function buildBaseHomeworkItems(dribbleCount: number, shootAttemptCount: number) {
  return [
    buildProgressItem('base-dribble', DAILY_DRIBBLE_HOMEWORK_TITLE, 'base', 'daily', dribbleCount, DAILY_DRIBBLE_TARGET, {
      reasonText: buildBaseDribbleReasonText(dribbleCount, DAILY_DRIBBLE_TARGET),
      detailText: buildBaseDribbleDetailText(dribbleCount, DAILY_DRIBBLE_TARGET),
    }),
    buildProgressItem('base-shoot', DAILY_SHOOT_HOMEWORK_TITLE, 'base', 'daily', shootAttemptCount, DAILY_SHOOT_TARGET, {
      reasonText: buildBaseShootReasonText(shootAttemptCount, DAILY_SHOOT_TARGET),
      detailText: buildBaseShootDetailText(shootAttemptCount, DAILY_SHOOT_TARGET),
    }),
  ];
}

function buildStage2FollowupHomeworkItems(
  input: BuildHomeworkProgressInput,
  stage2Unlock: HomeworkUnlockSnapshot
) {
  const followupLessonCount = Math.max(0, getTodayLessonCount(input.dateKey, input.lessonRecords) - stage2Unlock.lessonCount);
  const feedbackCategory = stage2Unlock.feedbackCategory ?? null;
  const feedbackCount = typeof stage2Unlock.feedbackCount === 'number' ? Math.max(0, Math.trunc(stage2Unlock.feedbackCount)) : 0;
  const hasFeedbackEvidence = Boolean(feedbackCategory) && feedbackCount > 0;
  const reasonText = hasFeedbackEvidence
    ? buildStage2FeedbackReasonText(feedbackCategory, feedbackCount)
    : LEGACY_STAGE2_REASON_TEXT;
  const detailText = hasFeedbackEvidence
    ? buildStage2FeedbackCoachingText(feedbackCategory)
    : LEGACY_STAGE2_DETAIL_TEXT;
  const linkedDiaryContext = hasFeedbackEvidence
    ? buildStage2FeedbackLinkedDiaryContext(input.lessonRecords, stage2Unlock)
    : null;

  return [
    buildProgressItem(
      'stage2-feedback',
      '가장 많이 나온 피드백 부분 고치기',
      'position_followup',
      'feedback',
      followupLessonCount,
      POSITION_FEEDBACK_RETRY_TARGET,
      {
        reasonText,
        detailText,
        linkedDiaryContext,
      }
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
  const directionLabel = correctionTask.direction === 'left' ? '왼쪽' : '오른쪽';
  const hasTriggerEvidence =
    typeof correctionTask.triggerLeftCount === 'number'
    && Number.isFinite(correctionTask.triggerLeftCount)
    && typeof correctionTask.triggerRightCount === 'number'
    && Number.isFinite(correctionTask.triggerRightCount)
    && typeof correctionTask.triggerGap === 'number'
    && Number.isFinite(correctionTask.triggerGap);
  const safeTriggerLeftCount = hasTriggerEvidence ? Math.max(0, Math.trunc(correctionTask.triggerLeftCount ?? 0)) : 0;
  const safeTriggerRightCount = hasTriggerEvidence ? Math.max(0, Math.trunc(correctionTask.triggerRightCount ?? 0)) : 0;
  const safeTriggerGap = hasTriggerEvidence ? Math.max(0, Math.trunc(correctionTask.triggerGap ?? 0)) : 0;
  const reasonText = hasTriggerEvidence
    ? `앞모습 드리블에서 왼손 ${safeTriggerLeftCount}회, 오른손 ${safeTriggerRightCount}회로 ${safeTriggerGap}회 차이가 나서 ${directionLabel} 보정이 필요해요.`
    : LEGACY_CORRECTION_REASON_TEXT;
  const detailText = hasTriggerEvidence
    ? `이 숙제는 덜 사용한 ${directionLabel} 드리블을 10회 더 연습해 좌우 밸런스를 맞추기 위한 단계예요. 숙제가 생성될 때 기준 차이는 ${safeTriggerGap}회였고, 현재 보정 진행도는 ${Math.min(progress, CORRECTION_DRIBBLE_TARGET)}/${CORRECTION_DRIBBLE_TARGET}회예요.`
    : LEGACY_CORRECTION_DETAIL_TEXT;

  return buildProgressItem(
    `correction-${correctionTask.direction}`,
    title,
    'correction',
    'dribble_balance',
    progress,
    CORRECTION_DRIBBLE_TARGET,
    {
      reasonText,
      detailText,
    }
  );
}

export function buildDailyHomeworkProgress(input: BuildHomeworkProgressInput): HomeworkProgressItem[] {
  const baseItems = buildBaseHomeworkItems(input.dailyDribbleCount, input.shootAttemptCount);
  const correctionItem = buildCorrectionHomeworkItem(input.dailyState.correctionTask, input.dailyState);
  const stage2Unlock = input.dailyState.stage2Unlock;

  if (!stage2Unlock) {
    return correctionItem ? [...baseItems, correctionItem] : baseItems;
  }

  const followupItems = buildStage2FollowupHomeworkItems(input, stage2Unlock);
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
  lessonCount: number,
  feedbackSummary?: {
    category: HomeworkFeedbackCategory | null;
    count: number;
  }
): HomeworkUnlockSnapshot {
  return {
    unlockedAt: new Date().toISOString(),
    position,
    dribbleCount,
    shootAttemptCount,
    shotSuccessCount,
    lessonCount,
    feedbackCategory: feedbackSummary?.category ?? null,
    feedbackCount: typeof feedbackSummary?.count === 'number' ? Math.max(0, Math.trunc(feedbackSummary.count)) : 0,
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
    triggerLeftCount: safeLeftCount,
    triggerRightCount: safeRightCount,
    triggerGap: gap,
  };
}

export function getHomeworkCompletionMessage(type: 'dribble' | 'shoot') {
  return type === 'dribble'
    ? `${DAILY_DRIBBLE_HOMEWORK_TITLE} 숙제를 완수했어요.`
    : `${DAILY_SHOOT_HOMEWORK_TITLE} 숙제를 완수했어요.`;
}
