import { createElement, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
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
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const currentJobIdRef = useRef<string | null>(job?.id ?? null);

  useEffect(() => {
    currentJobIdRef.current = job?.id ?? null;
  }, [job]);

  useEffect(() => {
    if (!job) {
      return undefined;
    }

    const handleMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) {
        return;
      }

      const activeJobId = currentJobIdRef.current;

      if (!activeJobId) {
        return;
      }

      const payload = event.data as
        | { type: 'complete'; profile: BallRecognitionProfile | null }
        | { type: 'error'; message?: string };

      if (payload?.type === 'complete') {
        onComplete(activeJobId, payload.profile ?? null);
        return;
      }

      onError(activeJobId, payload?.message || 'ball_calibration_failed');
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [job, onComplete, onError]);

  const srcDoc = useMemo(
    () => (job ? buildBallRecognitionCalibrationHtml(job.pendingPreviews) : ''),
    [job]
  );

  if (!job) {
    return null;
  }

  return (
    <View pointerEvents="none" style={styles.hidden}>
      {createElement('iframe', {
        key: job.id,
        ref: iframeRef,
        srcDoc,
        style: StyleSheet.flatten(styles.frame) as unknown as React.CSSProperties,
      })}
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
  frame: {
    width: 1,
    height: 1,
    opacity: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
});
