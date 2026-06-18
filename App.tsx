import { useCallback, useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Animated, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SmallButton } from './src/components/common/Buttons';
import { FireworkBurst } from './src/components/common/FireworkBurst';
import { Header } from './src/components/common/Header';
import { useBasketballCoachApp } from './src/hooks/useBasketballCoachApp';
import { AuthScreen } from './src/screens/AuthScreen';
import { DiaryScreen } from './src/screens/DiaryScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { LessonScreen } from './src/screens/LessonScreen';
import { RulesGuideScreen } from './src/screens/RulesGuideScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { SkillScreen } from './src/screens/SkillScreen';
import { colors } from './src/theme/colors';

export default function App() {
  const app = useBasketballCoachApp();
  const { width } = useWindowDimensions();
  const showBack = Boolean(app.currentUser && app.screen !== 'home');
  const isLessonScreen = app.isReady && app.currentUser && app.screen === 'lesson';
  const isHomeScreen = app.isReady && app.currentUser && app.screen === 'home';
  const headerVisibility = useRef(new Animated.Value(1)).current;
  const settingsDrawerProgress = useRef(new Animated.Value(0)).current;
  const headerVisibilityTargetRef = useRef<0 | 1>(1);
  const lastScrollYRef = useRef(0);
  const [headerMeasuredHeight, setHeaderMeasuredHeight] = useState(0);
  const [isSettingsDrawerVisible, setIsSettingsDrawerVisible] = useState(false);
  const [shouldRenderSettingsDrawer, setShouldRenderSettingsDrawer] = useState(false);
  const effectiveHeaderHeight = Math.max(headerMeasuredHeight, 96);
  const settingsDrawerWidth =
    width >= 960 ? Math.min(width * 0.48, 460) : Math.min(Math.max(width * 0.82, 280), width - 16);

  const animateHeader = useCallback(
    (nextValue: 0 | 1) => {
      if (headerVisibilityTargetRef.current === nextValue) {
        return;
      }

      headerVisibilityTargetRef.current = nextValue;
      Animated.timing(headerVisibility, {
        toValue: nextValue,
        duration: 220,
        useNativeDriver: false,
      }).start();
    },
    [headerVisibility]
  );

  const handleScroll = useCallback(
    (event: { nativeEvent: { contentOffset: { y: number } } }) => {
      const nextScrollY = Math.max(0, event.nativeEvent.contentOffset.y);

      if (nextScrollY <= 4) {
        lastScrollYRef.current = 0;
        animateHeader(1);
        return;
      }

      const delta = nextScrollY - lastScrollYRef.current;

      if (delta > 10) {
        animateHeader(0);
      } else if (delta < -10) {
        animateHeader(1);
      }

      lastScrollYRef.current = nextScrollY;
    },
    [animateHeader]
  );

  useEffect(() => {
    lastScrollYRef.current = 0;
    headerVisibilityTargetRef.current = 1;
    headerVisibility.setValue(1);
  }, [app.currentUser, app.screen, headerVisibility]);

  useEffect(() => {
    if (!isHomeScreen) {
      setIsSettingsDrawerVisible(false);
    }
  }, [isHomeScreen]);

  useEffect(() => {
    if (isSettingsDrawerVisible) {
      setShouldRenderSettingsDrawer(true);
      Animated.spring(settingsDrawerProgress, {
        toValue: 1,
        useNativeDriver: true,
        damping: 22,
        stiffness: 220,
        mass: 0.9,
      }).start();
      return;
    }

    if (!shouldRenderSettingsDrawer) {
      settingsDrawerProgress.setValue(0);
      return;
    }

    Animated.timing(settingsDrawerProgress, {
      toValue: 0,
      duration: 220,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setShouldRenderSettingsDrawer(false);
      }
    });
  }, [isSettingsDrawerVisible, settingsDrawerProgress, shouldRenderSettingsDrawer]);

  const animatedHeaderHeight = headerVisibility.interpolate({
    inputRange: [0, 1],
    outputRange: [0, effectiveHeaderHeight],
  });
  const animatedHeaderOpacity = headerVisibility.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  const animatedHeaderTranslateY = headerVisibility.interpolate({
    inputRange: [0, 1],
    outputRange: [-Math.round(effectiveHeaderHeight * 0.18), 0],
  });
  const settingsDrawerTranslateX = settingsDrawerProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [settingsDrawerWidth + 24, 0],
  });
  const settingsBackdropOpacity = settingsDrawerProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <View style={styles.appShell}>
        <FireworkBurst visible={app.showFireworks} items={app.fireworks} />
        {!isLessonScreen ? (
          <Animated.View
            style={[
              styles.headerAnimatedWrap,
              {
                height: animatedHeaderHeight,
                opacity: animatedHeaderOpacity,
                transform: [{ translateY: animatedHeaderTranslateY }],
              },
            ]}
          >
            <View
              onLayout={(event) => {
                const nextHeight = Math.round(event.nativeEvent.layout.height);

                if (nextHeight > 0 && nextHeight !== headerMeasuredHeight) {
                  setHeaderMeasuredHeight(nextHeight);
                }
              }}
            >
              <Header showBack={showBack} onBack={() => void app.navigateTo('home')} />
            </View>
          </Animated.View>
        ) : null}
        {isLessonScreen ? (
          <View style={styles.lessonScreenWrap}>
            <LessonScreen
              lessonMode={app.lessonMode}
              selectedDribbleView={app.selectedDribbleView}
              selectedBallBrand={app.selectedBallBrand}
              selectedBallColors={app.selectedBallColors}
              isCameraActive={app.isCameraActive}
              isCameraPreviewHidden={app.isCameraPreviewHidden}
              isLessonActive={app.isLessonActive}
              isCameraReady={app.isCameraReady}
              cameraSessionKey={app.cameraSessionKey}
              countdownValue={app.countdownValue}
              dribbleResetToken={app.dribbleResetToken}
              shootResetToken={app.shootResetToken}
              recordingStartToken={app.recordingStartToken}
              recordingStopToken={app.recordingStopToken}
              debugText={app.debugText}
              feedbackText={app.feedbackText}
              lessonReview={app.lessonReview}
              currentDribbleCount={app.currentDribbleCount}
              cameraError={app.cameraError}
              isShootSuccessButtonVisible={app.isShootSuccessButtonVisible}
              onSelectMode={app.changeLessonMode}
              onSelectDribbleView={app.setSelectedDribbleView}
              onBeginLesson={(dribbleTargetCount, dribbleView) => void app.beginLesson(dribbleTargetCount, dribbleView)}
              onEndLesson={() => void app.endLesson()}
              onRegisterSuccessfulShot={app.registerSuccessfulShot}
              onGoHome={() => void app.navigateTo('home')}
              onPoseMessage={app.handlePoseMessage}
            />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
          >
          {!app.isReady && (
            <View style={styles.loadingCard}>
              <Text style={styles.loadingTitle}>앱을 준비하는 중입니다</Text>
              <Text style={styles.loadingText}>
                {app.startupStatusText || '초기 데이터를 불러오고 있습니다. 잠시만 기다려 주세요.'}
              </Text>
              <Text style={styles.loadingHint}>
                이 화면이 계속 유지되면 저장된 로그인 상태를 초기화하고 로그인 화면으로 바로 이동할 수 있습니다.
              </Text>
              <View style={styles.loadingActionRow}>
                <SmallButton title="로그인 화면 바로 열기" onPress={() => void app.recoverStartupToLogin()} variant="dark" />
              </View>
            </View>
          )}

          {app.isReady && !app.currentUser && (
            <AuthScreen
              mode={app.authMode}
              onChangeMode={app.changeAuthMode}
              onLogin={app.login}
              onSignup={app.signup}
              onImportAccount={app.importAccountTransfer}
            />
          )}

          {app.isReady && app.currentUser && app.screen === 'home' && (
            <HomeScreen
              homeworkToShow={app.homeworkToShow}
              isHomeworkVisible={app.isHomeworkRevealed}
              onRevealHomework={app.revealHomework}
              onOpenLesson={() => void app.navigateTo('lesson')}
              onOpenDiary={() => void app.navigateTo('diary')}
              onOpenSkill={() => void app.navigateTo('skill')}
              onOpenRules={() => void app.navigateTo('rules')}
              onOpenSettings={() => setIsSettingsDrawerVisible(true)}
            />
          )}

          {app.isReady && app.currentUser && app.screen === 'skill' && (
            <SkillScreen
              selectedSkillKey={app.selectedSkillKey}
              onSelectSkill={app.selectSkill}
              onOpenSkillVideo={() => void app.openSkillVideo()}
            />
          )}

          {app.isReady && app.currentUser && app.screen === 'diary' && (
            <DiaryScreen
              currentDate={app.currentDate}
              calendarCells={app.calendarCells}
              selectedDateKey={app.selectedDateKey}
              selectedDateRecords={app.selectedDateRecords}
              selectedDateDribbleCount={app.selectedDateDribbleCount}
              shotGraphData={app.shotGraphData}
              onChangeMonth={app.changeMonth}
              onOpenDate={app.openDiaryDate}
              onToggleShotOutcome={app.toggleLessonRecordShotOutcome}
              onDeleteRecord={(recordId) => void app.deleteLessonRecord(recordId)}
            />
          )}

          {app.isReady && app.currentUser && app.screen === 'settings' && (
            <SettingsScreen
              currentUser={app.currentUser}
              selectedBallBrand={app.selectedBallBrand}
              selectedBallColors={app.selectedBallColors}
              selectedPosition={app.selectedPosition}
              homeworkTestState={app.homeworkTestState}
              onSelectBallBrand={app.selectBallBrand}
              onToggleBallColor={app.toggleBallColor}
              onSelectPosition={app.selectPosition}
              onApplyHomeworkTestState={app.applyHomeworkTestState}
              onLogout={() => void app.logout()}
              onCreateTransferCode={app.createTransferCode}
            />
          )}

          {app.isReady && app.currentUser && app.screen === 'rules' && <RulesGuideScreen />}
          </ScrollView>
        )}
        {shouldRenderSettingsDrawer && isHomeScreen ? (
          <View pointerEvents="box-none" style={styles.settingsOverlay}>
            <Pressable
              onPress={() => setIsSettingsDrawerVisible(false)}
              style={styles.settingsBackdropPressable}
            >
              <Animated.View style={[styles.settingsBackdrop, { opacity: settingsBackdropOpacity }]} />
            </Pressable>
            <Animated.View
              style={[
                styles.settingsDrawer,
                {
                  width: settingsDrawerWidth,
                  transform: [{ translateX: settingsDrawerTranslateX }],
                },
              ]}
            >
              <View style={styles.settingsDrawerHeader}>
                <Text style={styles.settingsDrawerTitle}>⚙️ 설정</Text>
                <Pressable
                  onPress={() => setIsSettingsDrawerVisible(false)}
                  style={({ pressed }) => [styles.settingsDrawerCloseButton, pressed && styles.pressed]}
                >
                  <Text style={styles.settingsDrawerCloseText}>닫기</Text>
                </Pressable>
              </View>
              <ScrollView
                style={styles.settingsDrawerScroll}
                contentContainerStyle={styles.settingsDrawerContent}
                showsVerticalScrollIndicator={false}
              >
                <SettingsScreen
                  currentUser={app.currentUser!}
                  selectedBallBrand={app.selectedBallBrand}
                  selectedBallColors={app.selectedBallColors}
                  selectedPosition={app.selectedPosition}
                  homeworkTestState={app.homeworkTestState}
                  onSelectBallBrand={app.selectBallBrand}
                  onToggleBallColor={app.toggleBallColor}
                  onSelectPosition={app.selectPosition}
                  onApplyHomeworkTestState={app.applyHomeworkTestState}
                  onLogout={() => {
                    setIsSettingsDrawerVisible(false);
                    void app.logout();
                  }}
                  onCreateTransferCode={app.createTransferCode}
                />
              </ScrollView>
            </Animated.View>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  appShell: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 16,
    paddingTop: 12,
    position: 'relative',
  },
  scrollContent: {
    paddingBottom: 32,
    gap: 16,
  },
  lessonScreenWrap: {
    flex: 1,
    minHeight: 0,
    paddingBottom: 32,
  },
  headerAnimatedWrap: {
    overflow: 'hidden',
  },
  settingsOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 30,
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
  },
  settingsBackdropPressable: {
    ...StyleSheet.absoluteFillObject,
  },
  settingsBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  settingsDrawer: {
    height: '100%',
    backgroundColor: colors.background,
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.26,
    shadowRadius: 18,
    shadowOffset: { width: -6, height: 0 },
    elevation: 18,
  },
  settingsDrawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  settingsDrawerTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  settingsDrawerCloseButton: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.surfaceStrong,
    borderWidth: 1,
    borderColor: colors.border,
  },
  settingsDrawerCloseText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  settingsDrawerScroll: {
    flex: 1,
  },
  settingsDrawerContent: {
    padding: 18,
    paddingBottom: 28,
  },
  loadingCard: {
    borderRadius: 18,
    padding: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  loadingTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 21,
  },
  loadingHint: {
    color: colors.textAccent,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 12,
  },
  loadingActionRow: {
    marginTop: 14,
    alignSelf: 'flex-start',
  },
  pressed: {
    opacity: 0.9,
  },
});
