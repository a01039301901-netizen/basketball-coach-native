import type { DribbleAnalysis, LessonMode, ShootAnalysis } from '../types/app';

export function buildFeedbackText(mode: LessonMode, lines: [string, string, string]): string {
  const title = mode === 'shoot' ? '슛 피드백' : '드리블 피드백';
  return `${title}\n1. ${lines[0]}\n2. ${lines[1]}\n3. ${lines[2]}`;
}

export function buildDribbleFeedbackText(analysis: DribbleAnalysis): string {
  const stabilityLine = getDribbleStabilityFeedback(analysis);

  if (analysis.dribbleView === 'front') {
    const stanceLine =
      analysis.stanceState === 'ready'
        ? `발-무릎-엉덩이 각도 ${analysis.frontStanceAngle ? analysis.frontStanceAngle.toFixed(1) : '--'}도로 준비 자세가 잘 잡혔습니다.`
        : `발-무릎-엉덩이 각도가 ${analysis.frontStanceAngle ? analysis.frontStanceAngle.toFixed(1) : '--'}도예요. 140~170도가 되도록 자세를 다시 맞춰 주세요.`;

    const laneLine =
      analysis.frontBallLaneState === 'between_legs'
        ? '공이 다리 사이로 들어가 있습니다. 다리 사이가 아니라 옆쪽에서 드리블해 주세요.'
        : analysis.frontBallLaneState === 'outside_legs'
          ? '공 위치는 좋습니다. 다리 사이가 아니라 옆쪽에서 드리블하고 있습니다.'
          : '공 위치를 확인하는 중입니다. 공과 다리가 함께 보이도록 맞춰 주세요.';

    const balanceLine =
      analysis.handBalanceState === 'unbalanced'
        ? `왼손 ${analysis.leftHandDribbleCount}회, 오른손 ${analysis.rightHandDribbleCount}회로 차이가 있습니다. 양손 숙련도가 불균형할 수 있어요.`
        : analysis.handBalanceState === 'balanced'
          ? `왼손 ${analysis.leftHandDribbleCount}회, 오른손 ${analysis.rightHandDribbleCount}회로 균형이 좋습니다.`
          : '양손 드리블 횟수를 세는 중입니다.';

    const footLine =
      analysis.footSpacingState === 'narrow'
        ? '발 간격이 어깨보다 좁습니다. 조금 더 벌려 주세요.'
        : analysis.footSpacingState === 'wide'
          ? '발 간격이 어깨 너비의 두 배 이상입니다. 조금만 좁혀 주세요.'
          : analysis.footSpacingState === 'balanced'
            ? '발 간격은 안정적입니다.'
            : '발 간격을 확인하는 중입니다.';

    return `드리블 피드백\n1. ${stanceLine}\n2. ${laneLine}\n3. ${stabilityLine ?? `${balanceLine} ${footLine}`}`;
  }

  const stanceLine =
    analysis.stanceState === 'too_upright'
      ? `상체 기울기가 ${analysis.torsoLeanAngle ? analysis.torsoLeanAngle.toFixed(1) : '--'}도라서 조금 더 숙여 주세요.`
      : analysis.stanceState === 'too_low'
        ? `상체 기울기가 ${analysis.torsoLeanAngle ? analysis.torsoLeanAngle.toFixed(1) : '--'}도라서 너무 많이 숙였습니다. 조금 세워 주세요.`
        : analysis.stanceState === 'ready'
          ? `상체 기울기 ${analysis.torsoLeanAngle ? analysis.torsoLeanAngle.toFixed(1) : '--'}도로 준비 자세가 좋습니다.`
          : '어깨와 엉덩이가 잘 보이도록 서서 상체 기울기를 다시 확인해 주세요.';

  const eyeLine =
    analysis.eyeFocus === 'ball'
      ? '시선이 공으로 내려가 있습니다. 공이 아니라 앞을 보고 드리블해 주세요.'
      : analysis.eyeFocus === 'forward'
        ? '시선 처리는 좋습니다. 계속 앞을 보고 드리블해 주세요.'
        : '시선 판정이 아직 불안정합니다. 얼굴과 상체가 잘 보이도록 맞춰 주세요.';

  const bounceLine =
    !analysis.dribbleStarted
      ? '공이 발 가까이 내려왔다가 다시 올라오면 드리블이 시작된 것으로 보고 분석을 이어갑니다.'
      : analysis.bounceHighState === 'too_high'
        ? `공 최고 높이가 어깨보다 높습니다. 공을 조금 더 낮게 튀겨 주세요. 현재 드리블 ${analysis.dribbleCount}회입니다.`
        : analysis.bounceLowState === 'too_low'
          ? `공 최저 높이가 엉덩이보다 위에 머물고 있습니다. 공을 조금 더 높게 튀겨 주세요. 현재 드리블 ${analysis.dribbleCount}회입니다.`
          : `공의 간격은 안정적입니다. 지금 리듬을 유지해 보세요. 현재 드리블 ${analysis.dribbleCount}회입니다.`;

  return `드리블 피드백\n1. ${stanceLine}\n2. ${eyeLine}\n3. ${stabilityLine ?? bounceLine}`;
}

export function buildShootFeedbackText(analysis: ShootAnalysis): string {
  const armLine =
    analysis.armAngleState === 'narrow'
      ? '준비 자세에서 팔 각도가 좁습니다. 어깨, 팔꿈치, 손목 각도를 조금 더 벌려 80~120도로 맞춰 주세요.'
      : analysis.armAngleState === 'wide'
        ? '준비 자세에서 팔 각도가 넓습니다. 팔을 조금 더 모아 80~120도로 맞춰 주세요.'
        : analysis.armAngleState === 'balanced'
          ? '슛 준비 자세의 팔 각도는 좋습니다. 그대로 유지해 보세요.'
          : '어깨, 팔꿈치, 손목이 잘 보이도록 서서 준비 자세를 다시 잡아 주세요.';

  const releasePointLine =
    analysis.releasePointState === 'high'
      ? '발사 직전 가장 최근 공의 위치가 머리보다 위에 있어 슛 타점이 좋습니다.'
      : analysis.releasePointState === 'low'
        ? '발사 직전 가장 최근 공의 위치가 머리보다 아래에 있습니다. 공을 조금 더 높게 끌어올려 슛해 주세요.'
        : '발사 직전 가장 최근 공의 위치를 확인하는 중입니다. 머리와 공이 함께 보이도록 맞춰 주세요.';

  const legLine =
    analysis.legAngleState === 'low'
      ? `점프 준비 자세의 하체 각도가 ${analysis.lowestLegAngle ? analysis.lowestLegAngle.toFixed(1) : '--'}도로 너무 낮습니다. 무릎을 조금 더 펴서 점프해 주세요.`
      : analysis.legAngleState === 'high'
        ? `점프 준비 자세의 하체 각도가 ${analysis.lowestLegAngle ? analysis.lowestLegAngle.toFixed(1) : '--'}도로 너무 높습니다. 자세를 더 낮춰 점프해 주세요.`
        : analysis.legAngleState === 'balanced'
          ? '점프 준비 자세의 하체 각도는 안정적입니다.'
          : '엉덩이, 무릎, 발이 잘 보이도록 서서 하체 자세를 확인해 주세요.';

  const timingLine =
    analysis.releaseTiming === 'early'
      ? '무릎이 펴지기 전에 팔이 먼저 급하게 펴졌습니다. 하체가 올라오는 흐름과 팔 타이밍을 더 맞춰 보세요.'
      : analysis.releaseTiming === 'late'
        ? '무릎이 먼저 펴지고 난 뒤 팔이 늦게 따라 나왔습니다. 하체와 팔이 더 함께 펴지도록 맞춰 보세요.'
        : analysis.releaseTiming === 'balanced'
          ? '무릎이 가장 많이 굽혀진 뒤 무릎과 팔이 함께 펴지며 슛이 나가고 있습니다. 타이밍이 좋습니다.'
          : '무릎이 가장 많이 굽혀진 뒤 무릎과 팔이 함께 펴지는 흐름을 확인하는 중입니다. 하체와 슈팅 팔이 잘 보이도록 맞춰 주세요.';

  const releaseDurationText =
    analysis.releaseDurationMs !== null ? `${(analysis.releaseDurationMs / 1000).toFixed(2)}초` : '--';
  const releaseDurationLine =
    analysis.releaseDurationState === 'balanced'
      ? `가장 많이 굽힌 무릎 이후 ${releaseDurationText} 만에 릴리즈되어 0.6초 기준 안에서 안정적입니다.`
      : analysis.releaseDurationState === 'slow'
        ? `가장 많이 굽힌 무릎 이후 ${releaseDurationText} 뒤에 릴리즈되어 0.6초 기준보다 늦었습니다. 조금 더 빠르게 공을 놓아 보세요.`
        : '가장 많이 굽힌 무릎 이후 릴리즈 시간을 확인하는 중입니다. 하체와 슈팅 순간이 함께 보이도록 맞춰 주세요.';

  return `슛 피드백\n1. ${armLine}\n2. ${legLine}\n3. ${timingLine}\n4. ${releasePointLine}\n5. ${releaseDurationLine}`;
}

function getStabilitySeverity(state: DribbleAnalysis['positionStabilityState']) {
  if (state === 'unstable') {
    return 2;
  }

  if (state === 'mixed') {
    return 1;
  }

  return 0;
}

function getDribbleStabilityFeedback(analysis: DribbleAnalysis) {
  if (analysis.stabilitySampleCount <= 0) {
    return null;
  }

  const candidates = [
    {
      key: 'position',
      severity: getStabilitySeverity(analysis.positionStabilityState),
      text:
        analysis.positionStabilityState === 'unstable'
          ? analysis.dribbleView === 'front'
            ? '공 위치가 매번 달라집니다. 같은 레인에서 반복해 주세요.'
            : '공이 몸 앞뒤로 흔들립니다. 몸통 옆 같은 위치에서 반복해 주세요.'
          : analysis.positionStabilityState === 'mixed'
            ? analysis.dribbleView === 'front'
              ? '공 위치가 조금씩 달라집니다. 같은 레인에서 반복해 주세요.'
              : '공 위치가 조금씩 흔들립니다. 몸통 옆 같은 위치를 유지해 주세요.'
            : null,
    },
    {
      key: 'height',
      severity: getStabilitySeverity(analysis.heightStabilityState),
      text:
        analysis.heightStabilityState === 'unstable'
          ? '드리블 높이가 들쭉날쭉합니다. 같은 높이로 반복해 주세요.'
          : analysis.heightStabilityState === 'mixed'
            ? '드리블 높이가 조금씩 달라집니다. 같은 높이로 반복해 주세요.'
            : null,
    },
    {
      key: 'tempo',
      severity: getStabilitySeverity(analysis.tempoStabilityState),
      text:
        analysis.tempoStabilityState === 'unstable'
          ? '드리블 리듬이 흔들립니다. 같은 속도로 반복해 주세요.'
          : analysis.tempoStabilityState === 'mixed'
            ? '드리블 속도가 조금씩 흔들립니다. 같은 리듬을 유지해 주세요.'
            : null,
    },
  ].filter((candidate) => candidate.text && candidate.severity > 0);

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((left, right) => {
    if (right.severity !== left.severity) {
      return right.severity - left.severity;
    }

    const priorityOrder = ['position', 'height', 'tempo'];
    return priorityOrder.indexOf(left.key) - priorityOrder.indexOf(right.key);
  });

  return candidates[0]?.text ?? null;
}
