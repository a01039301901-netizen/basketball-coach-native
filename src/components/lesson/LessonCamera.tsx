import { Platform } from 'react-native';
import type { WebViewMessageEvent } from 'react-native-webview';
import type { BallBrandOption, BallColorOption, LessonMode } from '../../types/app';

interface LessonCameraProps {
  lessonMode: LessonMode;
  selectedBallBrand: BallBrandOption;
  selectedBallColors: BallColorOption[];
  isLessonActive: boolean;
  isCameraReady: boolean;
  countdownValue: number | null;
  onPoseMessage: (event: WebViewMessageEvent) => void;
}

const LessonCameraImpl =
  Platform.OS === 'web'
    ? require('./LessonCamera.web').LessonCamera
    : require('./LessonCamera.native').LessonCamera;

export function LessonCamera(props: LessonCameraProps) {
  return <LessonCameraImpl {...props} />;
}
