export const POSE_WEB_BOOTSTRAP_URL = 'https://example.com/';

export function buildPoseWebHtml(): string {
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
      <div class="hud" id="hud">MediaPipe와 공 인식을 준비하는 중입니다.</div>
    </div>

    <script type="module">
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
        head: "머리",
        neck: "목",
        shoulder: "어깨",
        elbow: "팔꿈치",
        hand: "손",
        hip: "엉덩이",
        knee: "무릎",
        foot: "발"
      };

      let poseLandmarker = null;
      let recorder = null;
      let recorderChunks = [];
      let recorderStopping = false;
      let lastVideoTime = -1;
      let lastPointSummary = "";
      let lastDribbleSummary = "";
      let lastShootSummary = "";
      let lastSentAt = 0;
      let previousHipY = null;

      function post(payload) {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify(payload));
        }
      }

      function finalizeRecording() {
        if (recorderChunks.length === 0) {
          post({ type: "recording_error", message: "저장할 영상 데이터가 없습니다." });
          return;
        }

        const blob = new Blob(recorderChunks, {
          type: recorder?.mimeType || "video/webm"
        });
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = typeof reader.result === "string" ? reader.result : "";
          if (!result) {
            post({ type: "recording_error", message: "영상 인코딩에 실패했습니다." });
            return;
          }

          post({ type: "recording_ready", videoUri: result });
        };
        reader.onerror = () => {
          post({ type: "recording_error", message: "영상 파일을 읽는 중 오류가 발생했습니다." });
        };
        reader.readAsDataURL(blob);
      }

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

        const isOrange = h >= 10 && h <= 42 && s >= 0.45 && v >= 0.25 && r > g && g > b * 0.8;
        if (isOrange) {
          return 1;
        }

        const isRed = (h <= 12 || h >= 345) && s >= 0.45 && v >= 0.22 && r > g * 1.1 && r > b * 1.1;
        if (isRed) {
          return 2;
        }

        return 0;
      }

      function detectBall() {
        if (!processingContext) {
          return null;
        }

        const width = 192;
        const height = 144;
        processingCanvas.width = width;
        processingCanvas.height = height;
        processingContext.drawImage(video, 0, 0, width, height);

        const { data } = processingContext.getImageData(0, 0, width, height);
        const visited = new Uint8Array(width * height);
        const colorMap = new Uint8Array(width * height);

        for (let index = 0; index < width * height; index += 1) {
          const offset = index * 4;
          colorMap[index] = classifyBallPixel(data[offset], data[offset + 1], data[offset + 2]);
        }

        let best = null;

        for (let index = 0; index < colorMap.length; index += 1) {
          if (visited[index] || colorMap[index] === 0) {
            continue;
          }

          const queue = [index];
          visited[index] = 1;
          const colorValue = colorMap[index];
          let head = 0;
          let count = 0;
          let sumX = 0;
          let sumY = 0;
          let minX = width;
          let minY = height;
          let maxX = 0;
          let maxY = 0;

          while (head < queue.length) {
            const current = queue[head];
            head += 1;

            const x = current % width;
            const y = Math.floor(current / width);

            count += 1;
            sumX += x;
            sumY += y;
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);

            const neighbors = [current - 1, current + 1, current - width, current + width];

            for (const neighbor of neighbors) {
              if (neighbor < 0 || neighbor >= colorMap.length || visited[neighbor] || colorMap[neighbor] !== colorValue) {
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

          if (count < 90) {
            continue;
          }

          const blobWidth = maxX - minX + 1;
          const blobHeight = maxY - minY + 1;
          const aspectRatio = blobWidth / blobHeight;
          if (aspectRatio < 0.55 || aspectRatio > 1.45) {
            continue;
          }

          const candidate = {
            x: sumX / count / width,
            y: sumY / count / height,
            radius: Math.max(blobWidth, blobHeight) / Math.max(width, height) / 2,
            pixelCount: count,
            color: colorValue === 1 ? "orange" : "red"
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
        ctx.fillText(ball.color === "orange" ? "주황 공" : "빨간 공", centerX, centerY - Math.max(radius, 16) - 16);
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

      function classifyTorsoPosture(shoulderMid, hipMid) {
        if (!shoulderMid || !hipMid) {
          return "unknown";
        }

        const torsoHeight = hipMid.y - shoulderMid.y;
        if (torsoHeight > 0.3) {
          return "high";
        }

        if (torsoHeight < 0.2) {
          return "low";
        }

        return "balanced";
      }

      function buildDribbleAnalysis(landmarks, ball) {
        const leftShoulder = landmarks[INDEX.leftShoulder];
        const rightShoulder = landmarks[INDEX.rightShoulder];
        const leftHip = landmarks[INDEX.leftHip];
        const rightHip = landmarks[INDEX.rightHip];
        const shoulderMid = visible(leftShoulder) && visible(rightShoulder) ? midpoint(leftShoulder, rightShoulder) : null;
        const hipMid = visible(leftHip) && visible(rightHip) ? midpoint(leftHip, rightHip) : null;
        const neck = shoulderMid;

        const eyeFocus = classifyEyeFocus(landmarks, neck);
        const dribbleHeight = classifyDribbleHeight(landmarks, neck, hipMid);
        const torsoPosture = classifyTorsoPosture(shoulderMid, hipMid);

        return {
          eyeFocus,
          dribbleHeight,
          torsoPosture,
          summary: [
            "시선:" + (eyeFocus === "ball" ? "공 쪽" : eyeFocus === "forward" ? "앞" : "판정 어려움"),
            "드리블:" + (dribbleHeight === "high" ? "높음" : dribbleHeight === "low" ? "낮음" : dribbleHeight === "balanced" ? "적절" : "판정 어려움"),
            "상체:" + (torsoPosture === "high" ? "높음" : torsoPosture === "low" ? "낮음" : torsoPosture === "balanced" ? "적절" : "판정 어려움"),
            "공:" + (ball ? (ball.color === "orange" ? "주황 감지" : "빨강 감지") : "탐색 중")
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
            "팔:" + (armAngleState === "narrow" ? "좁음" : armAngleState === "wide" ? "넓음" : armAngleState === "balanced" ? "적절" : "판정 어려움"),
            "타이밍:" + (releaseTiming === "early" ? "빠름" : releaseTiming === "late" ? "늦음" : releaseTiming === "balanced" ? "적절" : "판정 어려움"),
            "하체:" + (legAngleState === "low" ? "너무 낮음" : legAngleState === "high" ? "높음" : legAngleState === "balanced" ? "적절" : "판정 어려움"),
            "공:" + (ball ? (ball.color === "orange" ? "주황 감지" : "빨강 감지") : "탐색 중")
          ].join(" | ")
        };
      }

      function renderPose(landmarks) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const ball = detectBall();

        if (!landmarks) {
          if (ball) {
            drawBall(ball);
          }

          setHud(ball ? "공 인식됨: " + (ball.color === "orange" ? "주황 공" : "빨간 공") : "화면 안에 몸과 공이 보이도록 맞춰 주세요.");
          const now = Date.now();
          if (now - lastSentAt > 1000) {
            lastSentAt = now;
            post({ type: "status", message: ball ? "공은 감지되지만 사람을 찾는 중입니다." : "사람과 공을 찾는 중입니다." });
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

        drawSegment(leftShoulder, rightShoulder, "#ffb347");
        drawSegment(leftShoulder, leftElbow, "#ffb347");
        drawSegment(rightShoulder, rightElbow, "#ffb347");
        drawSegment(leftElbow, leftWrist, "#ffd166");
        drawSegment(rightElbow, rightWrist, "#ffd166");
        drawSegment(leftShoulder, leftHip, "#7bd389");
        drawSegment(rightShoulder, rightHip, "#7bd389");
        drawSegment(leftHip, rightHip, "#7bd389");
        drawSegment(leftHip, leftKnee, "#7bd389");
        drawSegment(rightHip, rightKnee, "#7bd389");
        drawSegment(leftKnee, leftAnkle, "#80ed99");
        drawSegment(rightKnee, rightAnkle, "#80ed99");

        if (visible(head)) drawPoint(head, LABELS.head, "#ff6b6b");
        if (neck && visible(neck)) drawPoint(neck, LABELS.neck, "#f7b267");
        if (visible(leftShoulder)) drawPoint(leftShoulder, "왼쪽 " + LABELS.shoulder, "#ffd166");
        if (visible(rightShoulder)) drawPoint(rightShoulder, "오른쪽 " + LABELS.shoulder, "#ffd166");
        if (visible(leftElbow)) drawPoint(leftElbow, "왼쪽 " + LABELS.elbow, "#ffb703");
        if (visible(rightElbow)) drawPoint(rightElbow, "오른쪽 " + LABELS.elbow, "#ffb703");
        if (visible(leftWrist)) drawPoint(leftWrist, "왼쪽 " + LABELS.hand, "#fb8500");
        if (visible(rightWrist)) drawPoint(rightWrist, "오른쪽 " + LABELS.hand, "#fb8500");
        if (visible(leftHip)) drawPoint(leftHip, "왼쪽 " + LABELS.hip, "#06d6a0");
        if (visible(rightHip)) drawPoint(rightHip, "오른쪽 " + LABELS.hip, "#06d6a0");
        if (visible(leftKnee)) drawPoint(leftKnee, "왼쪽 " + LABELS.knee, "#118ab2");
        if (visible(rightKnee)) drawPoint(rightKnee, "오른쪽 " + LABELS.knee, "#118ab2");
        if (visible(leftAnkle)) drawPoint(leftAnkle, "왼쪽 " + LABELS.foot, "#4cc9f0");
        if (visible(rightAnkle)) drawPoint(rightAnkle, "오른쪽 " + LABELS.foot, "#4cc9f0");
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
          detected.push(ball.color === "orange" ? "주황 공" : "빨간 공");
        }

        const pointSummary = detected.join(", ");
        setHud(pointSummary ? "인식 중: " + pointSummary : "관절과 공을 찾는 중입니다.");

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
        post({ type: "status", message: "MediaPipe와 공 인식 모델을 준비하는 중입니다." });
        setHud("MediaPipe와 공 인식 모델을 준비하는 중입니다.");

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
        setHud("카메라를 시작하는 중입니다.");
      }

      async function setupCamera() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("navigator.mediaDevices.getUserMedia를 사용할 수 없습니다.");
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
          const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")
            ? "video/webm;codecs=vp8,opus"
            : MediaRecorder.isTypeSupported("video/webm")
              ? "video/webm"
              : "";

          recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
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
            post({ type: "recording_error", message: "레슨 영상 녹화 중 오류가 발생했습니다." });
          };
          recorder.start(1000);
        }

        post({ type: "stream_started" });
        setHud("카메라 시작 완료. 자세와 공을 분석하는 중입니다.");
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
          const message = error instanceof Error ? error.message : "분석을 시작하지 못했습니다.";
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

export function buildPoseBootstrapScript(): string {
  const html = JSON.stringify(buildPoseWebHtml());

  return `
    document.open();
    document.write(${html});
    document.close();
    true;
  `;
}
