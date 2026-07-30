const http = require('http');
const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');

const PORT = Number(process.env.AUTH_SERVER_PORT || 4317);
const HOST = process.env.AUTH_SERVER_HOST || '0.0.0.0';
const DATA_FILE = process.env.AUTH_SERVER_DATA_FILE
  ? path.resolve(process.cwd(), process.env.AUTH_SERVER_DATA_FILE)
  : path.resolve(__dirname, 'auth-data.json');

const EMPTY_SNAPSHOT = Object.freeze({
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
});

const EMPTY_DB = Object.freeze({
  version: 1,
  accounts: [],
  sessions: {},
});

let dbCache = null;
let writeQueue = Promise.resolve();

function cloneEmptySnapshot() {
  return JSON.parse(JSON.stringify(EMPTY_SNAPSHOT));
}

function createEmptyDb() {
  return JSON.parse(JSON.stringify(EMPTY_DB));
}

function isRecordObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeNickname(nickname) {
  return String(nickname || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

function trimNickname(nickname) {
  return String(nickname || '').trim().replace(/\s+/g, ' ');
}

function createPasswordHash(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derivedKey}`;
}

function verifyPassword(password, passwordHash) {
  if (typeof passwordHash !== 'string' || !passwordHash.includes(':')) {
    return false;
  }

  const [salt, storedHash] = passwordHash.split(':');

  if (!salt || !storedHash) {
    return false;
  }

  const derivedKey = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(derivedKey, 'hex'), Buffer.from(storedHash, 'hex'));
}

function sanitizeSnapshot(value) {
  if (!isRecordObject(value)) {
    return cloneEmptySnapshot();
  }

  return {
    attendance: isRecordObject(value.attendance) ? value.attendance : {},
    lessonRecords: Array.isArray(value.lessonRecords) ? value.lessonRecords : [],
    dribbleCounts: isRecordObject(value.dribbleCounts) ? value.dribbleCounts : {},
    shotAttempts: isRecordObject(value.shotAttempts) ? value.shotAttempts : {},
    shotSuccess: isRecordObject(value.shotSuccess) ? value.shotSuccess : {},
    ballColors: Array.isArray(value.ballColors) ? value.ballColors : ['orange'],
    ballBrand: typeof value.ballBrand === 'string' ? value.ballBrand : 'wilson',
    ballRecognitionProfile: isRecordObject(value.ballRecognitionProfile) ? value.ballRecognitionProfile : null,
    position: typeof value.position === 'string' ? value.position : 'none',
    homework: isRecordObject(value.homework) ? value.homework : {},
  };
}

function createPublicAccount(account) {
  return {
    id: account.id,
    nickname: account.nickname,
    createdAt: account.createdAt,
  };
}

function createSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

function createAccountId() {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function respondJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, OPTIONS',
    'Content-Type': 'application/json; charset=utf-8',
  });
  response.end(JSON.stringify(payload));
}

async function parseJsonBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return null;
  }

  const rawBody = Buffer.concat(chunks).toString('utf8').trim();

  if (!rawBody) {
    return null;
  }

  return JSON.parse(rawBody);
}

function sanitizeAccount(rawAccount) {
  if (!isRecordObject(rawAccount)) {
    return null;
  }

  const nickname = trimNickname(rawAccount.nickname);
  const nicknameKey = normalizeNickname(nickname);

  return {
    id: typeof rawAccount.id === 'string' ? rawAccount.id : createAccountId(),
    nickname,
    nicknameKey,
    passwordHash: typeof rawAccount.passwordHash === 'string' ? rawAccount.passwordHash : '',
    createdAt: typeof rawAccount.createdAt === 'string' ? rawAccount.createdAt : new Date().toISOString(),
    updatedAt: typeof rawAccount.updatedAt === 'string' ? rawAccount.updatedAt : new Date().toISOString(),
    snapshot: sanitizeSnapshot(rawAccount.snapshot),
  };
}

async function readDb() {
  if (dbCache) {
    return dbCache;
  }

  try {
    const rawText = await fs.readFile(DATA_FILE, 'utf8');
    const parsed = JSON.parse(rawText);

    if (!isRecordObject(parsed) || !Array.isArray(parsed.accounts) || !isRecordObject(parsed.sessions)) {
      dbCache = createEmptyDb();
      return dbCache;
    }

    dbCache = {
      version: 1,
      accounts: parsed.accounts.map(sanitizeAccount).filter(Boolean),
      sessions: parsed.sessions,
    };
  } catch {
    dbCache = createEmptyDb();
  }

  return dbCache;
}

async function writeDb(db) {
  dbCache = db;

  writeQueue = writeQueue.then(async () => {
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    await fs.writeFile(DATA_FILE, `${JSON.stringify(db, null, 2)}\n`, 'utf8');
  });

  return writeQueue;
}

function findAccountByNickname(db, nickname) {
  const nicknameKey = normalizeNickname(nickname);

  if (!nicknameKey) {
    return null;
  }

  return db.accounts.find((account) => account.nicknameKey === nicknameKey) || null;
}

function createAuthenticatedSuccessPayload(account, token) {
  return {
    success: true,
    message: '계정 연결이 완료되었습니다.',
    token,
    account: createPublicAccount(account),
    snapshot: sanitizeSnapshot(account.snapshot),
  };
}

function requireAuthenticatedAccount(db, request) {
  const authorizationHeader = request.headers.authorization;

  if (typeof authorizationHeader !== 'string' || !authorizationHeader.startsWith('Bearer ')) {
    return {
      account: null,
      token: null,
    };
  }

  const token = authorizationHeader.slice('Bearer '.length).trim();
  const session = isRecordObject(db.sessions[token]) ? db.sessions[token] : null;

  if (!session || typeof session.userId !== 'string') {
    return {
      account: null,
      token: null,
    };
  }

  const account = db.accounts.find((entry) => entry.id === session.userId) || null;

  if (!account) {
    delete db.sessions[token];
    return {
      account: null,
      token: null,
    };
  }

  db.sessions[token] = {
    ...session,
    lastUsedAt: new Date().toISOString(),
  };

  return {
    account,
    token,
  };
}

function respondInvalidSession(response) {
  respondJson(response, 401, {
    success: false,
    code: 'invalid_session',
    message: '로그인 상태가 만료되었습니다. 다시 로그인해 주세요.',
  });
}

async function handleSignup(request, response) {
  const body = await parseJsonBody(request);

  if (!isRecordObject(body)) {
    respondJson(response, 400, {
      success: false,
      code: 'invalid_request',
      message: '회원가입 정보를 다시 확인해 주세요.',
    });
    return;
  }

  const nickname = trimNickname(body.nickname);
  const password = String(body.password || '').trim();

  if (!nickname || !password) {
    respondJson(response, 400, {
      success: false,
      code: 'missing_credentials',
      message: '닉네임과 비밀번호를 모두 입력해 주세요.',
    });
    return;
  }

  const db = await readDb();
  const existingAccount = findAccountByNickname(db, nickname);

  if (existingAccount) {
    respondJson(response, 409, {
      success: false,
      code: 'nickname_taken',
      message: '이미 사용 중인 닉네임입니다. 다른 닉네임을 입력해 주세요.',
    });
    return;
  }

  const now = new Date().toISOString();
  const account = {
    id: createAccountId(),
    nickname,
    nicknameKey: normalizeNickname(nickname),
    passwordHash: createPasswordHash(password),
    createdAt: typeof body.createdAt === 'string' ? body.createdAt : now,
    updatedAt: now,
    snapshot: sanitizeSnapshot(body.snapshot),
  };

  db.accounts.push(account);

  const token = createSessionToken();
  db.sessions[token] = {
    userId: account.id,
    createdAt: now,
    lastUsedAt: now,
  };

  await writeDb(db);
  respondJson(response, 201, {
    success: true,
    message: '회원가입이 완료되었습니다.',
    token,
    account: createPublicAccount(account),
    snapshot: sanitizeSnapshot(account.snapshot),
  });
}

async function handleLogin(request, response) {
  const body = await parseJsonBody(request);

  if (!isRecordObject(body)) {
    respondJson(response, 400, {
      success: false,
      code: 'invalid_request',
      message: '로그인 정보를 다시 확인해 주세요.',
    });
    return;
  }

  const nickname = trimNickname(body.nickname);
  const password = String(body.password || '').trim();

  if (!nickname || !password) {
    respondJson(response, 400, {
      success: false,
      code: 'missing_credentials',
      message: '닉네임과 비밀번호를 모두 입력해 주세요.',
    });
    return;
  }

  const db = await readDb();
  const account = findAccountByNickname(db, nickname);

  if (!account) {
    respondJson(response, 404, {
      success: false,
      code: 'account_not_found',
      message: '입력한 닉네임의 계정을 찾지 못했습니다.',
    });
    return;
  }

  if (!verifyPassword(password, account.passwordHash)) {
    respondJson(response, 401, {
      success: false,
      code: 'password_mismatch',
      message: '비밀번호가 올바르지 않습니다.',
    });
    return;
  }

  const now = new Date().toISOString();
  const token = createSessionToken();
  db.sessions[token] = {
    userId: account.id,
    createdAt: now,
    lastUsedAt: now,
  };

  await writeDb(db);
  respondJson(response, 200, {
    success: true,
    message: '로그인되었습니다.',
    token,
    account: createPublicAccount(account),
    snapshot: sanitizeSnapshot(account.snapshot),
  });
}

async function handleGetCurrentAccount(request, response) {
  const db = await readDb();
  const { account, token } = requireAuthenticatedAccount(db, request);

  if (!account || !token) {
    respondInvalidSession(response);
    return;
  }

  await writeDb(db);
  respondJson(response, 200, createAuthenticatedSuccessPayload(account, token));
}

async function handleUpdateSnapshot(request, response) {
  const body = await parseJsonBody(request);
  const db = await readDb();
  const { account } = requireAuthenticatedAccount(db, request);

  if (!account) {
    respondInvalidSession(response);
    return;
  }

  account.snapshot = isRecordObject(body) ? sanitizeSnapshot(body.snapshot) : cloneEmptySnapshot();
  account.updatedAt = new Date().toISOString();

  await writeDb(db);
  respondJson(response, 200, {
    success: true,
    message: '계정 데이터가 동기화되었습니다.',
  });
}

async function handleUpdateProfile(request, response) {
  const body = await parseJsonBody(request);
  const db = await readDb();
  const { account, token } = requireAuthenticatedAccount(db, request);

  if (!account || !token) {
    respondInvalidSession(response);
    return;
  }

  if (!isRecordObject(body)) {
    respondJson(response, 400, {
      success: false,
      code: 'invalid_request',
      message: '변경할 닉네임을 다시 확인해 주세요.',
    });
    return;
  }

  const nickname = trimNickname(body.nickname);

  if (!nickname) {
    respondJson(response, 400, {
      success: false,
      code: 'missing_nickname',
      message: '닉네임을 입력해 주세요.',
    });
    return;
  }

  const duplicateAccount = db.accounts.find(
    (entry) => entry.id !== account.id && entry.nicknameKey === normalizeNickname(nickname)
  );

  if (duplicateAccount) {
    respondJson(response, 409, {
      success: false,
      code: 'nickname_taken',
      message: '이미 사용 중인 닉네임입니다. 다른 닉네임을 입력해 주세요.',
    });
    return;
  }

  account.nickname = nickname;
  account.nicknameKey = normalizeNickname(nickname);
  account.updatedAt = new Date().toISOString();

  await writeDb(db);
  respondJson(response, 200, {
    success: true,
    message: '닉네임이 변경되었습니다.',
    token,
    account: createPublicAccount(account),
    snapshot: sanitizeSnapshot(account.snapshot),
  });
}

async function handleUpdatePassword(request, response) {
  const body = await parseJsonBody(request);
  const db = await readDb();
  const { account } = requireAuthenticatedAccount(db, request);

  if (!account) {
    respondInvalidSession(response);
    return;
  }

  if (!isRecordObject(body)) {
    respondJson(response, 400, {
      success: false,
      code: 'invalid_request',
      message: '비밀번호 변경 정보를 다시 확인해 주세요.',
    });
    return;
  }

  const currentPassword = String(body.currentPassword || '').trim();
  const nextPassword = String(body.nextPassword || '').trim();

  if (!currentPassword || !nextPassword) {
    respondJson(response, 400, {
      success: false,
      code: 'missing_password',
      message: '현재 비밀번호와 새 비밀번호를 모두 입력해 주세요.',
    });
    return;
  }

  if (!verifyPassword(currentPassword, account.passwordHash)) {
    respondJson(response, 401, {
      success: false,
      code: 'password_mismatch',
      message: '현재 비밀번호가 올바르지 않습니다.',
    });
    return;
  }

  if (currentPassword === nextPassword) {
    respondJson(response, 400, {
      success: false,
      code: 'same_password',
      message: '새 비밀번호가 현재 비밀번호와 같습니다. 다른 비밀번호를 입력해 주세요.',
    });
    return;
  }

  account.passwordHash = createPasswordHash(nextPassword);
  account.updatedAt = new Date().toISOString();

  await writeDb(db);
  respondJson(response, 200, {
    success: true,
    message: '비밀번호가 변경되었습니다.',
  });
}

const server = http.createServer(async (request, response) => {
  try {
    if (!request.url || !request.method) {
      respondJson(response, 404, {
        success: false,
        code: 'not_found',
        message: '요청한 기능을 찾지 못했습니다.',
      });
      return;
    }

    if (request.method === 'OPTIONS') {
      response.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, OPTIONS',
      });
      response.end();
      return;
    }

    const requestUrl = new URL(request.url, `http://${request.headers.host || 'localhost'}`);

    if (request.method === 'GET' && requestUrl.pathname === '/health') {
      respondJson(response, 200, {
        success: true,
        message: 'ok',
      });
      return;
    }

    if (request.method === 'POST' && requestUrl.pathname === '/auth/signup') {
      await handleSignup(request, response);
      return;
    }

    if (request.method === 'POST' && requestUrl.pathname === '/auth/login') {
      await handleLogin(request, response);
      return;
    }

    if (request.method === 'GET' && requestUrl.pathname === '/me') {
      await handleGetCurrentAccount(request, response);
      return;
    }

    if (request.method === 'PUT' && requestUrl.pathname === '/me/snapshot') {
      await handleUpdateSnapshot(request, response);
      return;
    }

    if (request.method === 'PATCH' && requestUrl.pathname === '/me/profile') {
      await handleUpdateProfile(request, response);
      return;
    }

    if (request.method === 'POST' && requestUrl.pathname === '/me/password') {
      await handleUpdatePassword(request, response);
      return;
    }

    respondJson(response, 404, {
      success: false,
      code: 'not_found',
      message: '요청한 기능을 찾지 못했습니다.',
    });
  } catch (error) {
    console.error('[auth-server] Unexpected error:', error);
    respondJson(response, 500, {
      success: false,
      code: 'internal_error',
      message: '로그인 서버에서 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.',
    });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[auth-server] listening on http://${HOST}:${PORT}`);
  console.log(`[auth-server] data file: ${DATA_FILE}`);
});
