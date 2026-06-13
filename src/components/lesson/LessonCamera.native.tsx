import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useEffect, useRef } from 'react';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { colors } from '../../theme/colors';
import type { BallBrandOption, BallColorOption, LessonMode } from '../../types/app';
import { buildPoseBootstrapScript, POSE_WEB_BOOTSTRAP_URL } from './poseWebHtml';

interface LessonCameraProps {
  lessonMode: LessonMode;
  selectedBallBrand: BallBrandOption;
  selectedBallColors: BallColorOption[];
  isCameraActive: boolean;
  isCameraPreviewHidden: boolean;
  isLessonActive: boolean;
  isCameraReady: boolean;
  countdownValue: number | null;
  dribbleResetToken: number;
  shootResetToken: number;
  recordingStartToken: number;
  recordingStopToken: number;
  onPoseMessage: (event: WebViewMessageEvent) => void;
}

export function LessonCamera({
  lessonMode,
  selectedBallBrand,
  selectedBallColors,
  isCameraActive,
  isCameraPreviewHidden,
  isLessonActive,
  isCameraReady,
  countdownValue,
  dribbleResetToken,
  shootResetToken,
  recordingStartToken,
  recordingStopToken,
  onPoseMessage,
}: LessonCameraProps) {
  const webViewRef = useRef<WebView>(null);

  useEffect(() => {
    if (!isCameraActive || recordingStartToken <= 0) {
      return;
    }

    webViewRef.current?.injectJavaScript(
      "window.__codexRestartRecordingFromCue && window.__codexRestartRecordingFromCue(); true;"
    );
  }, [isCameraActive, recordingStartToken]);

  useEffect(() => {
    if (!isCameraActive || dribbleResetToken <= 0) {
      return;
    }

    webViewRef.current?.injectJavaScript(
      "window.__codexResetDribbleTracking && window.__codexResetDribbleTracking(); true;"
    );
  }, [dribbleResetToken, isCameraActive]);

  useEffect(() => {
    if (!isCameraActive || shootResetToken <= 0) {
      return;
    }

    webViewRef.current?.injectJavaScript(
      "window.__codexResetShootTracking && window.__codexResetShootTracking(); true;"
    );
  }, [isCameraActive, shootResetToken]);

  useEffect(() => {
    if (!isCameraActive || recordingStopToken <= 0) {
      return;
    }

    const stopScript =
      lessonMode === 'dribble'
        ? "window.__codexStopRecordingAndDisconnectCamera && window.__codexStopRecordingAndDisconnectCamera(); true;"
        : "window.__codexStopRecordingForReview && window.__codexStopRecordingForReview(); true;";

    webViewRef.current?.injectJavaScript(
      stopScript
    );
  }, [isCameraActive, lessonMode, recordingStopToken]);

  return (
    <View style={styles.videoWrap}>
      {isCameraActive ? (
        <>
          <WebView
            ref={webViewRef}
            originWhitelist={['https://*']}
            source={{ uri: POSE_WEB_BOOTSTRAP_URL }}
            style={[styles.webview, isCameraPreviewHidden && styles.hiddenCapture]}
            onMessage={onPoseMessage}
            injectedJavaScriptBeforeContentLoaded={buildPoseBootstrapScript(lessonMode, selectedBallBrand, selectedBallColors)}
            javaScriptEnabled
            domStorageEnabled
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            mediaCapturePermissionGrantType="grantIfSameHostElsePrompt"
            cacheEnabled={false}
            allowFileAccess
            allowFileAccessFromFileURLs
            allowUniversalAccessFromFileURLs
            mixedContentMode="always"
            setSupportMultipleWindows={false}
            startInLoadingState
            renderLoading={() => (
              <View style={styles.loading}>
                <ActivityIndicator size="large" color="#ff9f1c" />
                <Text style={styles.loadingText}>MediaPipe 분석 화면을 준비하는 중입니다.</Text>
              </View>
            )}
          />
          <View style={styles.overlay}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{isCameraReady ? 'LIVE' : 'LOADING'}</Text>
            </View>
            {countdownValue !== null ? (
              <View style={styles.countdownWrap}>
                <View style={styles.countdownBubble}>
                  <Text style={styles.countdownNumber}>{countdownValue}</Text>
                  <Text style={styles.countdownLabel}>START</Text>
                </View>
              </View>
            ) : null}
            <Text style={styles.hint}>
              모바일에서는 WebView 안에서 inner.html 방식으로 MediaPipe를 실행합니다.
            </Text>
          </View>
          {isCameraPreviewHidden ? (
            <View style={styles.placeholderOverlay}>
              <Text style={styles.placeholderTitle}>카메라 종료 중</Text>
              <Text style={styles.placeholderText}>목표 횟수를 채워 카메라를 끄고 레슨 결과를 정리하고 있습니다.</Text>
            </View>
          ) : null}
        </>
      ) : (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderTitle}>카메라 대기 중</Text>
          <Text style={styles.placeholderText}>레슨 시작을 누르면 MediaPipe 분석 카메라가 실행됩니다.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  videoWrap: {
    height: 560,
    backgroundColor: colors.cameraBg,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: colors.secondary,
    marginBottom: 16,
    position: 'relative',
  },
  webview: {
    flex: 1,
    backgroundColor: colors.cameraBg,
  },
  hiddenCapture: {
    opacity: 0,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cameraBg,
    gap: 12,
  },
  loadingText: {
    color: colors.text,
    fontSize: 14,
  },
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'space-between',
    padding: 16,
    pointerEvents: 'none',
  },
  placeholderOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    backgroundColor: colors.cameraBg,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(230,57,70,0.9)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  badgeText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  countdownWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countdownBubble: {
    width: 150,
    height: 150,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.48)',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.78)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countdownNumber: {
    color: '#fff6ed',
    fontSize: 64,
    fontWeight: '900',
    lineHeight: 72,
  },
  countdownLabel: {
    color: '#ffd8a8',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 2,
    marginTop: 2,
  },
  hint: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    backgroundColor: 'rgba(0,0,0,0.38)',
    borderRadius: 14,
    padding: 12,
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  placeholderTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 8,
  },
  placeholderText: {
    color: '#ddd1c8',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
});
