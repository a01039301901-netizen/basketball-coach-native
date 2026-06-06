import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SKILLS } from '../constants/content';
import { Card } from '../components/common/Card';
import { SmallButton } from '../components/common/Buttons';
import { colors } from '../theme/colors';
import type { SkillKey } from '../types/app';

interface SkillScreenProps {
  selectedSkillKey: SkillKey | '';
  onSelectSkill: (key: SkillKey) => void;
  onOpenSkillVideo: () => void;
}

export function SkillScreen({ selectedSkillKey, onSelectSkill, onOpenSkillVideo }: SkillScreenProps) {
  const selectedSkill = selectedSkillKey ? SKILLS[selectedSkillKey] : null;

  return (
    <Card title="새로운 기술 배우기">
      <Text style={styles.paragraph}>배우고 싶은 기술을 고르면 대표 선수와 관찰 포인트를 보여주고, 유튜브 검색으로 바로 이어집니다.</Text>

      <View style={styles.skillGrid}>
        {Object.entries(SKILLS).map(([key, value]) => (
          <Pressable
            key={key}
            onPress={() => onSelectSkill(key as SkillKey)}
            style={({ pressed }) => [
              styles.skillButton,
              selectedSkillKey === key && styles.skillButtonActive,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.skillButtonText}>{value.title}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.skillViewer}>
        {selectedSkill ? (
          <>
            <Text style={styles.skillTitle}>{selectedSkill.title}</Text>
            <Text style={styles.skillInfo}>대표 선수: {selectedSkill.player}</Text>
            <Text style={styles.skillInfo}>관찰 포인트: {selectedSkill.point}</Text>
            <SmallButton title="유튜브에서 보기" onPress={onOpenSkillVideo} />
          </>
        ) : (
          <Text style={styles.skillInfo}>기술을 선택하면 여기에서 설명과 영상 이동 버튼을 볼 수 있어요.</Text>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  paragraph: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 23,
    marginBottom: 18,
  },
  skillGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 18,
  },
  skillButton: {
    width: '48%',
    borderRadius: 18,
    padding: 18,
    backgroundColor: colors.primary,
  },
  skillButtonActive: {
    backgroundColor: colors.primaryStrong,
  },
  skillButtonText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  skillViewer: {
    backgroundColor: colors.surfaceStrong,
    borderRadius: 20,
    padding: 18,
    gap: 10,
  },
  skillTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  skillInfo: {
    color: colors.textSoft,
    fontSize: 15,
    lineHeight: 22,
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
});
