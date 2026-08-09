import * as FileSystem from 'expo-file-system/legacy';
import {
  expandBallRecognitionPatternProfiles,
  MAX_EFFECTIVE_BALL_PATTERN_PROFILES,
} from '../constants/ballRecognition';
import type {
  BallColorOption,
  BallRecognitionBand,
  BallRecognitionPatternProfile,
  BallRecognitionPreview,
  BallRecognitionProfile,
  BallRecognitionRange,
  BallTrainingImageSource,
} from '../types/app';

export const BALL_RECOGNITION_PREVIEW_LIMIT = 3;
export const BALL_RECOGNITION_STORAGE_DIR_NAME = 'ball-profile';

function isRecordObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function isBallColorOption(value: unknown): value is BallColorOption {
  return value === 'orange' || value === 'brown' || value === 'yellow' || value === 'white' || value === 'black' || value === 'gray' || value === 'red';
}

function sanitizeRange(
  value: unknown,
  {
    min = 0,
    max = 1,
    fallbackMin = min,
    fallbackMax = max,
  }: {
    min?: number;
    max?: number;
    fallbackMin?: number;
    fallbackMax?: number;
  } = {}
): BallRecognitionRange {
  if (!isRecordObject(value)) {
    return {
      min: fallbackMin,
      max: fallbackMax,
    };
  }

  const nextMin = typeof value.min === 'number' && Number.isFinite(value.min) ? value.min : fallbackMin;
  const nextMax = typeof value.max === 'number' && Number.isFinite(value.max) ? value.max : fallbackMax;

  return {
    min: clampNumber(Math.min(nextMin, nextMax), min, max),
    max: clampNumber(Math.max(nextMin, nextMax), min, max),
  };
}

function sanitizePatternProfile(value: unknown): BallRecognitionPatternProfile | null {
  if (!isRecordObject(value)) {
    return null;
  }

  return {
    panelLineRatioRange: sanitizeRange(value.panelLineRatioRange, {
      min: 0,
      max: 1,
      fallbackMin: 0,
      fallbackMax: 0.2,
    }),
    edgeDensityRange: sanitizeRange(value.edgeDensityRange, {
      min: 0,
      max: 1,
      fallbackMin: 0,
      fallbackMax: 0.5,
    }),
    rowCoverageRange: sanitizeRange(value.rowCoverageRange, {
      min: 0,
      max: 1,
      fallbackMin: 0,
      fallbackMax: 1,
    }),
    columnCoverageRange: sanitizeRange(value.columnCoverageRange, {
      min: 0,
      max: 1,
      fallbackMin: 0,
      fallbackMax: 1,
    }),
    weight:
      typeof value.weight === 'number' && Number.isFinite(value.weight)
        ? clampNumber(value.weight, 0, 1)
        : 0.72,
  };
}

function sanitizePatternProfiles(value: unknown): BallRecognitionPatternProfile[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => sanitizePatternProfile(entry))
    .filter((entry): entry is BallRecognitionPatternProfile => Boolean(entry))
    .slice(0, MAX_EFFECTIVE_BALL_PATTERN_PROFILES);
}

export function sanitizeBallRecognitionProfile(value: unknown): BallRecognitionProfile | null {
  if (!isRecordObject(value)) {
    return null;
  }

  const learnedColors = Array.isArray(value.learnedColors)
    ? value.learnedColors.filter(isBallColorOption)
    : [];
  const bands = Array.isArray(value.bands)
    ? value.bands
        .map((entry) => {
          if (!isRecordObject(entry) || !isBallColorOption(entry.color)) {
            return null;
          }

          const hueRanges = Array.isArray(entry.hueRanges)
            ? entry.hueRanges.map((range) => sanitizeRange(range, { min: 0, max: 360, fallbackMin: 0, fallbackMax: 360 }))
            : [{ min: 0, max: 360 }];
          const weight = typeof entry.weight === 'number' && Number.isFinite(entry.weight) ? clampNumber(entry.weight, 0, 1) : 0;

          return {
            color: entry.color,
            hueRanges: hueRanges.length > 0 ? hueRanges : [{ min: 0, max: 360 }],
            saturationRange: sanitizeRange(entry.saturationRange, { min: 0, max: 1, fallbackMin: 0, fallbackMax: 1 }),
            valueRange: sanitizeRange(entry.valueRange, { min: 0, max: 1, fallbackMin: 0, fallbackMax: 1 }),
            weight,
          } satisfies BallRecognitionBand;
        })
        .filter((entry): entry is BallRecognitionBand => Boolean(entry))
    : [];
  const legacyPatternProfile = sanitizePatternProfile(value.patternProfile);
  const patternProfiles = sanitizePatternProfiles(value.patternProfiles);
  const normalizedPatternProfiles =
    patternProfiles.length > 0
      ? patternProfiles
      : legacyPatternProfile
        ? [legacyPatternProfile]
        : [];
  const expandedPatternProfiles = expandBallRecognitionPatternProfiles(normalizedPatternProfiles);

  if (bands.length === 0 && expandedPatternProfiles.length === 0) {
    return null;
  }

  const uniqueLearnedColors = Array.from(
    new Set(
      learnedColors.filter((color) => bands.some((band) => band.color === color))
    )
  ).slice(0, BALL_RECOGNITION_PREVIEW_LIMIT);
  const trainedAt = typeof value.trainedAt === 'string' && value.trainedAt ? value.trainedAt : new Date().toISOString();

  return {
    learnedColors: uniqueLearnedColors.length > 0 ? uniqueLearnedColors : bands.slice(0, BALL_RECOGNITION_PREVIEW_LIMIT).map((band) => band.color),
    bands,
    patternProfiles: expandedPatternProfiles,
    trainedAt,
  };
}

export function sanitizeBallRecognitionPreviews(value: unknown): BallRecognitionPreview[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (
        !isRecordObject(entry) ||
        typeof entry.id !== 'string' ||
        typeof entry.uri !== 'string' ||
        typeof entry.createdAt !== 'string'
      ) {
        return null;
      }

      const source: BallTrainingImageSource =
        entry.source === 'camera' || entry.source === 'url' ? entry.source : 'library';
      return {
        id: entry.id,
        uri: entry.uri,
        source,
        createdAt: entry.createdAt,
      } satisfies BallRecognitionPreview;
    })
    .filter((entry): entry is BallRecognitionPreview => Boolean(entry))
    .slice(-BALL_RECOGNITION_PREVIEW_LIMIT);
}

export function getBallRecognitionStorageDir(userId: string) {
  if (!FileSystem.documentDirectory) {
    throw new Error('local_document_directory_unavailable');
  }

  return `${FileSystem.documentDirectory}${BALL_RECOGNITION_STORAGE_DIR_NAME}/${userId}/`;
}

export async function ensureBallRecognitionStorageDir(userId: string) {
  const directory = getBallRecognitionStorageDir(userId);
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  return directory;
}

function buildImageExtension(fileName?: string | null, mimeType?: string | null) {
  const fileNameParts = typeof fileName === 'string' ? fileName.split('.') : [];
  const fileNameExtension = fileNameParts.length > 1 ? fileNameParts[fileNameParts.length - 1]?.trim().toLowerCase() : '';

  if (fileNameExtension) {
    return fileNameExtension;
  }

  const mimeTypeValue = typeof mimeType === 'string' ? mimeType.toLowerCase() : '';

  if (mimeTypeValue.includes('png')) {
    return 'png';
  }

  if (mimeTypeValue.includes('webp')) {
    return 'webp';
  }

  return 'jpg';
}

export async function writeBallRecognitionPreviewFile({
  userId,
  previewId,
  base64,
  fileName,
  mimeType,
}: {
  userId: string;
  previewId: string;
  base64: string;
  fileName?: string | null;
  mimeType?: string | null;
}) {
  const directory = await ensureBallRecognitionStorageDir(userId);
  const extension = buildImageExtension(fileName, mimeType);
  const outputUri = `${directory}${previewId}.${extension}`;

  await FileSystem.writeAsStringAsync(outputUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return outputUri;
}

export async function deleteBallRecognitionPreviewFiles(previews: BallRecognitionPreview[]) {
  await Promise.all(
    previews.map(async (preview) => {
      try {
        await FileSystem.deleteAsync(preview.uri, { idempotent: true });
      } catch {
        // Ignore individual preview cleanup failures.
      }
    })
  );
}
