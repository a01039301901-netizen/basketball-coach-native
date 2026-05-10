export const POSE_WEB_BOOTSTRAP_URL = 'https://example.com/';

export function buildPoseWebHtml(): string {
  return `<!DOCTYPE html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
    />
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
        transform: scaleX(-1);
      }

      .hud {
        position: absolute;
        left: 12px;
        right: 12px;
        bottom: 12px;
        z-index: 5;
        color: white;
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
      <div class="hud" id="hud">MediaPipe를 준비하는 중...</div>
    </div>

    <script type="module">
      const video = document.getElementById("video");
      const canvas = document.getElementById("canvas");
      const hud = document.getElementById("hud");
      const ctx = canvas.getContext("2d");

      const INDEX = {
        nose: 0,
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
      let lastVideoTime = -1;
      let lastSummary = "";
      let lastSentAt = 0;

      function post(payload) {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify(payload));
        }
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

      function drawPoint(point, label, color) {
        const x = point.x * canvas.width;
        const y = point.y * canvas.height;
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
        if (!visible(a) || !visible(b)) return;
        ctx.beginPath();
        ctx.moveTo(a.x * canvas.width, a.y * canvas.height);
        ctx.lineTo(b.x * canvas.width, b.y * canvas.height);
        ctx.strokeStyle = color;
        ctx.lineWidth = 4;
        ctx.stroke();
      }

      function renderPose(landmarks) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (!landmarks) {
          setHud("사람이 화면 안에 잘 보이도록 서 주세요.");
          const now = Date.now();
          if (now - lastSentAt > 1000) {
            lastSentAt = now;
            post({ type: "status", message: "사람을 찾는 중" });
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

        const detected = [];
        if (visible(head)) detected.push(LABELS.head);
        if (neck && visible(neck)) detected.push(LABELS.neck);
        if (visible(leftShoulder) || visible(rightShoulder)) detected.push(LABELS.shoulder);
        if (visible(leftElbow) || visible(rightElbow)) detected.push(LABELS.elbow);
        if (visible(leftWrist) || visible(rightWrist)) detected.push(LABELS.hand);
        if (visible(leftHip) || visible(rightHip)) detected.push(LABELS.hip);
        if (visible(leftKnee) || visible(rightKnee)) detected.push(LABELS.knee);
        if (visible(leftAnkle) || visible(rightAnkle)) detected.push(LABELS.foot);

        const summary = detected.join(", ");
        setHud(summary ? "인식 중: " + summary : "관절 포인트를 찾는 중...");

        const now = Date.now();
        if (summary && (summary !== lastSummary || now - lastSentAt > 1200)) {
          lastSummary = summary;
          lastSentAt = now;
          post({ type: "points", summary });
        }
      }

      async function setupPose() {
        post({ type: "status", message: "MediaPipe 모델을 불러오는 중" });
        setHud("MediaPipe 모델을 불러오는 중...");

        try {
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
          setHud("카메라를 시작하는 중...");
        } catch (error) {
          const message = error instanceof Error ? error.message : "MediaPipe 초기화 실패";
          post({ type: "error", message });
          setHud(message);
          throw error;
        }
      }

      async function setupCamera() {
        try {
          if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error("navigator.mediaDevices.getUserMedia 를 사용할 수 없습니다.");
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
          post({ type: "stream_started" });
          setHud("카메라 시작 완료. 자세를 분석하는 중...");
          requestAnimationFrame(loop);
        } catch (error) {
          const message = error instanceof Error ? error.message : "카메라 접근 실패";
          post({ type: "error", message });
          setHud(message);
        }
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
          const message = error instanceof Error ? error.message : "분석 시작 실패";
          post({ type: "error", message });
        }
      }

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
