export const POSE_WEB_BOOTSTRAP_URL = 'https://example.com/';

import { getEffectiveBallRecognitionProfile } from '../../constants/ballRecognition';
import type { BallRecognitionProfile } from '../../types/app';

export function buildPoseWebHtml(
  lessonMode: 'dribble' | 'shoot' = 'dribble',
  selectedDribbleView: 'front' | 'side' = 'front',
  selectedBallBrand: 'wilson' | 'spalding' | 'molten' = 'wilson',
  selectedBallColors: string[] = ['orange'],
  ballRecognitionProfile: BallRecognitionProfile | null = null
): string {
  const effectiveBallRecognitionProfile = getEffectiveBallRecognitionProfile(selectedBallBrand, ballRecognitionProfile);

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
        touch-action: none;
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
        left: 50%;
        bottom: calc(env(safe-area-inset-bottom, 0px) + 126px);
        width: min(calc(100% - 32px), 360px);
        transform: translateX(-50%);
        z-index: 5;
        color: #ffffff;
        background: rgba(0, 0, 0, 0.5);
        border-radius: 14px;
        padding: 10px 12px;
        font-size: 13px;
        line-height: 1.45;
        text-align: center;
        pointer-events: none;
      }

      @media (orientation: landscape) {
        .hud {
          bottom: calc(env(safe-area-inset-bottom, 0px) + 18px);
          width: min(calc(100% - 168px), 420px);
        }
      }
    </style>
  </head>
  <body>
    <div class="wrap" id="wrap">
      <video id="video" autoplay playsinline muted webkit-playsinline></video>
      <canvas id="canvas"></canvas>
      <div class="hud" id="hud">MediaPipe와 공 인식을 준비하고 있습니다.</div>
    </div>

    <script type="module">
      const lessonMode = ${JSON.stringify(lessonMode)};
      const selectedDribbleView = ${JSON.stringify(selectedDribbleView)};
      const selectedBallBrand = ${JSON.stringify(selectedBallBrand)};
      const selectedBallColors = ${JSON.stringify(selectedBallColors)};
      const selectedBallRecognitionProfile = ${JSON.stringify(effectiveBallRecognitionProfile)};
      const learnedBandByColor = new Map(
        Array.isArray(selectedBallRecognitionProfile?.bands)
          ? selectedBallRecognitionProfile.bands.map((band) => [band.color, band])
          : []
      );
      const selectedBallPatternProfiles = Array.isArray(selectedBallRecognitionProfile?.patternProfiles)
        ? selectedBallRecognitionProfile.patternProfiles
        : selectedBallRecognitionProfile?.patternProfile
          ? [selectedBallRecognitionProfile.patternProfile]
          : [];
      const shouldUseBallPatternMatch = false;
      const wrap = document.getElementById("wrap");
      const video = document.getElementById("video");
      const canvas = document.getElementById("canvas");
      const hud = document.getElementById("hud");
      const ctx = canvas.getContext("2d");
      const processingCanvas = document.createElement("canvas");
      const processingContext = processingCanvas.getContext("2d", { willReadFrequently: true });
      const CAMERA_SWITCH_THRESHOLD_PX = 72;
      const REAR_CAMERA_LABEL_PATTERN = /(back|rear|environment|world|후면|뒤)/i;
      const FRONT_CAMERA_LABEL_PATTERN = /(front|user|face|전면|앞)/i;
      const DRIBBLE_RHYTHM_BAD_INTERVAL_DIFF_MS = 200;
      const DRIBBLE_FRONT_EYE_NECK_DOWN_GAP = 0.03;
      const DRIBBLE_FOOT_COUNT_DISTANCE = 0.12;
      const DRIBBLE_FOOT_RESET_DISTANCE = 0.17;
      const SHOOT_BALL_HAND_CONTACT_DISTANCE = 0.16;
      const SHOOT_BALL_HAND_SEPARATION_DISTANCE = 0.22;
      const SHOOT_BALL_HAND_SEPARATION_DELTA = 0.045;
      const BALL_TRACK_MAX_MISSING_FRAMES = 4;
      const BALL_TRACK_MIN_SEARCH_RADIUS = 0.14;
      const BALL_TRACK_MAX_SEARCH_RADIUS = 0.36;
      const BALL_TRACK_RADIUS_MULTIPLIER = 5.5;
      const BALL_TRACK_DISTANCE_BONUS = 160;
      const BALL_TRACK_DISTANCE_PENALTY = 180;
      const BALL_TRACK_DISTANCE_PENALTY_SCALE = 520;
      const BALL_TRACK_RADIUS_BONUS = 32;
      const BALL_TRACK_RADIUS_PENALTY_SCALE = 700;
      const BALL_TRACK_COLOR_BONUS = 16;
      const BALL_TRACK_SHAPE_BONUS = 24;
      const BALL_TRACK_CIRCLE_MATCH_BONUS = 60;
      const BALL_TRACK_FILL_RATIO_BONUS = 22;
      const BALL_TRACK_CIRCLE_COVERAGE_BONUS = 20;
      const BALL_TRACK_PATTERN_BONUS = 76;
      const BALL_TRACK_PATTERN_PRIMARY_MATCH_SCORE = 0.56;
      const BALL_TRACK_PATTERN_STRONG_MATCH_SCORE = 0.72;
      const BALL_TRACK_PATTERN_FILL_RELAX_FACTOR = 0.82;
      const BALL_TRACK_PATTERN_MIN_COVERAGE_RELAX_FACTOR = 0.74;
      const BALL_TRACK_PATTERN_MAX_COVERAGE_RELAX_FACTOR = 1.12;
      const BALL_TRACK_PATTERN_CIRCLE_MATCH_RELAX = 0.08;
      const BALL_TRACK_PATTERN_MIN_RADIUS_PX = 8;
      const BALL_TRACK_OUTLINE_BIN_COUNT = 18;
      const BALL_TRACK_OUTLINE_INNER_RADIUS_RATIO = 0.58;
      const BALL_TRACK_OUTLINE_OUTER_RADIUS_RATIO = 1.18;
      const BALL_TRACK_OUTLINE_FILL_RELAX_FACTOR = 0.78;
      const BALL_TRACK_OUTLINE_MIN_COVERAGE_RELAX_FACTOR = 0.72;
      const BALL_TRACK_OUTLINE_MAX_COVERAGE_RELAX_FACTOR = 1.08;
      const BALL_TRACK_MOTION_BONUS = 44;
      const BALL_TRACK_MOTION_MIN_RATIO = 0.08;
      const BALL_TRACK_MOTION_THRESHOLD = 0.12;
      const BALL_TRACK_MOTION_LINK_RADIUS = 2;
      const BALL_TRACK_MOTION_GLOBAL_MIN_RATIO = 0.002;
      const BALL_TRACK_MOTION_GLOBAL_MAX_RATIO = 0.34;
      const BALL_TRACK_MOTION_REGION_SHIFT_MAX = 0.12;
      const BALL_TRACK_MOTION_REGION_AREA_MIN_RATIO = 0.72;
      const BALL_TRACK_MOTION_REGION_AREA_MAX_RATIO = 1.45;
      const BALL_DETECTION_FULL_WIDTH = 224;
      const BALL_DETECTION_FULL_HEIGHT = 168;
      const BALL_DETECTION_FOCUSED_SIZE = 320;
      const BALL_DETECTION_SHOOT_FOCUSED_SIZE = 512;
      const BALL_DETECTION_DRIBBLE_FOCUSED_SIZE = 512;
      const BALL_DETECTION_MIN_ROI_SIDE = 0.28;
      const BALL_DETECTION_SHOOT_MIN_ROI_SIDE = 0.24;
      const BALL_DETECTION_ROI_PADDING = 0.18;
      const BALL_DETECTION_SHOOT_WRIST_MIN_ROI_SIDE = 0.22;
      const BALL_DETECTION_SHOOT_WRIST_ROI_PADDING = 0.08;
      const BALL_DETECTION_DRIBBLE_ROI_PADDING = 0.12;
      const BALL_DETECTION_DRIBBLE_WRIST_MIN_ROI_SIDE = 0.24;
      const BALL_DETECTION_DRIBBLE_WRIST_ROI_PADDING = 0.08;
      const BALL_DETECTION_TRACKED_PADDING = 1.15;
      const BALL_DETECTION_TRACKED_MIN_RADIUS = 0.07;
      const BALL_TRACK_ANY_WRIST_BONUS = 74;
      const BALL_TRACK_SHOOTING_WRIST_BONUS = 120;
      const BALL_TRACK_SUPPORT_WRIST_BONUS = 54;
      const BALL_TRACK_WRIST_DISTANCE_SCALE = 360;
      const BALL_TRACK_DRIBBLE_WRIST_BONUS = 42;
      const BALL_TRACK_DRIBBLE_WRIST_DISTANCE_SCALE = 240;
      const BALL_TRACK_LOWER_BODY_BONUS = 42;
      const BALL_TRACK_BODY_ALIGNMENT_BONUS = 30;
      const BALL_TRACK_BODY_ALIGNMENT_PENALTY = 18;
      const BALL_TRACK_TORSO_PENALTY = 88;
      const BALL_TRACK_DRIBBLE_VERTICAL_BONUS = 18;
      const BALL_TRACK_DRIBBLE_VERTICAL_PENALTY = 26;
      const BALL_TRACK_SHOOT_VERTICAL_BONUS = 14;
      const SHOOT_ARM_EXTENSION_BASE_ANGLE_MAX = 130;
      const SHOOT_ARM_EXTENSION_TARGET_ANGLE = 145;
      const SHOOT_ARM_EXTENSION_MIN_DELTA = 16;
      const SHOOT_ARM_EXTENSION_MIN_SPEED = 0.08;
      const SHOOT_KNEE_EXTENSION_MIN_DELTA = 4;
      const SHOOT_KNEE_EXTENSION_FROM_LOWEST_DELTA = 10;
      const SHOOT_TIMING_SYNC_WINDOW_MS = 180;
      const SHOOT_RELEASE_DURATION_BALANCED_MS = 600;
      const SHOOT_SUCCESS_CIRCLE_WINDOW_MS = 5000;
      const SHOOT_SUCCESS_CIRCLE_WRIST_HEAD_Y_GAP = 0.02;
      const SHOOT_SUCCESS_CIRCLE_HEAD_X_MARGIN = 0.01;
      const SHOOT_SUCCESS_CIRCLE_MIN_SHOULDER_WIDTH = 0.08;
      const SHOOT_SUCCESS_CIRCLE_MAX_WRIST_DISTANCE_RATIO = 0.85;
      const SHOOT_SUCCESS_CIRCLE_STABLE_FRAMES = 2;

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
        eye: "눈",
        neck: "목",
        shoulder: "어깨",
        elbow: "팔꿈치",
        hand: "손",
        hip: "엉덩이",
        knee: "무릎",
        foot: "발"
      };

      const UI = {
        left: "왼쪽 ",
        right: "오른쪽 ",
        orangeBall: "주황 공",
        redBall: "빨간 공",
        loading: "MediaPipe와 공 인식을 준비하고 있습니다.",
        frameGuide: "화면 안에 몸과 공이 모두 보이도록 맞춰 주세요.",
        pointPrefix: "인식 중: ",
        waitingBoth: "관절과 공을 찾는 중입니다.",
        waitingPlayer: "공은 감지됐지만 사람을 찾는 중입니다.",
        waitingPlayerBall: "사람과 공을 찾는 중입니다.",
        preparingModel: "MediaPipe와 공 인식 모델을 준비하고 있습니다.",
        startingCamera: "카메라를 시작하는 중입니다.",
        cameraConnected: "카메라 연결 완료. 자세와 공을 분석하고 있습니다.",
        frontCameraConnected: "앞 카메라 연결 완료. 자세와 공을 분석하고 있습니다.",
        rearCameraConnected: "뒤 카메라 연결 완료. 자세와 공을 분석하고 있습니다.",
        switchingFrontCamera: "앞 카메라로 전환하는 중입니다.",
        switchingRearCamera: "뒤 카메라로 전환하는 중입니다.",
        frontCameraUnavailable: "앞 카메라를 전환하지 못했습니다.",
        rearCameraUnavailable: "뒤 카메라를 전환하지 못했습니다.",
        switchCameraFailed: "카메라를 전환하지 못했습니다.",
        unsupportedCamera: "이 브라우저는 카메라 연결을 지원하지 않습니다.",
        startFailed: "분석을 시작하지 못했습니다."
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
      let wasBallBelowKnee = false;
      let dribbleBounceLocked = false;
      let highestBounceY = null;
      let lowestBounceY = null;
      let lastBounceHand = "unknown";
      let lastDribbleBounceAtMs = null;
      let previousDribbleIntervalMs = null;
      let dribbleRhythmGoodCount = 0;
      let dribbleRhythmBadCount = 0;
      let shootLowestLegAngle = null;
      let shootLowestLegAngleAtMs = null;
      let shootHeadPeakY = null;
      let shootLatestControlledBallY = null;
      let shootLatestControlledHeadY = null;
      let shootReleaseDetected = false;
      let shootReleaseTiming = "unknown";
      let shootReleasePointY = null;
      let shootReleasePointState = "unknown";
      let shootReleaseDurationMs = null;
      let shootReleaseDurationState = "unknown";
      let shootPreviousLegAngle = null;
      let shootPreviousLegAngleAtMs = null;
      let shootKneeExtensionAtMs = null;
      let shootPreviousArmAngle = null;
      let shootPreviousArmAngleAtMs = null;
      let shootPreviousBallHandDistance = null;
      let shootBallNearHandAtMs = null;
      let shootArmExtensionAtMs = null;
      let shootReleaseDetectedAtMs = null;
      let shootSuccessCircleDetected = false;
      let shootSuccessCircleStableFrameCount = 0;
      let shootSuccessCircleEventPending = false;
      let trackedBall = null;
      let trackedBallMissingFrames = 0;
      let previousBallMotionLuminanceMap = null;
      let previousBallMotionRegion = null;
      let previousBallMotionWidth = 0;
      let previousBallMotionHeight = 0;
      let cameraStreamStopped = false;
      let currentCameraFacingMode = "user";
      let isSwitchingCamera = false;
      let isRenderLoopRunning = false;
      let dragStartX = null;
      let dragStartY = null;
      let dragTriggered = false;
      let lastProcessingErrorMessage = "";
      let lastProcessingErrorAt = 0;

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
        wasBallBelowKnee = false;
        dribbleBounceLocked = false;
        highestBounceY = null;
        lowestBounceY = null;
        lastBounceHand = "unknown";
        lastDribbleBounceAtMs = null;
        previousDribbleIntervalMs = null;
        dribbleRhythmGoodCount = 0;
        dribbleRhythmBadCount = 0;
      }

      function resetShootTracking() {
        previousHipY = null;
        shootLowestLegAngle = null;
        shootLowestLegAngleAtMs = null;
        shootHeadPeakY = null;
        shootLatestControlledBallY = null;
        shootLatestControlledHeadY = null;
        shootReleaseDetected = false;
        shootReleaseTiming = "unknown";
        shootReleasePointY = null;
        shootReleasePointState = "unknown";
        shootReleaseDurationMs = null;
        shootReleaseDurationState = "unknown";
        shootPreviousLegAngle = null;
        shootPreviousLegAngleAtMs = null;
        shootKneeExtensionAtMs = null;
        shootPreviousArmAngle = null;
        shootPreviousArmAngleAtMs = null;
        shootPreviousBallHandDistance = null;
        shootBallNearHandAtMs = null;
        shootArmExtensionAtMs = null;
        shootReleaseDetectedAtMs = null;
        shootSuccessCircleDetected = false;
        shootSuccessCircleStableFrameCount = 0;
        shootSuccessCircleEventPending = false;
      }

      function resetBallTracking() {
        trackedBall = null;
        trackedBallMissingFrames = 0;
        previousBallMotionLuminanceMap = null;
        previousBallMotionRegion = null;
        previousBallMotionWidth = 0;
        previousBallMotionHeight = 0;
      }

      function resetAnalysisSummaries() {
        lastVideoTime = -1;
        lastPointSummary = "";
        lastDribbleSummary = "";
        lastShootSummary = "";
        lastSentAt = 0;
      }

      function reportProcessingError(scope, error) {
        const message =
          error instanceof Error && error.message
            ? error.message
            : typeof error === "string"
              ? error
              : "unknown_processing_error";
        const now = Date.now();

        if (message !== lastProcessingErrorMessage || now - lastProcessingErrorAt > 2000) {
          console.error("[lesson-camera:" + scope + "]", error);
          lastProcessingErrorMessage = message;
          lastProcessingErrorAt = now;
        }
      }

      function stopActiveVideoStream() {
        const activeStream = video.srcObject;
        if (!activeStream) {
          return;
        }

        activeStream.getTracks().forEach((track) => track.stop());
        video.srcObject = null;
      }

      function disconnectCameraStream() {
        if (cameraStreamStopped) {
          return;
        }

        cameraStreamStopped = true;
        stopActiveVideoStream();
        stopComposedStream();

        setHud("카메라 연결을 종료했습니다.");
      }

      function stopComposedStream() {
        if (!composedStream) {
          return;
        }

        composedStream.getTracks().forEach((track) => track.stop());
        composedStream = null;
      }

      function ensureComposedStream() {
        if (typeof MediaRecorder === "undefined") {
          return null;
        }

        if (!composedStream) {
          composedStream = canvas.captureStream(30);
        }

        return composedStream;
      }

      function finalizeRecording() {
        if (recorderChunks.length === 0) {
          recorder = null;
          stopComposedStream();
          post({ type: "recording_error", message: "No recorded video data was found." });
          return;
        }

        const blob = new Blob(recorderChunks, {
          type: recorder?.mimeType || "video/webm"
        });
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = typeof reader.result === "string" ? reader.result : "";
          if (!result) {
            recorder = null;
            stopComposedStream();
            post({ type: "recording_error", message: "Failed to encode the recorded video." });
            return;
          }

          recorder = null;
          stopComposedStream();
          post({ type: "recording_ready", videoUri: result });
        };
        reader.onerror = () => {
          recorder = null;
          stopComposedStream();
          post({ type: "recording_error", message: "An error occurred while reading the recorded video file." });
        };
        reader.readAsDataURL(blob);
      }

      function startRecorder() {
        const activeComposedStream = ensureComposedStream();
        if (!activeComposedStream || typeof MediaRecorder === "undefined") {
          return;
        }

        const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")
          ? "video/webm;codecs=vp8,opus"
          : MediaRecorder.isTypeSupported("video/webm")
            ? "video/webm"
            : "";

        recorder = mimeType
          ? new MediaRecorder(activeComposedStream, { mimeType })
          : new MediaRecorder(activeComposedStream);
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
          post({ type: "recording_error", message: "An error occurred while recording the lesson video." });
        };
        resetDribbleTracking();
        resetShootTracking();
        resetBallTracking();
        recorder.start(1000);
        post({ type: "recording_started" });
      }

      function restartRecordingFromCue() {
        if (typeof MediaRecorder === "undefined") {
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
          post({ type: "recording_error", message: "녹화 중이 아니라 종료 영상을 저장하지 못했습니다." });
          return;
        }

        recorderStopping = true;
        recorder.stop();
      }

      function stopRecordingAndDisconnectCamera() {
        if (!recorder || recorder.state === "inactive") {
          disconnectCameraStream();
          post({ type: "recording_error", message: "녹화 중이 아니라 종료 영상을 저장하지 못했습니다." });
          return;
        }

        recorderStopping = true;
        recorder.stop();
        disconnectCameraStream();
      }

      window.__codexRestartRecordingFromCue = restartRecordingFromCue;
      window.__codexStopRecordingForReview = stopRecordingForReview;
      window.__codexStopRecordingAndDisconnectCamera = stopRecordingAndDisconnectCamera;
      window.__codexResetDribbleTracking = resetDribbleTracking;
      window.__codexResetShootTracking = resetShootTracking;
      window.__codexResetBallTracking = resetBallTracking;

      function setHud(text) {
        hud.textContent = text;
      }

      function resizeCanvas() {
        const width = video.videoWidth || window.innerWidth;
        const height = video.videoHeight || window.innerHeight;
        canvas.width = width;
        canvas.height = height;
      }

      function isFrontCameraActive() {
        return currentCameraFacingMode === "user";
      }

      function normalizeFacingMode(value) {
        return value === "user" || value === "environment" ? value : null;
      }

      function inferFacingModeFromStream(stream, fallbackFacingMode = currentCameraFacingMode) {
        const track = stream && stream.getVideoTracks ? stream.getVideoTracks()[0] : null;

        if (!track) {
          return fallbackFacingMode;
        }

        const settingsFacingMode =
          track.getSettings && typeof track.getSettings === "function"
            ? normalizeFacingMode(track.getSettings().facingMode)
            : null;

        if (settingsFacingMode) {
          return settingsFacingMode;
        }

        const label = track.label || "";

        if (REAR_CAMERA_LABEL_PATTERN.test(label)) {
          return "environment";
        }

        if (FRONT_CAMERA_LABEL_PATTERN.test(label)) {
          return "user";
        }

        return fallbackFacingMode;
      }

      function updateVideoPresentation() {
        video.style.transform = isFrontCameraActive() ? "scaleX(-1)" : "none";
      }

      function getCameraConnectedMessage(facingMode = currentCameraFacingMode) {
        return facingMode === "environment" ? UI.rearCameraConnected : UI.frontCameraConnected;
      }

      function getCameraSwitchingMessage(facingMode) {
        return facingMode === "environment" ? UI.switchingRearCamera : UI.switchingFrontCamera;
      }

      function projectX(x) {
        return (isFrontCameraActive() ? 1 - x : x) * canvas.width;
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

      function averageVisiblePoints(points) {
        const visiblePoints = points.filter(visible);
        if (visiblePoints.length === 0) {
          return null;
        }

        const total = visiblePoints.reduce(
          (acc, point) => ({
            x: acc.x + point.x,
            y: acc.y + point.y,
            visibility: Math.min(acc.visibility, point.visibility ?? 1)
          }),
          { x: 0, y: 0, visibility: 1 }
        );

        return {
          x: total.x / visiblePoints.length,
          y: total.y / visiblePoints.length,
          visibility: total.visibility
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

      function matchesLearnedHueRange(hue, range) {
        if (!range) {
          return false;
        }

        if (range.min <= range.max) {
          return hue >= range.min && hue <= range.max;
        }

        return hue >= range.min || hue <= range.max;
      }

      function matchesLearnedBand(h, s, v, band) {
        if (!band) {
          return false;
        }

        const saturationRange = band.saturationRange || { min: 0, max: 1 };
        const valueRange = band.valueRange || { min: 0, max: 1 };

        if (s < saturationRange.min || s > saturationRange.max || v < valueRange.min || v > valueRange.max) {
          return false;
        }

        if (band.color === "white" || band.color === "black" || band.color === "gray") {
          return true;
        }

        return Array.isArray(band.hueRanges) && band.hueRanges.some((range) => matchesLearnedHueRange(h, range));
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

        const learnedOrange = allowOrange ? learnedBandByColor.get("orange") : null;
        if (learnedOrange && matchesLearnedBand(h, s, v, learnedOrange)) {
          return 1;
        }

        const learnedBrown = allowBrown ? learnedBandByColor.get("brown") : null;
        if (learnedBrown && matchesLearnedBand(h, s, v, learnedBrown)) {
          return 1;
        }

        const learnedYellow = allowYellow ? learnedBandByColor.get("yellow") : null;
        if (learnedYellow && matchesLearnedBand(h, s, v, learnedYellow)) {
          return 1;
        }

        const learnedRed = allowRed ? learnedBandByColor.get("red") : null;
        if (learnedRed && matchesLearnedBand(h, s, v, learnedRed)) {
          return 2;
        }

        const learnedWhite = allowWhite ? learnedBandByColor.get("white") : null;
        if (learnedWhite && matchesLearnedBand(h, s, v, learnedWhite)) {
          return 1;
        }

        const learnedBlack = allowBlack ? learnedBandByColor.get("black") : null;
        if (learnedBlack && matchesLearnedBand(h, s, v, learnedBlack)) {
          return 1;
        }

        const learnedGray = allowGray ? learnedBandByColor.get("gray") : null;
        if (learnedGray && matchesLearnedBand(h, s, v, learnedGray)) {
          return 1;
        }

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
            minAspectRatio: 0.8,
            maxAspectRatio: 1.2,
            minFillRatio: 0.28,
            minCircleCoverage: 0.18,
            maxCircleCoverage: 1.38,
            minCircleMatch: 0.72,
            minOutlineMatch: 0.54
          };
        }

        if (selectedBallBrand === "wilson") {
          return {
            mergeColors: true,
            dilationRadius: 1,
            minPixels: 28,
            minAspectRatio: 0.82,
            maxAspectRatio: 1.18,
            minFillRatio: 0.3,
            minCircleCoverage: 0.2,
            maxCircleCoverage: 1.34,
            minCircleMatch: 0.74,
            minOutlineMatch: 0.58
          };
        }

        return {
          mergeColors: true,
          dilationRadius: 1,
          minPixels: 26,
          minAspectRatio: 0.81,
          maxAspectRatio: 1.19,
          minFillRatio: 0.3,
          minCircleCoverage: 0.2,
          maxCircleCoverage: 1.34,
          minCircleMatch: 0.73,
          minOutlineMatch: 0.57
        };
      }

      function clamp01(value) {
        return Math.min(1, Math.max(0, value));
      }

      function getTrackedBallSearchRadius(ball) {
        if (!ball) {
          return BALL_TRACK_MIN_SEARCH_RADIUS;
        }

        return Math.max(
          BALL_TRACK_MIN_SEARCH_RADIUS,
          Math.min(BALL_TRACK_MAX_SEARCH_RADIUS, ball.radius * BALL_TRACK_RADIUS_MULTIPLIER)
        );
      }

      function getVisiblePoints(points) {
        return points.filter(visible);
      }

      function getBoundingBox(points, paddingX = 0, paddingY = paddingX) {
        const visiblePoints = getVisiblePoints(points);

        if (visiblePoints.length === 0) {
          return null;
        }

        let minX = 1;
        let minY = 1;
        let maxX = 0;
        let maxY = 0;

        for (const point of visiblePoints) {
          minX = Math.min(minX, point.x);
          minY = Math.min(minY, point.y);
          maxX = Math.max(maxX, point.x);
          maxY = Math.max(maxY, point.y);
        }

        return {
          minX: clamp01(minX - paddingX),
          minY: clamp01(minY - paddingY),
          maxX: clamp01(maxX + paddingX),
          maxY: clamp01(maxY + paddingY)
        };
      }

      function mergeBoxes(...boxes) {
        const validBoxes = boxes.filter(Boolean);

        if (validBoxes.length === 0) {
          return null;
        }

        let minX = 1;
        let minY = 1;
        let maxX = 0;
        let maxY = 0;

        for (const box of validBoxes) {
          minX = Math.min(minX, box.minX);
          minY = Math.min(minY, box.minY);
          maxX = Math.max(maxX, box.maxX);
          maxY = Math.max(maxY, box.maxY);
        }

        return {
          minX: clamp01(minX),
          minY: clamp01(minY),
          maxX: clamp01(maxX),
          maxY: clamp01(maxY)
        };
      }

      function createTrackedBallBox(ball) {
        if (!ball) {
          return null;
        }

        const radius = Math.max(BALL_DETECTION_TRACKED_MIN_RADIUS, ball.radius * (BALL_TRACK_RADIUS_MULTIPLIER + BALL_DETECTION_TRACKED_PADDING));

        return {
          minX: clamp01(ball.x - radius),
          minY: clamp01(ball.y - radius),
          maxX: clamp01(ball.x + radius),
          maxY: clamp01(ball.y + radius)
        };
      }

      function createSquareBox(box, minSide, paddingRatio) {
        if (!box) {
          return null;
        }

        const width = Math.max(0.001, box.maxX - box.minX);
        const height = Math.max(0.001, box.maxY - box.minY);
        const side = Math.min(1, Math.max(Math.max(width, height) * (1 + paddingRatio * 2), minSide));
        const centerX = (box.minX + box.maxX) / 2;
        const centerY = (box.minY + box.maxY) / 2;
        let minX = centerX - side / 2;
        let maxX = centerX + side / 2;
        let minY = centerY - side / 2;
        let maxY = centerY + side / 2;

        if (minX < 0) {
          maxX = Math.min(1, maxX - minX);
          minX = 0;
        }

        if (maxX > 1) {
          minX = Math.max(0, minX - (maxX - 1));
          maxX = 1;
        }

        if (minY < 0) {
          maxY = Math.min(1, maxY - minY);
          minY = 0;
        }

        if (maxY > 1) {
          minY = Math.max(0, minY - (maxY - 1));
          maxY = 1;
        }

        return {
          minX: clamp01(minX),
          minY: clamp01(minY),
          maxX: clamp01(maxX),
          maxY: clamp01(maxY)
        };
      }

      function getBallDetectionRegion(landmarks) {
        const trackedBallBox = createTrackedBallBox(trackedBall);

        if (!landmarks) {
          if (!trackedBallBox) {
            return {
              minX: 0,
              minY: 0,
              maxX: 1,
              maxY: 1,
              width: BALL_DETECTION_FULL_WIDTH,
              height: BALL_DETECTION_FULL_HEIGHT,
              focused: false
            };
          }

          const focusedTrackedBox = createSquareBox(trackedBallBox, BALL_DETECTION_MIN_ROI_SIDE, 0.08);
          return {
            ...focusedTrackedBox,
            width: lessonMode === "shoot" ? BALL_DETECTION_SHOOT_FOCUSED_SIZE : BALL_DETECTION_DRIBBLE_FOCUSED_SIZE,
            height: lessonMode === "shoot" ? BALL_DETECTION_SHOOT_FOCUSED_SIZE : BALL_DETECTION_DRIBBLE_FOCUSED_SIZE,
            focused: true
          };
        }

        const bodyBox =
          lessonMode === "shoot"
            ? getBoundingBox(
                [
                  landmarks[INDEX.nose],
                  landmarks[INDEX.leftShoulder],
                  landmarks[INDEX.rightShoulder],
                  landmarks[INDEX.leftElbow],
                  landmarks[INDEX.rightElbow],
                  landmarks[INDEX.leftWrist],
                  landmarks[INDEX.rightWrist],
                  landmarks[INDEX.leftHip],
                  landmarks[INDEX.rightHip],
                  landmarks[INDEX.leftKnee],
                  landmarks[INDEX.rightKnee]
                ],
                0.04,
                0.04
              )
            : mergeBoxes(
                getBoundingBox(
                  [
                    landmarks[INDEX.leftElbow],
                    landmarks[INDEX.rightElbow],
                    landmarks[INDEX.leftWrist],
                    landmarks[INDEX.rightWrist]
                  ],
                  0.03,
                  0.1
                ),
                getBoundingBox(
                  [
                    landmarks[INDEX.leftShoulder],
                    landmarks[INDEX.rightShoulder],
                    landmarks[INDEX.leftHip],
                    landmarks[INDEX.rightHip]
                  ],
                  0.03,
                  0.05
                ),
                getBoundingBox(
                  [
                    landmarks[INDEX.leftHip],
                    landmarks[INDEX.rightHip],
                    landmarks[INDEX.leftKnee],
                    landmarks[INDEX.rightKnee],
                    landmarks[INDEX.leftAnkle],
                    landmarks[INDEX.rightAnkle]
                  ],
                  0.03,
                  0.03
                )
              );
        const dribbleWristPriorityBox =
          lessonMode === "dribble"
            ? mergeBoxes(
                getBoundingBox(
                  [
                    landmarks[INDEX.leftElbow],
                    landmarks[INDEX.rightElbow],
                    landmarks[INDEX.leftWrist],
                    landmarks[INDEX.rightWrist]
                  ],
                  0.03,
                  0.12
                ),
                getBoundingBox(
                  [
                    landmarks[INDEX.leftShoulder],
                    landmarks[INDEX.rightShoulder],
                    landmarks[INDEX.leftHip],
                    landmarks[INDEX.rightHip]
                  ],
                  0.03,
                  0.05
                ),
                getBoundingBox(
                  [
                    landmarks[INDEX.leftHip],
                    landmarks[INDEX.rightHip],
                    landmarks[INDEX.leftKnee],
                    landmarks[INDEX.rightKnee],
                    landmarks[INDEX.leftAnkle],
                    landmarks[INDEX.rightAnkle]
                  ],
                  0.03,
                  0.03
                ),
                trackedBallBox
              )
            : null;
        const shootWristPriorityBox =
          lessonMode === "shoot"
            ? mergeBoxes(
                getBoundingBox(
                  [
                    landmarks[INDEX.nose],
                    landmarks[INDEX.leftShoulder],
                    landmarks[INDEX.rightShoulder],
                    landmarks[INDEX.leftElbow],
                    landmarks[INDEX.rightElbow],
                    landmarks[INDEX.leftWrist],
                    landmarks[INDEX.rightWrist]
                  ],
                  0.04,
                  0.14
                ),
                getBoundingBox(
                  [
                    landmarks[INDEX.leftShoulder],
                    landmarks[INDEX.rightShoulder],
                    landmarks[INDEX.leftHip],
                    landmarks[INDEX.rightHip]
                  ],
                  0.03,
                  0.06
                ),
                trackedBallBox
              )
            : null;
        const mergedBox = mergeBoxes(
          lessonMode === "shoot" && shootWristPriorityBox
            ? shootWristPriorityBox
            : lessonMode === "dribble" && dribbleWristPriorityBox
              ? dribbleWristPriorityBox
              : bodyBox,
          trackedBallBox
        );
        const minSide = lessonMode === "shoot" ? BALL_DETECTION_SHOOT_MIN_ROI_SIDE : BALL_DETECTION_MIN_ROI_SIDE;
        const focusedBox = createSquareBox(
          mergedBox,
          lessonMode === "shoot" && shootWristPriorityBox
            ? BALL_DETECTION_SHOOT_WRIST_MIN_ROI_SIDE
            : lessonMode === "dribble" && dribbleWristPriorityBox
            ? BALL_DETECTION_DRIBBLE_WRIST_MIN_ROI_SIDE
            : minSide,
          lessonMode === "shoot"
            ? lessonMode === "shoot" && shootWristPriorityBox
              ? BALL_DETECTION_SHOOT_WRIST_ROI_PADDING
              : BALL_DETECTION_ROI_PADDING
            : lessonMode === "dribble" && dribbleWristPriorityBox
              ? BALL_DETECTION_DRIBBLE_WRIST_ROI_PADDING
              : BALL_DETECTION_DRIBBLE_ROI_PADDING
        );

        if (!focusedBox) {
          return {
            minX: 0,
            minY: 0,
            maxX: 1,
            maxY: 1,
            width: BALL_DETECTION_FULL_WIDTH,
            height: BALL_DETECTION_FULL_HEIGHT,
            focused: false
          };
        }

        return {
          ...focusedBox,
          width: lessonMode === "shoot" ? BALL_DETECTION_SHOOT_FOCUSED_SIZE : BALL_DETECTION_DRIBBLE_FOCUSED_SIZE,
          height: lessonMode === "shoot" ? BALL_DETECTION_SHOOT_FOCUSED_SIZE : BALL_DETECTION_DRIBBLE_FOCUSED_SIZE,
          focused: true
        };
      }

      function isInsideBox(point, box) {
        if (!point || !box) {
          return false;
        }

        return (
          point.x >= box.minX &&
          point.x <= box.maxX &&
          point.y >= box.minY &&
          point.y <= box.maxY
        );
      }

      function getMinDistanceToPoints(candidate, points) {
        const visiblePoints = getVisiblePoints(points);

        if (visiblePoints.length === 0) {
          return null;
        }

        let minDistance = Infinity;

        for (const point of visiblePoints) {
          minDistance = Math.min(minDistance, distanceBetween(candidate, point));
        }

        return Number.isFinite(minDistance) ? minDistance : null;
      }

      function calculateCircleMatchRatio(componentPixels, width, minX, minY, maxX, maxY, centerX, centerY, radiusPx) {
        if (!componentPixels.length || radiusPx <= 0) {
          return 0;
        }

        const componentPixelSet = new Set(componentPixels);
        const radiusSquared = radiusPx * radiusPx;
        let intersectionCount = 0;
        let unionCount = 0;

        for (let y = minY; y <= maxY; y += 1) {
          for (let x = minX; x <= maxX; x += 1) {
            const index = y * width + x;
            const inComponent = componentPixelSet.has(index);
            const dx = x + 0.5 - centerX;
            const dy = y + 0.5 - centerY;
            const inIdealCircle = dx * dx + dy * dy <= radiusSquared;

            if (inComponent || inIdealCircle) {
              unionCount += 1;
            }

            if (inComponent && inIdealCircle) {
              intersectionCount += 1;
            }
          }
        }

        return unionCount > 0 ? intersectionCount / unionCount : 0;
      }

      function calculateCircleOutlineMetrics(componentPixels, width, height, centerX, centerY, radiusPx) {
        if (!componentPixels.length || radiusPx <= 0) {
          return {
            outlineMatchRatio: 0,
            arcCoverageRatio: 0,
            radialConsistencyRatio: 0,
          };
        }

        const componentPixelSet = new Set(componentPixels);
        const angleBins = new Uint8Array(BALL_TRACK_OUTLINE_BIN_COUNT);
        const minRadius = radiusPx * BALL_TRACK_OUTLINE_INNER_RADIUS_RATIO;
        const maxRadius = radiusPx * BALL_TRACK_OUTLINE_OUTER_RADIUS_RATIO;
        let boundaryPixelCount = 0;
        let alignedBoundaryCount = 0;

        for (const index of componentPixels) {
          const x = index % width;
          const y = Math.floor(index / width);
          const neighbors = [index - 1, index + 1, index - width, index + width];
          let isBoundary = false;

          for (const neighbor of neighbors) {
            if (neighbor < 0 || neighbor >= width * height) {
              isBoundary = true;
              break;
            }

            const neighborX = neighbor % width;
            if (Math.abs(neighborX - x) > 1 || !componentPixelSet.has(neighbor)) {
              isBoundary = true;
              break;
            }
          }

          if (!isBoundary) {
            continue;
          }

          boundaryPixelCount += 1;
          const dx = x + 0.5 - centerX;
          const dy = y + 0.5 - centerY;
          const distance = Math.hypot(dx, dy);

          if (distance < minRadius || distance > maxRadius) {
            continue;
          }

          alignedBoundaryCount += 1;
          const angle = Math.atan2(dy, dx);
          const normalizedAngle = angle < 0 ? angle + Math.PI * 2 : angle;
          const angleBin = Math.min(
            BALL_TRACK_OUTLINE_BIN_COUNT - 1,
            Math.floor((normalizedAngle / (Math.PI * 2)) * BALL_TRACK_OUTLINE_BIN_COUNT)
          );
          angleBins[angleBin] = 1;
        }

        const arcCoverageRatio = countPositive(angleBins) / BALL_TRACK_OUTLINE_BIN_COUNT;
        const radialConsistencyRatio = boundaryPixelCount > 0 ? alignedBoundaryCount / boundaryPixelCount : 0;

        return {
          outlineMatchRatio: arcCoverageRatio * 0.68 + radialConsistencyRatio * 0.32,
          arcCoverageRatio,
          radialConsistencyRatio,
        };
      }

      function clampNumber(value, min, max) {
        return Math.min(max, Math.max(min, value));
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

      function countPositive(values) {
        let count = 0;

        for (let index = 0; index < values.length; index += 1) {
          if (values[index] > 0) {
            count += 1;
          }
        }

        return count;
      }

      function getRegionCenter(region) {
        return {
          x: (region.minX + region.maxX) / 2,
          y: (region.minY + region.maxY) / 2,
        };
      }

      function getRegionArea(region) {
        return Math.max(0, region.maxX - region.minX) * Math.max(0, region.maxY - region.minY);
      }

      function buildBallMotionMaps(data, width, height, region) {
        const luminanceMap = new Float32Array(width * height);
        let motionMap = null;

        if (
          previousBallMotionLuminanceMap &&
          previousBallMotionWidth === width &&
          previousBallMotionHeight === height &&
          previousBallMotionRegion
        ) {
          const previousCenter = getRegionCenter(previousBallMotionRegion);
          const currentCenter = getRegionCenter(region);
          const centerShift = Math.hypot(currentCenter.x - previousCenter.x, currentCenter.y - previousCenter.y);
          const previousArea = getRegionArea(previousBallMotionRegion);
          const currentArea = getRegionArea(region);
          const areaRatio = previousArea > 0 ? currentArea / previousArea : 1;

          if (
            centerShift <= BALL_TRACK_MOTION_REGION_SHIFT_MAX &&
            areaRatio >= BALL_TRACK_MOTION_REGION_AREA_MIN_RATIO &&
            areaRatio <= BALL_TRACK_MOTION_REGION_AREA_MAX_RATIO
          ) {
            motionMap = new Uint8Array(width * height);
          }
        }

        let motionCount = 0;

        for (let index = 0; index < width * height; index += 1) {
          const offset = index * 4;
          const luminance = (data[offset] * 0.299 + data[offset + 1] * 0.587 + data[offset + 2] * 0.114) / 255;
          luminanceMap[index] = luminance;

          if (
            motionMap &&
            Math.abs(luminance - previousBallMotionLuminanceMap[index]) >= BALL_TRACK_MOTION_THRESHOLD
          ) {
            motionMap[index] = 1;
            motionCount += 1;
          }
        }

        const globalMotionRatio = motionMap ? motionCount / (width * height) : 0;
        const motionReliable =
          Boolean(motionMap) &&
          globalMotionRatio >= BALL_TRACK_MOTION_GLOBAL_MIN_RATIO &&
          globalMotionRatio <= BALL_TRACK_MOTION_GLOBAL_MAX_RATIO;

        previousBallMotionLuminanceMap = luminanceMap;
        previousBallMotionWidth = width;
        previousBallMotionHeight = height;
        previousBallMotionRegion = {
          minX: region.minX,
          minY: region.minY,
          maxX: region.maxX,
          maxY: region.maxY,
        };

        return {
          luminanceMap,
          motionMap: motionReliable ? motionMap : null,
          globalMotionRatio,
          motionReliable,
        };
      }

      function buildBallPatternMaps(luminanceMap, width, height) {

        const gradientMap = new Float32Array(width * height);

        for (let y = 1; y < height - 1; y += 1) {
          for (let x = 1; x < width - 1; x += 1) {
            const index = y * width + x;
            gradientMap[index] = clampNumber(
              Math.abs(luminanceMap[index + 1] - luminanceMap[index - 1]) +
                Math.abs(luminanceMap[index + width] - luminanceMap[index - width]),
              0,
              1
            );
          }
        }

        return {
          luminanceMap,
          gradientMap,
        };
      }

      function addMotionSupportToMergedMap(mergedMap, colorMap, motionMap, width, height) {
        if (!motionMap) {
          return;
        }

        for (let index = 0; index < motionMap.length; index += 1) {
          if (motionMap[index] === 0 || mergedMap[index] !== 0) {
            continue;
          }

          const x = index % width;
          const y = Math.floor(index / width);
          let linkedToColor = false;

          for (
            let offsetY = -BALL_TRACK_MOTION_LINK_RADIUS;
            offsetY <= BALL_TRACK_MOTION_LINK_RADIUS && !linkedToColor;
            offsetY += 1
          ) {
            for (let offsetX = -BALL_TRACK_MOTION_LINK_RADIUS; offsetX <= BALL_TRACK_MOTION_LINK_RADIUS; offsetX += 1) {
              const nextX = x + offsetX;
              const nextY = y + offsetY;

              if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height) {
                continue;
              }

              if (colorMap[nextY * width + nextX] !== 0) {
                linkedToColor = true;
                break;
              }
            }
          }

          if (linkedToColor) {
            mergedMap[index] = 1;
          }
        }
      }

      function calculateComponentMapHitRatio(componentPixels, supportMap) {
        if (!supportMap || !componentPixels.length) {
          return null;
        }

        let hitCount = 0;

        for (const index of componentPixels) {
          if (supportMap[index] > 0) {
            hitCount += 1;
          }
        }

        return hitCount / componentPixels.length;
      }

      function calculateBallPatternMetrics(luminanceMap, gradientMap, width, height, centerX, centerY, radiusPx) {
        if (!shouldUseBallPatternMatch || selectedBallPatternProfiles.length === 0 || radiusPx < BALL_TRACK_PATTERN_MIN_RADIUS_PX) {
          return null;
        }

        const radius = radiusPx * 0.82;
        const radiusSquared = radius * radius;
        const minX = Math.max(1, Math.floor(centerX - radius));
        const maxX = Math.min(width - 2, Math.ceil(centerX + radius));
        const minY = Math.max(1, Math.floor(centerY - radius));
        const maxY = Math.min(height - 2, Math.ceil(centerY + radius));

        if (minX >= maxX || minY >= maxY) {
          return null;
        }

        const activeRows = new Uint8Array(maxY - minY + 1);
        const activeColumns = new Uint8Array(maxX - minX + 1);
        const seamRows = new Uint8Array(maxY - minY + 1);
        const seamColumns = new Uint8Array(maxX - minX + 1);
        const luminances = [];
        const gradients = [];
        const sampleIndices = [];

        for (let y = minY; y <= maxY; y += 1) {
          for (let x = minX; x <= maxX; x += 1) {
            const dx = x + 0.5 - centerX;
            const dy = y + 0.5 - centerY;
            if (dx * dx + dy * dy > radiusSquared) {
              continue;
            }

            const index = y * width + x;
            sampleIndices.push(index);
            luminances.push(luminanceMap[index]);
            gradients.push(gradientMap[index]);
            activeRows[y - minY] = 1;
            activeColumns[x - minX] = 1;
          }
        }

        if (sampleIndices.length < 48) {
          return null;
        }

        const edgeThreshold = Math.max(0.05, percentile(gradients, 0.82));
        const darkThreshold = Math.min(0.62, percentile(luminances, 0.38) + 0.06);
        let seamCount = 0;
        let edgeCount = 0;

        for (const index of sampleIndices) {
          const x = index % width;
          const y = Math.floor(index / width);
          const gradient = gradientMap[index];
          if (gradient >= edgeThreshold) {
            edgeCount += 1;
          }

          if (gradient >= edgeThreshold && luminanceMap[index] <= darkThreshold) {
            seamCount += 1;
            seamRows[y - minY] = 1;
            seamColumns[x - minX] = 1;
          }
        }

        if (seamCount < Math.max(3, Math.round(sampleIndices.length * 0.008))) {
          return null;
        }

        const activeRowCount = countPositive(activeRows);
        const activeColumnCount = countPositive(activeColumns);

        return {
          panelLineRatio: seamCount / sampleIndices.length,
          edgeDensity: edgeCount / sampleIndices.length,
          rowCoverage: activeRowCount > 0 ? countPositive(seamRows) / activeRowCount : 0,
          columnCoverage: activeColumnCount > 0 ? countPositive(seamColumns) / activeColumnCount : 0,
        };
      }

      function getRangeMatchScore(value, range, minimumTolerance) {
        if (!range || typeof value !== "number") {
          return 0;
        }

        if (value >= range.min && value <= range.max) {
          return 1;
        }

        const tolerance = Math.max(minimumTolerance, Math.abs(range.max - range.min));
        if (value < range.min) {
          return Math.max(0, 1 - (range.min - value) / tolerance);
        }

        return Math.max(0, 1 - (value - range.max) / tolerance);
      }

      function getPatternProfileMatchScore(metrics, patternProfile) {
        if (!metrics || !patternProfile) {
          return null;
        }

        const scores = [
          getRangeMatchScore(metrics.panelLineRatio, patternProfile.panelLineRatioRange, 0.02),
          getRangeMatchScore(metrics.edgeDensity, patternProfile.edgeDensityRange, 0.06),
          getRangeMatchScore(metrics.rowCoverage, patternProfile.rowCoverageRange, 0.08),
          getRangeMatchScore(metrics.columnCoverage, patternProfile.columnCoverageRange, 0.08),
        ];

        return scores.reduce((sum, value) => sum + value, 0) / scores.length;
      }

      function getPatternProfileOrientation(patternProfile) {
        if (!patternProfile) {
          return "mixed";
        }

        if (patternProfile.orientation === "vertical" || patternProfile.orientation === "horizontal" || patternProfile.orientation === "mixed") {
          return patternProfile.orientation;
        }

        const rowMid = (patternProfile.rowCoverageRange.min + patternProfile.rowCoverageRange.max) / 2;
        const columnMid = (patternProfile.columnCoverageRange.min + patternProfile.columnCoverageRange.max) / 2;
        const coverageDelta = columnMid - rowMid;

        if (coverageDelta >= 0.12) {
          return "vertical";
        }

        if (coverageDelta <= -0.12) {
          return "horizontal";
        }

        return "mixed";
      }

      function getBestPatternMatchFromProfiles(metrics, patternProfiles) {
        if (!metrics || !Array.isArray(patternProfiles) || patternProfiles.length === 0) {
          return null;
        }

        let bestMatchScore = null;
        let bestWeight = 1;

        for (const patternProfile of patternProfiles) {
          const patternMatchScore = getPatternProfileMatchScore(metrics, patternProfile);
          if (typeof patternMatchScore !== "number") {
            continue;
          }

          const nextWeight = patternProfile.weight || 1;

          if (
            bestMatchScore === null ||
            patternMatchScore > bestMatchScore ||
            (patternMatchScore === bestMatchScore && nextWeight > bestWeight)
          ) {
            bestMatchScore = patternMatchScore;
            bestWeight = nextWeight;
          }
        }

        if (bestMatchScore === null) {
          return null;
        }

        return {
          matchScore: bestMatchScore,
          contribution: (bestMatchScore * 2 - 1) * BALL_TRACK_PATTERN_BONUS * bestWeight
        };
      }

      function getBestPatternProfileContribution(metrics, patternProfiles) {
        if (!metrics || !Array.isArray(patternProfiles) || patternProfiles.length === 0) {
          return null;
        }

        const verticalProfiles = [];
        const horizontalProfiles = [];
        const mixedProfiles = [];

        for (const patternProfile of patternProfiles) {
          const orientation = getPatternProfileOrientation(patternProfile);
          if (orientation === "vertical") {
            verticalProfiles.push(patternProfile);
          } else if (orientation === "horizontal") {
            horizontalProfiles.push(patternProfile);
          } else {
            mixedProfiles.push(patternProfile);
          }
        }

        const primaryVerticalLookMatch = getBestPatternMatchFromProfiles(metrics, horizontalProfiles);
        if (primaryVerticalLookMatch && primaryVerticalLookMatch.matchScore >= BALL_TRACK_PATTERN_PRIMARY_MATCH_SCORE) {
          return primaryVerticalLookMatch.contribution;
        }

        const fallbackHorizontalLookMatch = getBestPatternMatchFromProfiles(metrics, verticalProfiles);
        if (fallbackHorizontalLookMatch) {
          return fallbackHorizontalLookMatch.contribution;
        }

        if (primaryVerticalLookMatch) {
          return primaryVerticalLookMatch.contribution;
        }

        const mixedMatch = getBestPatternMatchFromProfiles(metrics, mixedProfiles);
        return mixedMatch ? mixedMatch.contribution : null;
      }

      function getBallCandidateGuidance(landmarks) {
        if (!landmarks) {
          return null;
        }

        const leftShoulder = landmarks[INDEX.leftShoulder];
        const rightShoulder = landmarks[INDEX.rightShoulder];
        const leftHip = landmarks[INDEX.leftHip];
        const rightHip = landmarks[INDEX.rightHip];
        const leftKnee = landmarks[INDEX.leftKnee];
        const rightKnee = landmarks[INDEX.rightKnee];
        const leftAnkle = landmarks[INDEX.leftAnkle];
        const rightAnkle = landmarks[INDEX.rightAnkle];
        const leftWrist = landmarks[INDEX.leftWrist];
        const rightWrist = landmarks[INDEX.rightWrist];
        const head = visible(landmarks[INDEX.nose]) ? landmarks[INDEX.nose] : null;
        const shoulders = getVisiblePoints([leftShoulder, rightShoulder]);
        const hips = getVisiblePoints([leftHip, rightHip]);
        const knees = getVisiblePoints([leftKnee, rightKnee]);
        const ankles = getVisiblePoints([leftAnkle, rightAnkle]);
        const wrists = getVisiblePoints([leftWrist, rightWrist]);
        const shoulderMidY =
          shoulders.length === 2
            ? midpoint(shoulders[0], shoulders[1]).y
            : shoulders.length === 1
              ? shoulders[0].y
              : null;
        const shootingSide = lessonMode === "shoot" ? getShootingSide(landmarks) : null;
        const shootingWrist =
          shootingSide === "left"
            ? (visible(leftWrist) ? leftWrist : null)
            : shootingSide === "right"
              ? (visible(rightWrist) ? rightWrist : null)
              : null;
        const supportWrist =
          shootingSide === "left"
            ? (visible(rightWrist) ? rightWrist : null)
            : shootingSide === "right"
              ? (visible(leftWrist) ? leftWrist : null)
              : null;

        return {
          head,
          knees,
          ankles,
          wrists,
          shootingWrist,
          supportWrist,
          shoulderMidY,
          bodyBox: getBoundingBox([...shoulders, ...hips, ...knees, ...ankles, ...wrists], 0.14, 0.12),
          torsoBox: getBoundingBox([...shoulders, ...hips], 0.07, 0.09)
        };
      }

      function scoreBallCandidate(candidate, lastTrackedBall, guidance) {
        let score = candidate.pixelCount;
        const effectiveCircleMatchRatio = Math.max(candidate.circleMatchRatio, candidate.outlineMatchRatio || 0);

        score += Math.max(0, BALL_TRACK_SHAPE_BONUS - Math.abs(1 - candidate.aspectRatio) * 80);
        score += effectiveCircleMatchRatio * BALL_TRACK_CIRCLE_MATCH_BONUS;
        score += Math.max(0, BALL_TRACK_FILL_RATIO_BONUS - Math.abs(0.52 - candidate.fillRatio) * 120);
        score += Math.max(0, BALL_TRACK_CIRCLE_COVERAGE_BONUS - Math.abs(0.72 - candidate.circleCoverage) * 42);

        if (shouldUseBallPatternMatch && typeof candidate.patternContribution === "number") {
          score += selectedBallBrand === "molten"
            ? Math.max(0, candidate.patternContribution)
            : candidate.patternContribution;
        }

        if (typeof candidate.motionRatio === "number" && candidate.motionRatio > BALL_TRACK_MOTION_MIN_RATIO) {
          const normalizedMotionRatio = clampNumber(
            (candidate.motionRatio - BALL_TRACK_MOTION_MIN_RATIO) / (0.42 - BALL_TRACK_MOTION_MIN_RATIO),
            0,
            1
          );
          score += normalizedMotionRatio * BALL_TRACK_MOTION_BONUS;
        }

        if (!lastTrackedBall) {
          if (guidance?.bodyBox) {
            score += isInsideBox(candidate, guidance.bodyBox)
              ? BALL_TRACK_BODY_ALIGNMENT_BONUS
              : -BALL_TRACK_BODY_ALIGNMENT_PENALTY;
          }
        } else {
          const distance = distanceBetween(candidate, lastTrackedBall);
          const searchRadius = getTrackedBallSearchRadius(lastTrackedBall);

          if (distance <= searchRadius) {
            score += (1 - distance / searchRadius) * BALL_TRACK_DISTANCE_BONUS;
          } else {
            score -= Math.min(
              BALL_TRACK_DISTANCE_PENALTY,
              Math.max(0, distance - searchRadius) * BALL_TRACK_DISTANCE_PENALTY_SCALE
            );
          }

          const radiusDelta = Math.abs(candidate.radius - lastTrackedBall.radius);
          score += Math.max(0, BALL_TRACK_RADIUS_BONUS - radiusDelta * BALL_TRACK_RADIUS_PENALTY_SCALE);

          if (candidate.color === lastTrackedBall.color) {
            score += BALL_TRACK_COLOR_BONUS;
          }
        }

        if (guidance) {
          const nearestWristDistance = getMinDistanceToPoints(candidate, guidance.wrists);

          if (nearestWristDistance !== null) {
            score += Math.max(0, BALL_TRACK_ANY_WRIST_BONUS - nearestWristDistance * BALL_TRACK_WRIST_DISTANCE_SCALE);
          }

          if (guidance.shootingWrist) {
            score += Math.max(
              0,
              BALL_TRACK_SHOOTING_WRIST_BONUS -
                distanceBetween(candidate, guidance.shootingWrist) * (BALL_TRACK_WRIST_DISTANCE_SCALE + 80)
            );
          }

          if (guidance.supportWrist) {
            score += Math.max(
              0,
              BALL_TRACK_SUPPORT_WRIST_BONUS -
                distanceBetween(candidate, guidance.supportWrist) * BALL_TRACK_WRIST_DISTANCE_SCALE
            );
          }

          if (lessonMode === "dribble") {
            if (nearestWristDistance !== null) {
              score += Math.max(
                0,
                BALL_TRACK_DRIBBLE_WRIST_BONUS -
                  nearestWristDistance * BALL_TRACK_DRIBBLE_WRIST_DISTANCE_SCALE
              );
            }

            const lowerBodyDistance = getMinDistanceToPoints(candidate, [...guidance.knees, ...guidance.ankles]);

            if (lowerBodyDistance !== null) {
              score += Math.max(0, BALL_TRACK_LOWER_BODY_BONUS - lowerBodyDistance * 180);
            }

            if (guidance.shoulderMidY !== null) {
              score +=
                candidate.y >= guidance.shoulderMidY - 0.03
                  ? BALL_TRACK_DRIBBLE_VERTICAL_BONUS
                  : -BALL_TRACK_DRIBBLE_VERTICAL_PENALTY;
            }
          } else if (guidance.head && candidate.y <= guidance.head.y + 0.2) {
            score += BALL_TRACK_SHOOT_VERTICAL_BONUS;
          }

          if (
            guidance.torsoBox &&
            isInsideBox(candidate, guidance.torsoBox) &&
            (nearestWristDistance === null || nearestWristDistance > 0.18)
          ) {
            score -= BALL_TRACK_TORSO_PENALTY;
          }
        }

        return score;
      }

      function commitTrackedBall(nextBall) {
        if (!nextBall) {
          if (!trackedBall || trackedBallMissingFrames >= BALL_TRACK_MAX_MISSING_FRAMES) {
            resetBallTracking();
            return null;
          }

          trackedBallMissingFrames += 1;
          return trackedBall;
        }

        trackedBall = nextBall;
        trackedBallMissingFrames = 0;
        return trackedBall;
      }

      function detectBall(landmarks) {
        if (!processingContext) {
          return null;
        }

        const profile = getBallDetectionProfile();
        const region = getBallDetectionRegion(landmarks);
        const width = region.width;
        const height = region.height;
        processingCanvas.width = width;
        processingCanvas.height = height;
        const sourceWidth = video.videoWidth || canvas.width || width;
        const sourceHeight = video.videoHeight || canvas.height || height;
        const regionSourceX = Math.round(region.minX * sourceWidth);
        const regionSourceY = Math.round(region.minY * sourceHeight);
        const regionSourceWidth = Math.max(1, Math.round((region.maxX - region.minX) * sourceWidth));
        const regionSourceHeight = Math.max(1, Math.round((region.maxY - region.minY) * sourceHeight));
        processingContext.drawImage(
          video,
          regionSourceX,
          regionSourceY,
          regionSourceWidth,
          regionSourceHeight,
          0,
          0,
          width,
          height
        );

        const { data } = processingContext.getImageData(0, 0, width, height);
        const visited = new Uint8Array(width * height);
        const colorMap = new Uint8Array(width * height);
        const mergedMap = new Uint8Array(width * height);
        const motionMaps = buildBallMotionMaps(data, width, height, region);
        const patternMaps =
          shouldUseBallPatternMatch && selectedBallPatternProfiles.length > 0
            ? buildBallPatternMaps(motionMaps.luminanceMap, width, height)
            : null;

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

          if (motionMaps.motionReliable) {
            addMotionSupportToMergedMap(mergedMap, colorMap, motionMaps.motionMap, width, height);
          }
        }

        const candidates = [];
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
          const componentPixels = [];

          while (head < queue.length) {
            const current = queue[head];
            head += 1;
            componentPixels.push(current);

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
          if (aspectRatio < profile.minAspectRatio || aspectRatio > profile.maxAspectRatio) {
            continue;
          }

          const centerX = sumX / mergedCount;
          const centerY = sumY / mergedCount;
          const boundingArea = blobWidth * blobHeight;
          const fillRatio = (profile.mergeColors ? mergedCount : count) / boundingArea;
          const radiusPx = Math.max(blobWidth, blobHeight) / 2;
          const outlineMetrics = calculateCircleOutlineMetrics(
            componentPixels,
            width,
            height,
            centerX,
            centerY,
            radiusPx
          );
          const strongOutline = outlineMetrics.outlineMatchRatio >= profile.minOutlineMatch;
          const patternMetrics = patternMaps
            ? calculateBallPatternMetrics(
                patternMaps.luminanceMap,
                patternMaps.gradientMap,
                width,
                height,
                centerX,
                centerY,
                radiusPx
              )
            : null;
          const patternContribution =
            shouldUseBallPatternMatch && patternMetrics && selectedBallPatternProfiles.length > 0
              ? getBestPatternProfileContribution(patternMetrics, selectedBallPatternProfiles)
              : null;
          const strongPatternSupport =
            typeof patternContribution === "number" &&
            patternContribution >=
              (BALL_TRACK_PATTERN_STRONG_MATCH_SCORE * 2 - 1) * BALL_TRACK_PATTERN_BONUS * 0.7;
          const minFillRatio = strongOutline
            ? profile.minFillRatio * BALL_TRACK_OUTLINE_FILL_RELAX_FACTOR
            : profile.minFillRatio;
          const effectiveMinFillRatio = strongPatternSupport
            ? minFillRatio * BALL_TRACK_PATTERN_FILL_RELAX_FACTOR
            : minFillRatio;

          if (fillRatio < effectiveMinFillRatio) {
            continue;
          }

          const estimatedCircleArea = Math.PI * radiusPx * radiusPx;
          const circleCoverage = (profile.mergeColors ? mergedCount : count) / estimatedCircleArea;
          const minCircleCoverage = strongOutline
            ? profile.minCircleCoverage * BALL_TRACK_OUTLINE_MIN_COVERAGE_RELAX_FACTOR
            : profile.minCircleCoverage;
          const maxCircleCoverage = strongOutline
            ? profile.maxCircleCoverage * BALL_TRACK_OUTLINE_MAX_COVERAGE_RELAX_FACTOR
            : profile.maxCircleCoverage;
          const effectiveMinCircleCoverage = strongPatternSupport
            ? minCircleCoverage * BALL_TRACK_PATTERN_MIN_COVERAGE_RELAX_FACTOR
            : minCircleCoverage;
          const effectiveMaxCircleCoverage = strongPatternSupport
            ? maxCircleCoverage * BALL_TRACK_PATTERN_MAX_COVERAGE_RELAX_FACTOR
            : maxCircleCoverage;

          if (circleCoverage < effectiveMinCircleCoverage || circleCoverage > effectiveMaxCircleCoverage) {
            continue;
          }

          const circleMatchRatio = calculateCircleMatchRatio(
            componentPixels,
            width,
            minX,
            minY,
            maxX,
            maxY,
            centerX,
            centerY,
            radiusPx
          );
          const effectiveMinCircleMatch = strongPatternSupport
            ? Math.max(0, profile.minCircleMatch - BALL_TRACK_PATTERN_CIRCLE_MATCH_RELAX)
            : profile.minCircleMatch;
          if (circleMatchRatio < effectiveMinCircleMatch && !strongOutline) {
            continue;
          }
          const motionRatio = motionMaps.motionReliable
            ? calculateComponentMapHitRatio(componentPixels, motionMaps.motionMap)
            : null;

          const candidate = {
            x: region.minX + (centerX / width) * (region.maxX - region.minX),
            y: region.minY + (centerY / height) * (region.maxY - region.minY),
            radius:
              Math.max(
                (blobWidth / width) * (region.maxX - region.minX),
                (blobHeight / height) * (region.maxY - region.minY)
              ) / 2,
            pixelCount: count,
            color: redCount > orangeCount ? "red" : colorValue === 2 ? "red" : "orange",
            aspectRatio,
            fillRatio,
            circleCoverage,
            circleMatchRatio,
            outlineMatchRatio: outlineMetrics.outlineMatchRatio,
            arcCoverageRatio: outlineMetrics.arcCoverageRatio,
            motionRatio,
            patternMetrics,
            patternContribution
          };

          candidates.push(candidate);
        }

        if (candidates.length === 0) {
          return commitTrackedBall(null);
        }

        const lastTrackedBall = trackedBall;
        const guidance = getBallCandidateGuidance(landmarks);
        let best = null;
        let bestScore = -Infinity;

        for (const candidate of candidates) {
          const score = scoreBallCandidate(candidate, lastTrackedBall, guidance);

          if (!best || score > bestScore) {
            best = candidate;
            bestScore = score;
          }
        }

        return commitTrackedBall(best);
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
        const stroke = "#2ee66b";

        ctx.beginPath();
        ctx.arc(centerX, centerY, Math.max(radius, 16), 0, Math.PI * 2);
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 6;
        ctx.stroke();

        ctx.fillStyle = "rgba(46,230,107,0.85)";
        ctx.fillRect(centerX - 44, centerY - Math.max(radius, 16) - 32, 88, 22);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 13px Arial";
        ctx.textAlign = "center";
        ctx.fillText(ball.color === "orange" ? UI.orangeBall : UI.redBall, centerX, centerY - Math.max(radius, 16) - 16);
        ctx.textAlign = "left";
      }

      function classifyEyeFocus(landmarks, neck) {
        if (lessonMode === "shoot") {
          return "unknown";
        }

        const nose = landmarks[INDEX.nose];
        const leftEar = landmarks[INDEX.leftEar];
        const rightEar = landmarks[INDEX.rightEar];
        const leftEye = landmarks[INDEX.leftEye];
        const rightEye = landmarks[INDEX.rightEye];
        const leftShoulder = landmarks[INDEX.leftShoulder];
        const rightShoulder = landmarks[INDEX.rightShoulder];
        const isFrontDribbleView = selectedDribbleView === "front";
        const visibleEyeCount = [leftEye, rightEye].filter(visible).length;

        if (!neck) {
          return "unknown";
        }

        if (isFrontDribbleView && visibleEyeCount === 0) {
          return "ball";
        }

        const eyeAnchor = averageVisiblePoints([leftEye, rightEye]);
        if (isFrontDribbleView) {
          if (!eyeAnchor) {
            return "ball";
          }

          const eyeNeckGap = Math.abs(neck.y - eyeAnchor.y);
          return eyeNeckGap <= DRIBBLE_FRONT_EYE_NECK_DOWN_GAP ? "ball" : "forward";
        }

        const earAnchor = averageVisiblePoints([leftEar, rightEar]);
        const faceAnchor = eyeAnchor || earAnchor;

        if (!faceAnchor) {
          return isFrontDribbleView ? "ball" : "unknown";
        }

        const shoulderWidth =
          visible(leftShoulder) && visible(rightShoulder)
            ? distanceBetween(leftShoulder, rightShoulder)
            : null;

        if (!visible(nose)) {
          return "unknown";
        }

        const faceScaleCandidates = [Math.abs(neck.y - faceAnchor.y)];
        if (shoulderWidth !== null) {
          faceScaleCandidates.push(shoulderWidth * 0.55);
        }
        if (visible(leftEar) && visible(rightEar)) {
          faceScaleCandidates.push(distanceBetween(leftEar, rightEar) * 1.1);
        }

        const faceScale = Math.max(...faceScaleCandidates, 0.05);
        const noseDrop = nose.y - faceAnchor.y;
        const neckGap = neck.y - nose.y;
        const noseDropRatio = noseDrop / faceScale;
        const neckGapRatio = neckGap / faceScale;
        const lookingDown =
          noseDrop >= 0.02 &&
          noseDropRatio >= 0.4 &&
          neckGapRatio <= 0.58;

        return lookingDown ? "ball" : "forward";
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

        if (torsoLeanAngle < 40) {
          return "high";
        }

        if (torsoLeanAngle > 80) {
          return "low";
        }

        return "balanced";
      }

      function classifyStanceState(bodyFacing, torsoLeanAngle, frontStanceAngle) {
        if (bodyFacing === "front") {
          if (frontStanceAngle === null) {
            return "unknown";
          }

          if (frontStanceAngle < 140) {
            return "too_low";
          }

          if (frontStanceAngle > 170) {
            return "too_upright";
          }

          return "ready";
        }

        if (torsoLeanAngle === null) {
          return "unknown";
        }

        if (torsoLeanAngle < 40) {
          return "too_upright";
        }

        if (torsoLeanAngle > 80) {
          return "too_low";
        }

        return "ready";
      }

      function classifyFrontStanceAngle(landmarks, hipMid) {
        const leftAnkle = landmarks[INDEX.leftAnkle];
        const leftKnee = landmarks[INDEX.leftKnee];
        const leftHip = landmarks[INDEX.leftHip];
        const rightAnkle = landmarks[INDEX.rightAnkle];
        const rightKnee = landmarks[INDEX.rightKnee];
        const rightHip = landmarks[INDEX.rightHip];

        const legAngles = [
          visible(leftAnkle) && visible(leftKnee) && visible(leftHip) ? angleAt(leftAnkle, leftKnee, leftHip) : null,
          visible(rightAnkle) && visible(rightKnee) && visible(rightHip) ? angleAt(rightAnkle, rightKnee, rightHip) : null,
        ].filter((value) => value !== null);

        if (legAngles.length === 0) {
          return null;
        }

        return legAngles.reduce((sum, value) => sum + value, 0) / legAngles.length;
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

      function detectFrontDribbleSide(landmarks, ball) {
        const leftAnkle = landmarks[INDEX.leftAnkle];
        const rightAnkle = landmarks[INDEX.rightAnkle];

        if (!ball || !visible(leftAnkle) || !visible(rightAnkle)) {
          return "unknown";
        }

        const footCenterX = (leftAnkle.x + rightAnkle.x) / 2;
        const footSpan = Math.abs(leftAnkle.x - rightAnkle.x);

        if (footSpan < 0.001) {
          return "unknown";
        }

        const ballOffsetFromCenter = ball.x - footCenterX;

        if (Math.abs(ballOffsetFromCenter) < footSpan * 0.04) {
          const leftDistance = Math.abs(ball.x - leftAnkle.x);
          const rightDistance = Math.abs(ball.x - rightAnkle.x);
          return rightDistance <= leftDistance ? "right" : "left";
        }

        const rightSideDirection = Math.sign(rightAnkle.x - footCenterX);
        if (rightSideDirection === 0) {
          return "unknown";
        }

        return ballOffsetFromCenter * rightSideDirection >= 0 ? "right" : "left";
      }

      function detectControllingHand(landmarks, ball) {
        const leftWrist = landmarks[INDEX.leftWrist];
        const rightWrist = landmarks[INDEX.rightWrist];

        if (!ball) {
          return "unknown";
        }

        if (selectedDribbleView === "front") {
          const frontSide = detectFrontDribbleSide(landmarks, ball);
          if (frontSide !== "unknown") {
            return frontSide;
          }
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

      function recordDribbleRhythmSample(now) {
        if (lastDribbleBounceAtMs === null) {
          lastDribbleBounceAtMs = now;
          return;
        }

        const currentIntervalMs = Math.max(0, now - lastDribbleBounceAtMs);

        if (previousDribbleIntervalMs !== null) {
          if (Math.abs(currentIntervalMs - previousDribbleIntervalMs) >= DRIBBLE_RHYTHM_BAD_INTERVAL_DIFF_MS) {
            dribbleRhythmBadCount += 1;
          } else {
            dribbleRhythmGoodCount += 1;
          }
        }

        previousDribbleIntervalMs = currentIntervalMs;
        lastDribbleBounceAtMs = now;
      }

      function getDribbleRhythmMetrics() {
        const dribbleRhythmComparisonCount = dribbleRhythmGoodCount + dribbleRhythmBadCount;
        const dribbleRhythmBadRatio =
          dribbleRhythmComparisonCount > 0
            ? dribbleRhythmBadCount / dribbleRhythmComparisonCount
            : null;

        return {
          dribbleRhythmState:
            dribbleRhythmComparisonCount <= 0
              ? "unknown"
              : dribbleRhythmBadRatio !== null && dribbleRhythmBadRatio >= 0.5
                ? "needs_improvement"
                : "good",
          dribbleRhythmGoodCount,
          dribbleRhythmBadCount,
          dribbleRhythmBadRatio: dribbleRhythmBadRatio ?? undefined,
          dribbleRhythmComparisonCount,
        };
      }

      function updateDribbleBounceTracking(landmarks, ball) {
        const leftAnkle = landmarks[INDEX.leftAnkle];
        const rightAnkle = landmarks[INDEX.rightAnkle];
        const leftKnee = landmarks[INDEX.leftKnee];
        const rightKnee = landmarks[INDEX.rightKnee];
        const visibleKnees = [leftKnee, rightKnee].filter(visible);

        if (!ball || !visible(leftAnkle) || !visible(rightAnkle)) {
          wasBallNearFoot = false;
          wasBallBelowKnee = false;
          return;
        }

        const ballPoint = { x: ball.x, y: ball.y, visibility: 1 };
        const footMid = midpoint(leftAnkle, rightAnkle);
        const nearestFootDistance = Math.min(
          distanceBetween(ballPoint, leftAnkle),
          distanceBetween(ballPoint, rightAnkle),
          distanceBetween(ballPoint, footMid)
        );
        const kneeY =
          visibleKnees.length > 0
            ? visibleKnees.reduce((sum, point) => sum + point.y, 0) / visibleKnees.length
            : null;
        const nearFoot = nearestFootDistance <= DRIBBLE_FOOT_COUNT_DISTANCE;
        const movedAwayFromFoot = nearestFootDistance >= DRIBBLE_FOOT_RESET_DISTANCE;
        const aboveResetLine = kneeY !== null ? ball.y <= kneeY - 0.04 : movedAwayFromFoot;

        if (highestBounceY === null || ball.y < highestBounceY) {
          highestBounceY = ball.y;
        }

        if (lowestBounceY === null || ball.y > lowestBounceY) {
          lowestBounceY = ball.y;
        }

        const enteredBounceZone = nearFoot && !wasBallNearFoot;

        if (aboveResetLine || movedAwayFromFoot) {
          dribbleBounceLocked = false;
        }

        if (enteredBounceZone && !dribbleBounceLocked) {
          const now = performance.now();
          recordDribbleRhythmSample(now);
          dribbleCount += 1;
          lastBounceHand = detectControllingHand(landmarks, ball);

          if (lastBounceHand === "left") {
            leftHandDribbleCount += 1;
          } else if (lastBounceHand === "right") {
            rightHandDribbleCount += 1;
          }

          highestBounceY = ball.y;
          lowestBounceY = ball.y;
          dribbleBounceLocked = true;
        }

        wasBallNearFoot = nearFoot;
        wasBallBelowKnee = kneeY !== null ? ball.y >= kneeY : nearFoot;
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
        const dribbleStarted = selectedDribbleView === "front" ? true : didDribbleStart(landmarks, ball);

        if (dribbleStarted) {
          updateDribbleBounceTracking(landmarks, ball);
        }

        const eyeFocus = classifyEyeFocus(landmarks, neck);
        const dribbleHeight = dribbleStarted ? classifyDribbleHeight(landmarks, neck, hipMid) : "unknown";
        const torsoPosture = classifyTorsoPosture(shoulderMid, hipMid, torsoLeanAngle);
        const frontBallLaneState = selectedDribbleView === "front" ? classifyFrontBallLaneState(landmarks, ball) : "unknown";
        const footSpacingState = selectedDribbleView === "front" ? classifyFootSpacingState(landmarks) : "unknown";
        const handBalanceState = dribbleCount >= 2 && Math.abs(leftHandDribbleCount - rightHandDribbleCount) >= 2
          ? "unbalanced"
          : dribbleCount > 0
            ? "balanced"
            : "unknown";
        const bounceStates = classifyBounceStates(shoulderMid, hipMid);
        const dribbleRhythmMetrics = getDribbleRhythmMetrics();

        return {
          dribbleStarted,
          dribbleView: selectedDribbleView,
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
          dribbleRhythmState: dribbleRhythmMetrics.dribbleRhythmState,
          dribbleRhythmGoodCount: dribbleRhythmMetrics.dribbleRhythmGoodCount,
          dribbleRhythmBadCount: dribbleRhythmMetrics.dribbleRhythmBadCount,
          dribbleRhythmBadRatio: dribbleRhythmMetrics.dribbleRhythmBadRatio,
          dribbleRhythmComparisonCount: dribbleRhythmMetrics.dribbleRhythmComparisonCount,
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
        const head = landmarks[INDEX.nose];

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
        const ballPoint = ball ? { x: ball.x, y: ball.y, visibility: 1 } : null;
        const now = performance.now();
        const previousArmAngle = shootPreviousArmAngle;
        const previousArmAngleAtMs = shootPreviousArmAngleAtMs;
        const previousBallHandDistance = shootPreviousBallHandDistance;

        let armAngleState = "unknown";
        if (armAngle !== null) {
          if (armAngle < 80) {
            armAngleState = "narrow";
          } else if (armAngle > 120) {
            armAngleState = "wide";
          } else {
            armAngleState = "balanced";
          }
        }

        const ballHandDistance =
          ballPoint && visible(shootingWrist) ? distanceBetween(shootingWrist, ballPoint) : null;
        const ballNearShootingHand =
          ballHandDistance !== null && ballHandDistance <= SHOOT_BALL_HAND_CONTACT_DISTANCE;
        const shootingHandRaised =
          visible(shootingShoulder) &&
          visible(shootingWrist) &&
          shootingWrist.y <= shootingShoulder.y + 0.05;
        const readyPoseDetected = armAngleState === "balanced";

        if (ballNearShootingHand) {
          shootBallNearHandAtMs = now;
        }

        let suddenArmExtensionDetected = false;
        if (armAngle !== null) {
          if (previousArmAngle !== null && previousArmAngleAtMs !== null) {
            const elapsedMs = Math.max(1, now - previousArmAngleAtMs);
            const armAngleDelta = armAngle - previousArmAngle;

            suddenArmExtensionDetected =
              previousArmAngle <= SHOOT_ARM_EXTENSION_BASE_ANGLE_MAX &&
              armAngle >= SHOOT_ARM_EXTENSION_TARGET_ANGLE &&
              armAngleDelta >= SHOOT_ARM_EXTENSION_MIN_DELTA &&
              armAngleDelta / elapsedMs >= SHOOT_ARM_EXTENSION_MIN_SPEED;

            if (suddenArmExtensionDetected && shootBallNearHandAtMs !== null) {
              shootArmExtensionAtMs = now;
            }
          }

          shootPreviousArmAngle = armAngle;
          shootPreviousArmAngleAtMs = now;
        } else {
          shootPreviousArmAngle = null;
          shootPreviousArmAngleAtMs = null;
        }

        const ballControlDetected = shootBallNearHandAtMs !== null;
        const armExtensionDetectedAfterBallControl =
          shootBallNearHandAtMs !== null &&
          shootArmExtensionAtMs !== null &&
          shootArmExtensionAtMs >= shootBallNearHandAtMs;
        const ballSeparatedFromHand =
          ballHandDistance !== null &&
          (
            ballHandDistance >= SHOOT_BALL_HAND_SEPARATION_DISTANCE ||
            (
              previousBallHandDistance !== null &&
              ballHandDistance - previousBallHandDistance >= SHOOT_BALL_HAND_SEPARATION_DELTA
            )
          );

        if (ballHandDistance !== null) {
          shootPreviousBallHandDistance = ballHandDistance;
        } else {
          shootPreviousBallHandDistance = null;
        }

        const legAngles = [angleAt(leftHip, leftKnee, leftAnkle), angleAt(rightHip, rightKnee, rightAnkle)].filter((value) => value !== null);
        const legAngle = legAngles.length > 0 ? legAngles.reduce((sum, value) => sum + value, 0) / legAngles.length : null;

        if (legAngle !== null) {
          if (shootLowestLegAngle === null || legAngle < shootLowestLegAngle) {
            shootLowestLegAngle = legAngle;
            shootLowestLegAngleAtMs = now;
            shootKneeExtensionAtMs = null;
          } else if (shootPreviousLegAngle !== null && shootPreviousLegAngleAtMs !== null) {
            const legAngleDelta = legAngle - shootPreviousLegAngle;
            const extensionFromLowest = shootLowestLegAngle !== null ? legAngle - shootLowestLegAngle : 0;

            if (
              shootKneeExtensionAtMs === null &&
              shootLowestLegAngleAtMs !== null &&
              now >= shootLowestLegAngleAtMs &&
              legAngleDelta >= SHOOT_KNEE_EXTENSION_MIN_DELTA &&
              extensionFromLowest >= SHOOT_KNEE_EXTENSION_FROM_LOWEST_DELTA
            ) {
              shootKneeExtensionAtMs = now;
            }
          }

          shootPreviousLegAngle = legAngle;
          shootPreviousLegAngleAtMs = now;
        } else {
          shootPreviousLegAngle = null;
          shootPreviousLegAngleAtMs = null;
        }

        const referenceLegAngle = shootLowestLegAngle ?? legAngle;
        let legAngleState = "unknown";
        if (referenceLegAngle !== null) {
          if (referenceLegAngle < 120) {
            legAngleState = "low";
          } else if (referenceLegAngle > 140) {
            legAngleState = "high";
          } else {
            legAngleState = "balanced";
          }
        }

        const currentHeadY = visible(head) ? head.y : null;
        if (currentHeadY !== null) {
          shootHeadPeakY =
            shootHeadPeakY === null ? currentHeadY : Math.min(shootHeadPeakY, currentHeadY);
        }

        if (ballNearShootingHand && ballPoint && currentHeadY !== null) {
          shootLatestControlledBallY = ballPoint.y;
          shootLatestControlledHeadY = currentHeadY;
        }

        const releaseDetectedNow =
          !shootReleaseDetected &&
          ballHandDistance !== null &&
          ballControlDetected &&
          armExtensionDetectedAfterBallControl &&
          ballSeparatedFromHand;

        if (releaseDetectedNow) {
          shootReleaseDetected = true;
          shootReleaseDetectedAtMs = now;

          if (shootKneeExtensionAtMs !== null && shootArmExtensionAtMs !== null) {
            const timingDeltaMs = shootArmExtensionAtMs - shootKneeExtensionAtMs;

            if (timingDeltaMs < -SHOOT_TIMING_SYNC_WINDOW_MS) {
              shootReleaseTiming = "early";
            } else if (timingDeltaMs > SHOOT_TIMING_SYNC_WINDOW_MS) {
              shootReleaseTiming = "late";
            } else {
              shootReleaseTiming = "balanced";
            }
          } else {
            shootReleaseTiming = "unknown";
          }

          shootReleasePointY = shootLatestControlledBallY;
          if (shootLatestControlledBallY !== null && shootLatestControlledHeadY !== null) {
            shootReleasePointState = shootLatestControlledBallY < shootLatestControlledHeadY ? "high" : "low";
          } else {
            shootReleasePointState = "unknown";
          }

          if (shootLowestLegAngleAtMs !== null) {
            shootReleaseDurationMs = Math.max(0, now - shootLowestLegAngleAtMs);
            shootReleaseDurationState =
              shootReleaseDurationMs <= SHOOT_RELEASE_DURATION_BALANCED_MS ? "balanced" : "slow";
          } else {
            shootReleaseDurationMs = null;
            shootReleaseDurationState = "unknown";
          }
        }

        const canCheckShootSuccessCircle =
          shootReleaseDetectedAtMs !== null &&
          !shootSuccessCircleDetected &&
          now - shootReleaseDetectedAtMs <= SHOOT_SUCCESS_CIRCLE_WINDOW_MS;

        if (canCheckShootSuccessCircle) {
          const canMeasureShootSuccessCircle =
            visible(head) &&
            visible(leftShoulder) &&
            visible(rightShoulder) &&
            visible(leftElbow) &&
            visible(rightElbow) &&
            visible(leftWrist) &&
            visible(rightWrist);
          let hasShootSuccessCircleGesture = false;

          if (canMeasureShootSuccessCircle) {
            const shoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x);

            if (shoulderWidth >= SHOOT_SUCCESS_CIRCLE_MIN_SHOULDER_WIDTH) {
              const wristsAboveHead =
                leftWrist.y < head.y - SHOOT_SUCCESS_CIRCLE_WRIST_HEAD_Y_GAP &&
                rightWrist.y < head.y - SHOOT_SUCCESS_CIRCLE_WRIST_HEAD_Y_GAP;
              const headBetweenWrists =
                Math.min(leftWrist.x, rightWrist.x) < head.x - SHOOT_SUCCESS_CIRCLE_HEAD_X_MARGIN &&
                Math.max(leftWrist.x, rightWrist.x) > head.x + SHOOT_SUCCESS_CIRCLE_HEAD_X_MARGIN;
              const elbowsAboveShoulders =
                leftElbow.y < leftShoulder.y &&
                rightElbow.y < rightShoulder.y;
              const wristsAboveElbows =
                leftWrist.y < leftElbow.y &&
                rightWrist.y < rightElbow.y;
              const wristsCloseEnough =
                distanceBetween(leftWrist, rightWrist) <= shoulderWidth * SHOOT_SUCCESS_CIRCLE_MAX_WRIST_DISTANCE_RATIO;

              hasShootSuccessCircleGesture =
                wristsAboveHead &&
                headBetweenWrists &&
                elbowsAboveShoulders &&
                wristsAboveElbows &&
                wristsCloseEnough;
            }
          }

          if (hasShootSuccessCircleGesture) {
            shootSuccessCircleStableFrameCount += 1;

            if (shootSuccessCircleStableFrameCount >= SHOOT_SUCCESS_CIRCLE_STABLE_FRAMES) {
              shootSuccessCircleDetected = true;
              shootSuccessCircleEventPending = true;
            }
          } else {
            shootSuccessCircleStableFrameCount = 0;
          }
        } else if (!shootSuccessCircleDetected) {
          shootSuccessCircleStableFrameCount = 0;
        }

        const releaseTiming = shootReleaseDetected ? shootReleaseTiming : "unknown";

        return {
          armAngle,
          legAngle,
          releaseVelocity,
          lowestLegAngle: shootLowestLegAngle,
          headPeakY: shootHeadPeakY,
          releasePointY: shootReleasePointY,
          releaseDurationMs: shootReleaseDurationMs,
          releaseDetected: shootReleaseDetected,
          ballNearShootingHand,
          shootingHandRaised,
          readyPoseDetected,
          armAngleState,
          releaseTiming,
          legAngleState,
          releasePointState: shootReleasePointState,
          releaseDurationState: shootReleaseDurationState,
          summary: [
            "Arm:" + (armAngleState === "narrow" ? "narrow" : armAngleState === "wide" ? "wide" : armAngleState === "balanced" ? "balanced" : "unknown"),
            "Ready:" + (readyPoseDetected ? "yes" : "no"),
            "Timing:" + (releaseTiming === "early" ? "early" : releaseTiming === "late" ? "late" : releaseTiming === "balanced" ? "balanced" : "unknown"),
            "Leg:" + (legAngleState === "low" ? "low" : legAngleState === "high" ? "high" : legAngleState === "balanced" ? "balanced" : "unknown"),
            "Point:" + (shootReleasePointState === "high" ? "high" : shootReleasePointState === "low" ? "low" : "unknown"),
            "ReleaseMs:" + (shootReleaseDurationMs !== null ? Math.round(shootReleaseDurationMs) : "unknown"),
            "Release:" + (shootReleaseDetected ? "yes" : "no"),
            "Ball:" + (ball ? ball.color : "searching")
          ].join(" | ")
        };
      }

      function getProblemJointKeys(landmarks, dribbleAnalysis, shootAnalysis) {
        const problemJoints = new Set();

        if (lessonMode === "dribble") {
          if (dribbleAnalysis.eyeFocus === "ball") {
            problemJoints.add("head");
            problemJoints.add("leftEye");
            problemJoints.add("rightEye");
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
            problemJoints.add("leftKnee");
            problemJoints.add("rightKnee");
          }

          if (shootingSide && shootAnalysis.releasePointState === "low") {
            problemJoints.add(wristKey);
            problemJoints.add("head");
          }

          if (shootingSide && shootAnalysis.releaseDurationState === "slow") {
            problemJoints.add(wristKey);
            problemJoints.add("leftHip");
            problemJoints.add("rightHip");
            problemJoints.add("leftKnee");
            problemJoints.add("rightKnee");
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

      function getJointColor(problemJointKeys, key, defaultColor) {
        return problemJointKeys.has(key) ? "#ff4d5a" : defaultColor;
      }

      function drawPoseSkeleton(joints, problemJointKeys) {
        const segments = [
          ["head", "neck"],
          ["neck", "leftShoulder"],
          ["neck", "rightShoulder"],
          ["leftShoulder", "rightShoulder"],
          ["leftShoulder", "leftElbow"],
          ["rightShoulder", "rightElbow"],
          ["leftElbow", "leftWrist"],
          ["rightElbow", "rightWrist"],
          ["leftShoulder", "leftHip"],
          ["rightShoulder", "rightHip"],
          ["leftHip", "rightHip"],
          ["leftHip", "leftKnee"],
          ["rightHip", "rightKnee"],
          ["leftKnee", "leftAnkle"],
          ["rightKnee", "rightAnkle"]
        ];

        for (const [fromKey, toKey] of segments) {
          const color = shouldHighlightSegment(problemJointKeys, fromKey, toKey) ? "#ff4d5a" : "rgba(255,255,255,0.78)";
          drawSegment(joints[fromKey], joints[toKey], color);
        }
      }

      function renderPose(landmarks) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        if (isFrontCameraActive()) {
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        ctx.restore();
        let ball = null;

        try {
          ball = detectBall(landmarks);
        } catch (error) {
          resetBallTracking();
          reportProcessingError("ball-detect", error);
        }

        if (!landmarks) {
          if (ball) {
            drawBall(ball);
          }

          setHud(ball ? UI.pointPrefix + (ball.color === "orange" ? UI.orangeBall : UI.redBall) : UI.frameGuide);
          const now = Date.now();
          if (now - lastSentAt > 1000) {
            lastSentAt = now;
            post({ type: "status", message: ball ? UI.waitingPlayer : UI.waitingPlayerBall });
          }
          return;
        }

        const head = landmarks[INDEX.nose];
        const leftEye = landmarks[INDEX.leftEye];
        const rightEye = landmarks[INDEX.rightEye];
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
        const showEyeLandmarks = lessonMode !== "shoot";
        const neck = visible(leftShoulder) && visible(rightShoulder) ? midpoint(leftShoulder, rightShoulder) : null;
        const hipMid = visible(leftHip) && visible(rightHip) ? midpoint(leftHip, rightHip) : null;

        const releaseVelocity = hipMid && previousHipY !== null ? hipMid.y - previousHipY : null;
        if (hipMid) {
          previousHipY = hipMid.y;
        }

        const dribbleAnalysis = buildDribbleAnalysis(landmarks, ball);
        const shootAnalysis = buildShootAnalysis(landmarks, releaseVelocity, ball);
        const problemJointKeys = getProblemJointKeys(landmarks, dribbleAnalysis, shootAnalysis);
        const joints = {
          head,
          neck,
          leftEye,
          rightEye,
          leftShoulder,
          rightShoulder,
          leftElbow,
          rightElbow,
          leftWrist,
          rightWrist,
          leftHip,
          rightHip,
          leftKnee,
          rightKnee,
          leftAnkle,
          rightAnkle
        };

        drawPoseSkeleton(joints, problemJointKeys);
        if (visible(head)) drawPoint(head, LABELS.head, getJointColor(problemJointKeys, "head", "#ff6b6b"));
        if (showEyeLandmarks && visible(leftEye)) drawPoint(leftEye, UI.left + LABELS.eye, getJointColor(problemJointKeys, "leftEye", "#ff8fab"));
        if (showEyeLandmarks && visible(rightEye)) drawPoint(rightEye, UI.right + LABELS.eye, getJointColor(problemJointKeys, "rightEye", "#ff8fab"));
        if (neck && visible(neck)) drawPoint(neck, LABELS.neck, getJointColor(problemJointKeys, "neck", "#f7b267"));
        if (visible(leftShoulder)) drawPoint(leftShoulder, UI.left + LABELS.shoulder, getJointColor(problemJointKeys, "leftShoulder", "#ffd166"));
        if (visible(rightShoulder)) drawPoint(rightShoulder, UI.right + LABELS.shoulder, getJointColor(problemJointKeys, "rightShoulder", "#ffd166"));
        if (visible(leftElbow)) drawPoint(leftElbow, UI.left + LABELS.elbow, getJointColor(problemJointKeys, "leftElbow", "#ffb703"));
        if (visible(rightElbow)) drawPoint(rightElbow, UI.right + LABELS.elbow, getJointColor(problemJointKeys, "rightElbow", "#ffb703"));
        if (visible(leftWrist)) drawPoint(leftWrist, UI.left + LABELS.hand, getJointColor(problemJointKeys, "leftWrist", "#fb8500"));
        if (visible(rightWrist)) drawPoint(rightWrist, UI.right + LABELS.hand, getJointColor(problemJointKeys, "rightWrist", "#fb8500"));
        if (visible(leftHip)) drawPoint(leftHip, UI.left + LABELS.hip, getJointColor(problemJointKeys, "leftHip", "#06d6a0"));
        if (visible(rightHip)) drawPoint(rightHip, UI.right + LABELS.hip, getJointColor(problemJointKeys, "rightHip", "#06d6a0"));
        if (visible(leftKnee)) drawPoint(leftKnee, UI.left + LABELS.knee, getJointColor(problemJointKeys, "leftKnee", "#118ab2"));
        if (visible(rightKnee)) drawPoint(rightKnee, UI.right + LABELS.knee, getJointColor(problemJointKeys, "rightKnee", "#118ab2"));
        if (visible(leftAnkle)) drawPoint(leftAnkle, UI.left + LABELS.foot, getJointColor(problemJointKeys, "leftAnkle", "#4cc9f0"));
        if (visible(rightAnkle)) drawPoint(rightAnkle, UI.right + LABELS.foot, getJointColor(problemJointKeys, "rightAnkle", "#4cc9f0"));
        if (ball) {
          drawBall(ball);
        }

        const detected = [];
        if (visible(head)) detected.push(LABELS.head);
        if (showEyeLandmarks && (visible(leftEye) || visible(rightEye))) detected.push(LABELS.eye);
        if (neck && visible(neck)) detected.push(LABELS.neck);
        if (visible(leftShoulder) || visible(rightShoulder)) detected.push(LABELS.shoulder);
        if (visible(leftElbow) || visible(rightElbow)) detected.push(LABELS.elbow);
        if (visible(leftWrist) || visible(rightWrist)) detected.push(LABELS.hand);
        if (visible(leftHip) || visible(rightHip)) detected.push(LABELS.hip);
        if (visible(leftKnee) || visible(rightKnee)) detected.push(LABELS.knee);
        if (visible(leftAnkle) || visible(rightAnkle)) detected.push(LABELS.foot);
        if (ball) {
          detected.push(ball.color === "orange" ? UI.orangeBall : UI.redBall);
        }

        const pointSummary = detected.join(", ");
        setHud(pointSummary ? UI.pointPrefix + pointSummary : UI.waitingBoth);

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

        if (shootSuccessCircleEventPending) {
          shootSuccessCircleEventPending = false;
          post({ type: "shoot_success_circle_detected" });
        }
      }

      async function setupPose() {
        post({ type: "status", message: UI.preparingModel });
        setHud(UI.preparingModel);

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
        setHud(UI.startingCamera);
      }

      function getMatchingCameraDeviceId(devices, facingMode) {
        const labelPattern = facingMode === "environment" ? REAR_CAMERA_LABEL_PATTERN : FRONT_CAMERA_LABEL_PATTERN;
        const matchingDevice = devices.find((device) => device.kind === "videoinput" && labelPattern.test(device.label || ""));
        return matchingDevice?.deviceId || null;
      }

      async function requestCameraStream(facingMode, allowGenericFallback = facingMode === "user") {
        const sharedVideoConstraints = {
          width: { ideal: 1280 },
          height: { ideal: 720 }
        };
        const attempts = [
          { ...sharedVideoConstraints, facingMode: { exact: facingMode } },
          { ...sharedVideoConstraints, facingMode }
        ];

        if (navigator.mediaDevices.enumerateDevices) {
          try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const matchingDeviceId = getMatchingCameraDeviceId(devices, facingMode);
            if (matchingDeviceId) {
              attempts.push({ ...sharedVideoConstraints, deviceId: { exact: matchingDeviceId } });
            }
          } catch (error) {
            // Ignore device enumeration errors and fall back to generic requests.
          }
        }

        if (allowGenericFallback) {
          attempts.push(sharedVideoConstraints);
        }

        let lastError = null;

        for (const videoConstraints of attempts) {
          try {
            const stream = await navigator.mediaDevices.getUserMedia({
              audio: false,
              video: videoConstraints
            });

            const resolvedFacingMode = inferFacingModeFromStream(stream, facingMode);

            if (!allowGenericFallback && resolvedFacingMode !== facingMode) {
              stream.getTracks().forEach((track) => track.stop());
              lastError = new Error(
                facingMode === "environment" ? UI.rearCameraUnavailable : UI.frontCameraUnavailable
              );
              continue;
            }

            return stream;
          } catch (error) {
            lastError = error;
          }
        }

        throw lastError instanceof Error ? lastError : new Error(UI.startFailed);
      }

      async function bindCameraStream(stream, preferredFacingMode) {
        const resolvedFacingMode = inferFacingModeFromStream(stream, preferredFacingMode);
        stopActiveVideoStream();
        currentCameraFacingMode = resolvedFacingMode;
        cameraStreamStopped = false;
        resetAnalysisSummaries();
        resetBallTracking();
        video.srcObject = stream;
        updateVideoPresentation();
        await video.play();
        resizeCanvas();

        return resolvedFacingMode;
      }

      function ensureRenderLoopRunning() {
        if (isRenderLoopRunning) {
          return;
        }

        isRenderLoopRunning = true;
        requestAnimationFrame(loop);
      }

      async function setupCamera(facingMode = currentCameraFacingMode) {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error(UI.unsupportedCamera);
        }

        const stream = await requestCameraStream(facingMode);
        const resolvedFacingMode = await bindCameraStream(stream, facingMode);

        post({ type: "stream_started" });
        setHud(getCameraConnectedMessage(resolvedFacingMode));
        ensureRenderLoopRunning();
      }

      async function switchCameraFacing() {
        if (cameraStreamStopped || isSwitchingCamera || !video.srcObject) {
          return;
        }

        const previousFacingMode = currentCameraFacingMode;
        const nextFacingMode = previousFacingMode === "user" ? "environment" : "user";
        isSwitchingCamera = true;
        setHud(getCameraSwitchingMessage(nextFacingMode));

        try {
          let stream = null;

          try {
            stream = await requestCameraStream(nextFacingMode, false);
          } catch (firstError) {
            stopActiveVideoStream();
            stream = await requestCameraStream(nextFacingMode, false);
          }

          const resolvedFacingMode = await bindCameraStream(stream, nextFacingMode);

          if (resolvedFacingMode !== nextFacingMode) {
            stopActiveVideoStream();
            throw new Error(
              nextFacingMode === "environment" ? UI.rearCameraUnavailable : UI.frontCameraUnavailable
            );
          }

          setHud(getCameraConnectedMessage(resolvedFacingMode));
        } catch (error) {
          try {
            const restoreStream = await requestCameraStream(previousFacingMode, true);
            const restoredFacingMode = await bindCameraStream(restoreStream, previousFacingMode);
            setHud(getCameraConnectedMessage(restoredFacingMode));
          } catch (restoreError) {
            const message =
              error instanceof Error && error.message
                ? error.message
                : restoreError instanceof Error && restoreError.message
                  ? restoreError.message
                  : UI.switchCameraFailed;
            setHud(message);
          }
        } finally {
          isSwitchingCamera = false;
        }
      }

      function loop() {
        if (cameraStreamStopped) {
          isRenderLoopRunning = false;
          return;
        }

        try {
          if (poseLandmarker && video.readyState >= 2 && video.currentTime !== lastVideoTime) {
            lastVideoTime = video.currentTime;
            const result = poseLandmarker.detectForVideo(video, performance.now());
            const landmarks = result.landmarks && result.landmarks.length > 0 ? result.landmarks[0] : null;
            renderPose(landmarks);
          }
        } catch (error) {
          resetBallTracking();
          reportProcessingError("render-loop", error);
        }

        requestAnimationFrame(loop);
      }

      function resetCameraSwitchDrag() {
        dragStartX = null;
        dragStartY = null;
        dragTriggered = false;
      }

      function maybeSwitchCameraFromDrag(clientX, clientY) {
        if (dragStartX === null || dragStartY === null || dragTriggered || isSwitchingCamera) {
          return;
        }

        const deltaX = clientX - dragStartX;
        const deltaY = clientY - dragStartY;

        if (Math.abs(deltaY) > Math.abs(deltaX)) {
          return;
        }

        if (Math.abs(deltaX) < CAMERA_SWITCH_THRESHOLD_PX) {
          return;
        }

        dragTriggered = true;
        void switchCameraFacing();
      }

      function bindCameraSwitchGesture() {
        if (!wrap || (navigator.maxTouchPoints || 0) <= 0) {
          return;
        }

        wrap.addEventListener(
          "touchstart",
          (event) => {
            const touch = event.touches && event.touches[0];
            if (!touch) {
              return;
            }

            dragStartX = touch.clientX;
            dragStartY = touch.clientY;
            dragTriggered = false;
          },
          { passive: true }
        );

        wrap.addEventListener(
          "touchmove",
          (event) => {
            const touch = event.touches && event.touches[0];
            if (!touch) {
              return;
            }

            maybeSwitchCameraFromDrag(touch.clientX, touch.clientY);
          },
          { passive: true }
        );

        wrap.addEventListener("touchend", resetCameraSwitchDrag);
        wrap.addEventListener("touchcancel", resetCameraSwitchDrag);
      }

      async function start() {
        try {
          await setupPose();
          await setupCamera();
        } catch (error) {
          const message = error instanceof Error ? error.message : UI.startFailed;
          post({ type: "error", message });
          setHud(message);
        }
      }

      window.addEventListener("beforeunload", () => {
        if (recorder && recorder.state !== "inactive") {
          recorderStopping = true;
          recorder.stop();
        }
        disconnectCameraStream();
      });

      window.addEventListener("resize", resizeCanvas);
      bindCameraSwitchGesture();
      start();
    </script>
  </body>
</html>`;
}

export function buildPoseBootstrapScript(
  lessonMode: 'dribble' | 'shoot' = 'dribble',
  selectedDribbleView: 'front' | 'side' = 'front',
  selectedBallBrand: 'wilson' | 'spalding' | 'molten' = 'wilson',
  selectedBallColors: string[] = ['orange'],
  ballRecognitionProfile: BallRecognitionProfile | null = null
): string {
  const html = JSON.stringify(
    buildPoseWebHtml(lessonMode, selectedDribbleView, selectedBallBrand, selectedBallColors, ballRecognitionProfile)
  );

  return `
    document.open();
    document.write(${html});
    document.close();
    true;
  `;
}
