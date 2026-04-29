/**
 * Cleanup executor — reads tools/cleanup_config.json, optional SAFE_DELETE from
 * _reports/clean_recommendation.txt (appendix VERDICT blocks).
 *
 * Default: DRY RUN (log only). Use --force to delete.
 * --force requires a clean git working tree (use --allow-dirty to override).
 *
 * Workflow:
 *   node tools/scan_project_health.mjs
 *   node tools/clean_recommendation.mjs
 *   node tools/cleanup_executor.mjs
 *   node tools/cleanup_executor.mjs --force
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const configPath = path.join(__dirname, "cleanup_config.json");
const reportPath = path.join(root, "_reports", "clean_recommendation.txt");
const logPath = path.join(root, "_reports", "cleanup_log.txt");

const FORCE = process.argv.includes("--force");
const ALLOW_DIRTY = process.argv.includes("--allow-dirty");
const DRY_RUN = !FORCE;

/** Hard safety: never delete source, prisma, DB, route/module trees (even if mis-tagged SAFE_DELETE). */
const FORBIDDEN_FILE_PREFIXES = [
  "backend/src/",
  "frontend/src/",
  "backend/prisma/",
  "database/",
];
const FORBIDDEN_FILE_SUBSTRINGS = ["/routes/", "/modules/"];

function toPosix(p) {
  return p.split(path.sep).join("/");
}

function log(lines, msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  lines.push(line);
  // eslint-disable-next-line no-console
  console.log(line);
}

function ensureReportsDir(lines) {
  const dir = path.join(root, "_reports");
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (e) {
    log(lines, `ERROR: cannot create _reports: ${e?.message || e}`);
    throw e;
  }
}

function appendLog(lines) {
  ensureReportsDir(lines);
  fs.appendFileSync(logPath, lines.join("\n") + "\n", "utf8");
}

function loadConfig() {
  const raw = fs.readFileSync(configPath, "utf8");
  return JSON.parse(raw);
}

function normalizeProtect(entries) {
  return (Array.isArray(entries) ? entries : []).map((e) =>
    toPosix(String(e).replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+$/, "")),
  );
}

function isUnderProtect(relPosix, protectList) {
  const rel = relPosix.replace(/^\/+/, "");
  const r = rel.toLowerCase();
  for (const p of protectList) {
    const pl = p.toLowerCase();
    if (r === pl || r.startsWith(pl + "/")) return true;
  }
  return false;
}

function isForbiddenFileDeletion(relPosix) {
  const r = relPosix.replace(/^\/+/, "");
  for (const pre of FORBIDDEN_FILE_PREFIXES) {
    if (r === pre.slice(0, -1) || r.startsWith(pre)) return true;
  }
  for (const sub of FORBIDDEN_FILE_SUBSTRINGS) {
    if (r.includes(sub)) return true;
  }
  return false;
}

function safeResolveUnderRoot(rel) {
  const abs = path.resolve(root, rel);
  const relFrom = path.relative(root, abs);
  if (relFrom.startsWith("..") || path.isAbsolute(relFrom)) return null;
  return abs;
}

function gitStatusPorcelain() {
  try {
    return execSync("git status --porcelain", { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (e) {
    return null;
  }
}

function parseSafeDeleteFilesFromReport(reportText) {
  const chunks = reportText.split(/\r?\n-{10,}\r?\n/);
  const out = [];
  for (const chunk of chunks) {
    if (!/^\s*VERDICT:\s*SAFE_DELETE\s*$/m.test(chunk)) continue;
    const fm = chunk.match(/^FILE:\s*(.+)$/m);
    if (!fm) continue;
    const p = fm[1].trim().replace(/\\/g, "/");
    if (p) out.push(p);
  }
  return [...new Set(out)];
}

function emptyDirKeepBasenames(absDir, relPosix, keepBasenames, lines, dryRun) {
  if (!fs.existsSync(absDir)) {
    log(lines, `SKIP (missing dir): ${relPosix}`);
    return;
  }
  if (!fs.statSync(absDir).isDirectory()) {
    log(lines, `SKIP (not a directory): ${relPosix}`);
    return;
  }

  const entries = fs.readdirSync(absDir, { withFileTypes: true });
  for (const ent of entries) {
    const full = path.join(absDir, ent.name);
    const childRel = toPosix(path.join(relPosix, ent.name));
    if (keepBasenames.has(ent.name)) {
      log(lines, `KEEP (keepFiles): ${childRel}`);
      continue;
    }
    if (ent.isDirectory()) {
      emptyDirKeepBasenames(full, childRel, keepBasenames, lines, dryRun);
      if (!dryRun) {
        try {
          const left = fs.readdirSync(full);
          if (left.length === 0) fs.rmdirSync(full);
        } catch (e) {
          log(lines, `ERROR rmdir ${childRel}: ${e?.message || e}`);
        }
      }
    } else {
      if (dryRun) {
        log(lines, `[DRY RUN] would delete file: ${childRel}`);
      } else {
        try {
          fs.unlinkSync(full);
          log(lines, `DELETED file: ${childRel}`);
        } catch (e) {
          log(lines, `ERROR delete ${childRel}: ${e?.message || e}`);
        }
      }
    }
  }
}

function rmDirRecursive(relPosix, protectList, lines, dryRun) {
  if (isUnderProtect(relPosix, protectList)) {
    log(lines, `BLOCKED autoDelete (protect): ${relPosix}`);
    return;
  }
  const abs = safeResolveUnderRoot(relPosix);
  if (!abs) {
    log(lines, `BLOCKED autoDelete (path escape): ${relPosix}`);
    return;
  }
  if (!fs.existsSync(abs)) {
    log(lines, `SKIP (missing): ${relPosix}`);
    return;
  }
  if (dryRun) {
    log(lines, `[DRY RUN] would delete folder recursively: ${relPosix}`);
    return;
  }
  try {
    fs.rmSync(abs, { recursive: true, force: true });
    log(lines, `DELETED folder: ${relPosix}`);
  } catch (e) {
    log(lines, `ERROR rm ${relPosix}: ${e?.message || e}`);
  }
}

function processSafeDeleteFile(relPosix, protectList, keepBasenames, lines, dryRun) {
  const base = path.posix.basename(relPosix);
  if (keepBasenames.has(base)) {
    log(lines, `SKIP SAFE_DELETE (keepFiles): ${relPosix}`);
    return "skip";
  }
  if (isUnderProtect(relPosix, protectList) || isForbiddenFileDeletion(relPosix)) {
    log(lines, `SKIP SAFE_DELETE (forbidden/protect): ${relPosix}`);
    return "skip";
  }
  const abs = safeResolveUnderRoot(relPosix);
  if (!abs || !fs.existsSync(abs)) {
    log(lines, `SKIP SAFE_DELETE (missing): ${relPosix}`);
    return "skip";
  }
  const st = fs.statSync(abs);
  if (st.isDirectory()) {
    log(lines, `SKIP SAFE_DELETE (is directory, not file): ${relPosix}`);
    return "skip";
  }
  if (dryRun) {
    log(lines, `[DRY RUN] would delete SAFE_DELETE file: ${relPosix}`);
    return "dry";
  }
  try {
    fs.unlinkSync(abs);
    log(lines, `DELETED SAFE_DELETE file: ${relPosix}`);
    return "deleted";
  } catch (e) {
    log(lines, `ERROR SAFE_DELETE ${relPosix}: ${e?.message || e}`);
    return "error";
  }
}

function main() {
  const lines = [];
  log(lines, `=== cleanup_executor start mode=${DRY_RUN ? "DRY_RUN" : "FORCE"} ===`);

  if (!fs.existsSync(configPath)) {
    log(lines, `FATAL: missing ${toPosix(path.relative(root, configPath))}`);
    appendLog(lines);
    process.exit(1);
  }

  let cfg;
  try {
    cfg = loadConfig();
  } catch (e) {
    log(lines, `FATAL: invalid cleanup_config.json — ${e?.message || e}`);
    appendLog(lines);
    process.exit(1);
  }

  const protect = normalizeProtect(cfg.protect);
  const autoDelete = Array.isArray(cfg.autoDelete) ? cfg.autoDelete : [];
  const deleteFilesInside = Array.isArray(cfg.deleteFilesInside) ? cfg.deleteFilesInside : [];
  const keepFiles = new Set((Array.isArray(cfg.keepFiles) ? cfg.keepFiles : [".gitkeep"]).map(String));

  const porcelain = gitStatusPorcelain();
  if (porcelain === null) {
    log(lines, "WARN: git status failed (not a git repo or git missing); continuing.");
  } else if (porcelain.trim() !== "") {
    if (FORCE && !ALLOW_DIRTY) {
      log(lines, "ABORT: git working tree is not clean. Commit/stash changes or pass --allow-dirty (unsafe).");
      log(lines, "Dirty files:");
      porcelain
        .trim()
        .split("\n")
        .slice(0, 40)
        .forEach((l) => log(lines, `  ${l}`));
      appendLog(lines);
      process.exit(1);
    }
    if (DRY_RUN || ALLOW_DIRTY) {
      log(lines, "WARN: git working tree is not clean (dry run or --allow-dirty).");
    }
  } else {
    log(lines, "OK: git working tree clean.");
  }

  for (const rel of autoDelete) {
    const relPosix = toPosix(String(rel).replace(/\\/g, "/"));
    rmDirRecursive(relPosix, protect, lines, DRY_RUN);
  }

  for (const rel of deleteFilesInside) {
    const relPosix = toPosix(String(rel).replace(/\\/g, "/"));
    if (isUnderProtect(relPosix, protect)) {
      log(lines, `BLOCKED deleteFilesInside (protect): ${relPosix}`);
      continue;
    }
    const abs = safeResolveUnderRoot(relPosix);
    if (!abs) {
      log(lines, `BLOCKED deleteFilesInside (path escape): ${relPosix}`);
      continue;
    }
    log(lines, `--- deleteFilesInside (keep keepFiles): ${relPosix} ---`);
    emptyDirKeepBasenames(abs, relPosix, keepFiles, lines, DRY_RUN);
  }

  let safeDeleteFiles = [];
  if (fs.existsSync(reportPath)) {
    const reportText = fs.readFileSync(reportPath, "utf8");
    safeDeleteFiles = parseSafeDeleteFilesFromReport(reportText);
    log(lines, `Parsed SAFE_DELETE file entries from report: ${safeDeleteFiles.length}`);
  } else {
    log(lines, `SKIP report parsing: missing ${toPosix(path.relative(root, reportPath))}`);
  }

  let safeDry = 0;
  let safeSkip = 0;
  for (const rel of safeDeleteFiles) {
    const relPosix = toPosix(rel.replace(/\\/g, "/"));
    if (/\bREVIEW_REQUIRED\b|\bDO_NOT_DELETE\b/.test(relPosix)) continue;
    const r = processSafeDeleteFile(relPosix, protect, keepFiles, lines, DRY_RUN);
    if (r === "dry") safeDry += 1;
    if (r === "skip") safeSkip += 1;
  }
  if (safeDeleteFiles.length && safeSkip === safeDeleteFiles.length) {
    log(
      lines,
      "INFO: all SAFE_DELETE report paths were skipped by protect/forbidden rules (backend/src, frontend/src, /routes/, etc.).",
    );
  } else if (safeDry) {
    log(lines, `INFO: ${safeDry} SAFE_DELETE file(s) would be removed in FORCE mode (outside forbidden prefixes).`);
  }

  log(lines, "=== cleanup_executor end ===");
  appendLog(lines);
}

main();
