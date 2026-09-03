import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as ScreenOrientation from 'expo-screen-orientation';
import { setStatusBarHidden, StatusBar as ExpoStatusBar, setStatusBarStyle } from 'expo-status-bar';
import { Animated, AppState, PanResponder, Platform, Pressable, SafeAreaView, ScrollView, StatusBar as NativeStatusBar, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { BallRecognitionCalibrator } from './src/components/ballRecognition/BallRecognitionCalibrator';
import { SmallButton } from './src/components/common/Buttons';
import { FireworkBurst } from './src/components/common/FireworkBurst';
import { Header } from './src/components/common/Header';
import { useBasketballCoachApp } from './src/hooks/useBasketballCoachApp';
import { AuthScreen } from './src/screens/AuthScreen';
import { DiaryScreen } from './src/screens/DiaryScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { RulesGuideScreen } from './src/screens/RulesGuideScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { SkillScreen } from './src/screens/SkillScreen';
import { colors } from './src/theme/colors';
import { getDesktopMobileFrameWidth, shouldUseDesktopMobileLayout } from './src/utils/layout';

type SideDrawerType = 'settings' | 'profile';
type NavigationBarModule = typeof import('expo-navigation-bar');
type LessonScreenComponent = typeof import('./src/screens/LessonScreen').LessonScreen;
const APP_TOP_OFFSET = 12;
const APP_SHELL_HORIZONTAL_PADDING = 16;
const HOME_UTILITY_BAR_HEIGHT = 80;
const HOME_UTILITY_ICON_HIT_SLOP = { top: 14, right: 14, bottom: 14, left: 14 } as const;
const HOME_DRAWER_SWIPE_ACTIVATION_DISTANCE = 6;
const HOME_DRAWER_SWIPE_OPEN_DISTANCE = 20;
const HOME_DRAWER_SWIPE_FLICK_DISTANCE = 12;
const HOME_DRAWER_SWIPE_MIN_VELOCITY = 0.25;
const HOME_DRAWER_SWIPE_HORIZONTAL_PRIORITY = 0.6;

function ProfileSilhouetteIcon({ active = false }: { active?: boolean }) {
  return (
    <View style={styles.profileIcon}>
      <View style={[styles.profileIconHead, active && styles.profileIconPartActive]} />
      <View style={[styles.profileIconBody, active && styles.profileIconPartActive]} />
    </View>
  );
}

export default function App() {
  const app = useBasketballCoachApp();
  const { width } = useWindowDimensions();
  const RootContainer = Platform.OS === 'web' ? SafeAreaView : View;
  const isDesktopMobileMode = shouldUseDesktopMobileLayout(width);
  const appFrameWidth = isDesktopMobileMode ? getDesktopMobileFrameWidth(width) : width;
  const showBack = Boolean(app.currentUser && app.screen !== 'home');
  const isLessonScreen = app.isReady && app.currentUser && app.screen === 'lesson';
  const isHomeScreen = app.isReady && app.currentUser && app.screen === 'home';
  const isDiaryScreen = app.isReady && app.currentUser && app.screen === 'diary';
  const ActiveLessonScreen = (
    isLessonScreen ? require('./src/screens/LessonScreen').LessonScreen : null
  ) as LessonScreenComponent | null;
  const shouldShowHomeUtilityBar = Boolean(app.isReady && app.currentUser && app.screen === 'home');
  const shouldShowHeader = Boolean(app.currentUser) && !isLessonScreen && !isHomeScreen && !isDiaryScreen;
  const shouldShowHeaderProfile =
    Boolean(app.currentUser) && app.screen !== 'diary' && app.screen !== 'rules';
  const headerScrollY = useRef(new Animated.Value(0)).current;
  const sideDrawerProgress = useRef(new Animated.Value(0)).current;
  const navigationBarModuleRef = useRef<NavigationBarModule | null>(null);
  const navigationBarHideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusBarHideTimeoutRefs = useRef<ReturnType<typeof setTimeout>[]>([]);
  const statusBarStackEntryRef = useRef<ReturnType<typeof NativeStatusBar.pushStackEntry> | null>(null);
  const [headerMeasuredHeight, setHeaderMeasuredHeight] = useState(0);
  const [activeDrawer, setActiveDrawer] = useState<SideDrawerType | null>(null);
  const [renderedDrawer, setRenderedDrawer] = useState<SideDrawerType>('settings');
  const [shouldRenderDrawer, setShouldRenderDrawer] = useState(false);
  const effectiveHeaderHeight = Math.max(headerMeasuredHeight, 96);
  const isDrawerVisible = activeDrawer !== null;
  const shouldShowDrawer = shouldRenderDrawer && Boolean(app.currentUser) && !isLessonScreen;
  const visibleDrawer = activeDrawer ?? renderedDrawer;
  const isSettingsDrawerVisible = visibleDrawer === 'settings';
  const currentDrawerWidth =
    isDesktopMobileMode
      ? appFrameWidth + APP_SHELL_HORIZONTAL_PADDING * 2
      : width + APP_SHELL_HORIZONTAL_PADDING * 2;
  const activeHomeUtilityItem: SideDrawerType | 'home' = shouldShowDrawer ? visibleDrawer : 'home';
  const sideDrawerTitle = visibleDrawer === 'profile' ? '프로필' : '설정';
  const headerScrollClamp = useMemo(
    () => Animated.diffClamp(headerScrollY, 0, effectiveHeaderHeight),
    [effectiveHeaderHeight, headerScrollY]
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

    ScreenOrientation.lockAsync(
      isLessonScreen ? ScreenOrientation.OrientationLock.DEFAULT : ScreenOrientation.OrientationLock.PORTRAIT_UP
    ).catch((error) => {
      console.warn('Failed to lock screen orientation.', error);
    });
  }, [isLessonScreen]);

  const toggleDrawer = useCallback((drawer: SideDrawerType) => {
    setActiveDrawer((currentDrawer) => (currentDrawer === drawer ? null : drawer));
  }, []);

  const returnHomeFromDrawer = useCallback(() => {
    setActiveDrawer(null);

    if (app.screen !== 'home') {
      void app.navigateTo('home');
    }
  }, [app]);

  const homeDrawerPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) => {
          if (!isHomeScreen || isDrawerVisible) {
            return false;
          }

          const horizontalDistance = Math.abs(gestureState.dx);
          const verticalDistance = Math.abs(gestureState.dy);

          return (
            horizontalDistance >= HOME_DRAWER_SWIPE_ACTIVATION_DISTANCE &&
            horizontalDistance > verticalDistance * HOME_DRAWER_SWIPE_HORIZONTAL_PRIORITY
          );
        },
        onMoveShouldSetPanResponderCapture: (_, gestureState) => {
          if (!isHomeScreen || isDrawerVisible) {
            return false;
          }

          const horizontalDistance = Math.abs(gestureState.dx);
          const verticalDistance = Math.abs(gestureState.dy);

          return (
            horizontalDistance >= HOME_DRAWER_SWIPE_ACTIVATION_DISTANCE &&
            horizontalDistance > verticalDistance * HOME_DRAWER_SWIPE_HORIZONTAL_PRIORITY
          );
        },
        onPanResponderRelease: (_, gestureState) => {
          const horizontalDistance = Math.abs(gestureState.dx);
          const verticalDistance = Math.abs(gestureState.dy);

          const isLongSwipe = horizontalDistance >= HOME_DRAWER_SWIPE_OPEN_DISTANCE;
          const isQuickFlick =
            horizontalDistance >= HOME_DRAWER_SWIPE_FLICK_DISTANCE &&
            Math.abs(gestureState.vx) >= HOME_DRAWER_SWIPE_MIN_VELOCITY;

          if (
            (!isLongSwipe && !isQuickFlick) ||
            horizontalDistance <= verticalDistance * HOME_DRAWER_SWIPE_HORIZONTAL_PRIORITY
          ) {
            return;
          }

          // A right swipe reveals the left-side settings drawer; a left swipe reveals the profile drawer.
          setActiveDrawer(gestureState.dx > 0 ? 'settings' : 'profile');
        },
      }),
    [isDrawerVisible, isHomeScreen]
  );

  const drawerDismissPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) => {
          if (!isDrawerVisible) {
            return false;
          }

          const horizontalDistance = Math.abs(gestureState.dx);
          const verticalDistance = Math.abs(gestureState.dy);

          return (
            horizontalDistance >= HOME_DRAWER_SWIPE_ACTIVATION_DISTANCE &&
            horizontalDistance > verticalDistance * HOME_DRAWER_SWIPE_HORIZONTAL_PRIORITY
          );
        },
        onMoveShouldSetPanResponderCapture: (_, gestureState) => {
          if (!isDrawerVisible) {
            return false;
          }

          const horizontalDistance = Math.abs(gestureState.dx);
          const verticalDistance = Math.abs(gestureState.dy);

          return (
            horizontalDistance >= HOME_DRAWER_SWIPE_ACTIVATION_DISTANCE &&
            horizontalDistance > verticalDistance * HOME_DRAWER_SWIPE_HORIZONTAL_PRIORITY
          );
        },
        onPanResponderRelease: (_, gestureState) => {
          const horizontalDistance = Math.abs(gestureState.dx);
          const verticalDistance = Math.abs(gestureState.dy);
          const isLongSwipe = horizontalDistance >= HOME_DRAWER_SWIPE_OPEN_DISTANCE;
          const isQuickFlick =
            horizontalDistance >= HOME_DRAWER_SWIPE_FLICK_DISTANCE &&
            Math.abs(gestureState.vx) >= HOME_DRAWER_SWIPE_MIN_VELOCITY;

          if (
            (!isLongSwipe && !isQuickFlick) ||
            horizontalDistance <= verticalDistance * HOME_DRAWER_SWIPE_HORIZONTAL_PRIORITY
          ) {
            return;
          }

          returnHomeFromDrawer();
        },
      }),
    [isDrawerVisible, returnHomeFromDrawer]
  );

  const clearStatusBarHideTimeouts = useCallback(() => {
    statusBarHideTimeoutRefs.current.forEach((timeoutId) => clearTimeout(timeoutId));
    statusBarHideTimeoutRefs.current = [];
  }, []);

  const syncStatusBarStackEntry = useCallback(() => {
    if (Platform.OS === 'web') {
      return;
    }

    const stackProps = {
      animated: false,
      hidden: true,
      barStyle: 'light-content' as const,
    };

    if (statusBarStackEntryRef.current) {
      statusBarStackEntryRef.current = NativeStatusBar.replaceStackEntry(statusBarStackEntryRef.current, stackProps);
      return;
    }

    statusBarStackEntryRef.current = NativeStatusBar.pushStackEntry(stackProps);
  }, []);

  const scheduleStatusBarHide = useCallback(() => {
    if (Platform.OS === 'web') {
      return;
    }

    const applyStatusBarHidden = () => {
      syncStatusBarStackEntry();
      setStatusBarStyle('light');
      setStatusBarHidden(true, 'fade');
      NativeStatusBar.setBarStyle('light-content', true);
      NativeStatusBar.setHidden(true, 'fade');
    };

    clearStatusBarHideTimeouts();
    applyStatusBarHidden();
    statusBarHideTimeoutRefs.current = [100, 260, 520, 980, 1680].map((delay) => setTimeout(applyStatusBarHidden, delay));
  }, [clearStatusBarHideTimeouts, syncStatusBarStackEntry]);

  const ensureAndroidNavigationBarHidden = useCallback(async () => {
    if (Platform.OS !== 'android') {
      return;
    }

    try {
      const NavigationBar = navigationBarModuleRef.current ?? (await import('expo-navigation-bar'));
      navigationBarModuleRef.current = NavigationBar;
      await NavigationBar.setVisibilityAsync('hidden');
    } catch (error) {
      console.warn('Failed to hide Android navigation bar.', error);
    }
  }, []);

  const scheduleAndroidNavigationBarHide = useCallback(() => {
    if (Platform.OS !== 'android') {
      return;
    }

    void ensureAndroidNavigationBarHidden();

    if (navigationBarHideTimeoutRef.current) {
      clearTimeout(navigationBarHideTimeoutRef.current);
    }

    navigationBarHideTimeoutRef.current = setTimeout(() => {
      void ensureAndroidNavigationBarHidden();
    }, 180);
  }, [ensureAndroidNavigationBarHidden]);

  useLayoutEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }

    scheduleStatusBarHide();

    if (Platform.OS === 'android') {
      scheduleAndroidNavigationBarHide();
    }

    return () => {
      clearStatusBarHideTimeouts();
      if (statusBarStackEntryRef.current) {
        NativeStatusBar.popStackEntry(statusBarStackEntryRef.current);
        statusBarStackEntryRef.current = null;
      }

      if (navigationBarHideTimeoutRef.current) {
        clearTimeout(navigationBarHideTimeoutRef.current);
        navigationBarHideTimeoutRef.current = null;
      }
    };
  }, [app.currentUser, app.screen, clearStatusBarHideTimeouts, scheduleAndroidNavigationBarHide, scheduleStatusBarHide]);

  useEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }

    let isMounted = true;
    let visibilitySubscription: { remove: () => void } | null = null;

    const setupNavigationBarPersistence = async () => {
      try {
        const NavigationBar = navigationBarModuleRef.current ?? (await import('expo-navigation-bar'));

        if (!isMounted) {
          return;
        }

        navigationBarModuleRef.current = NavigationBar;
        visibilitySubscription = NavigationBar.addVisibilityListener(({ visibility }) => {
          if (visibility === 'visible') {
            scheduleStatusBarHide();
            scheduleAndroidNavigationBarHide();
          }
        });
      } catch (error) {
        console.warn('Failed to observe Android navigation bar visibility.', error);
      }
    };

    const appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        scheduleStatusBarHide();

        if (Platform.OS === 'android') {
          scheduleAndroidNavigationBarHide();
        }
      }
    });
    const appFocusSubscription =
      Platform.OS === 'android'
        ? AppState.addEventListener('focus', () => {
            scheduleStatusBarHide();
            scheduleAndroidNavigationBarHide();
          })
        : null;

    if (Platform.OS === 'android') {
      void setupNavigationBarPersistence();
    }

    return () => {
      isMounted = false;
      visibilitySubscription?.remove();
      appStateSubscription.remove();
      appFocusSubscription?.remove();
    };
  }, [scheduleAndroidNavigationBarHide, scheduleStatusBarHide]);

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
  const sideDrawerTranslateX = sideDrawerProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [isSettingsDrawerVisible ? -(currentDrawerWidth + 24) : currentDrawerWidth + 24, 0],
  });
  const sideDrawerBackdropOpacity = sideDrawerProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  return (
    <RootContainer style={styles.safeArea}>
      <ExpoStatusBar hidden translucent style="light" hideTransitionAnimation="fade" />
      <View style={[styles.appViewport, isDesktopMobileMode && styles.appViewportDesktop]}>
      <View
        {...(isHomeScreen ? homeDrawerPanResponder.panHandlers : {})}
        style={[
          styles.appShell,
          isDesktopMobileMode && styles.appShellDesktop,
          isDesktopMobileMode ? { width: appFrameWidth } : null,
        ]}
      >
        <FireworkBurst visible={app.showFireworks} items={app.fireworks} />
        {shouldShowHeader ? (
          isDiaryScreen ? (
            <View style={styles.headerAnimatedWrap}>
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
                  showProfile={shouldShowHeaderProfile}
                  profileLabel={app.currentUser?.nickname}
                  onOpenProfile={() => toggleDrawer('profile')}
                />
              </View>
            </View>
          ) : (
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
                  showProfile={shouldShowHeaderProfile}
                  profileLabel={app.currentUser?.nickname}
                  onOpenProfile={() => toggleDrawer('profile')}
                />
              </View>
            </Animated.View>
          )
        ) : null}
        {isLessonScreen ? (
          <View style={styles.lessonScreenWrap}>
            {ActiveLessonScreen ? (
              <ActiveLessonScreen
                lessonMode={app.lessonMode}
                selectedDribbleView={app.selectedDribbleView}
                selectedBallBrand={app.selectedBallBrand}
                selectedBallColors={app.selectedBallColors}
                ballRecognitionProfile={app.ballRecognitionProfile}
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
                isShootRecordStarButtonVisible={app.isShootRecordStarButtonVisible}
                isCurrentShootRecordStarred={app.isCurrentShootRecordStarred}
                onSelectMode={app.changeLessonMode}
                onSelectDribbleView={app.setSelectedDribbleView}
                onBeginLesson={(dribbleTargetCount, dribbleView) => void app.beginLesson(dribbleTargetCount, dribbleView)}
                onEndLesson={() => void app.endLesson()}
                onToggleCurrentShootRecordStar={app.toggleCurrentShootRecordStar}
                onGoHome={() => void app.navigateTo('home')}
                onPoseMessage={app.handlePoseMessage}
              />
            ) : null}
          </View>
        ) : (
          <Animated.ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              {
                paddingTop: shouldShowHeader ? effectiveHeaderHeight : 0,
                paddingBottom: shouldShowHomeUtilityBar ? HOME_UTILITY_BAR_HEIGHT + 24 : 32,
              },
            ]}
            scrollEnabled={!isHomeScreen}
            bounces={!isHomeScreen}
            overScrollMode={isHomeScreen ? 'never' : 'auto'}
            showsVerticalScrollIndicator={false}
            onScroll={isDiaryScreen ? undefined : handleHeaderScroll}
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
              onReconnectRecentAccount={app.reconnectRecentAccount}
              recentAccountNickname={app.recentLoginAccount?.nickname}
              onSignup={app.signup}
              onImportAccount={app.importAccountTransfer}
            />
          )}

          {app.isReady && app.currentUser && app.screen === 'home' && (
            <HomeScreen
              homeworkToShow={app.homeworkToShow}
              lessonRecords={app.lessonRecords}
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
              allLessonRecords={app.lessonRecords}
              homeworkLinkedDiaryContext={app.homeworkLinkedDiaryContext}
              selectedDateDribbleCount={app.selectedDateDribbleCount}
              diarySkillInsight={app.diarySkillInsight}
              shotGraphData={app.shotGraphData}
              onChangeMonth={app.changeMonth}
              onOpenDate={app.openDiaryDate}
              onClearHomeworkLinkedDiaryContext={app.clearHomeworkLinkedDiaryContext}
              onGoBack={() => void app.navigateTo('home')}
              onToggleShotOutcome={app.toggleLessonRecordShotOutcome}
              onToggleStarredRecord={app.toggleLessonRecordStarred}
              onDeleteRecord={(recordId) => void app.deleteLessonRecord(recordId)}
            />
          )}

          {app.isReady && app.currentUser && app.screen === 'settings' && (
            <SettingsScreen
              selectedBallBrand={app.selectedBallBrand}
              selectedBallColors={app.selectedBallColors}
              ballRecognitionProfile={app.ballRecognitionProfile}
              ballRecognitionPreviews={app.ballRecognitionPreviews}
              isBallRecognitionTraining={app.isBallRecognitionTraining}
              homeworkTestState={app.homeworkTestState}
              onSelectBallBrand={app.selectBallBrand}
              onToggleBallColor={app.toggleBallColor}
              onTrainBallRecognitionFromCamera={() => void app.startBallRecognitionTrainingFromCamera()}
              onTrainBallRecognitionFromLibrary={() => void app.startBallRecognitionTrainingFromLibrary()}
              onTrainBallRecognitionFromUrls={(rawUrls) => void app.startBallRecognitionTrainingFromUrls(rawUrls)}
              onResetBallRecognition={() => void app.resetBallRecognitionTraining()}
              onApplyHomeworkTestState={app.applyHomeworkTestState}
            />
          )}

          {app.isReady && app.currentUser && app.screen === 'rules' && <RulesGuideScreen />}
          </Animated.ScrollView>
        )}
        {shouldShowHomeUtilityBar ? (
          <View pointerEvents="box-none" style={styles.homeUtilityBarOverlay}>
            <View style={styles.homeUtilityBar}>
              <Pressable
                onPress={() => toggleDrawer('settings')}
                hitSlop={HOME_UTILITY_ICON_HIT_SLOP}
                style={({ pressed }) => [styles.homeUtilityAction, styles.homeUtilitySettingsButton, pressed && styles.pressed]}
                accessibilityState={{ selected: activeHomeUtilityItem === 'settings' }}
              >
                <View style={styles.homeUtilityActionContent}>
                  <Text style={[styles.homeUtilityIconText, activeHomeUtilityItem === 'settings' && styles.homeUtilityIconTextActive]}>⚙</Text>
                  <View
                    style={[
                      styles.homeUtilityIndicator,
                      activeHomeUtilityItem === 'settings' ? styles.homeUtilityIndicatorActive : styles.homeUtilityIndicatorInactive,
                    ]}
                  />
                </View>
              </Pressable>

              <Pressable
                onPress={() => {
                  setActiveDrawer(null);
                  void app.navigateTo('home');
                }}
                hitSlop={HOME_UTILITY_ICON_HIT_SLOP}
                style={({ pressed }) => [styles.homeUtilityAction, styles.homeUtilityHomeButton, pressed && styles.pressed]}
                accessibilityState={{ selected: activeHomeUtilityItem === 'home' }}
              >
                <View style={styles.homeUtilityActionContent}>
                  <Text style={[styles.homeUtilityIconText, activeHomeUtilityItem === 'home' && styles.homeUtilityIconTextActive]}>⌂</Text>
                  <View
                    style={[
                      styles.homeUtilityIndicator,
                      activeHomeUtilityItem === 'home' ? styles.homeUtilityIndicatorActive : styles.homeUtilityIndicatorInactive,
                    ]}
                  />
                </View>
              </Pressable>

              <Pressable
                onPress={() => toggleDrawer('profile')}
                hitSlop={HOME_UTILITY_ICON_HIT_SLOP}
                style={({ pressed }) => [styles.homeUtilityAction, styles.homeUtilityProfileButton, pressed && styles.pressed]}
                accessibilityState={{ selected: activeHomeUtilityItem === 'profile' }}
              >
                <View style={styles.homeUtilityActionContent}>
                  <ProfileSilhouetteIcon active={activeHomeUtilityItem === 'profile'} />
                  <View
                    style={[
                      styles.homeUtilityIndicator,
                      activeHomeUtilityItem === 'profile' ? styles.homeUtilityIndicatorActive : styles.homeUtilityIndicatorInactive,
                    ]}
                  />
                </View>
              </Pressable>
            </View>
          </View>
        ) : null}
        {shouldShowDrawer ? (
          <View
            pointerEvents="box-none"
            style={[styles.settingsOverlay, styles.settingsOverlayFullScreen]}
          >
            <Pressable
              onPress={() => setActiveDrawer(null)}
              style={styles.settingsBackdropPressable}
            >
              <Animated.View style={[styles.settingsBackdrop, { opacity: sideDrawerBackdropOpacity }]} />
            </Pressable>
            <Animated.View
              {...drawerDismissPanResponder.panHandlers}
              style={[
                styles.settingsDrawer,
                styles.settingsDrawerFullScreen,
                {
                  width: currentDrawerWidth,
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
                <View style={styles.settingsDrawerInner}>
                  {visibleDrawer === 'profile' ? (
                    <ProfileScreen
                      currentUser={app.currentUser!}
                      onUpdateProfile={app.updateProfile}
                      onChangePassword={app.changePassword}
                      onDeleteAccount={app.deleteAccount}
                      onLogout={() => {
                        setActiveDrawer(null);
                        void app.logout();
                      }}
                    />
                  ) : (
                    <SettingsScreen
                      selectedBallBrand={app.selectedBallBrand}
                      selectedBallColors={app.selectedBallColors}
                      ballRecognitionProfile={app.ballRecognitionProfile}
                      ballRecognitionPreviews={app.ballRecognitionPreviews}
                      isBallRecognitionTraining={app.isBallRecognitionTraining}
                      homeworkTestState={app.homeworkTestState}
                      onSelectBallBrand={app.selectBallBrand}
                      onToggleBallColor={app.toggleBallColor}
                      onTrainBallRecognitionFromCamera={() => void app.startBallRecognitionTrainingFromCamera()}
                      onTrainBallRecognitionFromLibrary={() => void app.startBallRecognitionTrainingFromLibrary()}
                      onTrainBallRecognitionFromUrls={(rawUrls) => void app.startBallRecognitionTrainingFromUrls(rawUrls)}
                      onResetBallRecognition={() => void app.resetBallRecognitionTraining()}
                      onApplyHomeworkTestState={app.applyHomeworkTestState}
                    />
                  )}
                </View>
              </ScrollView>
            </Animated.View>
          </View>
        ) : null}
        <BallRecognitionCalibrator
          job={app.ballRecognitionCalibrationJob}
          onComplete={(jobId, profile) => void app.handleBallRecognitionCalibrationComplete(jobId, profile)}
          onError={(jobId, message) => void app.handleBallRecognitionCalibrationError(jobId, message)}
        />
      </View>
      </View>
    </RootContainer>
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
    paddingHorizontal: APP_SHELL_HORIZONTAL_PADDING,
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
    paddingTop: 4,
    paddingBottom: 4,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  homeUtilityAction: {
    minHeight: 72,
    minWidth: 76,
    borderRadius: 0,
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  homeUtilityActionContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeUtilityHomeButton: {
    width: 82,
  },
  homeUtilityProfileButton: {
    width: 82,
  },
  homeUtilitySettingsButton: {
    width: 82,
  },
  homeUtilityActionText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  homeUtilityIconText: {
    color: '#ffffff',
    fontSize: 37,
    fontWeight: '900',
    lineHeight: 37,
  },
  homeUtilityIconTextActive: {
    color: colors.secondary,
  },
  homeUtilityIndicator: {
    width: 22,
    height: 3,
    borderRadius: 999,
    marginTop: 5,
  },
  homeUtilityIndicatorActive: {
    backgroundColor: colors.secondary,
  },
  homeUtilityIndicatorInactive: {
    backgroundColor: 'transparent',
  },
  profileIcon: {
    width: 37,
    height: 37,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileIconHead: {
    width: 13,
    height: 13,
    borderRadius: 999,
    backgroundColor: '#ffffff',
    marginBottom: 3,
  },
  profileIconBody: {
    width: 24,
    height: 16,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderBottomLeftRadius: 7,
    borderBottomRightRadius: 7,
    backgroundColor: '#ffffff',
  },
  profileIconPartActive: {
    backgroundColor: colors.secondary,
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
  settingsOverlayFullScreen: {
    top: 0,
    left: -APP_SHELL_HORIZONTAL_PADDING,
    right: -APP_SHELL_HORIZONTAL_PADDING,
    bottom: HOME_UTILITY_BAR_HEIGHT,
  },
  settingsBackdropPressable: {
    ...StyleSheet.absoluteFillObject,
  },
  settingsBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  settingsDrawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    height: '100%',
    backgroundColor: colors.background,
    shadowColor: '#000',
    shadowOpacity: 0.26,
    shadowRadius: 18,
    elevation: 18,
  },
  settingsDrawerFullScreen: {
    left: 0,
    right: 0,
    borderWidth: 0,
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  settingsDrawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 34,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  settingsDrawerTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  settingsDrawerScroll: {
    flex: 1,
  },
  settingsDrawerContent: {
    padding: 18,
    paddingBottom: 28,
    alignItems: 'center',
  },
  settingsDrawerInner: {
    width: '100%',
    maxWidth: 760,
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
