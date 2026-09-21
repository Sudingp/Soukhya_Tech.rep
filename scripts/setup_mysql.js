#!/usr/bin/env node
/**
 * scripts/setup_mysql.js — Cross-Platform MySQL / MariaDB Setup & Runner
 * Works seamlessly across Linux, Windows, and macOS.
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const net = require('net');

const ROOT_DIR = path.resolve(__dirname, '..');
const PORT = parseInt(process.env.MYSQL_PORT || '3306', 10);
const HOST = process.env.MYSQL_HOST || '127.0.0.1';

function logInfo(msg) { console.log(`[INFO]  ${msg}`); }
function logOk(msg) { console.log(`[OK]    ${msg}`); }
function logWarn(msg) { console.log(`[WARN]  ${msg}`); }

function checkPort(port, host = '127.0.0.1', timeoutMs = 1000) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, host);
  });
}

function runCmdSilent(cmd, cwd = ROOT_DIR) {
  try {
    execSync(cmd, { cwd, stdio: 'pipe', encoding: 'utf8' });
    return true;
  } catch {
    return false;
  }
}

async function tryDocker() {
  const hasDocker = runCmdSilent('docker --version') || runCmdSilent('docker-compose --version');
  if (!hasDocker) return false;

  logInfo('Docker detected. Checking MySQL container...');
  const composeStarted = runCmdSilent('docker compose up -d mysql') || runCmdSilent('docker-compose up -d mysql');
  if (composeStarted) {
    for (let i = 0; i < 15; i++) {
      if (await checkPort(PORT, HOST, 1000)) {
        logOk(`MySQL 8.4 LTS container is up and listening on ${HOST}:${PORT}!`);
        return true;
      }
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  return false;
}

async function tryNativeDaemon() {
  if (process.platform === 'win32') {
    // Attempt starting standard Windows MySQL services if installed
    const services = ['MySQL84', 'MySQL80', 'MySQL', 'MariaDB', 'wampmysqld64', 'wampmysqld'];
    for (const svc of services) {
      if (runCmdSilent(`net start ${svc}`)) {
        logOk(`Started Windows service: ${svc}`);
        return true;
      }
    }
    // Check common binary install paths on Windows (XAMPP, MySQL Server)
    const winBins = [
      'C:\\xampp\\mysql\\bin\\mysqld.exe',
      'D:\\xampp\\mysql\\bin\\mysqld.exe',
      'C:\\Program Files\\MySQL\\MySQL Server 8.4\\bin\\mysqld.exe',
      'C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysqld.exe'
    ];
    for (const bin of winBins) {
      if (fs.existsSync(bin)) {
        try {
          spawn(bin, ['--console'], { detached: true, stdio: 'ignore' }).unref();
          logOk(`Started MySQL daemon from: ${bin}`);
          return true;
        } catch {}
      }
    }
  } else {
    // Linux / macOS fallback script
    const shScript = path.join(__dirname, 'setup_mysql.sh');
    if (fs.existsSync(shScript)) {
      try {
        execSync(`bash "${shScript}"`, { cwd: ROOT_DIR, stdio: 'inherit' });
        return true;
      } catch (e) {
        logWarn('Native bash script warning: ' + e.message);
      }
    }
  }
  return false;
}

async function main() {
  console.log('============================================================');
  console.log(' Soukhya Tech — Cross-Platform MySQL Setup & Runner');
  console.log('============================================================');

  // 1. If MySQL is already accessible on the target port, proceed
  if (await checkPort(PORT, HOST, 1000)) {
    logOk(`MySQL is already running and accessible on ${HOST}:${PORT}.`);
    return;
  }

  // 2. Try starting via Docker Compose
  logInfo(`MySQL is not detected on ${HOST}:${PORT}. Attempting auto-start...`);
  const dockerStarted = await tryDocker();
  if (dockerStarted) return;

  // 3. Try native system service or daemon
  await tryNativeDaemon();

  // 4. Verification loop
  for (let i = 0; i < 5; i++) {
    if (await checkPort(PORT, HOST, 1000)) {
      logOk(`MySQL is ready on ${HOST}:${PORT}.`);
      return;
    }
    await new Promise(r => setTimeout(r, 1000));
  }

  logWarn(`MySQL could not be automatically started on ${HOST}:${PORT}.`);
  logWarn('Please ensure your local MySQL server or Docker container is running.');
}

if (require.main === module) {
  main().catch(err => {
    logWarn('Setup helper notice: ' + err.message);
  });
}

module.exports = { main, checkPort };
