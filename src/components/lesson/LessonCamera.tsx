import { Platform } from 'react-native';
import type { WebViewMessageEvent } from 'react-native-webview';
import type { BallBrandOption, BallColorOption, DribbleLessonView, LessonMode } from '../../types/app';

interface LessonCameraProps {
  lessonMode: LessonMode;
  dribbleLessonView: DribbleLessonView;
  selectedBallBrand: BallBrandOption;
  selectedBallColors: BallColorOption[];
  isCameraActive: boolean;
  isLessonActive: boolean;
  isCameraReady: boolean;
  countdownValue: number | null;
  dribbleResetToken: number;
  shootResetToken: number;
  recordingStartToken: number;
  recordingStopToken: number;
  onPoseMessage: (event: WebViewMessageEvent) => void;
}

const LessonCameraImpl =
  Platform.OS === 'web'
    ? require('./LessonCamera.web').LessonCamera
    : require('./LessonCamera.native').LessonCamera;

export function LessonCamera(props: LessonCameraProps) {
  return <LessonCameraImpl {...props} />;
}
