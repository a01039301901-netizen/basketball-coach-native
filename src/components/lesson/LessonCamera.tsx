import { Platform } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import type { WebViewMessageEvent } from 'react-native-webview';
import type { BallBrandOption, BallColorOption, BallRecognitionProfile, DribbleLessonView, LessonMode } from '../../types/app';

interface LessonCameraProps {
  lessonMode: LessonMode;
  selectedDribbleView: DribbleLessonView;
  selectedBallBrand: BallBrandOption;
  selectedBallColors: BallColorOption[];
  ballRecognitionProfile: BallRecognitionProfile | null;
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

const LessonCameraImpl =
  Platform.OS === 'web'
    ? require('./LessonCamera.web').LessonCamera
    : require('./LessonCamera.native').LessonCamera;

export function LessonCamera(props: LessonCameraProps) {
  return <LessonCameraImpl {...props} />;
}
