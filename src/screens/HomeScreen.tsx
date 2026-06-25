import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { colors } from '../theme/colors';
import type { HomeworkProgressItem } from '../types/app';

type HomeMenuArtworkType = 'lesson' | 'diary' | 'skill';
const lessonPlayerSilhouette = require('../../assets/lesson-player-silhouette.png');
const diaryCalendarArt = require('../../assets/diary-calendar-art.png');

interface HomeScreenProps {
  homeworkToShow: HomeworkProgressItem[];
  isHomeworkVisible: boolean;
  onRevealHomework: () => void;
  onOpenLesson: () => void;
  onOpenDiary: () => void;
  onOpenSkill: () => void;
  onOpenRules: () => void;
  onOpenSettings: () => void;
}

interface HomeMenuButtonProps {
  accentColor: string;
  accentSoft: string;
  artworkType: HomeMenuArtworkType;
  label: string;
  title: string;
  subtitle: string;
  onPress: () => void;
  isWide: boolean;
  isCompact: boolean;
  isFullWidth?: boolean;
  isBorderless?: boolean;
}

function HomeMenuArtwork({ type }: { type: HomeMenuArtworkType }) {
  if (type === 'lesson') {
    return (
      <View pointerEvents="none" style={styles.lessonArtwork}>
        <View style={styles.lessonArtworkGlow} />
        <Image source={lessonPlayerSilhouette} resizeMode="contain" style={styles.lessonArtworkImage} />
      </View>
    );
  }

  if (type === 'diary') {
    return (
      <View pointerEvents="none" style={styles.diaryArtwork}>
        <View style={styles.diaryArtworkBackdrop} />
        <View style={styles.diaryArtworkGlow} />
        <Image source={diaryCalendarArt} resizeMode="contain" style={styles.diaryArtworkImage} />
      </View>
    );
  }

  return null;
}

function HomeMenuButton({
  accentColor,
  accentSoft,
  artworkType,
  label,
  title,
  subtitle,
  onPress,
  isWide,
  isCompact,
  isFullWidth = false,
  isBorderless = false,
}: HomeMenuButtonProps) {
  const hasArtwork = !isCompact && artworkType !== 'skill';
  const isDiaryArtwork = !isCompact && artworkType === 'diary';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.mainButtonWrap,
        isWide && styles.mainButtonWrapWide,
        isFullWidth && styles.mainButtonWrapFull,
        isCompact && styles.mainButtonWrapCompact,
        isCompact && isFullWidth && styles.mainButtonWrapCompactFull,
        pressed && styles.pressed,
      ]}
    >
      <View
        style={[
          styles.mainButton,
          isWide && styles.mainButtonWide,
          isCompact && styles.mainButtonCompact,
          hasArtwork && styles.mainButtonWithArtwork,
          isDiaryArtwork && styles.mainButtonDiary,
          isBorderless && styles.mainButtonBorderless,
        ]}
      >
        <HomeMenuArtwork type={artworkType} />
        <View
          style={[
            styles.mainButtonContent,
            isDiaryArtwork && styles.mainButtonContentDiary,
            isCompact && styles.mainButtonContentCompact,
          ]}
        >
          <View
            style={[
              styles.mainButtonTop,
              isDiaryArtwork && styles.mainButtonTopDiary,
              isCompact && styles.mainButtonTopCompact,
            ]}
          >
            <View style={[styles.mainButtonIcon, isCompact && styles.mainButtonIconCompact, { backgroundColor: accentSoft }]}>
              <View style={[styles.mainButtonIconDot, { backgroundColor: accentColor }]} />
            </View>
            <Text style={[styles.mainButtonLabel, isCompact && styles.mainButtonLabelCompact]}>{label}</Text>
          </View>

          <Text
            style={[
              styles.mainButtonTitle,
              hasArtwork && styles.mainButtonTitleWithArtwork,
              isDiaryArtwork && styles.mainButtonTitleDiary,
              isCompact && styles.mainButtonTitleCompact,
            ]}
          >
            {title}
          </Text>
          <Text
            style={[
              styles.mainButtonSubtitle,
              hasArtwork && styles.mainButtonSubtitleWithArtwork,
              isDiaryArtwork && styles.mainButtonSubtitleDiary,
              isCompact && styles.mainButtonSubtitleCompact,
            ]}
          >
            {subtitle}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

export function HomeScreen({
  homeworkToShow,
  isHomeworkVisible,
  onRevealHomework,
  onOpenLesson,
  onOpenDiary,
  onOpenSkill,
  onOpenRules,
  onOpenSettings,
}: HomeScreenProps) {
  const { width } = useWindowDimensions();
  const isWide = width >= 860;

  const menuButtons = [
    {
      key: 'lesson',
      accentColor: '#f7923a',
      accentSoft: '#ffe0bf',
      artworkType: 'lesson' as const,
      label: '실시간 분석',
      title: 'AI에게 레슨 받기',
      subtitle: '카메라로 동작을 분석하고 실시간 코칭을 받을 수 있어요.',
      onPress: onOpenLesson,
      isBorderless: true,
    },
    {
      key: 'diary',
      accentColor: '#7ab5ff',
      accentSoft: '#dcecff',
      artworkType: 'diary' as const,
      label: '기록 확인',
      title: '기록일지',
      subtitle: '출석, 연습 기록, 저장한 레슨 영상을 날짜별로 확인할 수 있어요.',
      onPress: onOpenDiary,
    },
    {
      key: 'skill',
      accentColor: '#90c95c',
      accentSoft: '#e4f3cf',
      artworkType: 'skill' as const,
      label: '동작 학습',
      title: '프로 레슨 배우기',
      subtitle: '원하는 기술과 선수 영상을 보고 오늘 연습할 동작을 고를 수 있어요.',
      onPress: onOpenSkill,
    },
  ];

  return (
    <View style={styles.layout}>
      <View style={styles.heroCard}>
        <View style={styles.heroTextWrap}>
          <Text style={styles.heroTitle}>오늘 어떤 연습을 시작할까요?</Text>
        </View>

        <Pressable onPress={onOpenSettings} style={({ pressed }) => [styles.settingsButton, pressed && styles.pressed]}>
          <Text style={styles.settingsButtonText}>⚙️</Text>
        </Pressable>
      </View>

      {isWide ? (
        <View style={styles.menuButtonsRow}>
          {menuButtons.map((button) => (
            <HomeMenuButton
              key={button.key}
              accentColor={button.accentColor}
              accentSoft={button.accentSoft}
              artworkType={button.artworkType}
              label={button.label}
              title={button.title}
              subtitle={button.subtitle}
              onPress={button.onPress}
              isWide={isWide}
              isCompact={false}
              isBorderless={button.isBorderless}
            />
          ))}
        </View>
      ) : (
        <View style={styles.menuButtonsStack}>
          {menuButtons.map((button) => (
            <HomeMenuButton
              key={button.key}
              accentColor={button.accentColor}
              accentSoft={button.accentSoft}
              artworkType={button.artworkType}
              label={button.label}
              title={button.title}
              subtitle={button.subtitle}
              onPress={button.onPress}
              isWide={isWide}
              isCompact={false}
              isFullWidth
              isBorderless={button.isBorderless}
            />
          ))}
        </View>
      )}

      <View style={styles.homeworkCard}>
        <View style={styles.homeworkTopRow}>
          <View>
            <Text style={styles.homeworkTitle}>오늘의 연습 숙제</Text>
            <Text style={styles.homeworkDescription}>오늘 날짜 기준으로 숙제 진행도를 확인할 수 있어요.</Text>
          </View>
        </View>

        {isHomeworkVisible ? (
          <View style={styles.homeworkList}>
            {homeworkToShow.map((item) => (
              <View key={item.id} style={styles.homeworkItem}>
                <View style={styles.homeworkHeader}>
                  <View style={[styles.homeworkBullet, item.isCompleted && styles.homeworkBulletCompleted]} />
                  <Text style={styles.homeworkText}>{item.title}</Text>
                </View>
                <View style={styles.homeworkMetaRow}>
                  <Text style={styles.homeworkStatus}>{item.completionText}</Text>
                  <Text style={styles.homeworkProgress}>{item.progressText}</Text>
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${item.progressPercent}%` }]} />
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.homeworkHiddenCard}>
            <Text style={styles.homeworkHiddenTitle}>오늘의 숙제 확인하기</Text>
            <Text style={styles.homeworkHiddenText}>
              버튼을 누르면 오늘 해야 할 숙제 내용과 진행도가 나타나고, 앱 안에서는 계속 보입니다.
            </Text>
            <Pressable onPress={onRevealHomework} style={({ pressed }) => [styles.homeworkRevealButton, pressed && styles.pressed]}>
              <Text style={styles.homeworkRevealButtonText}>오늘의 숙제 확인하기</Text>
            </Pressable>
          </View>
        )}

      </View>

      <View style={[styles.secondaryCards, isWide && styles.secondaryCardsWide]}>
        <Pressable
          onPress={onOpenRules}
          style={({ pressed }) => [styles.rulesCard, isWide && styles.secondaryCardCompactWide, pressed && styles.pressed]}
        >
          <Text style={styles.rulesCardLabel}>Guide</Text>
          <Text style={styles.rulesCardTitle}>농구 규칙 가이드</Text>
          <Text style={styles.rulesCardText}>처음 보는 규칙도 빠르게 확인할 수 있도록 기본 내용을 따로 모아뒀어요.</Text>
        </Pressable>

        <View style={[styles.tipCard, isWide && styles.secondaryCardCompactWide]}>
          <Text style={styles.tipTitle}>연습 팁</Text>
          <Text style={styles.tipText}>기본 숙제를 끝내면 다음 숙제가 열리고, 드리블 균형 차이가 보이면 보정 숙제가 추가됩니다.</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  layout: {
    gap: 16,
  },
  heroCard: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 20,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
  },
  heroTextWrap: {
    flex: 1,
  },
  heroTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
  },
  settingsButton: {
    alignSelf: 'flex-start',
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: colors.surfaceStrong,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsButtonText: {
    fontSize: 20,
  },
  menuButtonsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
  },
  menuButtonsStack: {
    gap: 12,
  },
  mainButtonWrap: {
    width: 232,
    borderRadius: 24,
  },
  mainButtonWrapWide: {
    flex: 1,
    width: undefined,
  },
  mainButtonWrapFull: {
    width: '100%',
  },
  mainButtonWrapCompact: {
    width: '48%',
  },
  mainButtonWrapCompactFull: {
    width: '100%',
  },
  mainButton: {
    minHeight: 178,
    borderRadius: 24,
    padding: 18,
    backgroundColor: colors.surfaceStrong,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    position: 'relative',
  },
  mainButtonBorderless: {
    borderWidth: 0,
    borderColor: 'transparent',
  },
  mainButtonWide: {
    minHeight: 194,
  },
  mainButtonCompact: {
    minHeight: 120,
    borderRadius: 18,
    padding: 14,
  },
  mainButtonWithArtwork: {
    paddingRight: 22,
  },
  mainButtonDiary: {
    backgroundColor: '#27211d',
  },
  mainButtonContent: {
    position: 'relative',
    zIndex: 1,
  },
  mainButtonContentCompact: {
    gap: 4,
  },
  mainButtonContentDiary: {
    maxWidth: 138,
  },
  mainButtonTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  mainButtonTopDiary: {
    marginBottom: 18,
  },
  mainButtonTopCompact: {
    marginBottom: 8,
    gap: 8,
  },
  mainButtonIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainButtonIconCompact: {
    width: 28,
    height: 28,
    borderRadius: 10,
  },
  mainButtonIconDot: {
    width: 18,
    height: 18,
    borderRadius: 999,
  },
  mainButtonLabel: {
    color: colors.textAccent,
    fontSize: 12,
    fontWeight: '700',
  },
  mainButtonLabelCompact: {
    fontSize: 11,
  },
  mainButtonTitle: {
    color: colors.text,
    fontSize: 19,
    fontWeight: '800',
    marginBottom: 8,
  },
  mainButtonTitleCompact: {
    fontSize: 16,
    marginBottom: 4,
  },
  mainButtonTitleWithArtwork: {
    maxWidth: 156,
  },
  mainButtonTitleDiary: {
    maxWidth: 132,
  },
  mainButtonSubtitle: {
    color: colors.textSoft,
    fontSize: 13,
    lineHeight: 19,
  },
  mainButtonSubtitleCompact: {
    fontSize: 12,
    lineHeight: 17,
  },
  mainButtonSubtitleWithArtwork: {
    maxWidth: 154,
  },
  mainButtonSubtitleDiary: {
    maxWidth: 132,
  },
  lessonArtwork: {
    position: 'absolute',
    right: -10,
    bottom: -8,
    width: 154,
    height: 154,
  },
  lessonArtworkGlow: {
    position: 'absolute',
    right: 18,
    bottom: 16,
    width: 110,
    height: 110,
    borderRadius: 999,
    backgroundColor: 'rgba(247, 146, 58, 0.16)',
  },
  lessonArtworkImage: {
    position: 'absolute',
    right: -10,
    bottom: -2,
    width: 152,
    height: 138,
    opacity: 0.34,
  },
  diaryArtwork: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    overflow: 'hidden',
  },
  diaryArtworkBackdrop: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(122, 181, 255, 0.08)',
  },
  diaryArtworkGlow: {
    position: 'absolute',
    right: -28,
    top: -24,
    width: 168,
    height: 168,
    borderRadius: 999,
    backgroundColor: 'rgba(122, 181, 255, 0.12)',
  },
  diaryArtworkImage: {
    position: 'absolute',
    right: -34,
    bottom: -16,
    width: 236,
    height: 188,
    opacity: 0.42,
  },
  homeworkCard: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    borderWidth: 0,
    borderColor: 'transparent',
    padding: 20,
  },
  homeworkTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  homeworkTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 6,
  },
  homeworkDescription: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  homeworkList: {
    gap: 12,
    marginTop: 18,
  },
  homeworkItem: {
    gap: 10,
    backgroundColor: colors.surfaceStrong,
    borderRadius: 18,
    borderWidth: 0,
    borderColor: 'transparent',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  homeworkHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  homeworkBullet: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#f09c46',
  },
  homeworkBulletCompleted: {
    backgroundColor: '#6eb37c',
  },
  homeworkText: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '700',
  },
  homeworkMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  homeworkStatus: {
    color: colors.textAccent,
    fontSize: 13,
    fontWeight: '700',
  },
  homeworkProgress: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  progressTrack: {
    width: '100%',
    height: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.secondary,
  },
  homeworkHiddenCard: {
    marginTop: 18,
    borderRadius: 18,
    backgroundColor: colors.surfaceStrong,
    borderWidth: 0,
    borderColor: 'transparent',
    paddingHorizontal: 18,
    paddingVertical: 20,
    alignItems: 'center',
  },
  homeworkHiddenTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 8,
  },
  homeworkHiddenText: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  homeworkRevealButton: {
    marginTop: 14,
    borderRadius: 999,
    backgroundColor: colors.secondary,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  homeworkRevealButtonText: {
    color: colors.lightButtonText,
    fontSize: 13,
    fontWeight: '700',
  },
  secondaryCards: {
    gap: 12,
  },
  secondaryCardsWide: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  secondaryCardCompactWide: {
    flex: 1,
    width: undefined,
    minWidth: 0,
  },
  rulesCard: {
    flex: 1,
    minHeight: 118,
    borderRadius: 20,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 0,
    borderColor: 'transparent',
  },
  rulesCardLabel: {
    color: colors.textAccent,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: 0.4,
  },
  rulesCardTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 6,
  },
  rulesCardText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  tipCard: {
    flex: 1,
    minHeight: 118,
    borderRadius: 20,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 0,
    borderColor: 'transparent',
  },
  tipTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  tipText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  pressed: {
    opacity: 0.92,
  },
});
