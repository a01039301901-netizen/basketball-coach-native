import type { DribbleAnalysis, LessonMode, ShootAnalysis } from '../types/app';

export function buildFeedbackText(mode: LessonMode, lines: [string, string, string]): string {
  const title = mode === 'shoot' ? '슛 피드백' : '드리블 피드백';
  return `${title}\n1. ${lines[0]}\n2. ${lines[1]}\n3. ${lines[2]}`;
}

export function buildDribbleFeedbackText(analysis: DribbleAnalysis): string {
  if (analysis.bodyFacing === 'front') {
    const stanceLine =
      analysis.stanceState === 'ready'
        ? `무릎-엉덩이-무릎 각도 ${analysis.frontStanceAngle ? analysis.frontStanceAngle.toFixed(1) : '--'}도로 준비 자세가 잘 잡혔습니다.`
        : `무릎-엉덩이-무릎 각도가 ${analysis.frontStanceAngle ? analysis.frontStanceAngle.toFixed(1) : '--'}도예요. 40~60도가 되도록 자세를 다시 맞춰 주세요.`;

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

    return `드리블 피드백\n1. ${stanceLine}\n2. ${laneLine}\n3. ${balanceLine} ${footLine}`;
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

  return `드리블 피드백\n1. ${stanceLine}\n2. ${eyeLine}\n3. ${bounceLine}`;
}

export function buildShootFeedbackText(analysis: ShootAnalysis): string {
  const armLine =
    analysis.armAngleState === 'narrow'
      ? '준비 자세에서 팔 각도가 좁습니다. 어깨, 팔꿈치, 손목 각도를 조금 더 벌려 90~110도로 맞춰 주세요.'
      : analysis.armAngleState === 'wide'
        ? '준비 자세에서 팔 각도가 넓습니다. 팔을 조금 더 모아 90~110도로 맞춰 주세요.'
        : analysis.armAngleState === 'balanced'
          ? '슛 준비 자세의 팔 각도는 좋습니다. 그대로 유지해 보세요.'
          : '어깨, 팔꿈치, 손목이 잘 보이도록 서서 준비 자세를 다시 잡아 주세요.';

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
      ? '점프 최고점 전에 슛을 발사했습니다. 너무 급하게 쏘지 말고 조금 더 끌고 가 보세요.'
      : analysis.releaseTiming === 'late'
        ? '점프가 내려오는 구간에서 슛을 발사했습니다. 조금 더 이르게 던져 보세요.'
        : analysis.releaseTiming === 'balanced'
          ? '점프 최고점 근처에서 슛을 발사하고 있습니다. 타이밍이 좋습니다.'
          : '점프 최고점과 슛 발사 시점을 확인하는 중입니다. 전신이 잘 보이도록 맞춰 주세요.';

  return `슛 피드백\n1. ${armLine}\n2. ${legLine}\n3. ${timingLine}`;
}
