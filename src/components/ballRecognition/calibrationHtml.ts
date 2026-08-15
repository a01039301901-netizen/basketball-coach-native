export function buildBallRecognitionCalibrationHtml(
  samples: Array<{
    id: string;
    dataUrl: string;
  }>
) {
  return `<!DOCTYPE html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      html,
      body {
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
        background: transparent;
        overflow: hidden;
      }
    </style>
  </head>
  <body>
    <script>
      const samples = ${JSON.stringify(samples)};
      const MAX_SIZE = 160;
      const CENTER_CROP_RATIO = 0.6;
      const ACHROMATIC_COLORS = new Set(["white", "black", "gray"]);
      const MIN_PATTERN_SAMPLE_PIXELS = 180;
      const MIN_PATTERN_GRADIENT_PIXELS = 80;
      const MIN_PANEL_LINE_RATIO = 0.006;
      const PATTERN_ORIENTATION_DELTA = 0.12;

      function post(payload) {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify(payload));
        }

        if (window.parent && window.parent !== window) {
          window.parent.postMessage(payload, "*");
        }
      }

      function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
      }

      function rgbToHsv(r, g, b) {
        const red = r / 255;
        const green = g / 255;
        const blue = b / 255;
        const max = Math.max(red, green, blue);
        const min = Math.min(red, green, blue);
        const delta = max - min;

        let hue = 0;
        if (delta !== 0) {
          if (max === red) {
            hue = ((green - blue) / delta) % 6;
          } else if (max === green) {
            hue = (blue - red) / delta + 2;
          } else {
            hue = (red - green) / delta + 4;
          }
        }

        hue = Math.round(hue * 60);
        if (hue < 0) {
          hue += 360;
        }

        return {
          h: hue,
          s: max === 0 ? 0 : delta / max,
          v: max,
        };
      }

      function percentile(values, ratio) {
        if (!values.length) {
          return 0;
        }

        const sorted = [...values].sort((left, right) => left - right);
        const rawIndex = (sorted.length - 1) * ratio;
        const lowerIndex = Math.floor(rawIndex);
        const upperIndex = Math.ceil(rawIndex);
        const lowerValue = sorted[lowerIndex];
        const upperValue = sorted[upperIndex] ?? lowerValue;

        if (lowerIndex === upperIndex) {
          return lowerValue;
        }

        return lowerValue + (upperValue - lowerValue) * (rawIndex - lowerIndex);
      }

      function buildMetricRange(values, { padding = 0.02, minWidth = 0.04, min = 0, max = 1 } = {}) {
        if (!values.length) {
          return { min, max };
        }

        let nextMin = clamp(percentile(values, 0.1) - padding, min, max);
        let nextMax = clamp(percentile(values, 0.9) + padding, min, max);

        if (nextMax - nextMin < minWidth) {
          const midpoint = (nextMin + nextMax) / 2;
          const halfWidth = minWidth / 2;
          nextMin = clamp(midpoint - halfWidth, min, max);
          nextMax = clamp(midpoint + halfWidth, min, max);

          if (nextMax - nextMin < minWidth) {
            if (nextMin === min) {
              nextMax = clamp(min + minWidth, min, max);
            } else {
              nextMin = clamp(max - minWidth, min, max);
            }
          }
        }

        return {
          min: Math.min(nextMin, nextMax),
          max: Math.max(nextMin, nextMax),
        };
      }

      function circularHueDistance(left, right) {
        const delta = Math.abs(left - right);
        return Math.min(delta, 360 - delta) / 180;
      }

      function computeLuminance(r, g, b) {
        return (r * 0.299 + g * 0.587 + b * 0.114) / 255;
      }

      function countNonZero(values) {
        let count = 0;

        for (let index = 0; index < values.length; index += 1) {
          if (values[index] > 0) {
            count += 1;
          }
        }

        return count;
      }

      function extractPatternMetrics(data, width, height) {
        if (width < 12 || height < 12) {
          return null;
        }

        const centerX = width / 2;
        const centerY = height / 2;
        const radius = Math.min(width, height) * 0.46;
        const radiusSquared = radius * radius;
        const luminanceMap = new Float32Array(width * height);

        for (let index = 0; index < width * height; index += 1) {
          const offset = index * 4;
          luminanceMap[index] = computeLuminance(data[offset], data[offset + 1], data[offset + 2]);
        }

        const maskedIndices = [];
        const maskedLuminances = [];
        const activeRows = new Uint8Array(height);
        const activeColumns = new Uint8Array(width);

        for (let y = 0; y < height; y += 1) {
          for (let x = 0; x < width; x += 1) {
            const index = y * width + x;
            const alpha = data[index * 4 + 3];
            if (alpha < 140) {
              continue;
            }

            const dx = x + 0.5 - centerX;
            const dy = y + 0.5 - centerY;
            if (dx * dx + dy * dy > radiusSquared) {
              continue;
            }

            maskedIndices.push(index);
            maskedLuminances.push(luminanceMap[index]);
            activeRows[y] = 1;
            activeColumns[x] = 1;
          }
        }

        if (maskedIndices.length < MIN_PATTERN_SAMPLE_PIXELS) {
          return null;
        }

        const gradientMap = new Float32Array(width * height);
        const maskedGradients = [];

        for (const index of maskedIndices) {
          const x = index % width;
          const y = Math.floor(index / width);
          if (x <= 0 || x >= width - 1 || y <= 0 || y >= height - 1) {
            continue;
          }

          const gradient = clamp(
            Math.abs(luminanceMap[index + 1] - luminanceMap[index - 1]) +
              Math.abs(luminanceMap[index + width] - luminanceMap[index - width]),
            0,
            1
          );
          gradientMap[index] = gradient;
          maskedGradients.push(gradient);
        }

        if (maskedGradients.length < MIN_PATTERN_GRADIENT_PIXELS) {
          return null;
        }

        const edgeThreshold = Math.max(0.06, percentile(maskedGradients, 0.82));
        const darkThreshold = Math.min(0.62, percentile(maskedLuminances, 0.38) + 0.06);
        const seamRows = new Uint8Array(height);
        const seamColumns = new Uint8Array(width);
        let seamCount = 0;
        let edgeCount = 0;

        for (const index of maskedIndices) {
          const x = index % width;
          const y = Math.floor(index / width);
          const gradient = gradientMap[index];
          if (gradient >= edgeThreshold) {
            edgeCount += 1;
          }

          if (gradient >= edgeThreshold && luminanceMap[index] <= darkThreshold) {
            seamCount += 1;
            seamRows[y] = 1;
            seamColumns[x] = 1;
          }
        }

        if (seamCount < Math.max(4, Math.round(maskedIndices.length * MIN_PANEL_LINE_RATIO))) {
          return null;
        }

        const activeRowCount = countNonZero(activeRows);
        const activeColumnCount = countNonZero(activeColumns);

        return {
          panelLineRatio: seamCount / maskedIndices.length,
          edgeDensity: edgeCount / maskedIndices.length,
          rowCoverage: activeRowCount > 0 ? countNonZero(seamRows) / activeRowCount : 0,
          columnCoverage: activeColumnCount > 0 ? countNonZero(seamColumns) / activeColumnCount : 0,
        };
      }

      function buildHueRanges(values) {
        if (!values.length) {
          return [{ min: 0, max: 360 }];
        }

        const sorted = [...values].sort((left, right) => left - right);
        const spread = sorted[sorted.length - 1] - sorted[0];
        const shifted = spread > 180 ? sorted.map((value) => (value < 180 ? value + 360 : value)) : sorted;
        const minHue = percentile(shifted, 0.1);
        const maxHue = percentile(shifted, 0.9);
        const normalizeHue = (value) => {
          let nextValue = value % 360;
          if (nextValue < 0) {
            nextValue += 360;
          }

          return nextValue;
        };

        if (maxHue <= 360) {
          return [{ min: normalizeHue(minHue), max: normalizeHue(maxHue) }];
        }

        return [
          { min: 0, max: normalizeHue(maxHue) },
          { min: normalizeHue(minHue), max: 360 },
        ];
      }

      function getClosestBallColor(h, s, v) {
        if (v <= 0.18) {
          return "black";
        }

        if (s <= 0.18) {
          if (v >= 0.76) {
            return "white";
          }

          if (v > 0.18 && v < 0.76) {
            return "gray";
          }
        }

        if (s < 0.22) {
          return null;
        }

        const candidates = [
          { key: "red", h: 0, s: 0.78, v: 0.78 },
          { key: "orange", h: 25, s: 0.78, v: 0.86 },
          { key: "brown", h: 23, s: 0.52, v: 0.42 },
          { key: "yellow", h: 54, s: 0.82, v: 0.94 },
        ];
        let bestKey = null;
        let bestScore = Infinity;

        for (const candidate of candidates) {
          let score =
            circularHueDistance(h, candidate.h) * 1.9 +
            Math.abs(s - candidate.s) * 0.75 +
            Math.abs(v - candidate.v) * 0.5;

          if (candidate.key === "red" && !(h <= 28 || h >= 320)) {
            score += 0.45;
          }

          if (candidate.key === "yellow" && (h < 32 || h > 78)) {
            score += 0.35;
          }

          if ((candidate.key === "orange" || candidate.key === "brown") && (h < 5 || h > 55)) {
            score += 0.4;
          }

          if (candidate.key === "brown" && v > 0.78) {
            score += 0.24;
          }

          if (candidate.key === "orange" && v < 0.22) {
            score += 0.24;
          }

          if (score < bestScore) {
            bestScore = score;
            bestKey = candidate.key;
          }
        }

        return bestScore <= 0.9 ? bestKey : null;
      }

      function createEmptyBucket() {
        return {
          count: 0,
          hues: [],
          saturations: [],
          values: [],
        };
      }

      function createEmptyPatternBuckets() {
        return {
          vertical: [],
          horizontal: [],
          mixed: [],
        };
      }

      function classifyPatternOrientation(patternMetrics) {
        if (!patternMetrics) {
          return null;
        }

        const coverageDelta = patternMetrics.columnCoverage - patternMetrics.rowCoverage;

        if (coverageDelta >= PATTERN_ORIENTATION_DELTA) {
          return "vertical";
        }

        if (coverageDelta <= -PATTERN_ORIENTATION_DELTA) {
          return "horizontal";
        }

        return "mixed";
      }

      function buildPatternProfileFromSamples(patternSamples, orientation) {
        if (!patternSamples.length) {
          return null;
        }

        const panelLineRatios = patternSamples.map((sample) => sample.panelLineRatio);
        const edgeDensities = patternSamples.map((sample) => sample.edgeDensity);
        const rowCoverageValues = patternSamples.map((sample) => sample.rowCoverage);
        const columnCoverageValues = patternSamples.map((sample) => sample.columnCoverage);

        return {
          panelLineRatioRange: buildMetricRange(panelLineRatios, { padding: 0.01, minWidth: 0.02 }),
          edgeDensityRange: buildMetricRange(edgeDensities, { padding: 0.03, minWidth: 0.06 }),
          rowCoverageRange: buildMetricRange(rowCoverageValues, { padding: 0.04, minWidth: 0.08 }),
          columnCoverageRange: buildMetricRange(columnCoverageValues, { padding: 0.04, minWidth: 0.08 }),
          weight: clamp(0.58 + patternSamples.length * 0.08 + percentile(panelLineRatios, 0.5) * 6, 0.58, 0.92),
          orientation,
        };
      }

      function pushPatternMetrics(data, width, height, patternBuckets) {
        const patternMetrics = extractPatternMetrics(data, width, height);
        if (!patternMetrics) {
          return;
        }

        const orientation = classifyPatternOrientation(patternMetrics);
        if (orientation) {
          patternBuckets[orientation].push(patternMetrics);
        }
      }

      function rotateImageDataQuarterTurn(data, width, height) {
        const rotatedWidth = height;
        const rotatedHeight = width;
        const rotatedData = new Uint8ClampedArray(data.length);

        for (let y = 0; y < height; y += 1) {
          for (let x = 0; x < width; x += 1) {
            const sourceIndex = (y * width + x) * 4;
            const rotatedX = height - 1 - y;
            const rotatedY = x;
            const targetIndex = (rotatedY * rotatedWidth + rotatedX) * 4;

            rotatedData[targetIndex] = data[sourceIndex];
            rotatedData[targetIndex + 1] = data[sourceIndex + 1];
            rotatedData[targetIndex + 2] = data[sourceIndex + 2];
            rotatedData[targetIndex + 3] = data[sourceIndex + 3];
          }
        }

        return {
          data: rotatedData,
          width: rotatedWidth,
          height: rotatedHeight,
        };
      }

      async function loadImage(dataUrl) {
        return new Promise((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve(image);
          image.onerror = () => reject(new Error("image_load_failed"));
          image.src = dataUrl;
        });
      }

      async function processSample(sample, buckets, patternBuckets) {
        const image = await loadImage(sample.dataUrl);
        const scale = Math.min(MAX_SIZE / image.naturalWidth, MAX_SIZE / image.naturalHeight, 1);
        const width = Math.max(1, Math.round(image.naturalWidth * scale));
        const height = Math.max(1, Math.round(image.naturalHeight * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) {
          throw new Error("canvas_context_unavailable");
        }

        context.drawImage(image, 0, 0, width, height);

        const cropWidth = Math.max(1, Math.round(width * CENTER_CROP_RATIO));
        const cropHeight = Math.max(1, Math.round(height * CENTER_CROP_RATIO));
        const cropX = Math.max(0, Math.floor((width - cropWidth) / 2));
        const cropY = Math.max(0, Math.floor((height - cropHeight) / 2));
        const { data } = context.getImageData(cropX, cropY, cropWidth, cropHeight);
        pushPatternMetrics(data, cropWidth, cropHeight, patternBuckets);
        const quarterTurnImage = rotateImageDataQuarterTurn(data, cropWidth, cropHeight);
        pushPatternMetrics(quarterTurnImage.data, quarterTurnImage.width, quarterTurnImage.height, patternBuckets);

        for (let index = 0; index < data.length; index += 4) {
          if (data[index + 3] < 140) {
            continue;
          }

          const hsv = rgbToHsv(data[index], data[index + 1], data[index + 2]);
          const colorKey = getClosestBallColor(hsv.h, hsv.s, hsv.v);

          if (!colorKey) {
            continue;
          }

          buckets[colorKey].count += 1;
          buckets[colorKey].hues.push(hsv.h);
          buckets[colorKey].saturations.push(hsv.s);
          buckets[colorKey].values.push(hsv.v);
        }
      }

      async function start() {
        try {
          const buckets = {
            orange: createEmptyBucket(),
            brown: createEmptyBucket(),
            yellow: createEmptyBucket(),
            white: createEmptyBucket(),
            black: createEmptyBucket(),
            gray: createEmptyBucket(),
            red: createEmptyBucket(),
          };
          const patternBuckets = createEmptyPatternBuckets();

          for (const sample of samples) {
            await processSample(sample, buckets, patternBuckets);
          }

          const rankedEntries = Object.entries(buckets)
            .filter(([, bucket]) => bucket.count >= 24)
            .sort((left, right) => right[1].count - left[1].count)
            .slice(0, 3);
          const totalCount = rankedEntries.reduce((sum, [, bucket]) => sum + bucket.count, 0);

          if (rankedEntries.length === 0 || totalCount === 0) {
            post({ type: "complete", profile: null });
            return;
          }

          const bands = rankedEntries.map(([color, bucket]) => ({
            color,
            hueRanges: ACHROMATIC_COLORS.has(color) ? [{ min: 0, max: 360 }] : buildHueRanges(bucket.hues),
            saturationRange: {
              min: clamp(percentile(bucket.saturations, 0.1), 0, 1),
              max: clamp(percentile(bucket.saturations, 0.9), 0, 1),
            },
            valueRange: {
              min: clamp(percentile(bucket.values, 0.1), 0, 1),
              max: clamp(percentile(bucket.values, 0.9), 0, 1),
            },
            weight: clamp(bucket.count / totalCount, 0, 1),
          }));
          const patternProfiles = ["vertical", "horizontal", "mixed"]
            .map((orientation) => buildPatternProfileFromSamples(patternBuckets[orientation], orientation))
            .filter(Boolean);

          post({
            type: "complete",
            profile: {
              learnedColors: rankedEntries.map(([color]) => color),
              bands,
              patternProfiles,
              trainedAt: new Date().toISOString(),
            },
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "ball_calibration_failed";
          post({ type: "error", message });
        }
      }

      start();
    </script>
  </body>
</html>`;
}
