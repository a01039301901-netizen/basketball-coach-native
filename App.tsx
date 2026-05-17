import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';
import { FireworkBurst } from './src/components/common/FireworkBurst';
import { Header } from './src/components/common/Header';
import { useBasketballCoachApp } from './src/hooks/useBasketballCoachApp';
import { DiaryScreen } from './src/screens/DiaryScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { LessonScreen } from './src/screens/LessonScreen';
import { SkillScreen } from './src/screens/SkillScreen';
import { colors } from './src/theme/colors';

export default function App() {
  const app = useBasketballCoachApp();

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <View style={styles.appShell}>
        <View style={styles.backgroundGlowTop} />
        <View style={styles.backgroundGlowBottom} />
        <FireworkBurst visible={app.showFireworks} items={app.fireworks} />
        <Header showBack={app.screen !== 'home'} onBack={() => void app.navigateTo('home')} />
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {app.screen === 'home' && (
            <HomeScreen
              homeworkToShow={app.homeworkToShow}
              onOpenLesson={() => void app.navigateTo('lesson')}
              onOpenDiary={() => void app.navigateTo('diary')}
              onOpenSkill={() => void app.navigateTo('skill')}
            />
          )}

          {app.screen === 'lesson' && (
            <LessonScreen
              lessonMode={app.lessonMode}
              isLessonActive={app.isLessonActive}
              isCameraReady={app.isCameraReady}
              cameraSessionKey={app.cameraSessionKey}
              countdownValue={app.countdownValue}
              debugText={app.debugText}
              feedbackText={app.feedbackText}
              cameraError={app.cameraError}
              onSelectMode={app.changeLessonMode}
              onBeginLesson={() => void app.beginLesson()}
              onEndLesson={() => void app.endLesson()}
              onRegisterSuccessfulShot={app.registerSuccessfulShot}
              onPoseMessage={app.handlePoseMessage}
            />
          )}

          {app.screen === 'skill' && (
            <SkillScreen
              selectedSkillKey={app.selectedSkillKey}
              onSelectSkill={app.selectSkill}
              onOpenSkillVideo={() => void app.openSkillVideo()}
            />
          )}

          {app.screen === 'diary' && (
            <DiaryScreen
              currentDate={app.currentDate}
              calendarCells={app.calendarCells}
              selectedDateKey={app.selectedDateKey}
              selectedDateRecords={app.selectedDateRecords}
              selectedDateShotCount={app.selectedDateShotCount}
              onChangeMonth={app.changeMonth}
              onOpenDate={app.openDiaryDate}
              onDeleteRecord={(recordId) => void app.deleteLessonRecord(recordId)}
            />
          )}
        </ScrollView>
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
});
