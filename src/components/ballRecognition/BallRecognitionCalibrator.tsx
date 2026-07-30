import { Platform } from 'react-native';
import type { BallRecognitionProfile } from '../../types/app';

interface CalibrationJob {
  id: string;
  pendingPreviews: Array<{
    id: string;
    dataUrl: string;
  }>;
}

interface BallRecognitionCalibratorProps {
  job: CalibrationJob | null;
  onComplete: (jobId: string, profile: BallRecognitionProfile | null) => void;
  onError: (jobId: string, message: string) => void;
}

const BallRecognitionCalibratorImpl =
  Platform.OS === 'web'
    ? require('./BallRecognitionCalibrator.web').BallRecognitionCalibrator
    : require('./BallRecognitionCalibrator.native').BallRecognitionCalibrator;

export function BallRecognitionCalibrator(props: BallRecognitionCalibratorProps) {
  return <BallRecognitionCalibratorImpl {...props} />;
}
