import { Platform } from 'react-native';
import type { WebViewMessageEvent } from 'react-native-webview';

interface LessonCameraProps {
  isLessonActive: boolean;
  isCameraReady: boolean;
  onPoseMessage: (event: WebViewMessageEvent) => void;
}

const LessonCameraImpl =
  Platform.OS === 'web'
    ? require('./LessonCamera.web').LessonCamera
    : require('./LessonCamera.native').LessonCamera;

export function LessonCamera(props: LessonCameraProps) {
  return <LessonCameraImpl {...props} />;
}
