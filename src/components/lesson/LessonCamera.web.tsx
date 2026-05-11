import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { WebViewMessageEvent } from 'react-native-webview';
import { colors } from '../../theme/colors';
import type { DribbleAnalysis, ShootAnalysis } from '../../types/app';

interface LessonCameraProps {
  isLessonActive: boolean;
  isCameraReady: boolean;
  onPoseMessage: (event: WebViewMessageEvent) => void;
}

type Landmark = { x: number; y: number; visibility?: number };

type PosePayload =
  | { type: 'ready' }
  | { type: 'stream_started' }
  | { type: 'status'; message: string }
  | { type: 'points'; summary: string }
  | { type: 'dribble_analysis'; analysis: DribbleAnalysis }
  | { type: 'shoot_analysis'; analysis: ShootAnalysis }
  | { type: 'error'; message: string };

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
  rightAnkle: 28,
} as const;

const LABELS = {
  head: '머리',
  neck: '목',
  shoulder: '어깨',
  elbow: '팔꿈치',
  hand: '손',
  hip: '엉덩이',
  knee: '무릎',
  foot: '발',
} as const;

function visible(point?: Landmark | null) {
  return Boolean(point && (point.visibility ?? 1) > 0.4);
}

function midpoint(a: Landmark, b: Landmark): Landmark {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    visibility: Math.min(a.visibility ?? 1, b.visibility ?? 1),
  };
}

function angleAt(a?: Landmark, b?: Landmark, c?: Landmark): number | null {
  if (!a || !b || !c || !visible(a) || !visible(b) || !visible(c)) {
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
  return (Math.acos(cosine) * 180) / Math.PI;
}

function classifyEyeFocus(landmarks: Landmark[], neck: Landmark | null): DribbleAnalysis['eyeFocus'] {
  const nose = landmarks[INDEX.nose];
  const leftEar = landmarks[INDEX.leftEar];
  const rightEar = landmarks[INDEX.rightEar];
  const leftEye = landmarks[INDEX.leftEye];
  const rightEye = landmarks[INDEX.rightEye];

  if (!visible(nose) || !neck) {
    return 'unknown';
  }

  const headBase =
    visible(leftEar) && visible(rightEar)
      ? midpoint(leftEar, rightEar)
      : visible(leftEye) && visible(rightEye)
        ? midpoint(leftEye, rightEye)
        : null;

  if (!headBase) {
    return 'unknown';
  }

  const noseDrop = nose.y - headBase.y;
  const neckGap = neck.y - nose.y;
  return noseDrop > 0.055 || neckGap < 0.11 ? 'ball' : 'forward';
}

function classifyDribbleHeight(
  landmarks: Landmark[],
  neck: Landmark | null,
  hipMid: Landmark | null
): DribbleAnalysis['dribbleHeight'] {
  const wrists = [landmarks[INDEX.leftWrist], landmarks[INDEX.rightWrist]].filter(visible);

  if (!neck || !hipMid || wrists.length === 0) {
    return 'unknown';
  }

  const dribbleHand = wrists.reduce((lowest, current) => (current.y > lowest.y ? current : lowest));
  const neckDistance = Math.abs(dribbleHand.y - neck.y);
  const hipDistance = Math.abs(dribbleHand.y - hipMid.y);

  if (neckDistance + 0.015 < hipDistance) {
    return 'high';
  }

  if (hipDistance + 0.015 < neckDistance) {
    return 'low';
  }

  return 'balanced';
}

function classifyTorsoPosture(shoulderMid: Landmark | null, hipMid: Landmark | null): DribbleAnalysis['torsoPosture'] {
  if (!shoulderMid || !hipMid) {
    return 'unknown';
  }

  const torsoHeight = hipMid.y - shoulderMid.y;

  if (torsoHeight > 0.3) {
    return 'high';
  }

  if (torsoHeight < 0.2) {
    return 'low';
  }

  return 'balanced';
}

function buildDribbleAnalysis(landmarks: Landmark[]): DribbleAnalysis {
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
      `시선:${eyeFocus === 'ball' ? '공 쪽' : eyeFocus === 'forward' ? '앞' : '판정 어려움'}`,
      `드리블:${dribbleHeight === 'high' ? '높음' : dribbleHeight === 'low' ? '낮음' : dribbleHeight === 'balanced' ? '적절' : '판정 어려움'}`,
      `상체:${torsoPosture === 'high' ? '높음' : torsoPosture === 'low' ? '낮음' : torsoPosture === 'balanced' ? '적절' : '판정 어려움'}`,
    ].join(' | '),
  };
}

function buildShootAnalysis(landmarks: Landmark[], releaseVelocity: number | null): ShootAnalysis {
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
      ? (leftWrist?.y ?? 1) < (rightWrist?.y ?? 1)
        ? 'left'
        : 'right'
      : leftArmAngle !== null
        ? 'left'
        : rightArmAngle !== null
          ? 'right'
          : null;

  const armAngle = shootingSide === 'left' ? leftArmAngle : shootingSide === 'right' ? rightArmAngle : null;
  const shootingShoulder = shootingSide === 'left' ? leftShoulder : shootingSide === 'right' ? rightShoulder : undefined;
  const shootingWrist = shootingSide === 'left' ? leftWrist : shootingSide === 'right' ? rightWrist : undefined;

  let armAngleState: ShootAnalysis['armAngleState'] = 'unknown';
  if (armAngle !== null) {
    if (armAngle < 90) {
      armAngleState = 'narrow';
    } else if (armAngle > 110) {
      armAngleState = 'wide';
    } else {
      armAngleState = 'balanced';
    }
  }

  const legAngles = [angleAt(leftHip, leftKnee, leftAnkle), angleAt(rightHip, rightKnee, rightAnkle)].filter(
    (value): value is number => value !== null
  );
  const legAngle = legAngles.length > 0 ? legAngles.reduce((sum, value) => sum + value, 0) / legAngles.length : null;

  let legAngleState: ShootAnalysis['legAngleState'] = 'unknown';
  if (legAngle !== null) {
    if (legAngle < 100) {
      legAngleState = 'low';
    } else if (legAngle > 130) {
      legAngleState = 'high';
    } else {
      legAngleState = 'balanced';
    }
  }

  const releasePose =
    armAngle !== null &&
    armAngle > 120 &&
    visible(shootingShoulder) &&
    visible(shootingWrist) &&
    shootingWrist!.y < shootingShoulder!.y;

  let releaseTiming: ShootAnalysis['releaseTiming'] = 'unknown';
  if (releasePose && releaseVelocity !== null) {
    if (releaseVelocity < -0.003) {
      releaseTiming = 'early';
    } else if (releaseVelocity > 0.003) {
      releaseTiming = 'late';
    } else {
      releaseTiming = 'balanced';
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
      `팔:${armAngleState === 'narrow' ? '좁음' : armAngleState === 'wide' ? '넓음' : armAngleState === 'balanced' ? '적절' : '판정 어려움'}`,
      `타이밍:${releaseTiming === 'early' ? '빠름' : releaseTiming === 'late' ? '늦음' : releaseTiming === 'balanced' ? '적절' : '판정 어려움'}`,
      `하체:${legAngleState === 'low' ? '너무 낮음' : legAngleState === 'high' ? '높음' : legAngleState === 'balanced' ? '적절' : '판정 어려움'}`,
    ].join(' | '),
  };
}

export function LessonCamera({ isLessonActive, isCameraReady, onPoseMessage }: LessonCameraProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const onPoseMessageRef = useRef(onPoseMessage);

  useEffect(() => {
    onPoseMessageRef.current = onPoseMessage;
  }, [onPoseMessage]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return undefined;
    }

    host.innerHTML = '';

    if (!isLessonActive) {
      return undefined;
    }

    let cancelled = false;
    let animationFrameId = 0;
    let stream: MediaStream | null = null;
    let poseLandmarker: {
      detectForVideo: (video: HTMLVideoElement, timestampMs: number) => { landmarks?: Landmark[][] };
      close?: () => void;
    } | null = null;
    let lastVideoTime = -1;
    let lastPointSummary = '';
    let lastDribbleSummary = '';
    let lastShootSummary = '';
    let lastSentAt = 0;
    let previousHipY: number | null = null;

    const emit = (payload: PosePayload) => {
      onPoseMessageRef.current({
        nativeEvent: {
          data: JSON.stringify(payload),
        },
      } as WebViewMessageEvent);
    };

    const wrap = document.createElement('div');
    wrap.style.position = 'relative';
    wrap.style.width = '100%';
    wrap.style.height = '100%';
    wrap.style.background = colors.cameraBg;
    wrap.style.overflow = 'hidden';

    const video = document.createElement('video');
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    video.setAttribute('webkit-playsinline', 'true');
    Object.assign(video.style, {
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      transform: 'scaleX(-1)',
      background: colors.cameraBg,
    } satisfies Partial<CSSStyleDeclaration>);

    const canvas = document.createElement('canvas');
    Object.assign(canvas.style, {
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
    } satisfies Partial<CSSStyleDeclaration>);

    const hud = document.createElement('div');
    hud.textContent = 'MediaPipe를 준비하는 중입니다.';
    Object.assign(hud.style, {
      position: 'absolute',
      left: '12px',
      right: '12px',
      bottom: '12px',
      zIndex: '5',
      color: '#ffffff',
      background: 'rgba(0, 0, 0, 0.5)',
      borderRadius: '14px',
      padding: '10px 12px',
      fontSize: '13px',
      lineHeight: '1.45',
      pointerEvents: 'none',
    } satisfies Partial<CSSStyleDeclaration>);

    wrap.appendChild(video);
    wrap.appendChild(canvas);
    wrap.appendChild(hud);
    host.appendChild(wrap);

    const context = canvas.getContext('2d');
    if (!context) {
      emit({ type: 'error', message: '브라우저 캔버스를 초기화할 수 없습니다.' });
      return undefined;
    }

    const setHud = (text: string) => {
      hud.textContent = text;
    };

    const resizeCanvas = () => {
      canvas.width = video.videoWidth || host.clientWidth || 1280;
      canvas.height = video.videoHeight || host.clientHeight || 720;
    };

    const projectX = (x: number) => (1 - x) * canvas.width;
    const projectY = (y: number) => y * canvas.height;

    const drawPoint = (point: Landmark, label: string, color: string) => {
      const x = projectX(point.x);
      const y = projectY(point.y);
      context.beginPath();
      context.arc(x, y, 7, 0, Math.PI * 2);
      context.fillStyle = color;
      context.fill();
      context.font = 'bold 16px Arial';
      context.lineWidth = 4;
      context.strokeStyle = 'rgba(0,0,0,0.75)';
      context.strokeText(label, x + 10, y - 10);
      context.fillStyle = '#ffffff';
      context.fillText(label, x + 10, y - 10);
    };

    const drawSegment = (a?: Landmark, b?: Landmark, color?: string) => {
      if (!a || !b || !color || !visible(a) || !visible(b)) {
        return;
      }

      context.beginPath();
      context.moveTo(projectX(a.x), projectY(a.y));
      context.lineTo(projectX(b.x), projectY(b.y));
      context.strokeStyle = color;
      context.lineWidth = 4;
      context.stroke();
    };

    const renderPose = (landmarks: Landmark[] | null) => {
      context.clearRect(0, 0, canvas.width, canvas.height);

      if (!landmarks) {
        setHud('화면 안에 몸이 보이도록 서 주세요.');
        const now = Date.now();
        if (now - lastSentAt > 1200) {
          lastSentAt = now;
          emit({ type: 'status', message: '사람을 찾는 중입니다.' });
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

      drawSegment(leftShoulder, rightShoulder, '#ffb347');
      drawSegment(leftShoulder, leftElbow, '#ffb347');
      drawSegment(rightShoulder, rightElbow, '#ffb347');
      drawSegment(leftElbow, leftWrist, '#ffd166');
      drawSegment(rightElbow, rightWrist, '#ffd166');
      drawSegment(leftShoulder, leftHip, '#7bd389');
      drawSegment(rightShoulder, rightHip, '#7bd389');
      drawSegment(leftHip, rightHip, '#7bd389');
      drawSegment(leftHip, leftKnee, '#7bd389');
      drawSegment(rightHip, rightKnee, '#7bd389');
      drawSegment(leftKnee, leftAnkle, '#80ed99');
      drawSegment(rightKnee, rightAnkle, '#80ed99');

      if (visible(head)) drawPoint(head, LABELS.head, '#ff6b6b');
      if (neck && visible(neck)) drawPoint(neck, LABELS.neck, '#f7b267');
      if (visible(leftShoulder)) drawPoint(leftShoulder, `왼쪽 ${LABELS.shoulder}`, '#ffd166');
      if (visible(rightShoulder)) drawPoint(rightShoulder, `오른쪽 ${LABELS.shoulder}`, '#ffd166');
      if (visible(leftElbow)) drawPoint(leftElbow, `왼쪽 ${LABELS.elbow}`, '#ffb703');
      if (visible(rightElbow)) drawPoint(rightElbow, `오른쪽 ${LABELS.elbow}`, '#ffb703');
      if (visible(leftWrist)) drawPoint(leftWrist, `왼쪽 ${LABELS.hand}`, '#fb8500');
      if (visible(rightWrist)) drawPoint(rightWrist, `오른쪽 ${LABELS.hand}`, '#fb8500');
      if (visible(leftHip)) drawPoint(leftHip, `왼쪽 ${LABELS.hip}`, '#06d6a0');
      if (visible(rightHip)) drawPoint(rightHip, `오른쪽 ${LABELS.hip}`, '#06d6a0');
      if (visible(leftKnee)) drawPoint(leftKnee, `왼쪽 ${LABELS.knee}`, '#118ab2');
      if (visible(rightKnee)) drawPoint(rightKnee, `오른쪽 ${LABELS.knee}`, '#118ab2');
      if (visible(leftAnkle)) drawPoint(leftAnkle, `왼쪽 ${LABELS.foot}`, '#4cc9f0');
      if (visible(rightAnkle)) drawPoint(rightAnkle, `오른쪽 ${LABELS.foot}`, '#4cc9f0');

      const detected: string[] = [];
      if (visible(head)) detected.push(LABELS.head);
      if (neck && visible(neck)) detected.push(LABELS.neck);
      if (visible(leftShoulder) || visible(rightShoulder)) detected.push(LABELS.shoulder);
      if (visible(leftElbow) || visible(rightElbow)) detected.push(LABELS.elbow);
      if (visible(leftWrist) || visible(rightWrist)) detected.push(LABELS.hand);
      if (visible(leftHip) || visible(rightHip)) detected.push(LABELS.hip);
      if (visible(leftKnee) || visible(rightKnee)) detected.push(LABELS.knee);
      if (visible(leftAnkle) || visible(rightAnkle)) detected.push(LABELS.foot);

      const pointSummary = detected.join(', ');
      setHud(pointSummary ? `인식 중: ${pointSummary}` : '관절을 찾는 중입니다.');

      const releaseVelocity = hipMid && previousHipY !== null ? hipMid.y - previousHipY : null;
      if (hipMid) {
        previousHipY = hipMid.y;
      }

      const dribbleAnalysis = buildDribbleAnalysis(landmarks);
      const shootAnalysis = buildShootAnalysis(landmarks, releaseVelocity);
      const now = Date.now();

      if (pointSummary && (pointSummary !== lastPointSummary || now - lastSentAt > 1200)) {
        lastPointSummary = pointSummary;
        lastSentAt = now;
        emit({ type: 'points', summary: pointSummary });
      }

      if (dribbleAnalysis.summary !== lastDribbleSummary || now - lastSentAt > 1200) {
        lastDribbleSummary = dribbleAnalysis.summary;
        emit({ type: 'dribble_analysis', analysis: dribbleAnalysis });
      }

      if (shootAnalysis.summary !== lastShootSummary || now - lastSentAt > 1200) {
        lastShootSummary = shootAnalysis.summary;
        emit({ type: 'shoot_analysis', analysis: shootAnalysis });
      }
    };

    const loop = () => {
      if (cancelled) {
        return;
      }

      if (!poseLandmarker || video.readyState < 2) {
        animationFrameId = window.requestAnimationFrame(loop);
        return;
      }

      if (video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        const result = poseLandmarker.detectForVideo(video, performance.now());
        const landmarks = result.landmarks && result.landmarks.length > 0 ? result.landmarks[0] : null;
        renderPose(landmarks);
      }

      animationFrameId = window.requestAnimationFrame(loop);
    };

    const start = async () => {
      try {
        if (!window.isSecureContext) {
          throw new Error('브라우저가 보안 컨텍스트가 아니라 카메라를 열 수 없습니다. localhost 또는 https에서 실행해 주세요.');
        }

        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('이 브라우저에서는 getUserMedia를 사용할 수 없습니다.');
        }

        emit({ type: 'status', message: 'MediaPipe 모델을 불러오는 중입니다.' });
        setHud('MediaPipe 모델을 불러오는 중입니다.');

        const loadVisionModule = new Function(
          'return import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest");'
        ) as () => Promise<{
          FilesetResolver: {
            forVisionTasks: (wasmRoot: string) => Promise<unknown>;
          };
          PoseLandmarker: {
            createFromOptions: (
              fileset: unknown,
              options: Record<string, unknown>
            ) => Promise<{
              detectForVideo: (video: HTMLVideoElement, timestampMs: number) => { landmarks?: Landmark[][] };
              close?: () => void;
            }>;
          };
        }>;

        const { FilesetResolver, PoseLandmarker } = await loadVisionModule();
        const fileset = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );

        poseLandmarker = await PoseLandmarker.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
          },
          runningMode: 'VIDEO',
          numPoses: 1,
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        emit({ type: 'ready' });

        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: 'user',
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        video.srcObject = stream;
        await video.play();
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        emit({ type: 'stream_started' });
        setHud('카메라 시작 완료. 자세를 분석하는 중입니다.');
        animationFrameId = window.requestAnimationFrame(loop);
      } catch (error) {
        const message = error instanceof Error ? error.message : '웹 카메라를 시작하지 못했습니다.';
        emit({ type: 'error', message });
        setHud(message);
      }
    };

    void start();

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resizeCanvas);
      stream?.getTracks().forEach((track) => track.stop());
      poseLandmarker?.close?.();
      host.innerHTML = '';
    };
  }, [isLessonActive]);

  return (
    <View style={styles.videoWrap}>
      {isLessonActive ? (
        <>
          <div ref={hostRef} style={{ width: '100%', height: '100%', backgroundColor: colors.cameraBg }} />
          <View style={styles.overlay}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{isCameraReady ? 'LIVE' : 'LOADING'}</Text>
            </View>
          </View>
        </>
      ) : (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderTitle}>카메라 대기 중</Text>
          <Text style={styles.placeholderText}>레슨 시작을 누르면 웹 카메라와 MediaPipe 분석이 바로 시작됩니다.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  videoWrap: {
    height: 560,
    backgroundColor: colors.cameraBg,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: colors.secondary,
    marginBottom: 16,
    position: 'relative',
  },
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'flex-start',
    padding: 16,
    pointerEvents: 'none',
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(230,57,70,0.9)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  badgeText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  placeholderTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 8,
  },
  placeholderText: {
    color: '#ddd1c8',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
});
