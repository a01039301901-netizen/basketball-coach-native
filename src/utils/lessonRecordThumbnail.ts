import { Platform } from 'react-native';

const LESSON_RECORD_THUMBNAIL_TIME_MS = 50;
const LESSON_RECORD_THUMBNAIL_TIME_SECONDS = LESSON_RECORD_THUMBNAIL_TIME_MS / 1000;

function normalizeNativeMediaUri(uri: string) {
  const normalizedUri = uri.trim();

  if (!normalizedUri || /^[a-z]+:\/\//i.test(normalizedUri)) {
    return normalizedUri;
  }

  if (normalizedUri.startsWith('/')) {
    return `file://${normalizedUri}`;
  }

  return normalizedUri;
}

async function generateNativeLessonRecordThumbnail(videoUri: string) {
  const { getThumbnailAsync } = await import('expo-video-thumbnails');
  const candidateUris = Array.from(new Set([normalizeNativeMediaUri(videoUri), videoUri.trim()])).filter(Boolean);

  for (const candidateUri of candidateUris) {
    try {
      const thumbnail = await getThumbnailAsync(candidateUri, {
        time: LESSON_RECORD_THUMBNAIL_TIME_MS,
        quality: 0.6,
      });

      if (thumbnail?.uri) {
        return thumbnail.uri;
      }
    } catch {
      // Try the next URI format when the current candidate fails.
    }
  }

  return null;
}

function generateWebLessonRecordThumbnail(videoUri: string) {
  if (typeof document === 'undefined') {
    return Promise.resolve<string | null>(null);
  }

  return new Promise<string | null>((resolve) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let isSettled = false;

    const finish = (result: string | null) => {
      if (isSettled) {
        return;
      }

      isSettled = true;

      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      video.pause();
      video.removeAttribute('src');
      video.load();
      resolve(result);
    };

    const captureFrame = () => {
      if (!video.videoWidth || !video.videoHeight) {
        finish(null);
        return;
      }

      try {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext('2d');

        if (!context) {
          finish(null);
          return;
        }

        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        finish(canvas.toDataURL('image/jpeg', 0.72));
      } catch {
        finish(null);
      }
    };

    const seekToStartFrame = () => {
      const targetTime =
        Number.isFinite(video.duration) && video.duration > 0
          ? Math.min(LESSON_RECORD_THUMBNAIL_TIME_SECONDS, Math.max(video.duration - 0.01, 0))
          : 0;

      if (Math.abs(video.currentTime - targetTime) < 0.001) {
        captureFrame();
        return;
      }

      try {
        video.currentTime = targetTime;
      } catch {
        captureFrame();
      }
    };

    video.addEventListener('loadeddata', seekToStartFrame, { once: true });
    video.addEventListener('seeked', captureFrame, { once: true });
    video.addEventListener('error', () => finish(null), { once: true });
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = 'anonymous';
    video.src = videoUri;
    video.load();

    timeoutId = setTimeout(() => finish(null), 8000);
  });
}

export async function generateLessonRecordThumbnail(videoUri: string) {
  if (!videoUri.trim()) {
    return null;
  }

  if (Platform.OS === 'web') {
    return generateWebLessonRecordThumbnail(videoUri);
  }

  return generateNativeLessonRecordThumbnail(videoUri);
}
