const { spawn } = require('child_process');

const ROOT = process.cwd();
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForUrl(url, timeoutMs = 90000, intervalMs = 500) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { method: 'GET' });
      if (res && res.ok) return true;
    } catch {
      // retry
    }
    await wait(intervalMs);
  }
  return false;
}

async function main() {
  // Hot-reload dev stack (Vite :5173 + API :3001) — no production build.
  const devStack = spawn(npmCmd, ['run', 'dev'], {
    cwd: ROOT,
    stdio: 'inherit',
    shell: true,
  });

  const backendReady = await waitForUrl('http://127.0.0.1:3001/api/health', 90000, 500);
  if (!backendReady) {
    console.error('[dev:all] Backend did not start in time (3001 /api/health).');
    if (devStack && !devStack.killed) devStack.kill();
    process.exitCode = 1;
    return;
  }

  const electronProc = spawn(npmCmd, ['run', 'electron'], {
    cwd: ROOT,
    stdio: 'inherit',
    shell: true,
  });

  const shutdown = () => {
    for (const p of [electronProc, devStack]) {
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
