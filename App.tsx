import { useEffect, useMemo, useRef, useState } from 'react';
import * as ScreenOrientation from 'expo-screen-orientation';
import { StatusBar } from 'expo-status-bar';
import { Animated, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SmallButton } from './src/components/common/Buttons';
import { FireworkBurst } from './src/components/common/FireworkBurst';
import { Header } from './src/components/common/Header';
import { useBasketballCoachApp } from './src/hooks/useBasketballCoachApp';
import { AuthScreen } from './src/screens/AuthScreen';
import { DiaryScreen } from './src/screens/DiaryScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { LessonScreen } from './src/screens/LessonScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { RulesGuideScreen } from './src/screens/RulesGuideScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { SkillScreen } from './src/screens/SkillScreen';
import { colors } from './src/theme/colors';
import { getDesktopMobileFrameWidth, shouldUseDesktopMobileLayout } from './src/utils/layout';

type SideDrawerType = 'settings' | 'profile';
const APP_TOP_OFFSET = 12;
const HOME_UTILITY_BAR_HEIGHT = 84;
const HOME_UTILITY_BAR_HIDE_DISTANCE = 120;

export default function App() {
  const app = useBasketballCoachApp();
  const { width } = useWindowDimensions();
  const isDesktopMobileMode = shouldUseDesktopMobileLayout(width);
  const appFrameWidth = isDesktopMobileMode ? getDesktopMobileFrameWidth(width) : width;
  const showBack = Boolean(app.currentUser && app.screen !== 'home');
  const isLessonScreen = app.isReady && app.currentUser && app.screen === 'lesson';
  const isHomeScreen = app.isReady && app.currentUser && app.screen === 'home';
  const shouldShowHomeUtilityBar = Boolean(app.isReady && app.currentUser && app.screen === 'home');
  const shouldShowHeader = !isLessonScreen && !isHomeScreen;
  const headerScrollY = useRef(new Animated.Value(0)).current;
  const sideDrawerProgress = useRef(new Animated.Value(0)).current;
  const [headerMeasuredHeight, setHeaderMeasuredHeight] = useState(0);
  const [activeDrawer, setActiveDrawer] = useState<SideDrawerType | null>(null);
  const [renderedDrawer, setRenderedDrawer] = useState<SideDrawerType>('settings');
  const [shouldRenderDrawer, setShouldRenderDrawer] = useState(false);
  const effectiveHeaderHeight = Math.max(headerMeasuredHeight, 96);
  const sideDrawerWidth =
    isDesktopMobileMode
      ? Math.min(Math.max(appFrameWidth - 12, 300), appFrameWidth)
      : width >= 960
        ? Math.min(width * 0.48, 460)
        : Math.min(Math.max(width * 0.82, 280), width - 16);
  const isDrawerVisible = activeDrawer !== null;
  const shouldShowDrawer = shouldRenderDrawer && Boolean(app.currentUser) && !isLessonScreen;
  const visibleDrawer = activeDrawer ?? renderedDrawer;
  const sideDrawerTitle = visibleDrawer === 'profile' ? '프로필' : '설정';
  const headerScrollClamp = useMemo(
    () => Animated.diffClamp(headerScrollY, 0, effectiveHeaderHeight),
    [effectiveHeaderHeight, headerScrollY]
  );
  const homeUtilityBarScrollClamp = useMemo(
    () => Animated.diffClamp(headerScrollY, 0, HOME_UTILITY_BAR_HIDE_DISTANCE),
    [headerScrollY]
  );
  const handleHeaderScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { y: headerScrollY } } }], {
        useNativeDriver: true,
      }),
    [headerScrollY]
  );

  useEffect(() => {
    headerScrollY.setValue(0);
  }, [app.currentUser, app.screen, headerScrollY]);

  useEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }

    void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }

    let isCancelled = false;

    const hideNavigationBar = async () => {
      try {
        const NavigationBar = await import('expo-navigation-bar');

        if (isCancelled) {
          return;
        }

        await NavigationBar.setVisibilityAsync('hidden');
      } catch (error) {
        console.warn('Failed to hide Android navigation bar.', error);
      }
    };

    void hideNavigationBar();

    return () => {
      isCancelled = true;
    };
  }, [app.currentUser, app.screen]);

  useEffect(() => {
    setActiveDrawer(null);
  }, [app.screen]);

  useEffect(() => {
    if (activeDrawer) {
      setRenderedDrawer(activeDrawer);
    }
  }, [activeDrawer]);

  useEffect(() => {
    if (!app.currentUser || isLessonScreen || (activeDrawer === 'settings' && !isHomeScreen)) {
      setActiveDrawer(null);
    }
  }, [activeDrawer, app.currentUser, isHomeScreen, isLessonScreen]);

  useEffect(() => {
    if (isDrawerVisible) {
      setShouldRenderDrawer(true);
      Animated.spring(sideDrawerProgress, {
        toValue: 1,
        useNativeDriver: true,
        damping: 22,
        stiffness: 220,
        mass: 0.9,
      }).start();
      return;
    }

    if (!shouldRenderDrawer) {
      sideDrawerProgress.setValue(0);
      return;
    }

    Animated.timing(sideDrawerProgress, {
      toValue: 0,
      duration: 220,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setShouldRenderDrawer(false);
      }
    });
  }, [isDrawerVisible, sideDrawerProgress, shouldRenderDrawer]);

  const animatedHeaderOpacity = headerScrollClamp.interpolate({
    inputRange: [0, effectiveHeaderHeight * 0.55, effectiveHeaderHeight],
    outputRange: [1, 0.35, 0],
    extrapolate: 'clamp',
  });
  const animatedHeaderTranslateY = headerScrollClamp.interpolate({
    inputRange: [0, effectiveHeaderHeight],
    outputRange: [0, -(effectiveHeaderHeight + APP_TOP_OFFSET)],
    extrapolate: 'clamp',
  });
  const homeUtilityBarTranslateY = homeUtilityBarScrollClamp.interpolate({
    inputRange: [0, HOME_UTILITY_BAR_HIDE_DISTANCE],
    outputRange: [0, HOME_UTILITY_BAR_HIDE_DISTANCE],
    extrapolate: 'clamp',
  });
  const homeUtilityBarOpacity = homeUtilityBarScrollClamp.interpolate({
    inputRange: [0, HOME_UTILITY_BAR_HIDE_DISTANCE],
    outputRange: [1, 0.72],
    extrapolate: 'clamp',
  });
  const sideDrawerTranslateX = sideDrawerProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [sideDrawerWidth + 24, 0],
  });
  const sideDrawerBackdropOpacity = sideDrawerProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar hidden style="light" />
      <View style={[styles.appViewport, isDesktopMobileMode && styles.appViewportDesktop]}>
      <View
        style={[
          styles.appShell,
          isDesktopMobileMode && styles.appShellDesktop,
          isDesktopMobileMode ? { width: appFrameWidth } : null,
        ]}
      >
        <FireworkBurst visible={app.showFireworks} items={app.fireworks} />
        {shouldShowHeader ? (
          <Animated.View
            style={[
              styles.headerAnimatedWrap,
              {
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
              <Header
                showBack={showBack}
                onBack={() => void app.navigateTo('home')}
                showProfile={Boolean(app.currentUser)}
                profileLabel={app.currentUser?.nickname}
                onOpenProfile={() => setActiveDrawer('profile')}
              />
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
              cameraStopMode={app.cameraStopMode}
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
          <Animated.ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              {
                paddingTop: shouldShowHeader ? effectiveHeaderHeight : 0,
                paddingBottom: shouldShowHomeUtilityBar ? 120 : 32,
              },
            ]}
            showsVerticalScrollIndicator={false}
            onScroll={handleHeaderScroll}
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
              onOpenRules={() => void app.navigateTo('rules')}
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
              diarySkillInsight={app.diarySkillInsight}
              shotGraphData={app.shotGraphData}
              onChangeMonth={app.changeMonth}
              onOpenDate={app.openDiaryDate}
              onToggleShotOutcome={app.toggleLessonRecordShotOutcome}
              onDeleteRecord={(recordId) => void app.deleteLessonRecord(recordId)}
            />
          )}

          {app.isReady && app.currentUser && app.screen === 'settings' && (
            <SettingsScreen
              selectedBallBrand={app.selectedBallBrand}
              selectedBallColors={app.selectedBallColors}
              selectedPosition={app.selectedPosition}
              homeworkTestState={app.homeworkTestState}
              onSelectBallBrand={app.selectBallBrand}
              onToggleBallColor={app.toggleBallColor}
              onSelectPosition={app.selectPosition}
              onApplyHomeworkTestState={app.applyHomeworkTestState}
            />
          )}

          {app.isReady && app.currentUser && app.screen === 'rules' && <RulesGuideScreen />}
          </Animated.ScrollView>
        )}
        {shouldShowHomeUtilityBar ? (
          <View pointerEvents="box-none" style={styles.homeUtilityBarOverlay}>
            <Animated.View
              style={[
                styles.homeUtilityBar,
                {
                  opacity: homeUtilityBarOpacity,
                  transform: [{ translateY: homeUtilityBarTranslateY }],
                },
              ]}
            >
              <Pressable
                onPress={() => {
                  setActiveDrawer(null);
                  void app.navigateTo('home');
                }}
                style={({ pressed }) => [styles.homeUtilityAction, styles.homeUtilityHomeButton, pressed && styles.pressed]}
              >
                <Text style={styles.homeUtilityIconText}>⌂</Text>
              </Pressable>

              <Pressable
                onPress={() => setActiveDrawer('profile')}
                style={({ pressed }) => [styles.homeUtilityAction, styles.homeUtilityProfileButton, pressed && styles.pressed]}
              >
                <Text style={styles.homeUtilityActionText}>프로필</Text>
              </Pressable>

              <Pressable
                onPress={() => setActiveDrawer('settings')}
                style={({ pressed }) => [styles.homeUtilityAction, styles.homeUtilitySettingsButton, pressed && styles.pressed]}
              >
                <Text style={styles.homeUtilityIconText}>⚙</Text>
              </Pressable>
            </Animated.View>
          </View>
        ) : null}
        {shouldShowDrawer ? (
          <View pointerEvents="box-none" style={styles.settingsOverlay}>
            <Pressable
              onPress={() => setActiveDrawer(null)}
              style={styles.settingsBackdropPressable}
            >
              <Animated.View style={[styles.settingsBackdrop, { opacity: sideDrawerBackdropOpacity }]} />
            </Pressable>
            <Animated.View
              style={[
                styles.settingsDrawer,
                {
                  width: sideDrawerWidth,
                  transform: [{ translateX: sideDrawerTranslateX }],
                },
              ]}
            >
              <View style={styles.settingsDrawerHeader}>
                <Text style={styles.settingsDrawerTitle}>{sideDrawerTitle}</Text>
              </View>
              <ScrollView
                style={styles.settingsDrawerScroll}
                contentContainerStyle={styles.settingsDrawerContent}
                showsVerticalScrollIndicator={false}
              >
                {visibleDrawer === 'profile' ? (
                  <ProfileScreen
                    currentUser={app.currentUser!}
                    onUpdateProfile={app.updateProfile}
                    onChangePassword={app.changePassword}
                    onLogout={() => {
                      setActiveDrawer(null);
                      void app.logout();
                    }}
                  />
                ) : (
                  <SettingsScreen
                    selectedBallBrand={app.selectedBallBrand}
                    selectedBallColors={app.selectedBallColors}
                    selectedPosition={app.selectedPosition}
                    homeworkTestState={app.homeworkTestState}
                    onSelectBallBrand={app.selectBallBrand}
                    onToggleBallColor={app.toggleBallColor}
                    onSelectPosition={app.selectPosition}
                    onApplyHomeworkTestState={app.applyHomeworkTestState}
                  />
                )}
              </ScrollView>
            </Animated.View>
          </View>
        ) : null}
      </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  appViewport: {
    flex: 1,
  },
  appViewportDesktop: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  appShell: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 16,
    paddingTop: APP_TOP_OFFSET,
    position: 'relative',
  },
  appShellDesktop: {
    alignSelf: 'center',
    maxWidth: '100%',
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 16 },
    elevation: 20,
  },
  scrollContent: {
    paddingBottom: 32,
    gap: 16,
  },
  homeUtilityBarOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 24,
  },
  homeUtilityBar: {
    minHeight: HOME_UTILITY_BAR_HEIGHT,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  homeUtilityAction: {
    minHeight: 46,
    borderRadius: 18,
    backgroundColor: colors.surfaceStrong,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  homeUtilityHomeButton: {
    width: 54,
    backgroundColor: '#000000',
    borderColor: '#000000',
    paddingHorizontal: 0,
  },
  homeUtilityProfileButton: {
    flex: 1,
    minWidth: 86,
  },
  homeUtilitySettingsButton: {
    width: 54,
    backgroundColor: '#000000',
    borderColor: '#000000',
    paddingHorizontal: 0,
  },
  homeUtilityActionText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  homeUtilityIconText: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 22,
  },
  lessonScreenWrap: {
    flex: 1,
    minHeight: 0,
    paddingBottom: 32,
  },
  headerAnimatedWrap: {
    position: 'absolute',
    top: APP_TOP_OFFSET,
    left: 0,
    right: 0,
    paddingHorizontal: 4,
    zIndex: 20,
    backgroundColor: colors.background,
  },
  settingsOverlay: {
    ...StyleSheet.absoluteFillObject,
    bottom: HOME_UTILITY_BAR_HEIGHT,
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
    justifyContent: 'flex-start',
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
