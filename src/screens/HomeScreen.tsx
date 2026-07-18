import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { colors } from '../theme/colors';
import type { HomeworkProgressItem } from '../types/app';
import { getDesktopMobileFrameWidth, shouldUseDesktopMobileLayout } from '../utils/layout';

type HomeMenuArtworkType = 'lesson' | 'diary';
const lessonPlayerSilhouette = require('../../assets/lesson-player-silhouette.png');
const diaryCalendarArt = require('../../assets/diary-calendar-art.png');
const lessonBallIcon = require('../../assets/lesson-basketball-icon.png');
const diaryPencilIcon = require('../../assets/diary-pencil-icon.png');

interface HomeScreenProps {
  homeworkToShow: HomeworkProgressItem[];
  isHomeworkVisible: boolean;
  onRevealHomework: () => void;
  onOpenLesson: () => void;
  onOpenDiary: () => void;
  onOpenRules: () => void;
}

interface HomeMenuButtonProps {
  accentColor: string;
  accentSoft: string;
  artworkType: HomeMenuArtworkType;
  label: string;
  title: string;
  subtitle?: string;
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

  return (
    <View pointerEvents="none" style={styles.diaryArtwork}>
      <View style={styles.diaryArtworkBackdrop} />
      <View style={styles.diaryArtworkGlow} />
      <Image source={diaryCalendarArt} resizeMode="contain" style={styles.diaryArtworkImage} />
    </View>
  );
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
  const hasArtwork = !isCompact;
  const isDiaryArtwork = !isCompact && artworkType === 'diary';
  const hasSubtitle = Boolean(subtitle);

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
          !hasSubtitle && styles.mainButtonNoSubtitle,
          isWide && styles.mainButtonWide,
          isWide && !hasSubtitle && styles.mainButtonWideNoSubtitle,
          isCompact && styles.mainButtonCompact,
          isCompact && !hasSubtitle && styles.mainButtonCompactNoSubtitle,
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
              !hasSubtitle && styles.mainButtonTopNoSubtitle,
              isDiaryArtwork && styles.mainButtonTopDiary,
              isDiaryArtwork && !hasSubtitle && styles.mainButtonTopDiaryNoSubtitle,
              isCompact && styles.mainButtonTopCompact,
              isCompact && !hasSubtitle && styles.mainButtonTopCompactNoSubtitle,
            ]}
          >
            <View style={[styles.mainButtonIcon, isCompact && styles.mainButtonIconCompact, { backgroundColor: accentSoft }]}>
              {artworkType === 'lesson' ? (
                <Image source={lessonBallIcon} resizeMode="contain" style={[styles.lessonBallIcon, isCompact && styles.lessonBallIconCompact]} />
              ) : (
                <Image source={diaryPencilIcon} resizeMode="contain" style={[styles.diaryPencilIcon, isCompact && styles.diaryPencilIconCompact]} />
              )}
            </View>
            <Text style={[styles.mainButtonLabel, isCompact && styles.mainButtonLabelCompact]}>{label}</Text>
          </View>

          <Text
            style={[
              styles.mainButtonTitle,
              hasSubtitle && styles.mainButtonTitleWithSubtitle,
              hasArtwork && styles.mainButtonTitleWithArtwork,
              isDiaryArtwork && styles.mainButtonTitleDiary,
              isCompact && styles.mainButtonTitleCompact,
              isCompact && hasSubtitle && styles.mainButtonTitleCompactWithSubtitle,
            ]}
          >
            {title}
          </Text>
          {hasSubtitle ? (
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
          ) : null}
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
  onOpenRules,
}: HomeScreenProps) {
  const { width } = useWindowDimensions();
  const layoutWidth = shouldUseDesktopMobileLayout(width) ? getDesktopMobileFrameWidth(width) : width;
  const isWide = layoutWidth >= 860;

  const menuButtons = [
    {
      key: 'lesson',
      accentColor: '#f7923a',
      accentSoft: '#ffe0bf',
      artworkType: 'lesson' as const,
      label: '실시간 분석',
      title: 'AI에게 레슨 받기',
      subtitle: undefined,
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
      subtitle: undefined,
      onPress: onOpenDiary,
    },
  ];

  return (
    <View style={styles.layout}>
      <View style={styles.heroCard}>
        <View style={styles.heroTextWrap}>
          <Text style={styles.heroTitle}>오늘 어떤 연습부터 시작할까요?</Text>
        </View>
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
            <Pressable onPress={onRevealHomework} style={({ pressed }) => [styles.homeworkRevealButton, pressed && styles.pressed]}>
              <Text style={styles.homeworkRevealButtonText}>오늘의 숙제 확인하기</Text>
            </Pressable>
          </View>
        )}
      </View>

      <View style={[styles.secondaryCards, isWide && styles.secondaryCardsWide]}>
        <Pressable
          onPress={onOpenRules}
          style={({ pressed }) => [
            styles.rulesCardButton,
            isWide && styles.secondaryCardCompactWide,
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.rulesCard}>
            <Text style={styles.rulesTitle}>농구 규칙 가이드</Text>
            <Text style={styles.rulesText}>기본 규칙을 빠르게 확인할 수 있어요.</Text>
          </View>
        </Pressable>
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
  mainButtonNoSubtitle: {
    minHeight: 148,
  },
  mainButtonBorderless: {
    borderWidth: 0,
    borderColor: 'transparent',
  },
  mainButtonWide: {
    minHeight: 194,
  },
  mainButtonWideNoSubtitle: {
    minHeight: 160,
  },
  mainButtonCompact: {
    minHeight: 120,
    borderRadius: 22,
    padding: 14,
  },
  mainButtonCompactNoSubtitle: {
    minHeight: 104,
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
  mainButtonTopNoSubtitle: {
    marginBottom: 10,
  },
  mainButtonTopDiary: {
    marginBottom: 18,
  },
  mainButtonTopDiaryNoSubtitle: {
    marginBottom: 10,
  },
  mainButtonTopCompact: {
    marginBottom: 8,
    gap: 8,
  },
  mainButtonTopCompactNoSubtitle: {
    marginBottom: 4,
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
  lessonBallIcon: {
    width: 22,
    height: 22,
  },
  lessonBallIconCompact: {
    width: 16,
    height: 16,
  },
  diaryPencilIcon: {
    width: 24,
    height: 24,
  },
  diaryPencilIconCompact: {
    width: 17,
    height: 17,
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
  },
  mainButtonTitleWithSubtitle: {
    marginBottom: 8,
  },
  mainButtonTitleCompact: {
    fontSize: 16,
  },
  mainButtonTitleCompactWithSubtitle: {
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
  homeworkRevealButton: {
    borderRadius: 0,
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
  rulesCardButton: {
    flex: 1,
  },
  rulesCard: {
    flex: 1,
    minHeight: 88,
    borderRadius: 20,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 0,
    borderColor: 'transparent',
  },
  rulesTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 3,
  },
  rulesText: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  pressed: {
    opacity: 0.92,
  },
});
