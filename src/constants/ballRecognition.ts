import type { BallBrandOption, BallRecognitionBand, BallRecognitionProfile } from '../types/app';

const MOLTEN_REFERENCE_BANDS: BallRecognitionBand[] = [
  {
    color: 'red',
    hueRanges: [
      { min: 0, max: 7 },
      { min: 346, max: 360 },
    ],
    saturationRange: { min: 0.24, max: 0.68 },
    valueRange: { min: 0.2, max: 0.7 },
    weight: 0.78,
  },
  {
    color: 'white',
    hueRanges: [{ min: 0, max: 360 }],
    saturationRange: { min: 0, max: 0.15 },
    valueRange: { min: 0.72, max: 0.96 },
    weight: 0.17,
  },
  {
    color: 'black',
    hueRanges: [{ min: 0, max: 360 }],
    saturationRange: { min: 0.08, max: 0.34 },
    valueRange: { min: 0.04, max: 0.24 },
    weight: 0.05,
  },
];

export const BALL_BRAND_REFERENCE_PROFILES: Partial<Record<BallBrandOption, BallRecognitionProfile>> = {
  molten: {
    learnedColors: ['red', 'white', 'black'],
    bands: MOLTEN_REFERENCE_BANDS,
    patternProfile: null,
    trainedAt: '2026-07-29T00:00:00.000Z',
  },
};

export function getEffectiveBallRecognitionProfile(
  selectedBallBrand: BallBrandOption,
  ballRecognitionProfile: BallRecognitionProfile | null
) {
  const referenceProfile = BALL_BRAND_REFERENCE_PROFILES[selectedBallBrand] ?? null;

  if (!referenceProfile) {
    return ballRecognitionProfile;
  }

  if (!ballRecognitionProfile) {
    return referenceProfile;
  }

  const mergedBandByColor = new Map(referenceProfile.bands.map((band) => [band.color, band]));

  for (const band of ballRecognitionProfile.bands) {
    mergedBandByColor.set(band.color, band);
  }

  return {
    learnedColors: Array.from(new Set([...ballRecognitionProfile.learnedColors, ...referenceProfile.learnedColors])),
    bands: Array.from(mergedBandByColor.values()),
    patternProfile: ballRecognitionProfile.patternProfile ?? referenceProfile.patternProfile ?? null,
    trainedAt: ballRecognitionProfile.trainedAt,
  } satisfies BallRecognitionProfile;
}
