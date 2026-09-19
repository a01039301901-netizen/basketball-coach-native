import { useState, type PropsWithChildren } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card } from '../components/common/Card';
import { colors } from '../theme/colors';

const APP_USAGE_SECTIONS = [
  {
    title: '1. 첫 시작',
    lines: ['메인 화면에서 하루 연습량을 확인하세요.', '하루 연습량은 총 드리블 50개, 슛 20개로 오늘 연습해보세요.'],
  },
  {
    title: '2. AI에게 레슨 받기',
    lines: [
      'AI에게 레슨 받기를 누른 뒤 슛 또는 드리블 레슨을 선택하세요.',
      '카메라에 전신과 농구공이 잘 보이게 두고 연습을 시작하세요.',
      '레슨이 끝나면 자세와 움직임을 분석해 피드백을 제공합니다.',
    ],
  },
  {
    title: '3. 기록일지 확인하기',
    lines: [
      '기록일지에서 날짜별 레슨 기록과 평가를 확인할 수 있습니다.',
      '드리블 횟수, 슛 시도, 성공률, 좌우 드리블 균형을 보고 부족한 점을 복습해 보세요.',
    ],
  },
  {
    title: '4. 오늘의 숙제 활용하기',
    lines: [
      '하루 연습량 숙제는 기록일지에서 정확한 평가를 만들기 위한 최소 연습 목표입니다.',
      '추가 연습 숙제는 최근 피드백이나 좌우 균형을 바탕으로 약한 부분을 보완하도록 추천됩니다.',
      'i 버튼을 누르면 각 숙제가 필요한 이유를 자세히 볼 수 있습니다.',
    ],
  },
  {
    title: '5. 인식 설정 맞추기',
    lines: [
      '설정에서 사용하는 농구공 브랜드와 색상을 선택하세요.',
      '공 사진을 학습시키면 내 공의 색상과 무늬를 더 잘 구분하도록 설정할 수 있습니다.',
    ],
  },
  {
    title: '6. 추천 연습 순서',
    lines: [
      '먼저 하루 연습량을 채웁니다.',
      '기록일지에서 부족한 부분을 확인합니다.',
      '추가 숙제로 약점을 보완합니다.',
      '다음 날에는 새 기록을 바탕으로 다시 연습합니다.',
    ],
  },
] as const;

interface CollapsibleRuleCardProps extends PropsWithChildren {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  style?: object;
}

function CollapsibleRuleCard({ title, isOpen, onToggle, style, children }: CollapsibleRuleCardProps) {
  return (
    <Card style={style}>
      <Pressable
        accessibilityLabel={isOpen ? `${title} 접기` : `${title} 펼치기`}
        onPress={onToggle}
        style={({ pressed }) => [styles.cardHeaderButton, pressed && styles.pressed]}
      >
        <Text style={styles.cardHeaderTitle}>{title}</Text>
        <View style={styles.cardHeaderAction}>
          <Text style={styles.cardHeaderActionText}>{isOpen ? '⌃' : '⌄'}</Text>
        </View>
      </Pressable>
      {isOpen ? children : null}
    </Card>
  );
}

export function RulesGuideScreen() {
  const [openedSections, setOpenedSections] = useState<Record<string, boolean>>({});

  function toggleSection(sectionKey: string) {
    setOpenedSections((current) => ({
      ...current,
      [sectionKey]: !current[sectionKey],
    }));
  }

  return (
    <View style={styles.layout}>
      <Card title="앱 사용법" style={styles.heroCard}>
        <Text style={styles.heroText}>하루 연습량을 채우고 기록을 확인하면서 나에게 맞는 연습 방향을 찾아보세요.</Text>
      </Card>

      {APP_USAGE_SECTIONS.map((section) => (
        <CollapsibleRuleCard
          key={section.title}
          title={section.title}
          isOpen={Boolean(openedSections[section.title])}
          onToggle={() => toggleSection(section.title)}
          style={styles.usageCard}
        >
          <View style={styles.lineList}>
            {section.lines.map((line, index) => (
              <View key={`${section.title}-${index}`} style={styles.lineRow}>
                <View style={styles.bullet} />
                <Text style={styles.lineText}>{line}</Text>
              </View>
            ))}
          </View>
        </CollapsibleRuleCard>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  layout: {
    gap: 16,
  },
  heroCard: {
    backgroundColor: colors.surfaceStrong,
    borderColor: colors.border,
  },
  heroText: {
    color: colors.textSoft,
    fontSize: 15,
    lineHeight: 22,
  },
  cardHeaderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
  },
  cardHeaderTitle: {
    flex: 1,
    color: colors.textSoft,
    fontSize: 20,
    fontWeight: '800',
  },
  cardHeaderAction: {
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: colors.surfaceStrong,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderActionText: {
    color: colors.textAccent,
    fontSize: 18,
    lineHeight: 18,
    fontWeight: '900',
  },
  usageCard: {
    gap: 12,
  },
  lineList: {
    gap: 8,
  },
  lineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  bullet: {
    width: 7,
    height: 7,
    borderRadius: 999,
    marginTop: 7,
    backgroundColor: colors.secondary,
  },
  lineText: {
    flex: 1,
    color: colors.textSoft,
    fontSize: 15,
    lineHeight: 22,
  },
  pressed: {
    opacity: 0.9,
  },
});
