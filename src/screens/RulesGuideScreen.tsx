import { useMemo, useState, type PropsWithChildren } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card } from '../components/common/Card';
import { RULE_GUIDE_MEMORY_LINES, RULE_GUIDE_SECTIONS } from '../constants/rulesGuide';
import { colors } from '../theme/colors';

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
  const [openedSections, setOpenedSections] = useState<Record<string, boolean>>(() => ({
    ...Object.fromEntries(RULE_GUIDE_SECTIONS.map((section) => [section.title, true])),
    memory: true,
  }));
  const sectionEntries = useMemo(() => RULE_GUIDE_SECTIONS, []);

  function toggleSection(sectionKey: string) {
    setOpenedSections((current) => ({
      ...current,
      [sectionKey]: !current[sectionKey],
    }));
  }

  return (
    <View style={styles.layout}>
      <Card title="농구 규칙 가이드" style={styles.heroCard}>
        <Text style={styles.heroText}>
          초보자가 먼저 알아두면 좋은 기본 규칙만 모았습니다. 경기 목표, 득점 방식, 드리블 반칙, 시간 규칙까지 한 번에 빠르게 볼 수 있습니다.
        </Text>
      </Card>

      {sectionEntries.map((section) => (
        <CollapsibleRuleCard
          key={section.title}
          title={section.title}
          isOpen={Boolean(openedSections[section.title])}
          onToggle={() => toggleSection(section.title)}
          style={styles.sectionCard}
        >
          <View style={styles.lineList}>
            {section.lines.map((line, index) => (
              <View key={`${section.title}-${index}`} style={styles.lineRow}>
                <View style={styles.bullet} />
                <Text style={styles.lineText}>{line}</Text>
              </View>
            ))}
          </View>
          {section.source ? <Text style={styles.sourceText}>{section.source}</Text> : null}
        </CollapsibleRuleCard>
      ))}

      <CollapsibleRuleCard
        title="초보자가 꼭 기억할 5가지"
        isOpen={Boolean(openedSections.memory)}
        onToggle={() => toggleSection('memory')}
        style={styles.memoryCard}
      >
        <View style={styles.memoryList}>
          {RULE_GUIDE_MEMORY_LINES.map((line, index) => (
            <View key={`memory-${index}`} style={styles.memoryItem}>
              <Text style={styles.memoryText}>{line}</Text>
            </View>
          ))}
        </View>
      </CollapsibleRuleCard>
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
  sectionCard: {
    gap: 10,
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
  sourceText: {
    marginTop: 12,
    color: colors.textAccent,
    fontSize: 13,
    lineHeight: 20,
  },
  memoryCard: {
    marginBottom: 8,
  },
  memoryList: {
    gap: 10,
  },
  memoryItem: {
    borderRadius: 14,
    backgroundColor: colors.surfaceStrong,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  memoryText: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.9,
  },
});
