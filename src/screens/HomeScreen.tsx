import { StyleSheet, Text, View } from 'react-native';
import { Card } from '../components/common/Card';
import { PrimaryButton } from '../components/common/Buttons';
import { colors } from '../theme/colors';

interface HomeScreenProps {
  homeworkToShow: string[];
  onOpenLesson: () => void;
  onOpenDiary: () => void;
  onOpenSkill: () => void;
}

export function HomeScreen({ homeworkToShow, onOpenLesson, onOpenDiary, onOpenSkill }: HomeScreenProps) {
  return (
    <View style={styles.contentGap}>
      <Card title="오늘은 어떤 연습을 할까요?" style={styles.heroCard}>
        <Text style={styles.paragraph}>
          기존 시안의 흐름을 바탕으로 다시 만든 모바일 전용 농구 코치 앱입니다. 원하는 기능을 선택해서 연습을 시작해 보세요.
        </Text>
        <View style={styles.verticalGap}>
          <PrimaryButton
            title="AI 레슨 받기"
            subtitle="카메라로 촬영하면서 드리블 또는 슛 코칭 피드백을 확인합니다."
            onPress={onOpenLesson}
          />
          <PrimaryButton
            title="기록일지 보기"
            subtitle="출석, 슛 성공 개수, 저장된 레슨 영상을 날짜별로 확인합니다."
            onPress={onOpenDiary}
          />
          <PrimaryButton
            title="기술 배우기"
            subtitle="선수별 기술 포인트와 유튜브 검색 링크를 확인합니다."
            onPress={onOpenSkill}
          />
        </View>
      </Card>

      <Card title="오늘의 숙제">
        {homeworkToShow.map((item) => (
          <View key={item} style={styles.homeworkItem}>
            <Text style={styles.homeworkText}>{item}</Text>
          </View>
        ))}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  contentGap: {
    gap: 18,
  },
  heroCard: {
    minHeight: 320,
  },
  paragraph: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 23,
    marginBottom: 18,
  },
  verticalGap: {
    gap: 16,
  },
  homeworkItem: {
    backgroundColor: colors.surfaceStrong,
    borderRadius: 16,
    borderLeftWidth: 5,
    borderLeftColor: '#ffb547',
    padding: 16,
    marginBottom: 12,
  },
  homeworkText: {
    color: colors.textSoft,
    fontSize: 15,
    lineHeight: 22,
  },
});
