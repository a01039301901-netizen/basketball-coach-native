import type { Skill, SkillKey } from '../types/app';

export const REQUIRED_HOMEWORK = '농구 영상 1개 촬영하기';
export const REQUIRED_SKILL_HOMEWORK = '농구 기술 배우기';

export const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'] as const;

export const SKILLS: Record<SkillKey, Skill> = {
  shoot: {
    title: '슛폼',
    videoType: '쇼츠 영상',
    description:
      '공을 농구 골대에 던져 넣어 득점을 위한 동작 자세로 하체의 힘을 이용해 정확한 공의 궤적으로 공을 농구 골대 링에 넣는 기술을 뜻한다.',
    videoUrl: 'https://www.youtube.com/shorts/lMPH9pYclfc',
  },
  crossover: {
    title: '크로스오버',
    videoType: '쇼츠 영상',
    description:
      '드리블 하는 도중에 방향을 바꾸기 위한 동작으로 공을 한 손에서 다른 손으로 넘기는 기술을 뜻한다.',
    videoUrl: 'https://www.youtube.com/shorts/OZOSGKY-AxE',
  },
  layup: {
    title: '레이업',
    videoType: '영상',
    description:
      '골대 근처까지 드리블 해 달려가 힘을 실어 공을 백보드 또는 골대 링에 넣는 기술을 뜻한다.',
    videoUrl: 'https://www.youtube.com/watch?v=mNkVuCJnBy8',
  },
  stepback: {
    title: '스텝백',
    videoType: '쇼츠 영상',
    description:
      '수비수와의 간격을 순간적으로 한 발짝 뒤로 물러 서 거리를 벌려 슛을 쏘는 기술을 뜻한다.',
    videoUrl: 'https://www.youtube.com/shorts/X1sbE7PhNWU',
  },
  spin: {
    title: '스핀무브',
    videoType: '쇼츠 영상',
    description:
      '드리블로 돌파를 할 때 수비수를 제치기 위한 기술로 골대 근처로 돌파하기 위해 180~360도 몸을 회전해 수비수를 제치는 기술을 뜻한다.',
    videoUrl: 'https://www.youtube.com/shorts/_Yo1wcKk0pg',
  },
  defense: {
    title: '수비 자세',
    videoType: '영상',
    description:
      '공격수의 돌파와 슛을 막기 위한 기술로 공격수의 이동을 막거나 슛 방향을 막아 공격수의 공격을 막는 기술을 뜻한다.',
    videoUrl: 'https://www.youtube.com/watch?v=PZbyrDClX9U',
  },
};
