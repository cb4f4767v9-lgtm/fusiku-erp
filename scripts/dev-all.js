const { spawn } = require('child_process');

const ROOT = process.cwd();
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForUrl(url, timeoutMs = 60000, intervalMs = 500) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { method: 'GET' });
      if (res && res.ok) return true;
    } catch {
      // ignore; retry
    }
    await wait(intervalMs);
  }
  return false;
}

async function main() {
  const frontendProc = spawn(npmCmd, ['run', 'dev:frontend'], {
    cwd: ROOT,
    stdio: 'inherit',
    shell: true
  });

  const backendProc = spawn(npmCmd, ['run', 'dev:backend'], {
    cwd: ROOT,
    stdio: 'inherit',
    shell: true
  });

  // Wait for frontend and backend to be reachable before starting Electron
  const frontendReady = await waitForUrl('http://127.0.0.1:5173/', 60000, 500);
  if (!frontendReady) {
    console.error('[dev:all] Frontend did not start in time (5173).');
    process.exitCode = 1;
    return;
  }

  const backendReady = await waitForUrl('http://127.0.0.1:3001/api/health', 60000, 500);
  if (!backendReady) {
    console.error('[dev:all] Backend did not start in time (3001 /api/health).');
    process.exitCode = 1;
    return;
  }

  const electronProc = spawn(npmCmd, ['run', 'electron'], {
    cwd: ROOT,
    stdio: 'inherit',
    shell: true
  });

  const shutdown = () => {
    for (const p of [electronProc, backendProc, frontendProc]) {
      if (p && !p.killed) p.kill();
    }
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  electronProc.on('exit', (code) => {
    shutdown();
    process.exitCode = code ?? 0;
  });
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

