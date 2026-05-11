import type { DribbleAnalysis, LessonMode, ShootAnalysis } from '../types/app';

export function buildFeedbackText(mode: LessonMode, lines: [string, string, string]): string {
  const title = mode === 'shoot' ? '슛 피드백' : '드리블 피드백';
  return `${title}\n1. ${lines[0]}\n2. ${lines[1]}\n3. ${lines[2]}`;
}

export function buildDribbleFeedbackText(analysis: DribbleAnalysis): string {
  const eyeLine =
    analysis.eyeFocus === 'ball'
      ? '시선이 공 쪽으로 내려가 있어요. 공이 아니라 앞을 보고 드리블해 보세요.'
      : analysis.eyeFocus === 'forward'
        ? '시선 처리가 좋아요. 계속 앞을 보며 드리블해 보세요.'
        : '시선 판정이 불안정해요. 얼굴이 화면에 잘 보이도록 맞춰 주세요.';

  const dribbleLine =
    analysis.dribbleHeight === 'high'
      ? '드리블 간격이 높아요. 공을 조금 더 낮게 튀겨 보세요.'
      : analysis.dribbleHeight === 'low'
        ? '드리블 간격이 낮아요. 공을 조금 더 높게 튀겨 보세요.'
        : analysis.dribbleHeight === 'balanced'
          ? '드리블 높이가 좋아요. 지금 리듬을 유지해 보세요.'
          : '드리블 손 위치가 잘 보이도록 손과 상체를 화면 안에 넣어 주세요.';

  const torsoLine =
    analysis.torsoPosture === 'high'
      ? '상체가 높게 서 있어요. 무릎을 굽히고 상체를 조금 더 낮춰 보세요.'
      : analysis.torsoPosture === 'low'
        ? '상체가 많이 낮아졌어요. 조금만 더 세워서 균형을 잡아 보세요.'
        : analysis.torsoPosture === 'balanced'
          ? '상체 높이가 안정적이에요. 지금 자세를 유지해 보세요.'
          : '어깨와 엉덩이가 잘 보이도록 몸 전체를 화면 안에 맞춰 주세요.';

  return `드리블 피드백\n1. ${eyeLine}\n2. ${dribbleLine}\n3. ${torsoLine}`;
}

export function buildShootFeedbackText(analysis: ShootAnalysis): string {
  const armLine =
    analysis.armAngleState === 'narrow'
      ? '어깨, 팔꿈치, 손목 각도가 좁아요. 팔을 조금 더 벌려서 밀어 넣어 보세요.'
      : analysis.armAngleState === 'wide'
        ? '어깨, 팔꿈치, 손목 각도가 넓어요. 팔을 조금 더 좁혀서 힘을 모아 보세요.'
        : analysis.armAngleState === 'balanced'
          ? '팔 각도가 좋아요. 지금 궤적을 유지해 보세요.'
          : '슈팅 팔 각도를 안정적으로 보기 위해 어깨부터 손목까지 화면에 잘 보이게 해 주세요.';

  const timingLine =
    analysis.releaseTiming === 'early'
      ? '공을 너무 빨리 던지고 있어요. 슛을 급하게 하지 말고 최고점에 가깝게 던져 보세요.'
      : analysis.releaseTiming === 'late'
        ? '공을 너무 늦게 던지고 있어요. 점프 힘을 쓰도록 슛을 조금 더 일찍 던져 보세요.'
        : analysis.releaseTiming === 'balanced'
          ? '슛 타이밍이 좋아요. 점프 최고점에서 자연스럽게 던지고 있어요.'
          : '점프와 릴리스 타이밍을 판단하는 중입니다. 점프 동작이 화면 안에 충분히 보이도록 해 주세요.';

  const legLine =
    analysis.legAngleState === 'low'
      ? '무릎이 너무 많이 접혀 있어요. 무릎을 조금 더 펴서 점프해 보세요.'
      : analysis.legAngleState === 'high'
        ? '하체 각도가 높아요. 자세를 조금 더 낮춰서 점프 힘을 만들어 보세요.'
        : analysis.legAngleState === 'balanced'
          ? '하체 각도가 안정적이에요. 지금 자세를 유지해 보세요.'
          : '엉덩이, 무릎, 발이 잘 보이도록 하체까지 화면 안에 맞춰 주세요.';

  return `슛 피드백\n1. ${armLine}\n2. ${timingLine}\n3. ${legLine}`;
}
