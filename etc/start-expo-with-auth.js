const path = require('path');
const { spawn } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');
const authServerPath = path.resolve(__dirname, 'auth-server.js');
const expoCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const expoArgs = ['expo', 'start', ...process.argv.slice(2)];

let authServerStopped = false;
let expoStopped = false;

const authServerProcess = spawn(process.execPath, [authServerPath], {
  cwd: projectRoot,
  env: process.env,
  stdio: 'inherit',
  windowsHide: true,
});

const expoProcess = spawn(expoCommand, expoArgs, {
  cwd: projectRoot,
  env: process.env,
  stdio: 'inherit',
  windowsHide: false,
});

function stopChildren(signal) {
  if (!expoStopped) {
    expoProcess.kill(signal);
  }

  if (!authServerStopped) {
    authServerProcess.kill(signal);
  }
}

authServerProcess.on('exit', (code) => {
  authServerStopped = true;

  if (!expoStopped && code !== 0) {
    console.error(`[auth-server] stopped with exit code ${code}. Expo dev server will be closed too.`);
    expoProcess.kill('SIGTERM');
  }
});

expoProcess.on('exit', (code) => {
  expoStopped = true;

  if (!authServerStopped) {
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
