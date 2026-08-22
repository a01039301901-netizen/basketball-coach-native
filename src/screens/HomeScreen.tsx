import { useMemo, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { colors } from '../theme/colors';
import type { HomeworkDiaryLinkContext, HomeworkProgressItem, LessonMode, LessonRecord } from '../types/app';
import { getDesktopMobileFrameWidth, shouldUseDesktopMobileLayout } from '../utils/layout';

type HomeMenuArtworkType = 'lesson' | 'diary';
const lessonPlayerSilhouette = require('../../assets/lesson-player-silhouette.png');
const diaryCalendarArt = require('../../assets/diary-calendar-art.png');
const lessonBallIcon = require('../../assets/lesson-basketball-icon.png');
const diaryPencilIcon = require('../../assets/diary-pencil-icon.png');
const rulesGuideIcon = require('../../assets/rules-guide-icon.png');

interface HomeScreenProps {
  homeworkToShow: HomeworkProgressItem[];
  lessonRecords: LessonRecord[];
  onOpenLesson: () => void;
  onOpenDiary: () => void;
  onOpenHomeworkLinkedDiary: (context: HomeworkDiaryLinkContext) => void;
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

function getHomeworkPreviewModeLabel(mode: LessonMode) {
  return mode === 'shoot' ? '슛 레슨' : '드리블 레슨';
}

function getHomeworkEvaluationLevelLabel(level: NonNullable<LessonRecord['evaluation']>['level']) {
  if (level === 'good') {
    return '좋음';
  }

  if (level === 'average') {
    return '보통';
  }

  return '나쁨';
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
  lessonRecords,
  onOpenLesson,
  onOpenDiary,
  onOpenHomeworkLinkedDiary,
  onOpenRules,
}: HomeScreenProps) {
  const { width } = useWindowDimensions();
  const layoutWidth = shouldUseDesktopMobileLayout(width) ? getDesktopMobileFrameWidth(width) : width;
  const isWide = layoutWidth >= 860;
  const [selectedHomeworkReasonItem, setSelectedHomeworkReasonItem] = useState<HomeworkProgressItem | null>(null);
  const [selectedHomeworkEvaluationRecord, setSelectedHomeworkEvaluationRecord] = useState<LessonRecord | null>(null);
  const selectedHomeworkReasonSummary = selectedHomeworkReasonItem?.reasonText?.trim() || '';
  const hasSelectedHomeworkDetailText = Boolean(selectedHomeworkReasonItem?.detailText?.trim());
  const selectedHomeworkReasonText =
    selectedHomeworkReasonItem?.detailText?.trim() ||
    selectedHomeworkReasonSummary ||
    '이 숙제가 생성된 이유를 준비하고 있어요.';
  const lessonRecordMap = useMemo(
    () => new Map(lessonRecords.map((record) => [record.id, record] as const)),
    [lessonRecords]
  );
  const selectedHomeworkLinkedRecordCards = useMemo(() => {
    const previewRecords = selectedHomeworkReasonItem?.linkedDiaryContext?.previewRecords ?? [];

    return previewRecords.map((preview) => ({
      preview,
      record: lessonRecordMap.get(preview.recordId) ?? null,
    }));
  }, [lessonRecordMap, selectedHomeworkReasonItem]);
  const selectedHomeworkEvaluation = selectedHomeworkEvaluationRecord?.evaluation ?? null;

  function closeHomeworkReasonModal() {
    setSelectedHomeworkEvaluationRecord(null);
    setSelectedHomeworkReasonItem(null);
  }

  function closeHomeworkEvaluationModal() {
    setSelectedHomeworkEvaluationRecord(null);
  }

  function openHomeworkEvaluationRecord(record: LessonRecord | null) {
    if (!record) {
      return;
    }

    setSelectedHomeworkEvaluationRecord(record);
  }

  function openLessonFromHomeworkReason() {
    closeHomeworkReasonModal();
    onOpenLesson();
  }

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
          </View>
        </View>
        <View style={styles.homeworkList}>
          {homeworkToShow.map((item) => {
            const hasReasonDetail = Boolean(item.detailText || item.reasonText);
            const isDailyPracticeHomework = item.stage === 'base' && item.source === 'daily';
            const homeworkDetailLabel = `${item.detailToggleText || '자세히 보기'} >`;

            return (
              <Pressable
                key={item.id}
                disabled={!hasReasonDetail}
                onPress={hasReasonDetail ? () => setSelectedHomeworkReasonItem(item) : undefined}
                style={({ pressed }) => [styles.homeworkItem, hasReasonDetail && pressed && styles.pressed]}
              >
                {isDailyPracticeHomework || hasReasonDetail ? (
                  <View style={styles.homeworkItemTopRow}>
                    {isDailyPracticeHomework ? (
                      <Text style={styles.homeworkCategoryText}>{'하루 연습량'}</Text>
                    ) : null}
                    {hasReasonDetail ? <Text style={styles.homeworkDetailToggleText}>{homeworkDetailLabel}</Text> : null}
                  </View>
                ) : null}

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
              </Pressable>
            );
          })}
        </View>
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
            <View style={styles.rulesCardContent}>
              <View style={styles.rulesTextWrap}>
                <Text style={styles.rulesTitle}>농구 규칙 가이드</Text>
                <Text style={styles.rulesText}>기본 규칙을 빠르게 확인할 수 있어요.</Text>
              </View>
              <Image source={rulesGuideIcon} resizeMode="contain" style={styles.rulesGuideIcon} />
            </View>
          </View>
        </Pressable>
      </View>

      <Modal
        visible={Boolean(selectedHomeworkReasonItem)}
        transparent
        animationType="fade"
        onRequestClose={closeHomeworkReasonModal}
      >
        <View style={styles.reasonModalOverlay}>
          <Pressable style={styles.reasonModalBackdrop} onPress={closeHomeworkReasonModal} />
          <View style={styles.reasonModalCard}>
            <View style={styles.reasonModalHeader}>
              <Text style={styles.reasonModalTitle}>{selectedHomeworkReasonItem?.title}</Text>
              <Pressable
                onPress={closeHomeworkReasonModal}
                style={({ pressed }) => [styles.reasonModalCloseButton, pressed && styles.pressed]}
              >
                <Text style={styles.reasonModalCloseButtonText}>닫기</Text>
              </Pressable>
            </View>
            <ScrollView
              style={styles.reasonModalScroll}
              contentContainerStyle={styles.reasonModalScrollContent}
              showsVerticalScrollIndicator={false}
            >
              {selectedHomeworkReasonSummary && hasSelectedHomeworkDetailText ? (
                <Text style={styles.reasonModalSummary}>{selectedHomeworkReasonSummary}</Text>
              ) : null}
              {selectedHomeworkLinkedRecordCards.length > 0 ? (
                <View style={styles.reasonModalLinkedPreviewRow}>
                  {selectedHomeworkLinkedRecordCards.map(({ preview, record }) => (
                    <Pressable
                      key={preview.recordId}
                      disabled={!record}
                      onPress={() => openHomeworkEvaluationRecord(record)}
                      style={({ pressed }) => [
                        styles.reasonModalLinkedPreviewCard,
                        !record && styles.reasonModalLinkedPreviewCardDisabled,
                        record && pressed && styles.pressed,
                      ]}
                    >
                      {preview.thumbnailUri.trim() ? (
                        <Image source={{ uri: preview.thumbnailUri }} resizeMode="cover" style={styles.reasonModalLinkedPreviewImage} />
                      ) : (
                        <View style={[styles.reasonModalLinkedPreviewImage, styles.reasonModalLinkedPreviewImageEmpty]}>
                          <Text style={styles.reasonModalLinkedPreviewEmptyText}>기록</Text>
                        </View>
                      )}
                      <View style={styles.reasonModalLinkedPreviewMeta}>
                        <Text style={styles.reasonModalLinkedPreviewMode}>{getHomeworkPreviewModeLabel(preview.mode)}</Text>
                        <Text style={styles.reasonModalLinkedPreviewTime} numberOfLines={1}>
                          {preview.createdAt}
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              ) : null}
              <Text style={styles.reasonModalBody}>{selectedHomeworkReasonText}</Text>
              <Pressable
                onPress={openLessonFromHomeworkReason}
                style={({ pressed }) => [styles.reasonModalActionButton, pressed && styles.pressed]}
              >
                <Text style={styles.reasonModalActionButtonText}>바로 레슨하러 가기</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={Boolean(selectedHomeworkEvaluationRecord)}
        transparent
        animationType="fade"
        onRequestClose={closeHomeworkEvaluationModal}
      >
        <View style={styles.homeworkEvaluationOverlay}>
          <Pressable style={styles.homeworkEvaluationBackdrop} onPress={closeHomeworkEvaluationModal} />
          <View style={styles.homeworkEvaluationCard}>
            <View style={styles.homeworkEvaluationHeader}>
              <Text style={styles.homeworkEvaluationTitle}>기록 평가</Text>
              <Pressable
                onPress={closeHomeworkEvaluationModal}
                style={({ pressed }) => [styles.homeworkEvaluationCloseButton, pressed && styles.pressed]}
              >
                <Text style={styles.homeworkEvaluationCloseText}>닫기</Text>
              </Pressable>
            </View>
            <ScrollView
              style={styles.homeworkEvaluationScroll}
              contentContainerStyle={styles.homeworkEvaluationScrollContent}
              showsVerticalScrollIndicator={false}
            >
              {selectedHomeworkEvaluationRecord?.thumbnailUri.trim() ? (
                <Image
                  source={{ uri: selectedHomeworkEvaluationRecord.thumbnailUri }}
                  resizeMode="cover"
                  style={styles.homeworkEvaluationThumbnail}
                />
              ) : (
                <View style={[styles.homeworkEvaluationThumbnail, styles.homeworkEvaluationThumbnailEmpty]}>
                  <Text style={styles.homeworkEvaluationThumbnailEmptyText}>썸네일 없음</Text>
                </View>
              )}

              <View style={styles.homeworkEvaluationMetaRow}>
                <View style={styles.homeworkEvaluationModeBadge}>
                  <Text style={styles.homeworkEvaluationModeBadgeText}>
                    {selectedHomeworkEvaluationRecord ? getHomeworkPreviewModeLabel(selectedHomeworkEvaluationRecord.mode) : ''}
                  </Text>
                </View>
                {selectedHomeworkEvaluation ? (
                  <View
                    style={[
                      styles.homeworkEvaluationLevelBadge,
                      selectedHomeworkEvaluation.level === 'good'
                        ? styles.homeworkEvaluationLevelBadgeGood
                        : selectedHomeworkEvaluation.level === 'average'
                          ? styles.homeworkEvaluationLevelBadgeAverage
                          : styles.homeworkEvaluationLevelBadgeBad,
                    ]}
                  >
                    <Text style={styles.homeworkEvaluationLevelText}>
                      {getHomeworkEvaluationLevelLabel(selectedHomeworkEvaluation.level)}
                    </Text>
                  </View>
                ) : null}
              </View>

              {selectedHomeworkEvaluationRecord?.createdAt ? (
                <Text style={styles.homeworkEvaluationCreatedAt}>{selectedHomeworkEvaluationRecord.createdAt}</Text>
              ) : null}

              {selectedHomeworkEvaluation ? (
                <>
                  <Text style={styles.homeworkEvaluationSummary}>{selectedHomeworkEvaluation.summary}</Text>
                  <View style={styles.homeworkEvaluationCriteriaList}>
                    {selectedHomeworkEvaluation.criteria.map((criterion) => (
                      <View key={`${criterion.key}-${criterion.label}`} style={styles.homeworkEvaluationCriterionRow}>
                        <View
                          style={[
                            styles.homeworkEvaluationCriterionStatus,
                            criterion.isStable
                              ? styles.homeworkEvaluationCriterionStatusStable
                              : styles.homeworkEvaluationCriterionStatusUnstable,
                          ]}
                        >
                          <Text style={styles.homeworkEvaluationCriterionStatusText}>
                            {criterion.isStable ? '좋음' : '보완'}
                          </Text>
                        </View>
                        <View style={styles.homeworkEvaluationCriterionTextWrap}>
                          <Text style={styles.homeworkEvaluationCriterionLabel}>{criterion.label}</Text>
                          <Text style={styles.homeworkEvaluationCriterionDetail}>{criterion.detail}</Text>
                        </View>
                      </View>
                    ))}
                  </View>

                  {selectedHomeworkEvaluation.improvements.length > 0 ? (
                    <View style={styles.homeworkEvaluationHighlightList}>
                      <Text style={styles.homeworkEvaluationSectionTitle}>보완 포인트</Text>
                      {selectedHomeworkEvaluation.improvements.map((highlight, index) => (
                        <View key={`${highlight.label}-${index}`} style={styles.homeworkEvaluationHighlightCard}>
                          <Text style={styles.homeworkEvaluationHighlightLabel}>{highlight.label}</Text>
                          <Text style={styles.homeworkEvaluationHighlightDetail}>{highlight.detail}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </>
              ) : (
                <Text style={styles.homeworkEvaluationEmptyText}>
                  자세한 기록 평가는 AI로 분석한 기록부터 확인할 수 있습니다.
                </Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  homeworkCategoryText: {
    color: colors.textAccent,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '800',
  },
  homeworkItemTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
  homeworkDetailToggleText: {
    marginLeft: 'auto',
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
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
  homeworkLinkedSection: {
    gap: 10,
    marginTop: 4,
  },
  homeworkLinkedSectionTitle: {
    color: colors.textSoft,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  homeworkLinkedPreviewRow: {
    flexDirection: 'row',
    gap: 10,
  },
  homeworkLinkedPreviewCard: {
    flex: 1,
    gap: 8,
  },
  homeworkLinkedPreviewImage: {
    width: '100%',
    aspectRatio: 1.18,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  homeworkLinkedPreviewImageEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeworkLinkedPreviewEmptyText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  homeworkLinkedPreviewLabel: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
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
  rulesCardContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },
  rulesTextWrap: {
    flex: 1,
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
  rulesGuideIcon: {
    width: 46,
    height: 46,
    opacity: 0.96,
  },
  reasonModalOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  reasonModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8, 10, 16, 0.56)',
  },
  reasonModalCard: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '86%',
    borderRadius: 24,
    backgroundColor: colors.surface,
    borderWidth: 0,
    borderColor: 'transparent',
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 20,
    gap: 12,
  },
  reasonModalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  reasonModalTitle: {
    flex: 1,
    color: colors.text,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '800',
  },
  reasonModalCloseButton: {
    alignSelf: 'flex-start',
  },
  reasonModalCloseButtonText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  reasonModalScroll: {
    flexGrow: 0,
  },
  reasonModalScrollContent: {
    gap: 14,
  },
  reasonModalSummary: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '700',
  },
  reasonModalLinkedPreviewRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  reasonModalLinkedPreviewCard: {
    width: '48%',
    gap: 8,
  },
  reasonModalLinkedPreviewCardDisabled: {
    opacity: 0.55,
  },
  reasonModalLinkedPreviewImage: {
    width: '100%',
    aspectRatio: 1.16,
    borderRadius: 14,
    backgroundColor: colors.surfaceStrong,
  },
  reasonModalLinkedPreviewImageEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  reasonModalLinkedPreviewEmptyText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  reasonModalLinkedPreviewMeta: {
    gap: 2,
  },
  reasonModalLinkedPreviewMode: {
    color: colors.text,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '800',
  },
  reasonModalLinkedPreviewTime: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
  },
  reasonModalBody: {
    color: colors.textSoft,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '600',
  },
  reasonModalActionButton: {
    marginTop: 4,
    alignSelf: 'stretch',
    borderRadius: 0,
    paddingHorizontal: 18,
    paddingVertical: 13,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reasonModalActionButtonText: {
    color: '#1b130c',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '900',
  },
  homeworkEvaluationOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  homeworkEvaluationBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8, 10, 16, 0.68)',
  },
  homeworkEvaluationCard: {
    width: '100%',
    maxWidth: 460,
    maxHeight: '88%',
    borderRadius: 24,
    backgroundColor: colors.surface,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 18,
    gap: 14,
  },
  homeworkEvaluationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  homeworkEvaluationTitle: {
    color: colors.text,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '900',
  },
  homeworkEvaluationCloseButton: {
    alignSelf: 'flex-start',
  },
  homeworkEvaluationCloseText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  homeworkEvaluationScroll: {
    flexGrow: 0,
  },
  homeworkEvaluationScrollContent: {
    gap: 14,
    paddingBottom: 4,
  },
  homeworkEvaluationThumbnail: {
    width: '100%',
    height: 184,
    borderRadius: 16,
    backgroundColor: colors.surfaceStrong,
  },
  homeworkEvaluationThumbnailEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeworkEvaluationThumbnailEmptyText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  homeworkEvaluationMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  homeworkEvaluationModeBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#f5ddc4',
  },
  homeworkEvaluationModeBadgeText: {
    color: '#51331c',
    fontSize: 12,
    fontWeight: '900',
  },
  homeworkEvaluationLevelBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  homeworkEvaluationLevelBadgeGood: {
    backgroundColor: 'rgba(87, 194, 106, 0.16)',
  },
  homeworkEvaluationLevelBadgeAverage: {
    backgroundColor: 'rgba(230, 174, 95, 0.16)',
  },
  homeworkEvaluationLevelBadgeBad: {
    backgroundColor: 'rgba(212, 109, 117, 0.16)',
  },
  homeworkEvaluationLevelText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
  },
  homeworkEvaluationCreatedAt: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },
  homeworkEvaluationSummary: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '700',
  },
  homeworkEvaluationCriteriaList: {
    gap: 10,
  },
  homeworkEvaluationCriterionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  homeworkEvaluationCriterionStatus: {
    minWidth: 48,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeworkEvaluationCriterionStatusStable: {
    backgroundColor: 'rgba(87, 194, 106, 0.16)',
  },
  homeworkEvaluationCriterionStatusUnstable: {
    backgroundColor: 'rgba(212, 109, 117, 0.16)',
  },
  homeworkEvaluationCriterionStatusText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '900',
  },
  homeworkEvaluationCriterionTextWrap: {
    flex: 1,
    gap: 4,
  },
  homeworkEvaluationCriterionLabel: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
  },
  homeworkEvaluationCriterionDetail: {
    color: colors.textSoft,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },
  homeworkEvaluationHighlightList: {
    gap: 10,
  },
  homeworkEvaluationSectionTitle: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
  },
  homeworkEvaluationHighlightCard: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: colors.surfaceStrong,
    gap: 4,
  },
  homeworkEvaluationHighlightLabel: {
    color: colors.text,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '900',
  },
  homeworkEvaluationHighlightDetail: {
    color: colors.textSoft,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },
  homeworkEvaluationEmptyText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.92,
  },
});
