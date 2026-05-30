export interface RuleGuideSection {
  title: string;
  lines: string[];
  source?: string;
}

export const RULE_GUIDE_SECTIONS: RuleGuideSection[] = [
  {
    title: '1. 경기 목표',
    lines: ['농구는 상대 팀보다 더 많은 점수를 얻는 것이 목표입니다.', '공을 상대 골대에 넣으면 득점하고, 경기 종료 시 점수가 높은 팀이 이깁니다.'],
  },
  {
    title: '2. 팀 구성',
    lines: ['한 팀은 코트 위에서 5명이 경기합니다.', '교체 선수와 자유롭게 교체할 수 있습니다.'],
    source: '출처: FIBA Official Basketball Rules - Rule 4 Teams',
  },
  {
    title: '3. 득점 방법',
    lines: ['2점 슛: 3점 라인 안쪽에서 성공하면 2점', '3점 슛: 3점 라인 밖에서 성공하면 3점', '자유투: 반칙으로 얻는 슛으로 성공하면 1점'],
    source: '출처: FIBA Official Basketball Rules - Rule 16 Goal: When made and its value',
  },
  {
    title: '4. 드리블 규칙',
    lines: [
      '공을 들고 그냥 걸을 수는 없습니다. 공을 튀기면서 이동해야 합니다.',
      '트래블링: 공을 잡고 3걸음 이상 이동하면 반칙입니다.',
      '더블 드리블: 드리블을 멈춘 뒤 다시 드리블하면 반칙입니다.',
      '드리블 후 공을 잡았다면 패스나 슛은 가능하지만 다시 드리블하면 안 됩니다.',
    ],
    source: '출처: NBA Rule No.10 Violations',
  },
  {
    title: '5. 반칙(Foul)',
    lines: ['상대 선수에게 불리한 신체 접촉을 하면 반칙입니다.', '대표적인 반칙은 밀기, 잡기, 손이나 몸으로 때리기 같은 불법 접촉입니다.', '반칙 상황에 따라 공격권이나 자유투가 주어집니다.'],
    source: '출처: FIBA Official Basketball Rules - Rule 33 Contact',
  },
  {
    title: '6. 시간 규칙',
    lines: ['24초 공격 제한: 공격 팀은 24초 안에 슛을 시도해야 합니다.', '8초 규칙: 자기 진영에서 상대 진영으로 8초 안에 넘어가야 합니다.', '5초 규칙: 강한 수비를 받을 때 오래 공을 들고 있을 수 없습니다.'],
    source: '출처: FIBA Official Basketball Rules - Rule 29, 28',
  },
  {
    title: '7. 코트 밖 규칙',
    lines: ['공을 가진 사람이 라인 밖을 밟으면 상대 팀 공입니다.', '공이 밖으로 나가면 마지막으로 건드린 팀의 상대가 공격권을 가집니다.'],
  },
  {
    title: '8. 기본 플레이 방법',
    lines: ['공격: 드리블로 이동하고, 패스로 기회를 만들고, 슛으로 득점합니다.', '수비: 상대 앞을 막고, 슛을 방해하고, 공을 빼앗는 것이 기본입니다.'],
  },
];

export const RULE_GUIDE_MEMORY_LINES = [
  '드리블: 공을 튀기면서 이동하기',
  '트래블링: 공을 들고 많이 걷지 않기',
  '더블 드리블: 공을 잡은 뒤 다시 드리블하지 않기',
  '파울: 상대를 밀거나 잡지 않기',
  '득점: 자유투 1점 / 일반슛 2점 / 먼 거리 3점',
];
