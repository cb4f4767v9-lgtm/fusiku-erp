const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const http = require('http');
const https = require('https');
const { fileURLToPath } = require('url');

let AdmZip;
try {
  AdmZip = require('adm-zip');
} catch (_) {
  AdmZip = null;
}

function readJsonSafe(p, fallback) {
  try {
    if (!fs.existsSync(p)) return fallback;
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), 'utf8');
}

function compareVersion(a, b) {
  const pa = String(a || '0')
    .split('.')
    .map((x) => parseInt(x, 10) || 0);
  const pb = String(b || '0')
    .split('.')
    .map((x) => parseInt(x, 10) || 0);
  const n = Math.max(pa.length, pb.length);
  for (let i = 0; i < n; i++) {
    const da = pa[i] || 0;
    const db = pb[i] || 0;
    if (da > db) return 1;
    if (da < db) return -1;
  }
  return 0;
}

function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

async function fetchJson(url) {
  if (typeof url !== 'string' || url.length === 0) {
    throw new Error('Invalid manifest url');
  }

  // Support local file manifest: file:///C:/fusiku-updates/version.json
  if (url.startsWith('file://')) {
    const p = fileURLToPath(url);
    const raw = fs.readFileSync(p, 'utf8');
    return JSON.parse(raw);
  }

  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`version.json HTTP ${res.status}`);
  return res.json();
}

async function downloadToFile(url, destPath) {
  await fs.promises.mkdir(path.dirname(destPath), { recursive: true });

  // Support local file download: file:///C:/.../frontend.zip
  if (typeof url === 'string' && url.startsWith('file://')) {
    const src = fileURLToPath(url);
    fs.copyFileSync(src, destPath);
    return;
  }

  // Support plain absolute file path in manifest
  if (typeof url === 'string' && fs.existsSync(url)) {
    fs.copyFileSync(url, destPath);
    return;
  }

  const u = new URL(url);
  const lib = u.protocol === 'https:' ? https : http;
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    const req = lib.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        const loc = res.headers.location;
        file.close();
        fs.unlink(destPath, () => {});
        if (!loc) return reject(new Error('Redirect without location'));
        return downloadToFile(new URL(loc, url).href, destPath).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        file.close();
        fs.unlink(destPath, () => {});
        return reject(new Error(`Download HTTP ${res.statusCode}`));
      }
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
      file.on('error', reject);
      res.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(120_000, () => {
      req.destroy(new Error('Download timeout'));
    });
  });
}

function rmrf(p) {
  try {
    fs.rmSync(p, { recursive: true, force: true });
  } catch (_) {}
}

function getLocalFrontendIndex(userDataRoot) {
  const distIndex = path.join(userDataRoot, 'frontend', 'dist', 'index.html');
  if (fs.existsSync(distIndex)) return distIndex;
  const rootIndex = path.join(userDataRoot, 'frontend', 'index.html');
  if (fs.existsSync(rootIndex)) return rootIndex;
  return distIndex; // default
}

function resolveExtractedDistRoot(extractedRoot) {
  const rootIndex = path.join(extractedRoot, 'index.html');
  if (fs.existsSync(rootIndex)) return extractedRoot;

  const a = path.join(extractedRoot, 'dist', 'index.html');
  if (fs.existsSync(a)) return extractedRoot;

  const b = path.join(extractedRoot, 'frontend', 'dist', 'index.html');
  if (fs.existsSync(b)) return path.join(extractedRoot, 'frontend');

  // Fallback: search nested folders for a directory that contains dist/index.html
  // This handles zips like: <some-folder>/dist/index.html
  const maxDepth = 6;
  const queue = [{ dir: extractedRoot, depth: 0 }];
  while (queue.length > 0) {
    const { dir, depth } = queue.shift();
    const candidate = path.join(dir, 'dist', 'index.html');
    if (fs.existsSync(candidate)) return dir;
    if (depth >= maxDepth) continue;
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      if (e.isDirectory()) {
        queue.push({ dir: path.join(dir, e.name), depth: depth + 1 });
      }
    }
  }

  throw new Error('Invalid frontend zip: could not find dist/index.html in extracted content');
}

function swapFrontendDirs(userDataRoot, extractedRoot) {
  const normalizedRoot = resolveExtractedDistRoot(extractedRoot);
  const target = path.join(userDataRoot, 'frontend');
  const prev = path.join(userDataRoot, 'frontend-prev');

  const distExtractedIndex = path.join(normalizedRoot, 'dist', 'index.html');
  const rootExtractedIndex = path.join(normalizedRoot, 'index.html');
  const extractedIndex = fs.existsSync(distExtractedIndex)
    ? distExtractedIndex
    : rootExtractedIndex;

  if (!fs.existsSync(extractedIndex)) {
    rmrf(extractedRoot);
    throw new Error('Invalid frontend zip: index.html missing');
  }

  rmrf(prev);
  if (fs.existsSync(target)) {
    try {
      fs.renameSync(target, prev);
    } catch {
      rmrf(prev);
      rmrf(target);
    }
  }
  fs.renameSync(normalizedRoot, target);
  if (normalizedRoot !== extractedRoot) {
    rmrf(extractedRoot);
  }
  rmrf(prev);

  const distIndex = path.join(target, 'dist', 'index.html');
  if (fs.existsSync(distIndex)) return distIndex;
  const rootIndex = path.join(target, 'index.html');
  if (fs.existsSync(rootIndex)) return rootIndex;
  throw new Error('Invalid frontend zip after extract: index.html missing');
}

/**
 * @param {object} opts
 * @param {string} opts.userDataRoot - app.getPath('userData')
 * @param {string} opts.manifestUrl - full URL or file:// path to version.json
 * @param {(msg: string) => void} [opts.log]
 * @returns {Promise<{ indexPath: string | null, updated: boolean, error?: string }>}
 */
async function ensureHotFrontend(opts) {
  const { userDataRoot, manifestUrl, log } = opts;
  const logFn = log || (() => {});
  const versionPath = path.join(userDataRoot, 'version.json');
  const local = readJsonSafe(versionPath, { version: '0.0.0' });
  const localVer = local.version || '0.0.0';

  let manifest;
  try {
    logFn('[Updater] Checking version');
    manifest = await fetchJson(manifestUrl);
  } catch (e) {
    logFn(`[Updater] Manifest read failed: ${e.message}`);
    const localIndex = getLocalFrontendIndex(userDataRoot);
    if (fs.existsSync(localIndex)) {
      return { indexPath: localIndex, updated: false };
    }
    return { indexPath: null, updated: false, error: e.message };
  }

  const remoteVer = String(manifest.version || '0.0.0');
  const zipUrl = String(manifest.url || '').trim();
  const expectSha = String(manifest.sha256 || '').trim().toLowerCase();

  if (!zipUrl || compareVersion(remoteVer, localVer) <= 0) {
    logFn(`[Updater] No update. remote=${remoteVer} local=${localVer}`);
    const localIndex = getLocalFrontendIndex(userDataRoot);
    if (fs.existsSync(localIndex)) {
      return { indexPath: localIndex, updated: false };
    }
    return { indexPath: null, updated: false };
  }

  logFn(`[Updater] New version found ${remoteVer} (local ${localVer})`);
  logFn(`[Updater] Extracting update`);

  const tmpZip = path.join(userDataRoot, 'tmp', 'frontend-update.zip');
  const tmpExtract = path.join(userDataRoot, 'tmp', 'frontend-extract');
  rmrf(path.join(userDataRoot, 'tmp'));
  fs.mkdirSync(path.dirname(tmpZip), { recursive: true });

  try {
    logFn(`[Updater] Downloading frontend.zip`);
    await downloadToFile(zipUrl, tmpZip);
  } catch (e) {
    logFn(`[Updater] Download failed: ${e.message}`);
    rmrf(path.join(userDataRoot, 'tmp'));
    const localIndex = getLocalFrontendIndex(userDataRoot);
    if (fs.existsSync(localIndex)) return { indexPath: localIndex, updated: false };
    return { indexPath: null, updated: false, error: e.message };
  }

  const hash = sha256File(tmpZip);
  if (expectSha && hash.toLowerCase() !== expectSha) {
    logFn(`[Updater] sha256 mismatch expected=${expectSha} actual=${hash}`);
    rmrf(path.join(userDataRoot, 'tmp'));
    const localIndex = getLocalFrontendIndex(userDataRoot);
    if (fs.existsSync(localIndex)) return { indexPath: localIndex, updated: false };
    return { indexPath: null, updated: false, error: 'sha256 mismatch' };
  }

  if (!AdmZip) {
    rmrf(path.join(userDataRoot, 'tmp'));
    logFn('[Updater] adm-zip not installed');
    return { indexPath: null, updated: false, error: 'adm-zip missing' };
  }

  fs.mkdirSync(tmpExtract, { recursive: true });
  try {
    const zip = new AdmZip(tmpZip);
    zip.extractAllTo(tmpExtract, true);
  } catch (e) {
    rmrf(path.join(userDataRoot, 'tmp'));
    logFn(`[Updater] extract failed: ${e.message}`);
    const localIndex = getLocalFrontendIndex(userDataRoot);
    if (fs.existsSync(localIndex)) return { indexPath: localIndex, updated: false };
    return { indexPath: null, updated: false, error: e.message };
  }

  let indexPath;
  try {
    indexPath = swapFrontendDirs(userDataRoot, tmpExtract);
  } catch (e) {
    rmrf(tmpExtract);
    rmrf(tmpZip);
    logFn(`[hot-update] swap failed: ${e.message}`);
    const localIndex = getLocalFrontendIndex(userDataRoot);
    if (fs.existsSync(localIndex)) return { indexPath: localIndex, updated: false };
    return { indexPath: null, updated: false, error: e.message };
  }

  rmrf(path.join(userDataRoot, 'tmp'));
  writeJson(versionPath, {
    version: remoteVer,
    installedAt: new Date().toISOString(),
    source: 'hot',
    sha256: hash,
  });
  logFn(`[Updater] installed ${remoteVer}`);
  return { indexPath, updated: true };
}

module.exports = { ensureHotFrontend, readJsonSafe, writeJson };
