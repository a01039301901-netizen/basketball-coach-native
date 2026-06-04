import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card } from '../components/common/Card';
import { SkillVideoPlayer } from '../components/skill/SkillVideoPlayer';
import { SKILLS } from '../constants/content';
import { colors } from '../theme/colors';
import type { SkillKey } from '../types/app';

interface SkillScreenProps {
  selectedSkillKey: SkillKey | '';
  onSelectSkill: (key: SkillKey) => void;
  onOpenSkillVideo: () => void;
}

export function SkillScreen({ selectedSkillKey, onSelectSkill }: SkillScreenProps) {
  const selectedSkill = selectedSkillKey ? SKILLS[selectedSkillKey] : null;

  return (
    <Card title="농구 기술 배우기">
      <Text style={styles.paragraph}>
        배우고 싶은 농구 기술을 고르면, 이 화면 안에서 바로 영상을 보고 아래 설명으로 핵심 동작도 함께 확인할 수 있습니다.
      </Text>

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
            <Text style={styles.skillType}>{selectedSkill.videoType}</Text>
            <SkillVideoPlayer videoUrl={selectedSkill.videoUrl} />
            <View style={styles.descriptionCard}>
              <Text style={styles.descriptionLabel}>기술 설명</Text>
              <Text style={styles.skillInfo}>{selectedSkill.description}</Text>
            </View>
          </>
        ) : (
          <Text style={styles.skillInfo}>기술을 선택하면 여기에서 영상을 재생하고 설명을 볼 수 있습니다.</Text>
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
    gap: 12,
  },
  skillTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  skillType: {
    color: colors.textAccent,
    fontSize: 14,
    fontWeight: '800',
  },
  descriptionCard: {
    backgroundColor: 'rgba(0,0,0,0.22)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  descriptionLabel: {
    color: colors.textSoft,
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 8,
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
