import * as Linking from 'expo-linking';
import { NativeModules, Platform } from 'react-native';
import type {
  BallBrandOption,
  BallColorOption,
  HomeworkStateRecord,
  LessonRecord,
  PositionOption,
  UserAccount,
} from '../types/app';

const AUTH_SERVER_PORT = 4317;
const AUTH_SERVER_OVERRIDE = process.env.EXPO_PUBLIC_AUTH_SERVER_URL?.trim() || '';

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
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT';
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

  if (AUTH_SERVER_OVERRIDE) {
    try {
      const overrideUrl = new URL(AUTH_SERVER_OVERRIDE);
      if (overrideUrl.hostname) {
        hosts.add(overrideUrl.hostname);
      }
    } catch {
      // Ignore malformed overrides here. The fetch path will surface a clearer error later.
    }
  }

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

export function resolveAuthServerUrl() {
  if (AUTH_SERVER_OVERRIDE) {
    try {
      return new URL(AUTH_SERVER_OVERRIDE).toString().replace(/\/$/, '');
    } catch {
      return null;
    }
  }

  const host = getCandidateHostnames().find(
    (candidate) => candidate && !candidate.endsWith('expo.dev') && !candidate.endsWith('exp.direct')
  );

  if (!host) {
    return null;
  }

  return `http://${host}:${AUTH_SERVER_PORT}`;
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
  const baseUrl = resolveAuthServerUrl();

  if (!baseUrl) {
    return {
      success: false,
      code: 'server_url_unavailable',
      message: REMOTE_SERVER_URL_MISSING_MESSAGE,
    } as T;
  }

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const payload = await readJsonResponse(response);

    if (payload) {
      return payload as T;
    }

    return {
      success: false,
      code: 'invalid_server_response',
      message: '로그인 서버 응답을 해석하지 못했습니다. 서버를 다시 실행해 주세요.',
    } as T;
  } catch {
    return {
      success: false,
      code: 'server_unavailable',
      message: REMOTE_SERVER_UNAVAILABLE_MESSAGE,
    } as T;
  }
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
