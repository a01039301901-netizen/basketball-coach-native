import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { colors } from '../theme/colors';

interface HomeScreenProps {
  homeworkToShow: string[];
  onOpenLesson: () => void;
  onOpenDiary: () => void;
  onOpenSkill: () => void;
  onOpenRules: () => void;
  onOpenSettings: () => void;
}

interface HomeMenuButtonProps {
  title: string;
  subtitle: string;
  onPress: () => void;
}

function HomeMenuButton({ title, subtitle, onPress }: HomeMenuButtonProps) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.mainButtonWrap, pressed && styles.pressed]}>
      <View style={styles.mainButton}>
        <View style={styles.mainButtonHighlight} />
        <Text style={styles.mainButtonTitle}>{title}</Text>
        <Text style={styles.mainButtonSubtitle}>{subtitle}</Text>
      </View>
    </Pressable>
  );
}

export function HomeScreen({ homeworkToShow, onOpenLesson, onOpenDiary, onOpenSkill, onOpenRules, onOpenSettings }: HomeScreenProps) {
  const { width } = useWindowDimensions();
  const isWide = width >= 860;

  return (
    <View style={[styles.layout, isWide && styles.layoutWide]}>
      <View style={[styles.panel, styles.menuCard, isWide && styles.menuCardWide]}>
        <View style={styles.panelGlow} />
        <Text style={styles.panelTitle}>기능 선택</Text>
        <Text style={styles.panelDescription}>원하는 기능을 선택해서 농구 연습을 시작해보세요.</Text>

        <Pressable onPress={onOpenSettings} style={({ pressed }) => [styles.settingsButton, pressed && styles.pressed]}>
          <Text style={styles.settingsButtonText}>설정</Text>
        </Pressable>
        <View style={styles.menuButtons}>
          <HomeMenuButton
            title="AI에게 레슨 받기"
            subtitle="카메라로 실시간 자세와 공 움직임을 분석하면서 코칭 피드백을 받아보세요."
            onPress={onOpenLesson}
          />
          <HomeMenuButton
            title="기록일지"
            subtitle="날짜별 출석, 슛 성공 기록, 저장한 레슨 영상을 한눈에 확인할 수 있어요."
            onPress={onOpenDiary}
          />
          <HomeMenuButton
            title="프로 기술 배우기"
            subtitle="선수별 핵심 기술 포인트와 연결된 영상으로 오늘 연습할 동작을 골라보세요."
            onPress={onOpenSkill}
          />
          <HomeMenuButton
            title="농구 규칙 가이드"
            subtitle="경기 목표, 득점, 드리블 반칙, 시간 규칙까지 초보자용 기본 규칙을 한 번에 확인해 보세요."
            onPress={onOpenRules}
          />
        </View>
      </View>

      <View style={[styles.panel, styles.homeworkCard, isWide && styles.homeworkCardWide]}>
        <View style={styles.sideAccent} />
        <Text style={styles.panelTitle}>오늘의 연습 숙제</Text>

        <View style={styles.homeworkList}>
          {homeworkToShow.map((item) => (
            <View key={item} style={styles.homeworkItem}>
              <View style={styles.homeworkBullet} />
              <Text style={styles.homeworkText}>{item}</Text>
            </View>
          ))}
        </View>

        <View style={styles.homeTipBox}>
          <Text style={styles.tipTitle}>연습 팁</Text>
          <Text style={styles.tipText}>레슨 전에 공간을 밝게 하고, 공과 전신이 함께 보이도록 거리를 맞추면 분석 정확도가 더 좋아집니다.</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  layout: {
    gap: 18,
  },
  layoutWide: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  panel: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  menuCard: {
    minHeight: 520,
  },
  menuCardWide: {
    flex: 1.3,
  },
  homeworkCard: {
    minHeight: 360,
  },
  homeworkCardWide: {
    flex: 0.9,
  },
  panelGlow: {
    position: 'absolute',
    top: -30,
    right: -20,
    width: 180,
    height: 180,
    borderRadius: 999,
    backgroundColor: 'rgba(255,179,71,0.14)',
  },
  sideAccent: {
    position: 'absolute',
    top: 22,
    right: 20,
    width: 74,
    height: 74,
    borderRadius: 18,
    backgroundColor: 'rgba(255,159,28,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  panelTitle: {
    color: colors.textSoft,
    fontSize: 26,
    fontWeight: '900',
    marginBottom: 8,
  },
  panelDescription: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 23,
  },
  settingsButton: {
    alignSelf: 'flex-end',
    marginTop: 14,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 9,
    backgroundColor: 'rgba(0,0,0,0.28)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  settingsButtonText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  menuButtons: {
    gap: 18,
    marginTop: 20,
  },
  mainButtonWrap: {
    borderRadius: 22,
  },
  mainButton: {
    position: 'relative',
    minHeight: 130,
    borderRadius: 22,
    paddingHorizontal: 24,
    paddingVertical: 24,
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: colors.primaryStrong,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    shadowColor: '#ff7000',
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
  },
  mainButtonHighlight: {
    position: 'absolute',
    top: -18,
    left: -10,
    width: '72%',
    height: '88%',
    borderRadius: 24,
    backgroundColor: 'rgba(255,202,122,0.28)',
  },
  mainButtonTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 10,
  },
  mainButtonSubtitle: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 14,
    lineHeight: 21,
  },
  homeworkList: {
    gap: 14,
    marginTop: 20,
  },
  homeworkItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.13)',
    borderRadius: 16,
    borderLeftWidth: 5,
    borderLeftColor: '#ff9f1c',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  homeworkBullet: {
    width: 10,
    height: 10,
    borderRadius: 999,
    marginTop: 6,
    backgroundColor: '#ffd17d',
  },
  homeworkText: {
    flex: 1,
    color: colors.textSoft,
    fontSize: 15,
    lineHeight: 22,
  },
  homeTipBox: {
    marginTop: 18,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.28)',
    padding: 18,
  },
  tipTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 8,
  },
  tipText: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 22,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ translateY: -2 }],
  },
});
