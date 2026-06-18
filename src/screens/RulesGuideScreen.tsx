import { StyleSheet, Text, View } from 'react-native';
import { Card } from '../components/common/Card';
import { RULE_GUIDE_MEMORY_LINES, RULE_GUIDE_SECTIONS } from '../constants/rulesGuide';
import { colors } from '../theme/colors';

export function RulesGuideScreen() {
  return (
    <View style={styles.layout}>
      <Card title="농구 규칙 가이드" style={styles.heroCard}>
        <Text style={styles.heroText}>
          초보자가 먼저 알아두면 좋은 기본 규칙만 모았습니다. 경기 목표, 득점 방식, 드리블 반칙, 시간 규칙까지 한 번에 빠르게 볼 수 있습니다.
        </Text>
      </Card>

      {RULE_GUIDE_SECTIONS.map((section) => (
        <Card key={section.title} title={section.title} style={styles.sectionCard}>
          <View style={styles.lineList}>
            {section.lines.map((line) => (
              <View key={line} style={styles.lineRow}>
                <View style={styles.bullet} />
                <Text style={styles.lineText}>{line}</Text>
              </View>
            ))}
          </View>
          {section.source ? <Text style={styles.sourceText}>{section.source}</Text> : null}
        </Card>
      ))}

      <Card title="초보자가 꼭 기억할 5가지" style={styles.memoryCard}>
        <View style={styles.memoryList}>
          {RULE_GUIDE_MEMORY_LINES.map((line) => (
            <View key={line} style={styles.memoryItem}>
              <Text style={styles.memoryText}>{line}</Text>
            </View>
          ))}
        </View>
      </Card>
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
});
