import type { DribbleAnalysis, LessonMode, ShootAnalysis } from '../types/app';

export function buildFeedbackText(mode: LessonMode, lines: [string, string, string]): string {
  const title = mode === 'shoot' ? '슛 피드백' : '드리블 피드백';
  return `${title}\n1. ${lines[0]}\n2. ${lines[1]}\n3. ${lines[2]}`;
}

export function buildDribbleFeedbackText(analysis: DribbleAnalysis): string {
  const eyeLine =
    analysis.eyeFocus === 'ball'
      ? '시선이 공으로 내려가 있어요. 공이 아니라 앞을 보고 드리블해 보세요.'
      : analysis.eyeFocus === 'forward'
        ? '시선 처리가 좋아요. 계속 앞을 보면서 드리블을 이어가 보세요.'
        : '시선 판정이 아직 불안정해요. 얼굴과 상체가 화면 안에 잘 보이도록 맞춰 주세요.';

  const dribbleLine =
    !analysis.dribbleStarted
      ? '공이 무릎이나 발 가까이 내려와 드리블이 시작되는 순간을 기다리고 있어요. 공을 바닥 쪽까지 내려 드리블해 보세요.'
      : analysis.dribbleHeight === 'high'
        ? '드리블 간격이 높아요. 공을 조금 더 낮게 드리블해 보세요.'
        : analysis.dribbleHeight === 'low'
          ? '드리블 간격이 낮아요. 공을 조금 더 높게 드리블해 보세요.'
          : analysis.dribbleHeight === 'balanced'
            ? '드리블 높이가 좋아요. 지금 리듬을 유지해 보세요.'
            : '공의 높이를 더 정확히 보려면 손과 공이 함께 화면 안에 보이도록 맞춰 주세요.';

  const torsoLine =
    analysis.torsoPosture === 'high'
      ? '상체가 너무 높게 서 있어요. 무릎을 굽히고 상체를 조금 더 낮춰 보세요.'
      : analysis.torsoPosture === 'low'
        ? '상체가 너무 많이 숙여져 있어요. 상체를 조금 더 세워 균형을 맞춰 보세요.'
        : analysis.torsoPosture === 'balanced'
          ? '상체 높이가 안정적이에요. 지금 자세를 유지해 보세요.'
          : '어깨와 엉덩이가 함께 보이도록 카메라 각도를 맞춰 주세요.';

  return `드리블 피드백\n1. ${eyeLine}\n2. ${dribbleLine}\n3. ${torsoLine}`;
}

export function buildShootFeedbackText(analysis: ShootAnalysis): string {
  const armLine =
    analysis.armAngleState === 'narrow'
      ? '어깨, 팔꿈치, 손목 각도가 너무 좁아요. 팔을 조금 더 벌려서 밀어 넣어 보세요.'
      : analysis.armAngleState === 'wide'
        ? '어깨, 팔꿈치, 손목 각도가 너무 넓어요. 팔을 조금 더 좁혀 힘을 모아 보세요.'
        : analysis.armAngleState === 'balanced'
          ? '팔 각도가 좋아요. 지금 슛 폼을 유지해 보세요.'
          : '팔 각도를 안정적으로 보기 위해 어깨부터 손목까지 화면 안에 잘 보이도록 맞춰 주세요.';

  const timingLine =
    analysis.releaseTiming === 'early'
      ? '공을 너무 빨리 던지고 있어요. 슛을 급하게 하지 말고 최고점에 가깝게 릴리스해 보세요.'
      : analysis.releaseTiming === 'late'
        ? '공을 너무 늦게 던지고 있어요. 점프 힘을 쓰려면 슛을 조금 더 일찍 던져 보세요.'
        : analysis.releaseTiming === 'balanced'
          ? '슛 타이밍이 좋아요. 점프 최고점 근처에서 자연스럽게 릴리스하고 있어요.'
          : '점프와 릴리스 타이밍을 판단하는 중이에요. 전신이 함께 보이도록 맞춰 주세요.';

  const legLine =
    analysis.legAngleState === 'low'
      ? '무릎이 너무 많이 접혀 있어요. 무릎을 조금 더 펴서 안정적으로 점프해 보세요.'
      : analysis.legAngleState === 'high'
        ? '하체 각도가 높아요. 자세를 조금 더 낮춰 점프 힘을 더 만들어 보세요.'
        : analysis.legAngleState === 'balanced'
          ? '하체 각도가 안정적이에요. 지금 자세를 유지해 보세요.'
          : '엉덩이, 무릎, 발이 모두 보이도록 카메라를 맞추면 하체 분석이 더 정확해져요.';

  return `슛 피드백\n1. ${armLine}\n2. ${timingLine}\n3. ${legLine}`;
}
