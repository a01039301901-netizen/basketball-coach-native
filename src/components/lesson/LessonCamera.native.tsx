import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { colors } from '../../theme/colors';
import { buildPoseBootstrapScript, POSE_WEB_BOOTSTRAP_URL } from './poseWebHtml';

interface LessonCameraProps {
  isLessonActive: boolean;
  isCameraReady: boolean;
  onPoseMessage: (event: WebViewMessageEvent) => void;
}

export function LessonCamera({ isLessonActive, isCameraReady, onPoseMessage }: LessonCameraProps) {
  return (
    <View style={styles.videoWrap}>
      {isLessonActive ? (
        <>
          <WebView
            originWhitelist={['https://*']}
            source={{ uri: POSE_WEB_BOOTSTRAP_URL }}
            style={styles.webview}
            onMessage={onPoseMessage}
            injectedJavaScriptBeforeContentLoaded={buildPoseBootstrapScript()}
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
            <Text style={styles.hint}>
              모바일에서는 WebView 안에서 inner.html 방식으로 MediaPipe를 실행합니다.
            </Text>
          </View>
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
