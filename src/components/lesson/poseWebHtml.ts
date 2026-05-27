export const POSE_WEB_BOOTSTRAP_URL = 'https://example.com/';

export function buildPoseWebHtml(
  lessonMode: 'dribble' | 'shoot' = 'dribble',
  selectedBallBrand: 'wilson' | 'spalding' | 'molten' = 'wilson',
  selectedBallColors: string[] = ['orange']
): string {
  return `<!DOCTYPE html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <style>
      html, body {
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
        background: #0f0f0f;
        overflow: hidden;
        font-family: Arial, sans-serif;
      }

      .wrap {
        position: relative;
        width: 100%;
        height: 100%;
        background: #0f0f0f;
      }

      video,
      canvas {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      video {
        transform: scaleX(-1);
        opacity: 0;
      }

      .hud {
        position: absolute;
        left: 12px;
        right: 12px;
        bottom: 12px;
        z-index: 5;
        color: #ffffff;
        background: rgba(0, 0, 0, 0.5);
        border-radius: 14px;
        padding: 10px 12px;
        font-size: 13px;
        line-height: 1.45;
      }
    </style>
  </head>
  <body>
    <div class="wrap">
      <video id="video" autoplay playsinline muted webkit-playsinline></video>
      <canvas id="canvas"></canvas>
      <div class="hud" id="hud">MediaPipe? 怨??몄떇??以鍮꾪븯??以묒엯?덈떎.</div>
    </div>

    <script type="module">
      const lessonMode = ${JSON.stringify(lessonMode)};
      const selectedBallBrand = ${JSON.stringify(selectedBallBrand)};
      const selectedBallColors = ${JSON.stringify(selectedBallColors)};
      const video = document.getElementById("video");
      const canvas = document.getElementById("canvas");
      const hud = document.getElementById("hud");
      const ctx = canvas.getContext("2d");
      const processingCanvas = document.createElement("canvas");
      const processingContext = processingCanvas.getContext("2d", { willReadFrequently: true });

      const INDEX = {
        nose: 0,
        leftEye: 2,
        rightEye: 5,
        leftEar: 7,
        rightEar: 8,
        leftShoulder: 11,
        rightShoulder: 12,
        leftElbow: 13,
        rightElbow: 14,
        leftWrist: 15,
        rightWrist: 16,
        leftHip: 23,
        rightHip: 24,
        leftKnee: 25,
        rightKnee: 26,
        leftAnkle: 27,
        rightAnkle: 28
      };

      const LABELS = {
        head: "癒몃━",
        neck: "紐?,
        shoulder: "?닿묠",
        elbow: "?붽퓞移?,
        hand: "??,
        hip: "?됰뜦??,
        knee: "臾대쫷",
        foot: "諛?
      };

      let poseLandmarker = null;
      let recorder = null;
      let composedStream = null;
      let recorderChunks = [];
      let recorderStopping = false;
      let lastVideoTime = -1;
      let lastPointSummary = "";
      let lastDribbleSummary = "";
      let lastShootSummary = "";
      let lastSentAt = 0;
      let previousHipY = null;
      let dribbleCount = 0;
      let leftHandDribbleCount = 0;
      let rightHandDribbleCount = 0;
      let wasBallNearFoot = false;
      let highestBounceY = null;
      let lowestBounceY = null;
      let lastBounceHand = "unknown";

      function post(payload) {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify(payload));
        }

        if (window.parent && window.parent !== window) {
          window.parent.postMessage(payload, "*");
        }
      }

      function resetDribbleTracking() {
        dribbleCount = 0;
        leftHandDribbleCount = 0;
        rightHandDribbleCount = 0;
        wasBallNearFoot = false;
        highestBounceY = null;
        lowestBounceY = null;
        lastBounceHand = "unknown";
      }

      function finalizeRecording() {
        if (recorderChunks.length === 0) {
          post({ type: "recording_error", message: "??ν븷 ?곸긽 ?곗씠?곌? ?놁뒿?덈떎." });
          return;
        }

        const blob = new Blob(recorderChunks, {
          type: recorder?.mimeType || "video/webm"
        });
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = typeof reader.result === "string" ? reader.result : "";
          if (!result) {
            post({ type: "recording_error", message: "?곸긽 ?몄퐫?⑹뿉 ?ㅽ뙣?덉뒿?덈떎." });
            return;
          }

          post({ type: "recording_ready", videoUri: result });
        };
        reader.onerror = () => {
          post({ type: "recording_error", message: "?곸긽 ?뚯씪???쎈뒗 以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎." });
        };
        reader.readAsDataURL(blob);
      }

      function startRecorder() {
        if (!composedStream || typeof MediaRecorder === "undefined") {
          return;
        }

        const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")
          ? "video/webm;codecs=vp8,opus"
          : MediaRecorder.isTypeSupported("video/webm")
            ? "video/webm"
            : "";

        recorder = mimeType ? new MediaRecorder(composedStream, { mimeType }) : new MediaRecorder(composedStream);
        recorderChunks = [];
        recorderStopping = false;
        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            recorderChunks.push(event.data);
          }
        };
        recorder.onstop = () => {
          if (recorderStopping) {
            finalizeRecording();
          }
        };
        recorder.onerror = () => {
          post({ type: "recording_error", message: "??됰뮣 ?怨멸맒 ?諭곸넅 餓???살첒揶쎛 獄쏆뮇源??됰뮸??덈뼄." });
        };
        resetDribbleTracking();
        recorder.start(1000);
        post({ type: "recording_started" });
      }

      function restartRecordingFromCue() {
        if (!composedStream || typeof MediaRecorder === "undefined") {
          return;
        }

        if (recorder && recorder.state !== "inactive") {
          recorder.onstop = () => {
            recorderChunks = [];
            recorderStopping = false;
            startRecorder();
          };
          recorderStopping = false;
          recorder.stop();
          return;
        }

        startRecorder();
      }

      function stopRecordingForReview() {
        if (!recorder || recorder.state === "inactive") {
          return;
        }

        recorderStopping = true;
        recorder.stop();
      }

      window.__codexRestartRecordingFromCue = restartRecordingFromCue;
      window.__codexStopRecordingForReview = stopRecordingForReview;

      function setHud(text) {
        hud.textContent = text;
      }

      function resizeCanvas() {
        const width = video.videoWidth || window.innerWidth;
        const height = video.videoHeight || window.innerHeight;
        canvas.width = width;
        canvas.height = height;
      }

      function projectX(x) {
        return (1 - x) * canvas.width;
      }

      function projectY(y) {
        return y * canvas.height;
      }

      function visible(point) {
        return Boolean(point && (point.visibility ?? 1) > 0.4);
      }

      function midpoint(a, b) {
        return {
          x: (a.x + b.x) / 2,
          y: (a.y + b.y) / 2,
          visibility: Math.min(a.visibility ?? 1, b.visibility ?? 1)
        };
      }

      function distanceBetween(a, b) {
        return Math.hypot(a.x - b.x, a.y - b.y);
      }

      function angleAt(a, b, c) {
        if (!visible(a) || !visible(b) || !visible(c)) {
          return null;
        }

        const abx = a.x - b.x;
        const aby = a.y - b.y;
        const cbx = c.x - b.x;
        const cby = c.y - b.y;
        const dot = abx * cbx + aby * cby;
        const magAB = Math.hypot(abx, aby);
        const magCB = Math.hypot(cbx, cby);

        if (magAB === 0 || magCB === 0) {
          return null;
        }

        const cosine = Math.min(1, Math.max(-1, dot / (magAB * magCB)));
        return Math.acos(cosine) * 180 / Math.PI;
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

        const saturation = max === 0 ? 0 : delta / max;
        const value = max;

        return { h: hue, s: saturation, v: value };
      }

      function classifyBallPixel(r, g, b) {
        const { h, s, v } = rgbToHsv(r, g, b);

        const allowOrange = selectedBallColors.includes("orange");
        const allowBrown = selectedBallColors.includes("brown");
        const allowYellow = selectedBallColors.includes("yellow");
        const allowWhite = selectedBallColors.includes("white");
        const allowBlack = selectedBallColors.includes("black");
        const allowGray = selectedBallColors.includes("gray");
        const allowRed = selectedBallColors.includes("red");

        const isOrange = allowOrange && h >= 10 && h <= 42 && s >= 0.45 && v >= 0.25 && r > g && g > b * 0.8;
        if (isOrange) {
          return 1;
        }

        const isBrown = allowBrown && h >= 12 && h <= 34 && s >= 0.3 && v >= 0.18 && v <= 0.75 && r > g * 1.05 && g > b * 1.05;
        if (isBrown) {
          return 1;
        }

        const isYellow = allowYellow && h >= 40 && h <= 65 && s >= 0.35 && v >= 0.35;
        if (isYellow) {
          return 1;
        }

        const isWhite = allowWhite && s <= 0.18 && v >= 0.72;
        if (isWhite) {
          return 1;
        }

        const isBlack = allowBlack && v <= 0.18;
        if (isBlack) {
          return 1;
        }

        const isGray = allowGray && s <= 0.2 && v > 0.18 && v < 0.72;
        if (isGray) {
          return 1;
        }

        const isRed = allowRed && (h <= 12 || h >= 345) && s >= 0.45 && v >= 0.22 && r > g * 1.1 && r > b * 1.1;
        if (isRed) {
          return 2;
        }

        return 0;
      }

      function getBallDetectionProfile() {
        if (selectedBallBrand === "molten") {
          return {
            mergeColors: true,
            dilationRadius: 1,
            minPixels: 24,
            minFillRatio: 0.28,
            minCircleCoverage: 0.18,
            maxCircleCoverage: 1.38
          };
        }

        if (selectedBallBrand === "wilson") {
          return {
            mergeColors: true,
            dilationRadius: 1,
            minPixels: 28,
            minFillRatio: 0.3,
            minCircleCoverage: 0.2,
            maxCircleCoverage: 1.34
          };
        }

        return {
          mergeColors: true,
          dilationRadius: 1,
          minPixels: 26,
          minFillRatio: 0.3,
          minCircleCoverage: 0.2,
          maxCircleCoverage: 1.34
        };
      }

      function detectBall() {
        if (!processingContext) {
          return null;
        }

        const profile = getBallDetectionProfile();
        const width = 192;
        const height = 144;
        processingCanvas.width = width;
        processingCanvas.height = height;
        processingContext.drawImage(video, 0, 0, width, height);

        const { data } = processingContext.getImageData(0, 0, width, height);
        const visited = new Uint8Array(width * height);
        const colorMap = new Uint8Array(width * height);
        const mergedMap = new Uint8Array(width * height);

        for (let index = 0; index < width * height; index += 1) {
          const offset = index * 4;
          colorMap[index] = classifyBallPixel(data[offset], data[offset + 1], data[offset + 2]);
        }

        if (profile.mergeColors) {
          for (let index = 0; index < colorMap.length; index += 1) {
            if (colorMap[index] === 0) {
              continue;
            }

            const x = index % width;
            const y = Math.floor(index / width);

            for (let offsetY = -profile.dilationRadius; offsetY <= profile.dilationRadius; offsetY += 1) {
              for (let offsetX = -profile.dilationRadius; offsetX <= profile.dilationRadius; offsetX += 1) {
                const nextX = x + offsetX;
                const nextY = y + offsetY;
                if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height) {
                  continue;
                }

                mergedMap[nextY * width + nextX] = 1;
              }
            }
          }
        }

        let best = null;
        const sourceMap = profile.mergeColors ? mergedMap : colorMap;

        for (let index = 0; index < sourceMap.length; index += 1) {
          if (visited[index] || sourceMap[index] === 0) {
            continue;
          }

          const queue = [index];
          visited[index] = 1;
          const colorValue = colorMap[index];
          let head = 0;
          let mergedCount = 0;
          let count = 0;
          let sumX = 0;
          let sumY = 0;
          let minX = width;
          let minY = height;
          let maxX = 0;
          let maxY = 0;
          let orangeCount = 0;
          let redCount = 0;

          while (head < queue.length) {
            const current = queue[head];
            head += 1;

            const x = current % width;
            const y = Math.floor(current / width);

            mergedCount += 1;
            sumX += x;
            sumY += y;
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);

            const currentColorValue = colorMap[current];
            if (currentColorValue !== 0) {
              count += 1;
              if (currentColorValue === 1) {
                orangeCount += 1;
              } else {
                redCount += 1;
              }
            }

            const neighbors = profile.mergeColors
              ? [current - 1, current + 1, current - width, current + width, current - width - 1, current - width + 1, current + width - 1, current + width + 1]
              : [current - 1, current + 1, current - width, current + width];

            for (const neighbor of neighbors) {
              if (neighbor < 0 || neighbor >= sourceMap.length || visited[neighbor]) {
                continue;
              }

              if (profile.mergeColors) {
                if (sourceMap[neighbor] === 0) {
                  continue;
                }
              } else if (colorMap[neighbor] !== colorValue) {
                continue;
              }

              const currentX = current % width;
              const neighborX = neighbor % width;
              if (Math.abs(currentX - neighborX) > 1) {
                continue;
              }

              visited[neighbor] = 1;
              queue.push(neighbor);
            }
          }

          if (count < profile.minPixels) {
            continue;
          }

          const blobWidth = maxX - minX + 1;
          const blobHeight = maxY - minY + 1;
          const aspectRatio = blobWidth / blobHeight;
          if (aspectRatio < 0.55 || aspectRatio > 1.45) {
            continue;
          }

          const boundingArea = blobWidth * blobHeight;
          const fillRatio = (profile.mergeColors ? mergedCount : count) / boundingArea;
          if (fillRatio < profile.minFillRatio) {
            continue;
          }

          const radiusPx = Math.max(blobWidth, blobHeight) / 2;
          const estimatedCircleArea = Math.PI * radiusPx * radiusPx;
          const circleCoverage = (profile.mergeColors ? mergedCount : count) / estimatedCircleArea;
          if (circleCoverage < profile.minCircleCoverage || circleCoverage > profile.maxCircleCoverage) {
            continue;
          }

          const candidate = {
            x: sumX / mergedCount / width,
            y: sumY / mergedCount / height,
            radius: Math.max(blobWidth, blobHeight) / Math.max(width, height) / 2,
            pixelCount: count,
            color: redCount > orangeCount ? "red" : colorValue === 2 ? "red" : "orange"
          };

          if (!best || candidate.pixelCount > best.pixelCount) {
            best = candidate;
          }
        }

        return best;
      }

      function drawPoint(point, label, color) {
        const x = projectX(point.x);
        const y = projectY(point.y);
        ctx.beginPath();
        ctx.arc(x, y, 7, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.font = "bold 16px Arial";
        ctx.lineWidth = 4;
        ctx.strokeStyle = "rgba(0,0,0,0.75)";
        ctx.strokeText(label, x + 10, y - 10);
        ctx.fillStyle = "#ffffff";
        ctx.fillText(label, x + 10, y - 10);
      }

      function drawSegment(a, b, color) {
        if (!visible(a) || !visible(b)) {
          return;
        }

        ctx.beginPath();
        ctx.moveTo(projectX(a.x), projectY(a.y));
        ctx.lineTo(projectX(b.x), projectY(b.y));
        ctx.strokeStyle = color;
        ctx.lineWidth = 4;
        ctx.stroke();
      }

      function drawBall(ball) {
        const centerX = projectX(ball.x);
        const centerY = projectY(ball.y);
        const radius = ball.radius * Math.max(canvas.width, canvas.height);
        const stroke = ball.color === "orange" ? "#ff9f1c" : "#ff4d5a";

        ctx.beginPath();
        ctx.arc(centerX, centerY, Math.max(radius, 16), 0, Math.PI * 2);
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 4;
        ctx.stroke();

        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(centerX - 44, centerY - Math.max(radius, 16) - 32, 88, 22);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 13px Arial";
        ctx.textAlign = "center";
        ctx.fillText(ball.color === "orange" ? "二쇳솴 怨? : "鍮④컙 怨?, centerX, centerY - Math.max(radius, 16) - 16);
        ctx.textAlign = "left";
      }

      function classifyEyeFocus(landmarks, neck) {
        const nose = landmarks[INDEX.nose];
        const leftEar = landmarks[INDEX.leftEar];
        const rightEar = landmarks[INDEX.rightEar];
        const leftEye = landmarks[INDEX.leftEye];
        const rightEye = landmarks[INDEX.rightEye];

        if (!visible(nose) || !neck) {
          return "unknown";
        }

        const headBase =
          visible(leftEar) && visible(rightEar)
            ? midpoint(leftEar, rightEar)
            : visible(leftEye) && visible(rightEye)
              ? midpoint(leftEye, rightEye)
              : null;

        if (!headBase) {
          return "unknown";
        }

        const noseDrop = nose.y - headBase.y;
        const neckGap = neck.y - nose.y;
        return noseDrop > 0.055 || neckGap < 0.11 ? "ball" : "forward";
      }

      function classifyDribbleHeight(landmarks, neck, hipMid) {
        const wrists = [landmarks[INDEX.leftWrist], landmarks[INDEX.rightWrist]].filter(visible);

        if (!neck || !hipMid || wrists.length === 0) {
          return "unknown";
        }

        const dribbleHand = wrists.reduce((lowest, current) => current.y > lowest.y ? current : lowest);
        const neckDistance = Math.abs(dribbleHand.y - neck.y);
        const hipDistance = Math.abs(dribbleHand.y - hipMid.y);

        if (neckDistance + 0.015 < hipDistance) {
          return "high";
        }

        if (hipDistance + 0.015 < neckDistance) {
          return "low";
        }

        return "balanced";
      }

      function didDribbleStart(landmarks, ball) {
        if (!ball) {
          return false;
        }

        const ballPoint = { x: ball.x, y: ball.y, visibility: 1 };
        const lowerBodyPoints = [
          landmarks[INDEX.leftKnee],
          landmarks[INDEX.rightKnee],
          landmarks[INDEX.leftAnkle],
          landmarks[INDEX.rightAnkle]
        ].filter(visible);

        if (lowerBodyPoints.length === 0) {
          return false;
        }

        return lowerBodyPoints.some((point) => distanceBetween(point, ballPoint) <= 0.12);
      }

      function getShootingSide(landmarks) {
        const leftArmAngle = angleAt(landmarks[INDEX.leftShoulder], landmarks[INDEX.leftElbow], landmarks[INDEX.leftWrist]);
        const rightArmAngle = angleAt(landmarks[INDEX.rightShoulder], landmarks[INDEX.rightElbow], landmarks[INDEX.rightWrist]);

        if (leftArmAngle !== null && rightArmAngle !== null) {
          return (landmarks[INDEX.leftWrist]?.y ?? 1) < (landmarks[INDEX.rightWrist]?.y ?? 1) ? "left" : "right";
        }

        if (leftArmAngle !== null) {
          return "left";
        }

        if (rightArmAngle !== null) {
          return "right";
        }

        return null;
      }

      function classifyBodyFacing(landmarks) {
        const leftShoulder = landmarks[INDEX.leftShoulder];
        const rightShoulder = landmarks[INDEX.rightShoulder];
        const nose = landmarks[INDEX.nose];

        if (!visible(leftShoulder) || !visible(rightShoulder) || !visible(nose)) {
          return "unknown";
        }

        const shoulderMid = midpoint(leftShoulder, rightShoulder);
        const shoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x);
        const noseOffset = Math.abs(nose.x - shoulderMid.x);

        if (shoulderWidth >= 0.16 && noseOffset <= shoulderWidth * 0.32) {
          return "front";
        }

        if (shoulderWidth <= 0.14 || noseOffset > shoulderWidth * 0.32) {
          return "side";
        }

        return "unknown";
      }

      function getTorsoLeanAngle(shoulderMid, hipMid) {
        if (!shoulderMid || !hipMid) {
          return null;
        }

        const dx = Math.abs(shoulderMid.x - hipMid.x);
        const dy = Math.abs(shoulderMid.y - hipMid.y);
        return Math.atan2(dx, dy + 0.0001) * 180 / Math.PI;
      }

      function classifyTorsoPosture(shoulderMid, hipMid, torsoLeanAngle) {
        if (!shoulderMid || !hipMid || torsoLeanAngle === null) {
          return "unknown";
        }

        if (torsoLeanAngle < 15) {
          return "high";
        }

        if (torsoLeanAngle > 45) {
          return "low";
        }

        return "balanced";
      }

      function classifyStanceState(bodyFacing, torsoLeanAngle, frontStanceAngle) {
        if (bodyFacing === "front") {
          if (frontStanceAngle === null) {
            return "unknown";
          }

          if (frontStanceAngle < 40) {
            return "too_low";
          }

          if (frontStanceAngle > 60) {
            return "too_upright";
          }

          return "ready";
        }

        if (torsoLeanAngle === null) {
          return "unknown";
        }

        if (torsoLeanAngle < 15) {
          return "too_upright";
        }

        if (torsoLeanAngle > 45) {
          return "too_low";
        }

        return "ready";
      }

      function classifyFrontStanceAngle(landmarks, hipMid) {
        const leftKnee = landmarks[INDEX.leftKnee];
        const rightKnee = landmarks[INDEX.rightKnee];

        if (!hipMid || !visible(leftKnee) || !visible(rightKnee)) {
          return null;
        }

        return angleAt(leftKnee, hipMid, rightKnee);
      }

      function classifyFrontBallLaneState(landmarks, ball) {
        const leftAnkle = landmarks[INDEX.leftAnkle];
        const rightAnkle = landmarks[INDEX.rightAnkle];

        if (!ball || !visible(leftAnkle) || !visible(rightAnkle)) {
          return "unknown";
        }

        const minX = Math.min(leftAnkle.x, rightAnkle.x);
        const maxX = Math.max(leftAnkle.x, rightAnkle.x);
        return ball.x >= minX && ball.x <= maxX ? "between_legs" : "outside_legs";
      }

      function classifyFootSpacingState(landmarks) {
        const leftAnkle = landmarks[INDEX.leftAnkle];
        const rightAnkle = landmarks[INDEX.rightAnkle];
        const leftShoulder = landmarks[INDEX.leftShoulder];
        const rightShoulder = landmarks[INDEX.rightShoulder];

        if (!visible(leftAnkle) || !visible(rightAnkle) || !visible(leftShoulder) || !visible(rightShoulder)) {
          return "unknown";
        }

        const footWidth = Math.abs(leftAnkle.x - rightAnkle.x);
        const shoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x);

        if (footWidth < shoulderWidth) {
          return "narrow";
        }

        if (footWidth > shoulderWidth * 2) {
          return "wide";
        }

        return "balanced";
      }

      function detectControllingHand(landmarks, ball) {
        const leftWrist = landmarks[INDEX.leftWrist];
        const rightWrist = landmarks[INDEX.rightWrist];

        if (!ball) {
          return "unknown";
        }

        if (visible(leftWrist) && visible(rightWrist)) {
          const leftDistance = Math.abs(leftWrist.x - ball.x) + Math.abs(leftWrist.y - ball.y);
          const rightDistance = Math.abs(rightWrist.x - ball.x) + Math.abs(rightWrist.y - ball.y);
          return leftDistance <= rightDistance ? "left" : "right";
        }

        if (visible(leftWrist)) {
          return "left";
        }

        if (visible(rightWrist)) {
          return "right";
        }

        return "unknown";
      }

      function updateDribbleBounceTracking(landmarks, ball) {
        const leftAnkle = landmarks[INDEX.leftAnkle];
        const rightAnkle = landmarks[INDEX.rightAnkle];

        if (!ball || !visible(leftAnkle) || !visible(rightAnkle)) {
          wasBallNearFoot = false;
          return;
        }

        const footY = (leftAnkle.y + rightAnkle.y) / 2;
        const nearFoot = ball.y >= footY - 0.07;

        if (highestBounceY === null || ball.y < highestBounceY) {
          highestBounceY = ball.y;
        }

        if (lowestBounceY === null || ball.y > lowestBounceY) {
          lowestBounceY = ball.y;
        }

        if (nearFoot && !wasBallNearFoot) {
          dribbleCount += 1;
          lastBounceHand = detectControllingHand(landmarks, ball);

          if (lastBounceHand === "left") {
            leftHandDribbleCount += 1;
          } else if (lastBounceHand === "right") {
            rightHandDribbleCount += 1;
          }

          highestBounceY = ball.y;
          lowestBounceY = ball.y;
        }

        wasBallNearFoot = nearFoot;
      }

      function classifyBounceStates(shoulderMid, hipMid) {
        let bounceHighState = "unknown";
        let bounceLowState = "unknown";

        if (shoulderMid && highestBounceY !== null) {
          bounceHighState = highestBounceY < shoulderMid.y - 0.015 ? "too_high" : "balanced";
        }

        if (hipMid && lowestBounceY !== null) {
          bounceLowState = lowestBounceY < hipMid.y - 0.015 ? "too_low" : "balanced";
        }

        return { bounceHighState, bounceLowState };
      }

      function buildDribbleAnalysis(landmarks, ball) {
        const leftShoulder = landmarks[INDEX.leftShoulder];
        const rightShoulder = landmarks[INDEX.rightShoulder];
        const leftHip = landmarks[INDEX.leftHip];
        const rightHip = landmarks[INDEX.rightHip];
        const shoulderMid = visible(leftShoulder) && visible(rightShoulder) ? midpoint(leftShoulder, rightShoulder) : null;
        const hipMid = visible(leftHip) && visible(rightHip) ? midpoint(leftHip, rightHip) : null;
        const neck = shoulderMid;
        const bodyFacing = classifyBodyFacing(landmarks);
        const frontStanceAngle = classifyFrontStanceAngle(landmarks, hipMid);
        const torsoLeanAngle = getTorsoLeanAngle(shoulderMid, hipMid);
        const stanceState = classifyStanceState(bodyFacing, torsoLeanAngle, frontStanceAngle);
        const dribbleStarted = didDribbleStart(landmarks, ball);

        if (dribbleStarted) {
          updateDribbleBounceTracking(landmarks, ball);
        }

        const eyeFocus = classifyEyeFocus(landmarks, neck);
        const dribbleHeight = dribbleStarted ? classifyDribbleHeight(landmarks, neck, hipMid) : "unknown";
        const torsoPosture = classifyTorsoPosture(shoulderMid, hipMid, torsoLeanAngle);
        const frontBallLaneState = bodyFacing === "front" ? classifyFrontBallLaneState(landmarks, ball) : "unknown";
        const footSpacingState = bodyFacing === "front" ? classifyFootSpacingState(landmarks) : "unknown";
        const handBalanceState = dribbleCount >= 2 && Math.abs(leftHandDribbleCount - rightHandDribbleCount) >= 2
          ? "unbalanced"
          : dribbleCount > 0
            ? "balanced"
            : "unknown";
        const bounceStates = classifyBounceStates(shoulderMid, hipMid);

        return {
          dribbleStarted,
          bodyFacing,
          eyeFocus,
          dribbleHeight,
          torsoPosture,
          torsoLeanAngle,
          stanceState,
          frontStanceAngle,
          bounceHighState: bounceStates.bounceHighState,
          bounceLowState: bounceStates.bounceLowState,
          dribbleCount,
          leftHandDribbleCount,
          rightHandDribbleCount,
          handBalanceState,
          frontBallLaneState,
          footSpacingState,
          highestBounceY,
          lowestBounceY,
          summary: [
            "??:" + bodyFacing,
            "???:" + (dribbleStarted ? "??" : "??"),
            "??:" + dribbleCount,
            "??:" + eyeFocus,
            "??:" + stanceState,
            "?:" + (ball ? ball.color : "unknown")
          ].join(" | ")
        };
      }

      function buildShootAnalysis(landmarks, releaseVelocity, ball) {
        const leftShoulder = landmarks[INDEX.leftShoulder];
        const rightShoulder = landmarks[INDEX.rightShoulder];
        const leftElbow = landmarks[INDEX.leftElbow];
        const rightElbow = landmarks[INDEX.rightElbow];
        const leftWrist = landmarks[INDEX.leftWrist];
        const rightWrist = landmarks[INDEX.rightWrist];
        const leftHip = landmarks[INDEX.leftHip];
        const rightHip = landmarks[INDEX.rightHip];
        const leftKnee = landmarks[INDEX.leftKnee];
        const rightKnee = landmarks[INDEX.rightKnee];
        const leftAnkle = landmarks[INDEX.leftAnkle];
        const rightAnkle = landmarks[INDEX.rightAnkle];

        const leftArmAngle = angleAt(leftShoulder, leftElbow, leftWrist);
        const rightArmAngle = angleAt(rightShoulder, rightElbow, rightWrist);
        const shootingSide =
          leftArmAngle !== null && rightArmAngle !== null
            ? (leftWrist?.y ?? 1) < (rightWrist?.y ?? 1) ? "left" : "right"
            : leftArmAngle !== null
              ? "left"
              : rightArmAngle !== null
                ? "right"
                : null;

        const armAngle = shootingSide === "left" ? leftArmAngle : shootingSide === "right" ? rightArmAngle : null;
        const shootingShoulder = shootingSide === "left" ? leftShoulder : shootingSide === "right" ? rightShoulder : null;
        const shootingWrist = shootingSide === "left" ? leftWrist : shootingSide === "right" ? rightWrist : null;

        let armAngleState = "unknown";
        if (armAngle !== null) {
          if (armAngle < 90) {
            armAngleState = "narrow";
          } else if (armAngle > 110) {
            armAngleState = "wide";
          } else {
            armAngleState = "balanced";
          }
        }

        const legAngles = [angleAt(leftHip, leftKnee, leftAnkle), angleAt(rightHip, rightKnee, rightAnkle)].filter((value) => value !== null);
        const legAngle = legAngles.length > 0 ? legAngles.reduce((sum, value) => sum + value, 0) / legAngles.length : null;

        let legAngleState = "unknown";
        if (legAngle !== null) {
          if (legAngle < 100) {
            legAngleState = "low";
          } else if (legAngle > 130) {
            legAngleState = "high";
          } else {
            legAngleState = "balanced";
          }
        }

        const releasePose =
          armAngle !== null &&
          armAngle > 120 &&
          visible(shootingShoulder) &&
          visible(shootingWrist) &&
          shootingWrist.y < shootingShoulder.y;

        let releaseTiming = "unknown";
        if (releasePose && releaseVelocity !== null) {
          if (releaseVelocity < -0.003) {
            releaseTiming = "early";
          } else if (releaseVelocity > 0.003) {
            releaseTiming = "late";
          } else {
            releaseTiming = "balanced";
          }
        }

        return {
          armAngle,
          legAngle,
          releaseVelocity,
          armAngleState,
          releaseTiming,
          legAngleState,
          summary: [
            "??" + (armAngleState === "narrow" ? "醫곸쓬" : armAngleState === "wide" ? "?볦쓬" : armAngleState === "balanced" ? "?곸젅" : "?먯젙 ?대젮?"),
            "??대컢:" + (releaseTiming === "early" ? "鍮좊쫫" : releaseTiming === "late" ? "??쓬" : releaseTiming === "balanced" ? "?곸젅" : "?먯젙 ?대젮?"),
            "?섏껜:" + (legAngleState === "low" ? "?덈Т ??쓬" : legAngleState === "high" ? "?믪쓬" : legAngleState === "balanced" ? "?곸젅" : "?먯젙 ?대젮?"),
            "怨?" + (ball ? (ball.color === "orange" ? "二쇳솴 媛먯?" : "鍮④컯 媛먯?") : "?먯깋 以?)
          ].join(" | ")
        };
      }

      function getProblemJointKeys(landmarks, dribbleAnalysis, shootAnalysis) {
        const problemJoints = new Set();

        if (lessonMode === "dribble") {
          if (dribbleAnalysis.eyeFocus === "ball") {
            problemJoints.add("head");
            problemJoints.add("neck");
          }

          if (dribbleAnalysis.dribbleStarted && dribbleAnalysis.dribbleHeight !== "balanced" && dribbleAnalysis.dribbleHeight !== "unknown") {
            problemJoints.add("leftWrist");
            problemJoints.add("rightWrist");
          }

          if (dribbleAnalysis.torsoPosture !== "balanced" && dribbleAnalysis.torsoPosture !== "unknown") {
            problemJoints.add("leftShoulder");
            problemJoints.add("rightShoulder");
            problemJoints.add("leftHip");
            problemJoints.add("rightHip");
          }
        } else {
          const shootingSide = getShootingSide(landmarks);
          const shoulderKey = shootingSide === "left" ? "leftShoulder" : "rightShoulder";
          const elbowKey = shootingSide === "left" ? "leftElbow" : "rightElbow";
          const wristKey = shootingSide === "left" ? "leftWrist" : "rightWrist";

          if (shootingSide && shootAnalysis.armAngleState !== "balanced" && shootAnalysis.armAngleState !== "unknown") {
            problemJoints.add(shoulderKey);
            problemJoints.add(elbowKey);
            problemJoints.add(wristKey);
          }

          if (shootingSide && shootAnalysis.releaseTiming !== "balanced" && shootAnalysis.releaseTiming !== "unknown") {
            problemJoints.add(wristKey);
            problemJoints.add("leftHip");
            problemJoints.add("rightHip");
          }

          if (shootAnalysis.legAngleState !== "balanced" && shootAnalysis.legAngleState !== "unknown") {
            problemJoints.add("leftHip");
            problemJoints.add("rightHip");
            problemJoints.add("leftKnee");
            problemJoints.add("rightKnee");
            problemJoints.add("leftAnkle");
            problemJoints.add("rightAnkle");
          }
        }

        return problemJoints;
      }

      function shouldHighlightSegment(problemJointKeys, a, b) {
        return problemJointKeys.has(a) || problemJointKeys.has(b);
      }

      function renderPose(landmarks) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        ctx.restore();
        const ball = detectBall();

        if (!landmarks) {
          if (ball) {
            drawBall(ball);
          }

          setHud(ball ? "怨??몄떇?? " + (ball.color === "orange" ? "二쇳솴 怨? : "鍮④컙 怨?) : "?붾㈃ ?덉뿉 紐멸낵 怨듭씠 蹂댁씠?꾨줉 留욎떠 二쇱꽭??");
          const now = Date.now();
          if (now - lastSentAt > 1000) {
            lastSentAt = now;
            post({ type: "status", message: ball ? "怨듭? 媛먯??섏?留??щ엺??李얜뒗 以묒엯?덈떎." : "?щ엺怨?怨듭쓣 李얜뒗 以묒엯?덈떎." });
          }
          return;
        }

        const head = landmarks[INDEX.nose];
        const leftShoulder = landmarks[INDEX.leftShoulder];
        const rightShoulder = landmarks[INDEX.rightShoulder];
        const leftElbow = landmarks[INDEX.leftElbow];
        const rightElbow = landmarks[INDEX.rightElbow];
        const leftWrist = landmarks[INDEX.leftWrist];
        const rightWrist = landmarks[INDEX.rightWrist];
        const leftHip = landmarks[INDEX.leftHip];
        const rightHip = landmarks[INDEX.rightHip];
        const leftKnee = landmarks[INDEX.leftKnee];
        const rightKnee = landmarks[INDEX.rightKnee];
        const leftAnkle = landmarks[INDEX.leftAnkle];
        const rightAnkle = landmarks[INDEX.rightAnkle];
        const neck = visible(leftShoulder) && visible(rightShoulder) ? midpoint(leftShoulder, rightShoulder) : null;
        const hipMid = visible(leftHip) && visible(rightHip) ? midpoint(leftHip, rightHip) : null;

        if (visible(head)) drawPoint(head, LABELS.head, "#ff6b6b");
        if (neck && visible(neck)) drawPoint(neck, LABELS.neck, "#f7b267");
        if (visible(leftShoulder)) drawPoint(leftShoulder, "?쇱そ " + LABELS.shoulder, "#ffd166");
        if (visible(rightShoulder)) drawPoint(rightShoulder, "?ㅻⅨ履?" + LABELS.shoulder, "#ffd166");
        if (visible(leftElbow)) drawPoint(leftElbow, "?쇱そ " + LABELS.elbow, "#ffb703");
        if (visible(rightElbow)) drawPoint(rightElbow, "?ㅻⅨ履?" + LABELS.elbow, "#ffb703");
        if (visible(leftWrist)) drawPoint(leftWrist, "?쇱そ " + LABELS.hand, "#fb8500");
        if (visible(rightWrist)) drawPoint(rightWrist, "?ㅻⅨ履?" + LABELS.hand, "#fb8500");
        if (visible(leftHip)) drawPoint(leftHip, "?쇱そ " + LABELS.hip, "#06d6a0");
        if (visible(rightHip)) drawPoint(rightHip, "?ㅻⅨ履?" + LABELS.hip, "#06d6a0");
        if (visible(leftKnee)) drawPoint(leftKnee, "?쇱そ " + LABELS.knee, "#118ab2");
        if (visible(rightKnee)) drawPoint(rightKnee, "?ㅻⅨ履?" + LABELS.knee, "#118ab2");
        if (visible(leftAnkle)) drawPoint(leftAnkle, "?쇱そ " + LABELS.foot, "#4cc9f0");
        if (visible(rightAnkle)) drawPoint(rightAnkle, "?ㅻⅨ履?" + LABELS.foot, "#4cc9f0");
        if (ball) {
          drawBall(ball);
        }

        const detected = [];
        if (visible(head)) detected.push(LABELS.head);
        if (neck && visible(neck)) detected.push(LABELS.neck);
        if (visible(leftShoulder) || visible(rightShoulder)) detected.push(LABELS.shoulder);
        if (visible(leftElbow) || visible(rightElbow)) detected.push(LABELS.elbow);
        if (visible(leftWrist) || visible(rightWrist)) detected.push(LABELS.hand);
        if (visible(leftHip) || visible(rightHip)) detected.push(LABELS.hip);
        if (visible(leftKnee) || visible(rightKnee)) detected.push(LABELS.knee);
        if (visible(leftAnkle) || visible(rightAnkle)) detected.push(LABELS.foot);
        if (ball) {
          detected.push(ball.color === "orange" ? "二쇳솴 怨? : "鍮④컙 怨?);
        }

        const pointSummary = detected.join(", ");
        setHud(pointSummary ? "?몄떇 以? " + pointSummary : "愿?덇낵 怨듭쓣 李얜뒗 以묒엯?덈떎.");

        const releaseVelocity = hipMid && previousHipY !== null ? hipMid.y - previousHipY : null;
        if (hipMid) {
          previousHipY = hipMid.y;
        }

        const dribbleAnalysis = buildDribbleAnalysis(landmarks, ball);
        const shootAnalysis = buildShootAnalysis(landmarks, releaseVelocity, ball);
        const now = Date.now();

        if (pointSummary && (pointSummary !== lastPointSummary || now - lastSentAt > 1200)) {
          lastPointSummary = pointSummary;
          lastSentAt = now;
          post({ type: "points", summary: pointSummary });
        }

        if (dribbleAnalysis.summary !== lastDribbleSummary || now - lastSentAt > 1200) {
          lastDribbleSummary = dribbleAnalysis.summary;
          post({ type: "dribble_analysis", analysis: dribbleAnalysis });
        }

        if (shootAnalysis.summary !== lastShootSummary || now - lastSentAt > 1200) {
          lastShootSummary = shootAnalysis.summary;
          post({ type: "shoot_analysis", analysis: shootAnalysis });
        }
      }

      async function setupPose() {
        post({ type: "status", message: "MediaPipe? 怨??몄떇 紐⑤뜽??以鍮꾪븯??以묒엯?덈떎." });
        setHud("MediaPipe? 怨??몄떇 紐⑤뜽??以鍮꾪븯??以묒엯?덈떎.");

        const vision = await import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest");
        const { FilesetResolver, PoseLandmarker } = vision;
        const fileset = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );

        poseLandmarker = await PoseLandmarker.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task"
          },
          runningMode: "VIDEO",
          numPoses: 1,
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5
        });

        post({ type: "ready" });
        setHud("移대찓?쇰? ?쒖옉?섎뒗 以묒엯?덈떎.");
      }

      async function setupCamera() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("navigator.mediaDevices.getUserMedia瑜??ъ슜?????놁뒿?덈떎.");
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: "user",
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        });

        video.srcObject = stream;
        await video.play();
        resizeCanvas();
        window.addEventListener("resize", resizeCanvas);

        if (typeof MediaRecorder !== "undefined") {
          composedStream = canvas.captureStream(30);
        }

        post({ type: "stream_started" });
        setHud("移대찓???쒖옉 ?꾨즺. ?먯꽭? 怨듭쓣 遺꾩꽍?섎뒗 以묒엯?덈떎.");
        requestAnimationFrame(loop);
      }

      function loop() {
        if (!poseLandmarker || video.readyState < 2) {
          requestAnimationFrame(loop);
          return;
        }

        if (video.currentTime !== lastVideoTime) {
          lastVideoTime = video.currentTime;
          const result = poseLandmarker.detectForVideo(video, performance.now());
          const landmarks = result.landmarks && result.landmarks.length > 0 ? result.landmarks[0] : null;
          renderPose(landmarks);
        }

        requestAnimationFrame(loop);
      }

      async function start() {
        try {
          await setupPose();
          await setupCamera();
        } catch (error) {
          const message = error instanceof Error ? error.message : "遺꾩꽍???쒖옉?섏? 紐삵뻽?듬땲??";
          post({ type: "error", message });
          setHud(message);
        }
      }

      window.addEventListener("beforeunload", () => {
        if (recorder && recorder.state !== "inactive") {
          recorderStopping = true;
          recorder.stop();
        }
        if (video.srcObject) {
          video.srcObject.getTracks().forEach((track) => track.stop());
        }
      });

      start();
    </script>
  </body>
</html>`;
}

export function buildPoseBootstrapScript(
  lessonMode: 'dribble' | 'shoot' = 'dribble',
  selectedBallBrand: 'wilson' | 'spalding' | 'molten' = 'wilson',
  selectedBallColors: string[] = ['orange']
): string {
  const html = JSON.stringify(buildPoseWebHtml(lessonMode, selectedBallBrand, selectedBallColors));

  return `
    document.open();
    document.write(${html});
    document.close();
    true;
  `;
}

