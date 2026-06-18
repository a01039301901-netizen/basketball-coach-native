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
    lineHeight: 21,
    marginBottom: 16,
  },
  skillGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  skillButton: {
    width: '48%',
    borderRadius: 14,
    padding: 16,
    backgroundColor: colors.surfaceStrong,
    borderWidth: 1,
    borderColor: colors.border,
  },
  skillButtonActive: {
    backgroundColor: 'rgba(208,145,85,0.18)',
    borderColor: 'rgba(208,145,85,0.32)',
  },
  skillButtonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  skillViewer: {
    backgroundColor: colors.surfaceStrong,
    borderRadius: 16,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  skillTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  skillInfo: {
    color: colors.textSoft,
    fontSize: 15,
    lineHeight: 21,
  },
  pressed: {
    opacity: 0.9,
  },
});
