import type { Skill, SkillKey } from '../types/app';

export const REQUIRED_HOMEWORK = '농구 영상 1개 촬영하기';
export const REQUIRED_SKILL_HOMEWORK = '새로운 기술 배우기';

export const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'] as const;

export const SKILLS: Record<SkillKey, Skill> = {
  shoot: {
    title: '슛 폼',
    player: '스테픈 커리',
    point: '무릎, 팔꿈치, 손목이 자연스럽게 이어지는 릴리즈를 관찰해 보세요.',
    query: 'Stephen Curry shooting form tutorial',
  },
  crossover: {
    title: '크로스오버',
    player: '앨런 아이버슨',
    point: '몸 방향을 속이고 공을 빠르게 반대쪽으로 넘기는 타이밍을 보세요.',
    query: 'Allen Iverson crossover tutorial',
  },
  layup: {
    title: '레이업',
    player: '카이리 어빙',
    point: '스텝과 손목 감각, 림 근처 마무리 동작을 관찰해 보세요.',
    query: 'Kyrie Irving layup tutorial',
  },
  stepback: {
    title: '스텝백',
    player: '제임스 하든',
    point: '뒤로 빠지는 발 동작과 슛 밸런스를 집중해서 보세요.',
    query: 'James Harden step back tutorial',
  },
  spin: {
    title: '스핀무브',
    player: '르브론 제임스',
    point: '수비수를 등지고 회전할 때 중심을 잃지 않는 자세를 보세요.',
    query: 'LeBron James spin move tutorial',
  },
  defense: {
    title: '수비 자세',
    player: '카와이 레너드',
    point: '낮은 자세, 발 이동, 손 위치를 관찰해 보세요.',
    query: 'Kawhi Leonard defense tutorial',
  },
};
