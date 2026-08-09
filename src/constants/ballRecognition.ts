import type {
  BallBrandOption,
  BallRecognitionBand,
  BallRecognitionPatternProfile,
  BallRecognitionProfile,
} from '../types/app';

export const MAX_EFFECTIVE_BALL_PATTERN_PROFILES = 12;

function clonePatternRange(range: { min: number; max: number }) {
  return {
    min: range.min,
    max: range.max,
  };
}

function buildPatternProfileKey(patternProfile: BallRecognitionPatternProfile) {
  return [
    patternProfile.panelLineRatioRange.min,
    patternProfile.panelLineRatioRange.max,
    patternProfile.edgeDensityRange.min,
    patternProfile.edgeDensityRange.max,
    patternProfile.rowCoverageRange.min,
    patternProfile.rowCoverageRange.max,
    patternProfile.columnCoverageRange.min,
    patternProfile.columnCoverageRange.max,
    patternProfile.weight,
  ].join('|');
}

export function rotateBallPatternProfileQuarterTurn(
  patternProfile: BallRecognitionPatternProfile
): BallRecognitionPatternProfile {
  return {
    panelLineRatioRange: clonePatternRange(patternProfile.panelLineRatioRange),
    edgeDensityRange: clonePatternRange(patternProfile.edgeDensityRange),
    rowCoverageRange: clonePatternRange(patternProfile.columnCoverageRange),
    columnCoverageRange: clonePatternRange(patternProfile.rowCoverageRange),
    weight: patternProfile.weight,
  };
}

export function expandBallRecognitionPatternProfiles(
  patternProfiles: BallRecognitionPatternProfile[],
  maxProfiles = MAX_EFFECTIVE_BALL_PATTERN_PROFILES
) {
  const expandedProfiles: BallRecognitionPatternProfile[] = [];
  const seenPatternProfiles = new Set<string>();

  const pushUniquePatternProfile = (patternProfile: BallRecognitionPatternProfile) => {
    const key = buildPatternProfileKey(patternProfile);
    if (seenPatternProfiles.has(key)) {
      return;
    }

    seenPatternProfiles.add(key);
    expandedProfiles.push(patternProfile);
  };

  for (const patternProfile of patternProfiles) {
    pushUniquePatternProfile(patternProfile);
    pushUniquePatternProfile(rotateBallPatternProfileQuarterTurn(patternProfile));

    if (expandedProfiles.length >= maxProfiles) {
      break;
    }
  }

  return expandedProfiles.slice(0, maxProfiles);
}

const MOLTEN_REFERENCE_PATTERN_PROFILES: BallRecognitionProfile['patternProfiles'] = [
  {
    panelLineRatioRange: { min: 0.145356, max: 0.165356 },
    edgeDensityRange: { min: 0.149973, max: 0.209973 },
    rowCoverageRange: { min: 0.92, max: 1 },
    columnCoverageRange: { min: 0.546207, max: 0.626207 },
    weight: 0.92,
  },
  {
    panelLineRatioRange: { min: 0.104463, max: 0.98 },
    edgeDensityRange: { min: 0.15013, max: 0.21013 },
    rowCoverageRange: { min: 0.880455, max: 0.960455 },
    columnCoverageRange: { min: 0.869091, max: 0.949091 },
    weight: 0.92,
  },
];

const MOLTEN_REFERENCE_BANDS: BallRecognitionBand[] = [
  {
    color: 'red',
    hueRanges: [
      { min: 0, max: 6 },
      { min: 356, max: 360 },
    ],
    saturationRange: { min: 0.528, max: 0.786207 },
    valueRange: { min: 0.439216, max: 0.72549 },
    weight: 0.696678,
  },
  {
    color: 'white',
    hueRanges: [{ min: 0, max: 360 }],
    saturationRange: { min: 0.023529, max: 0.083682 },
    valueRange: { min: 0.780392, max: 0.976471 },
    weight: 0.255777,
  },
  {
    color: 'black',
    hueRanges: [{ min: 0, max: 360 }],
    saturationRange: { min: 0.179487, max: 0.58641 },
    valueRange: { min: 0.113725, max: 0.172549 },
    weight: 0.047545,
  },
];

export const BALL_BRAND_REFERENCE_PROFILES: Partial<Record<BallBrandOption, BallRecognitionProfile>> = {
  molten: {
    learnedColors: ['red', 'white', 'black'],
    bands: MOLTEN_REFERENCE_BANDS,
    patternProfiles: MOLTEN_REFERENCE_PATTERN_PROFILES,
    trainedAt: '2026-08-07T00:00:00.000Z',
  },
};

export function getEffectiveBallRecognitionProfile(
  selectedBallBrand: BallBrandOption,
  ballRecognitionProfile: BallRecognitionProfile | null
) {
  const referenceProfile = BALL_BRAND_REFERENCE_PROFILES[selectedBallBrand] ?? null;
  const buildExpandedProfile = (profile: BallRecognitionProfile) => ({
    ...profile,
    patternProfiles: expandBallRecognitionPatternProfiles(profile.patternProfiles),
  });

  if (!referenceProfile) {
    return ballRecognitionProfile ? buildExpandedProfile(ballRecognitionProfile) : null;
  }

  if (!ballRecognitionProfile) {
    return buildExpandedProfile(referenceProfile);
  }

  const mergedBandByColor = new Map(referenceProfile.bands.map((band) => [band.color, band]));

  for (const band of ballRecognitionProfile.bands) {
    mergedBandByColor.set(band.color, band);
  }

  const mergedPatternProfiles = expandBallRecognitionPatternProfiles([
    ...ballRecognitionProfile.patternProfiles,
    ...referenceProfile.patternProfiles,
  ]);

  return {
    learnedColors: Array.from(new Set([...ballRecognitionProfile.learnedColors, ...referenceProfile.learnedColors])),
    bands: Array.from(mergedBandByColor.values()),
    patternProfiles: mergedPatternProfiles,
    trainedAt: ballRecognitionProfile.trainedAt,
  } satisfies BallRecognitionProfile;
}
