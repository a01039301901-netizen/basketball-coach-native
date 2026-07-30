import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { BallRecognitionProfile } from '../../types/app';
import { buildBallRecognitionCalibrationHtml } from './calibrationHtml';

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

export function BallRecognitionCalibrator({ job, onComplete, onError }: BallRecognitionCalibratorProps) {
  const currentJobIdRef = useRef<string | null>(job?.id ?? null);

  useEffect(() => {
    currentJobIdRef.current = job?.id ?? null;
  }, [job]);

  const html = useMemo(
    () => (job ? buildBallRecognitionCalibrationHtml(job.pendingPreviews) : ''),
    [job]
  );

  if (!job) {
    return null;
  }

  return (
    <View pointerEvents="none" style={styles.hidden}>
      <WebView
        key={job.id}
        originWhitelist={['*']}
        source={{ html }}
        onMessage={(event) => {
          const activeJobId = currentJobIdRef.current;

          if (!activeJobId) {
            return;
          }

          try {
            const payload = JSON.parse(event.nativeEvent.data) as
              | { type: 'complete'; profile: BallRecognitionProfile | null }
              | { type: 'error'; message?: string };

            if (payload.type === 'complete') {
              onComplete(activeJobId, payload.profile ?? null);
              return;
            }

            onError(activeJobId, payload.message || 'ball_calibration_failed');
          } catch {
            onError(activeJobId, 'ball_calibration_parse_failed');
          }
        }}
        javaScriptEnabled
        domStorageEnabled
        cacheEnabled={false}
        style={styles.webView}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hidden: {
    position: 'absolute',
    width: 0,
    height: 0,
    opacity: 0,
    overflow: 'hidden',
  },
  webView: {
    width: 1,
    height: 1,
    opacity: 0,
    backgroundColor: 'transparent',
  },
});
