import * as Linking from 'expo-linking';
import { NativeModules, Platform } from 'react-native';
import type {
  BallBrandOption,
  BallColorOption,
  BallRecognitionProfile,
  HomeworkStateRecord,
  LessonRecord,
  PositionOption,
  UserAccount,
} from '../types/app';
import { GENERATED_AUTH_SERVER_URL } from '../generated/authServerConfig';

const AUTH_SERVER_PORT = 4317;
const REMOTE_REQUEST_TIMEOUT_MS = 2500;
const AUTH_SERVER_OVERRIDE =
  GENERATED_AUTH_SERVER_URL.trim() || process.env.EXPO_PUBLIC_AUTH_SERVER_URL?.trim() || '';

const REMOTE_SERVER_UNAVAILABLE_MESSAGE =
  '공용 로그인 서버에 연결할 수 없습니다. 같은 네트워크에서 앱을 실행하고 `npm run start`로 개발 서버를 함께 켜 주세요.';
const REMOTE_SERVER_URL_MISSING_MESSAGE =
  '공용 로그인 서버 주소를 찾지 못했습니다. 앱을 `npm run start:lan`으로 실행하거나 `EXPO_PUBLIC_AUTH_SERVER_URL`을 설정해 주세요.';

export interface RemoteAccountSnapshot {
  attendance: Record<string, string>;
  lessonRecords: LessonRecord[];
  dribbleCounts: Record<string, number>;
  shotAttempts: Record<string, number>;
  shotSuccess: Record<string, number>;
  ballColors: BallColorOption[];
  ballBrand: BallBrandOption;
  ballRecognitionProfile: BallRecognitionProfile | null;
  position: PositionOption;
  homework: HomeworkStateRecord;
}

export interface RemoteActionResult {
  success: boolean;
  message: string;
  code?: string;
}

export interface RemoteAuthResult extends RemoteActionResult {
  token?: string;
  account?: UserAccount;
  snapshot?: RemoteAccountSnapshot;
}

interface RemoteRequestOptions {
  body?: unknown;
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  token?: string | null;
}

export function createEmptyRemoteSnapshot(): RemoteAccountSnapshot {
  return {
    attendance: {},
    lessonRecords: [],
    dribbleCounts: {},
    shotAttempts: {},
    shotSuccess: {},
    ballColors: ['orange'],
    ballBrand: 'wilson',
    ballRecognitionProfile: null,
    position: 'none',
    homework: {},
  };
}

function parseHostnameFromUrl(rawUrl: string | null | undefined) {
  if (!rawUrl) {
    return null;
  }

  try {
    return new URL(rawUrl).hostname || null;
  } catch {
    return null;
  }
}

function getCandidateHostnames() {
  const hosts = new Set<string>();

  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location.hostname) {
    hosts.add(window.location.hostname);
  }

  const scriptUrl = NativeModules?.SourceCode?.scriptURL;
  const scriptHost = parseHostnameFromUrl(typeof scriptUrl === 'string' ? scriptUrl : null);

  if (scriptHost) {
    hosts.add(scriptHost);
  }

  const linkingUrl = Linking.createURL('/');
  const linkingHost = parseHostnameFromUrl(linkingUrl);

  if (linkingHost) {
    hosts.add(linkingHost);
  }

  return [...hosts];
}

function normalizeBaseUrl(rawUrl: string | null | undefined) {
  if (!rawUrl) {
    return null;
  }

  try {
    const parsed = new URL(rawUrl);
    const protocol = parsed.protocol || 'http:';
    const host = parsed.hostname;
    const port = parsed.port || String(AUTH_SERVER_PORT);

    if (!host) {
      return null;
    }

    return `${protocol}//${host}:${port}`;
  } catch {
    return null;
  }
}

function buildCandidateBaseUrls() {
  const candidates: string[] = [];
  const seen = new Set<string>();

  function pushCandidate(nextUrl: string | null) {
    if (!nextUrl || seen.has(nextUrl)) {
      return;
    }

    seen.add(nextUrl);
    candidates.push(nextUrl);
  }

  for (const host of getCandidateHostnames()) {
    if (!host || host.endsWith('expo.dev') || host.endsWith('exp.direct')) {
      continue;
    }

    pushCandidate(`http://${host}:${AUTH_SERVER_PORT}`);
  }

  pushCandidate(normalizeBaseUrl(AUTH_SERVER_OVERRIDE));
  return candidates;
}

export function resolveAuthServerUrl() {
  return buildCandidateBaseUrls()[0] ?? null;
}

async function readJsonResponse(response: Response) {
  try {
    return (await response.json()) as RemoteActionResult;
  } catch {
    return null;
  }
}

async function requestRemote<T extends RemoteActionResult>(
  path: string,
  { body, method = 'GET', token }: RemoteRequestOptions = {}
): Promise<T> {
  const baseUrls = buildCandidateBaseUrls();

  if (baseUrls.length === 0) {
    return {
      success: false,
      code: 'server_url_unavailable',
      message: REMOTE_SERVER_URL_MISSING_MESSAGE,
    } as T;
  }

  let sawNonJsonResponse = false;

  for (const baseUrl of baseUrls) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REMOTE_REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
      const payload = await readJsonResponse(response);

      if (payload) {
        return payload as T;
      }

      sawNonJsonResponse = true;
    } catch {
      // Try the next candidate URL before surfacing a failure.
    } finally {
      clearTimeout(timeout);
    }
  }

  if (sawNonJsonResponse) {
    return {
      success: false,
      code: 'invalid_server_response',
      message: '로그인 서버 응답을 해석하지 못했습니다. 서버를 다시 실행해 주세요.',
    } as T;
  }

  return {
    success: false,
    code: 'server_unavailable',
    message: REMOTE_SERVER_UNAVAILABLE_MESSAGE,
  } as T;
}

export function loginRemoteAccount(values: {
  nickname: string;
  password: string;
}) {
  return requestRemote<RemoteAuthResult>('/auth/login', {
    method: 'POST',
    body: values,
  });
}

export function signupRemoteAccount(values: {
  nickname: string;
  password: string;
  createdAt?: string;
  snapshot?: RemoteAccountSnapshot;
}) {
  return requestRemote<RemoteAuthResult>('/auth/signup', {
    method: 'POST',
    body: values,
  });
}

export function fetchRemoteSession(token: string) {
  return requestRemote<RemoteAuthResult>('/me', {
    token,
  });
}

export function updateRemoteAccountSnapshot(token: string, snapshot: RemoteAccountSnapshot) {
  return requestRemote<RemoteActionResult>('/me/snapshot', {
    method: 'PUT',
    token,
    body: { snapshot },
  });
}

export function updateRemoteAccountProfile(
  token: string,
  values: {
    nickname: string;
  }
) {
  return requestRemote<RemoteAuthResult>('/me/profile', {
    method: 'PATCH',
    token,
    body: values,
  });
}

export function updateRemoteAccountPassword(
  token: string,
  values: {
    currentPassword: string;
    nextPassword: string;
  }
) {
  return requestRemote<RemoteActionResult>('/me/password', {
    method: 'POST',
    token,
    body: values,
  });
}

export function deleteRemoteAccount(
  token: string,
  values: {
    password: string;
  }
) {
  return requestRemote<RemoteActionResult>('/me', {
    method: 'DELETE',
    token,
    body: values,
  });
}
