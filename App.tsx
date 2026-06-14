import { useCallback, useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Animated, Platform, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
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
  const showBack = Boolean(app.currentUser && app.screen !== 'home');
  const isLessonScreen = app.isReady && app.currentUser && app.screen === 'lesson';
  const shouldAnimateHeader = Platform.OS !== 'web';
  const headerVisibility = useRef(new Animated.Value(1)).current;
  const headerVisibilityTargetRef = useRef<0 | 1>(1);
  const lastScrollYRef = useRef(0);
  const [headerMeasuredHeight, setHeaderMeasuredHeight] = useState(0);
  const effectiveHeaderHeight = Math.max(headerMeasuredHeight, 96);

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
      if (!shouldAnimateHeader) {
        return;
      }

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
    [animateHeader, shouldAnimateHeader]
  );

  useEffect(() => {
    lastScrollYRef.current = 0;
    headerVisibilityTargetRef.current = 1;
    headerVisibility.setValue(1);
  }, [app.currentUser, app.screen, headerVisibility, shouldAnimateHeader]);

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

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <View style={styles.appShell}>
        <View style={styles.backgroundGlowTop} />
        <View style={styles.backgroundGlowBottom} />
        <FireworkBurst visible={app.showFireworks} items={app.fireworks} />
        {!isLessonScreen && shouldAnimateHeader ? (
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
        {!isLessonScreen && !shouldAnimateHeader ? (
          <Header showBack={showBack} onBack={() => void app.navigateTo('home')} />
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
            onScroll={shouldAnimateHeader ? handleScroll : undefined}
            scrollEventThrottle={shouldAnimateHeader ? 16 : undefined}
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
              onOpenSettings={() => void app.navigateTo('settings')}
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
    paddingHorizontal: 18,
    paddingTop: 14,
    position: 'relative',
  },
  backgroundGlowTop: {
    position: 'absolute',
    top: -120,
    right: -50,
    width: 260,
    height: 260,
    borderRadius: 999,
    backgroundColor: 'rgba(255,145,77,0.18)',
  },
  backgroundGlowBottom: {
    position: 'absolute',
    bottom: 40,
    left: -60,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: 'rgba(255,204,102,0.08)',
  },
  scrollContent: {
    paddingBottom: 32,
    gap: 18,
  },
  lessonScreenWrap: {
    flex: 1,
    minHeight: 0,
    paddingBottom: 32,
  },
  headerAnimatedWrap: {
    overflow: 'hidden',
  },
  loadingCard: {
    borderRadius: 24,
    padding: 24,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  loadingTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 10,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
  },
  loadingHint: {
    color: colors.textAccent,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 14,
  },
  loadingActionRow: {
    marginTop: 16,
    alignSelf: 'flex-start',
  },
});
