const fs = require('fs');
const net = require('net');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const AUTH_SERVER_PORT = String(process.env.AUTH_SERVER_PORT || 4317);
const projectRoot = path.resolve(__dirname, '..');
const authServerPath = path.resolve(__dirname, 'auth-server.js');
const generatedConfigPath = path.resolve(projectRoot, 'src', 'generated', 'authServerConfig.ts');
const expoCliArgs = ['expo', 'start', ...process.argv.slice(2)];

function hasArg(flag) {
  return process.argv.includes(flag);
}

function isPrivateIpv4Address(address) {
  if (address.startsWith('10.')) {
    return true;
  }

  if (address.startsWith('192.168.')) {
    return true;
  }

  const match = /^172\.(\d+)\./.exec(address);

  if (!match) {
    return false;
  }

  const secondOctet = Number(match[1]);
  return secondOctet >= 16 && secondOctet <= 31;
}

function scoreInterfaceAddress(interfaceName, address) {
  let score = 0;
  const normalizedName = interfaceName.toLowerCase();

  if (isPrivateIpv4Address(address)) {
    score += 50;
  }

  if (normalizedName.includes('wi-fi') || normalizedName.includes('wifi')) {
    score += 20;
  }

  if (normalizedName.includes('ethernet')) {
    score += 15;
  }

  if (normalizedName.includes('virtual') || normalizedName.includes('vmware') || normalizedName.includes('hyper-v')) {
    score -= 30;
  }

  return score;
}

function getPreferredLanAddress() {
  const candidates = [];
  const interfaces = os.networkInterfaces();

  for (const [interfaceName, addresses] of Object.entries(interfaces)) {
    for (const entry of addresses || []) {
      if (entry.internal || entry.family !== 'IPv4') {
        continue;
      }

      candidates.push({
        address: entry.address,
        score: scoreInterfaceAddress(interfaceName, entry.address),
      });
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((left, right) => right.score - left.score);
  return candidates[0].address;
}

function resolveAuthServerUrl() {
  const explicitUrl = process.env.EXPO_PUBLIC_AUTH_SERVER_URL?.trim();

  if (explicitUrl) {
    return explicitUrl.replace(/\/$/, '');
  }

  if (hasArg('--localhost') || hasArg('--web')) {
    return `http://127.0.0.1:${AUTH_SERVER_PORT}`;
  }

  const lanAddress = getPreferredLanAddress();

  if (!lanAddress) {
    return null;
  }

  return `http://${lanAddress}:${AUTH_SERVER_PORT}`;
}

function writeGeneratedConfigFile(url) {
  const fileContents = `export const GENERATED_AUTH_SERVER_URL = ${JSON.stringify(url || '')} as const;\n`;
  fs.mkdirSync(path.dirname(generatedConfigPath), { recursive: true });
  fs.writeFileSync(generatedConfigPath, fileContents, 'utf8');
}

function quoteWindowsShellArg(value) {
  if (!value) {
    return '""';
  }

  if (!/[\s"&|<>^]/.test(value)) {
    return value;
  }

  return `"${String(value).replace(/"/g, '\\"')}"`;
}

function createExpoSpawnConfig() {
  const expoArgs = expoCliArgs;

  if (process.platform === 'win32') {
    const commandLine = `npx ${expoArgs.map(quoteWindowsShellArg).join(' ')}`;

    return {
      command: 'cmd.exe',
      args: ['/d', '/s', '/c', commandLine],
    };
  }

  return {
    command: 'npx',
    args: expoArgs,
  };
}

function getExplicitPortArg() {
  for (let index = 0; index < expoCliArgs.length; index += 1) {
    const current = expoCliArgs[index];

    if (current === '--port') {
      const nextValue = expoCliArgs[index + 1];
      const parsed = Number(nextValue);
      return Number.isFinite(parsed) ? parsed : null;
    }

    if (current.startsWith('--port=')) {
      const parsed = Number(current.slice('--port='.length));
      return Number.isFinite(parsed) ? parsed : null;
    }
  }

  return null;
}

function isHostPortAvailable(port, host) {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.unref();
    server.on('error', () => {
      resolve(false);
    });

    server.listen(port, host, () => {
      server.close(() => resolve(true));
    });
  });
}

async function isPortAvailable(port) {
  const ipv4Available = await isHostPortAvailable(port, '0.0.0.0');
  const ipv6Available = await isHostPortAvailable(port, '::');
  return ipv4Available && ipv6Available;
}

async function ensureExpoPortArg() {
  if (getExplicitPortArg() !== null) {
    return;
  }

  const preferredPort = hasArg('--web') ? 8083 : 8081;

  if (await isPortAvailable(preferredPort)) {
    expoCliArgs.push('--port', String(preferredPort));
    return;
  }

  for (let nextPort = preferredPort + 1; nextPort < preferredPort + 20; nextPort += 1) {
    if (!(await isPortAvailable(nextPort))) {
      continue;
    }

    expoCliArgs.push('--port', String(nextPort));
    console.log(`[expo] Port ${preferredPort} is busy, using ${nextPort} instead.`);
    return;
  }

  console.warn(`[expo] Could not find a free port near ${preferredPort}. Expo may prompt for a port.`);
}

async function probeAuthServer(url) {
  if (!url) {
    return false;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1500);

  try {
    const response = await fetch(`${url}/health`, {
      method: 'GET',
      signal: controller.signal,
    });

    if (!response.ok) {
      return false;
    }

    const payload = await response.json().catch(() => null);
    return payload?.success === true;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  const authServerUrl = resolveAuthServerUrl();
  const childEnv = {
    ...process.env,
    ...(authServerUrl ? { EXPO_PUBLIC_AUTH_SERVER_URL: authServerUrl } : {}),
  };

  let authServerProcess = null;
  let authServerStopped = true;
  let expoStopped = false;

  writeGeneratedConfigFile(authServerUrl);

  if (authServerUrl) {
    console.log(`[auth] EXPO_PUBLIC_AUTH_SERVER_URL=${authServerUrl}`);
  } else {
    console.warn('[auth] Could not determine the auth server URL automatically. Set EXPO_PUBLIC_AUTH_SERVER_URL manually if login does not work.');
  }

  if (hasArg('--tunnel') && !process.env.EXPO_PUBLIC_AUTH_SERVER_URL) {
    console.warn('[auth] Tunnel mode only works for shared login when the device can still reach this computer over the network.');
  }

  await ensureExpoPortArg();

  if (authServerUrl && (await probeAuthServer(authServerUrl))) {
    console.log(`[auth] Reusing existing auth server at ${authServerUrl}`);
  } else {
    authServerStopped = false;
    authServerProcess = spawn(process.execPath, [authServerPath], {
      cwd: projectRoot,
      env: childEnv,
      stdio: 'inherit',
      windowsHide: true,
    });
  }

  const expoSpawnConfig = createExpoSpawnConfig();
  const expoProcess = spawn(expoSpawnConfig.command, expoSpawnConfig.args, {
    cwd: projectRoot,
    env: childEnv,
    stdio: 'inherit',
    windowsHide: false,
  });

  function stopChildren(signal) {
    if (!expoStopped) {
      expoProcess.kill(signal);
    }

    if (authServerProcess && !authServerStopped) {
      authServerProcess.kill(signal);
    }
  }

  if (authServerProcess) {
    authServerProcess.on('exit', (code) => {
      authServerStopped = true;

      if (!expoStopped && code !== 0) {
        console.error(`[auth-server] stopped with exit code ${code}. Expo dev server will be closed too.`);
        expoProcess.kill('SIGTERM');
      }
    });
  }

  expoProcess.on('exit', (code) => {
    expoStopped = true;

    if (authServerProcess && !authServerStopped) {
      authServerProcess.kill('SIGTERM');
    }

    process.exit(code ?? 0);
  });

  process.on('SIGINT', () => {
    stopChildren('SIGINT');
  });

  process.on('SIGTERM', () => {
    stopChildren('SIGTERM');
  });
}

main().catch((error) => {
  console.error('[start-expo-with-auth] Failed to start:', error);
  process.exit(1);
});
