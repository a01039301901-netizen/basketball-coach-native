import { createElement, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import type { WebViewMessageEvent } from 'react-native-webview';
import { colors } from '../../theme/colors';
import type { BallBrandOption, BallColorOption, LessonMode } from '../../types/app';
import { buildPoseWebHtml } from './poseWebHtml';

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
  isCameraReady,
  countdownValue,
  dribbleResetToken,
  shootResetToken,
  recordingStartToken,
  recordingStopToken,
  cameraStopMode,
  containerStyle,
  onPoseMessage,
}: LessonCameraProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const onPoseMessageRef = useRef(onPoseMessage);

  useEffect(() => {
    onPoseMessageRef.current = onPoseMessage;
  }, [onPoseMessage]);

  useEffect(() => {
    if (!isCameraActive) {
      return undefined;
    }

    const handleMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) {
        return;
      }

      onPoseMessageRef.current({
        nativeEvent: { data: JSON.stringify(event.data) },
      } as WebViewMessageEvent);
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isCameraActive]);

  useEffect(() => {
    if (!isCameraActive || recordingStartToken <= 0) {
      return;
    }

    const iframeWindow = iframeRef.current?.contentWindow as
      | (Window & { __codexRestartRecordingFromCue?: () => void })
      | undefined;

    iframeWindow?.__codexRestartRecordingFromCue?.();
  }, [isCameraActive, recordingStartToken]);

  useEffect(() => {
    if (!isCameraActive || dribbleResetToken <= 0) {
      return;
    }

    const iframeWindow = iframeRef.current?.contentWindow as
      | (Window & { __codexResetDribbleTracking?: () => void })
      | undefined;

    iframeWindow?.__codexResetDribbleTracking?.();
  }, [dribbleResetToken, isCameraActive]);

  useEffect(() => {
    if (!isCameraActive || shootResetToken <= 0) {
      return;
    }

    const iframeWindow = iframeRef.current?.contentWindow as
      | (Window & { __codexResetShootTracking?: () => void })
      | undefined;

    iframeWindow?.__codexResetShootTracking?.();
  }, [isCameraActive, shootResetToken]);

  useEffect(() => {
    if (!isCameraActive || recordingStopToken <= 0) {
      return;
    }

    const iframeWindow = iframeRef.current?.contentWindow as
      | (Window & {
          __codexStopRecordingForReview?: () => void;
          __codexStopRecordingAndDisconnectCamera?: () => void;
        })
      | undefined;

    if (!cameraStopMode) {
      return;
    }

    if (cameraStopMode === 'disconnect') {
      iframeWindow?.__codexStopRecordingAndDisconnectCamera?.();
      return;
    }

    iframeWindow?.__codexStopRecordingForReview?.();
  }, [cameraStopMode, isCameraActive, lessonMode, recordingStopToken]);

  const srcDoc = useMemo(
    () => buildPoseWebHtml(lessonMode, selectedBallBrand, selectedBallColors),
    [lessonMode, selectedBallBrand, selectedBallColors]
  );

  return (
    <View style={[styles.videoWrap, containerStyle]}>
      {isCameraActive ? (
        <>
          {createElement('iframe', {
            key: `${lessonMode}-${cameraSessionKey}`,
            ref: iframeRef,
            srcDoc,
            allow: 'camera; microphone; autoplay',
            style: StyleSheet.flatten([styles.iframe, isCameraPreviewHidden && styles.hiddenCapture]) as unknown as React.CSSProperties,
          })}
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
    flex: 1,
    width: '100%',
    minHeight: 0,
    backgroundColor: colors.cameraBg,
    overflow: 'hidden',
    position: 'relative',
  },
  iframe: {
    borderWidth: 0,
    width: '100%',
    height: '100%',
    backgroundColor: colors.cameraBg,
  },
  hiddenCapture: {
    opacity: 0,
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
