import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { useEffect, useRef } from 'react';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { colors } from '../../theme/colors';
import type { BallBrandOption, BallColorOption, LessonMode } from '../../types/app';
import { buildPoseBootstrapScript, POSE_WEB_BOOTSTRAP_URL } from './poseWebHtml';

interface LessonCameraProps {
  lessonMode: LessonMode;
  selectedBallBrand: BallBrandOption;
  selectedBallColors: BallColorOption[];
  cameraSessionKey: number;
  isCameraActive: boolean;
  isCameraPreviewHidden: boolean;
  isLessonActive: boolean;
  isCameraReady: boolean;
  countdownValue: number | null;
  dribbleResetToken: number;
  shootResetToken: number;
  recordingStartToken: number;
  recordingStopToken: number;
  cameraStopMode: 'review' | 'disconnect' | null;
  containerStyle?: StyleProp<ViewStyle>;
  onPoseMessage: (event: WebViewMessageEvent) => void;
}

export function LessonCamera({
  lessonMode,
  selectedBallBrand,
  selectedBallColors,
  cameraSessionKey,
  isCameraActive,
  isCameraPreviewHidden,
  isLessonActive,
  countdownValue,
  dribbleResetToken,
  shootResetToken,
  recordingStartToken,
  recordingStopToken,
  cameraStopMode,
  containerStyle,
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

    if (!cameraStopMode) {
      return;
    }

    const stopScript =
      cameraStopMode === 'disconnect'
        ? "window.__codexStopRecordingAndDisconnectCamera && window.__codexStopRecordingAndDisconnectCamera(); true;"
        : "window.__codexStopRecordingForReview && window.__codexStopRecordingForReview(); true;";

    webViewRef.current?.injectJavaScript(stopScript);
  }, [cameraStopMode, isCameraActive, lessonMode, recordingStopToken]);

  return (
    <View style={[styles.videoWrap, containerStyle]}>
      {isCameraActive ? (
        <>
          <WebView
            key={`${lessonMode}-${cameraSessionKey}`}
            ref={webViewRef}
            originWhitelist={['https://*']}
            source={{ uri: `${POSE_WEB_BOOTSTRAP_URL}?session=${cameraSessionKey}&mode=${lessonMode}` }}
            style={[styles.webview, isCameraPreviewHidden && styles.hiddenCapture]}
            onMessage={onPoseMessage}
            injectedJavaScriptBeforeContentLoaded={buildPoseBootstrapScript(
              lessonMode,
              selectedBallBrand,
              selectedBallColors
            )}
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
                <Text style={styles.loadingText}>MediaPipe 분석 화면을 준비하고 있습니다.</Text>
              </View>
            )}
          />
          <View style={styles.overlay}>
            {countdownValue !== null ? (
              <View style={styles.countdownWrap}>
                <View style={styles.countdownBubble}>
                  <Text style={styles.countdownNumber}>{countdownValue}</Text>
                  <Text style={styles.countdownLabel}>START</Text>
                </View>
              </View>
            ) : null}
          </View>
          {isCameraPreviewHidden ? (
            <View style={styles.placeholderOverlay}>
              <Text style={styles.placeholderTitle}>카메라 종료 중</Text>
              <Text style={styles.placeholderText}>
                목표 횟수를 채워 카메라를 끄고 레슨 결과를 정리하고 있습니다.
              </Text>
            </View>
          ) : null}
        </>
      ) : (
        <View style={styles.placeholder}>
          <View style={styles.placeholderTitleWrap}>
            <Text style={[styles.placeholderTitle, styles.placeholderTitleSolo]}>카메라 대기 중</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  videoWrap: {
    flex: 1,
    width: '100%',
    minHeight: 0,
    backgroundColor: colors.cameraBg,
    overflow: 'hidden',
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
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  placeholderTitleWrap: {
    alignItems: 'center',
    transform: [{ translateY: -56 }],
  },
  placeholderTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 8,
  },
  placeholderTitleSolo: {
    marginBottom: 0,
  },
  placeholderText: {
    color: '#ddd1c8',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
});
