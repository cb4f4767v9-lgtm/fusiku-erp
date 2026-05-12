/**
 * Project health scan: unused files (import graph), duplicates, generated dirs,
 * folders not reached from backend/frontend source trees.
 *
 * Run: node tools/scan_project_health.mjs
 * Output: _reports/scan_project_health.txt (+ .json)
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const reportDir = path.join(root, "_reports");

const IGNORE_DIR_NAMES = new Set([
  ".git",
  ".cursor",
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".next",
  ".turbo",
  ".vite",
  ".cache",
  "_reports",
]);

function isIgnoredPath(abs) {
  const rel = path.relative(root, abs);
  if (rel.startsWith("..")) return true;
  // `path.relative(root, root)` is "" — must not treat repo root as ignored.
  if (rel === "" || rel === ".") return false;
  const parts = rel.split(path.sep);
  return parts.some((p) => IGNORE_DIR_NAMES.has(p));
}

function walkFiles(dir, out) {
  if (isIgnoredPath(dir)) return;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      walkFiles(full, out);
    } else {
      // Treat any non-directory entry as a file (Windows: some symlinks may not report isFile()).
      if (!isIgnoredPath(full)) out.push(full);
    }
  }
}

function toPosix(p) {
  return p.split(path.sep).join("/");
}

function relToRoot(abs) {
  return toPosix(path.relative(root, abs));
}

/** Extract relative import specifiers from source text */
function extractRelativeImports(source) {
  const specs = new Set();
  const q = String.raw`["']`;
  const patterns = [
    new RegExp(String.raw`\bfrom\s+${q}(\.[^"']+)${q}`, "g"),
    new RegExp(String.raw`\bimport\s+type\s+[^"']*?\bfrom\s+${q}(\.[^"']+)${q}`, "g"),
    new RegExp(String.raw`\bimport\s+${q}(\.[^"']+)${q}`, "g"),
    new RegExp(String.raw`\bimport\s*\(\s*${q}(\.[^"']+)${q}\s*\)`, "g"),
    new RegExp(String.raw`\brequire\s*\(\s*${q}(\.[^"']+)${q}\s*\)`, "g"),
    new RegExp(String.raw`\bexport\s+[^"']*from\s+${q}(\.[^"']+)${q}`, "g"),
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(source)) !== null) {
      specs.add(m[1]);
    }
  }
  return [...specs];
}

const CODE_EXT = [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"];

function tryResolve(fromFile, specifier, aliasMap) {
  if (!specifier.startsWith(".")) {
    const entries = [...aliasMap.entries()].sort((a, b) => b[0].length - a[0].length);
    for (const [prefix, targetDir] of entries) {
      if (!targetDir) continue;
      if (specifier === prefix || specifier.startsWith(prefix)) {
        const rest = specifier.slice(prefix.length).replace(/^\//, "");
        const base = path.join(targetDir, rest);
        return resolveWithExtensions(base);
      }
    }
    return null;
  }
  const base = path.resolve(path.dirname(fromFile), specifier);
  return resolveWithExtensions(base);
}

function resolveWithExtensions(base) {
  if (fs.existsSync(base) && fs.statSync(base).isFile()) return base;
  for (const ext of CODE_EXT) {
    const p = base + ext;
    if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
  }
  if (fs.existsSync(base) && fs.statSync(base).isDirectory()) {
    for (const ext of CODE_EXT) {
      const idx = path.join(base, "index" + ext);
      if (fs.existsSync(idx) && fs.statSync(idx).isFile()) return idx;
    }
  }
  const noExt = base;
  if (fs.existsSync(noExt) && fs.statSync(noExt).isFile()) return noExt;
  return null;
}

function readText(abs) {
  try {
    return fs.readFileSync(abs, "utf8");
  } catch {
    return "";
  }
}

function collectTestEntries(backendTestsDir) {
  const entries = [];
  if (fs.existsSync(backendTestsDir)) {
    for (const f of walkFlat(backendTestsDir)) {
      if (f.endsWith(".test.ts") || f.endsWith(".test.js")) entries.push(f);
    }
  }
  const feTests1 = path.join(root, "frontend/tests");
  const feTests2 = path.join(root, "frontend/src/tests");
  for (const d of [feTests1, feTests2]) {
    if (!fs.existsSync(d)) continue;
    for (const f of walkFlat(d)) {
      if (/\.test\.(ts|tsx)$/.test(f)) entries.push(f);
    }
  }
  return entries;
}

function walkFlat(dir) {
  const out = [];
  function w(d) {
    let e;
    try {
      e = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const x of e) {
      const p = path.join(d, x.name);
      if (x.isDirectory()) w(p);
      else out.push(p);
    }
  }
  w(dir);
  return out;
}

function htmlAssetRefs(htmlPath) {
  const html = readText(htmlPath);
  const refs = new Set();
  const re = /(?:src|href)=['"](\/[^'"]+)['"]/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const u = m[1];
    if (u.startsWith("/src/")) {
      const abs = path.join(root, "frontend", u.replace(/^\//, ""));
      refs.add(abs);
    } else if (u.startsWith("/")) {
      const abs = path.join(root, "frontend", "public", u.replace(/^\//, ""));
      refs.add(abs);
    }
  }
  return [...refs];
}

function sha256File(abs, max = 2_000_000) {
  try {
    const st = fs.statSync(abs);
    if (st.size > max) return null;
    const h = crypto.createHash("sha256").update(fs.readFileSync(abs)).digest("hex");
    return { h, size: st.size };
  } catch {
    return null;
  }
}

function main() {
  fs.mkdirSync(reportDir, { recursive: true });

  const allFiles = [];
  walkFiles(root, allFiles);

  const entries = new Set();
  const feMain = path.join(root, "frontend/src/main.tsx");
  const beMain = path.join(root, "backend/src/index.ts");
  const deskMain = path.join(root, "desktop/electron-main.js");
  const viteCfg = path.join(root, "frontend/vite.config.ts");
  const vitestCfg = path.join(root, "frontend/vitest.config.ts");
  const beJest = path.join(root, "backend/jest.config.cjs");

  if (fs.existsSync(feMain)) entries.add(feMain);
  if (fs.existsSync(beMain)) entries.add(beMain);
  if (fs.existsSync(deskMain)) entries.add(deskMain);
  if (fs.existsSync(viteCfg)) entries.add(viteCfg);
  if (fs.existsSync(vitestCfg)) entries.add(vitestCfg);
  if (fs.existsSync(beJest)) entries.add(beJest);

  const workerEntry = path.join(root, "backend/src/worker-entry.ts");
  if (fs.existsSync(workerEntry)) entries.add(workerEntry);

  const feIndexHtml = path.join(root, "frontend/index.html");
  if (fs.existsSync(feIndexHtml)) {
    for (const a of htmlAssetRefs(feIndexHtml)) {
      if (fs.existsSync(a)) entries.add(path.resolve(a));
    }
  }

  for (const t of collectTestEntries(path.join(root, "backend/tests"))) {
    entries.add(t);
  }

  function aliasesFor(file) {
    const r = relToRoot(file);
    if (r.startsWith("frontend/src/") || r.startsWith("frontend/tests/") || r.startsWith("frontend/src/tests/")) {
      const feSrc = path.join(root, "frontend", "src");
      return new Map([
        ["@/", feSrc + path.sep],
        ["@core/", path.join(feSrc, "core") + path.sep],
      ]);
    }
    return new Map();
  }

  const reachable = new Set();
  const queue = [...entries].filter((p) => fs.existsSync(p));

  for (const e of queue) reachable.add(path.normalize(e));

  while (queue.length) {
    const file = queue.pop();
    const ext = path.extname(file);
    if (!CODE_EXT.includes(ext) && !file.endsWith(".ts") && !file.endsWith(".tsx")) continue;
    const src = readText(file);
    const specs = extractRelativeImports(src);
    const aliasMap = aliasesFor(file);

    for (const spec of specs) {
      let resolved = null;
      if (spec.startsWith(".")) {
        resolved = tryResolve(file, spec, []);
      } else {
        resolved = tryResolve(file, spec, aliasMap);
      }
      if (!resolved) continue;
      const norm = path.normalize(resolved);
      if (isIgnoredPath(norm)) continue;
      if (!reachable.has(norm)) {
        reachable.add(norm);
        if (CODE_EXT.some((e) => norm.endsWith(e))) queue.push(norm);
      }
    }
  }

  const scanExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
  const codeFilesUnder = (prefix) =>
    allFiles.filter((f) => {
      const r = relToRoot(f);
      if (!r.startsWith(prefix)) return false;
      return scanExtensions.has(path.extname(f));
    });

  const feCode = codeFilesUnder("frontend/src/");
  const beCode = codeFilesUnder("backend/src/");
  const graphScoped = [...feCode, ...beCode];
  const unusedInGraph = graphScoped.filter((f) => !reachable.has(path.normalize(f)));

  const doNotDeletePatterns = [
    /^backend\/prisma\//,
    /^backend\/data\//,
    /^\.github\//,
    /^database\//,
    /^docs\//,
    /^shared\//,
    /^scripts\//,
    /^tools\//,
    /\.d\.ts$/,
    /\/public\//,
    /^frontend\/index\.html$/,
    /^desktop\//,
    /^backend\/plugins\//,
    /^backend\/tests\//,
    /^frontend\/tests\//,
    /^frontend\/src\/tests\//,
    /^package\.json$/,
    /package-lock\.json$/,
    /^\.env\.example$/,
    /\/\.env\.example$/,
    /^Dockerfile$/,
    /README\.md$/i,
  ];

  function categoryForUnused(rel) {
    if (doNotDeletePatterns.some((re) => re.test(rel))) return "DO_NOT_DELETE";
    if (/\.test\.(ts|tsx)$/.test(rel) || /\/tests?\//.test(rel)) return "DO_NOT_DELETE";
    return "REVIEW_REQUIRED";
  }

  const unusedByCat = { REVIEW_REQUIRED: [], DO_NOT_DELETE: [] };
  for (const f of unusedInGraph) {
    const rel = relToRoot(f);
    const cat = categoryForUnused(rel);
    unusedByCat[cat].push(rel);
  }
  unusedByCat.REVIEW_REQUIRED.sort();
  unusedByCat.DO_NOT_DELETE.sort();

  const byHash = new Map();
  for (const abs of allFiles) {
    const info = sha256File(abs);
    if (!info) continue;
    const key = `${info.h}:${info.size}`;
    const arr = byHash.get(key) ?? [];
    arr.push(relToRoot(abs));
    byHash.set(key, arr);
  }
  const dupContent = [...byHash.values()].filter((a) => a.length > 1).sort((a, b) => b.length - a.length);

  const WATCH_BASENAMES = new Set(["branchGuard.ts", "Sidebar.tsx", "api.ts", "appConfig.ts"]);
  const byWatchBasename = new Map();
  for (const f of allFiles) {
    const r = relToRoot(f);
    if (!/\/src\//.test(r)) continue;
    if (!scanExtensions.has(path.extname(f))) continue;
    const bn = path.posix.basename(r);
    if (!WATCH_BASENAMES.has(bn)) continue;
    const arr = byWatchBasename.get(bn) ?? [];
    arr.push(r);
    byWatchBasename.set(bn, arr);
  }
  const samePurposeBasenames = [...byWatchBasename.entries()].filter(([, arr]) => arr.length > 1);

  const generatedRoots = [];
  function findGeneratedDirs(dir) {
    let e;
    try {
      e = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const x of e) {
      if (!x.isDirectory()) continue;
      const full = path.join(dir, x.name);
      if (x.name === "node_modules" || x.name === ".git") continue;
      if (["dist", "build", "coverage", ".cache", "win-unpacked", "out"].includes(x.name)) {
        generatedRoots.push(relToRoot(full));
      }
      findGeneratedDirs(full);
    }
  }
  findGeneratedDirs(root);
  const genUnique = [...new Set(generatedRoots)].sort();

  const topDirs = fs
    .readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((n) => !IGNORE_DIR_NAMES.has(n));

  const folderReview = [];
  const folderKeep = [];

  for (const name of topDirs) {
    const rel = name;
    if (["node_modules", ".git"].includes(name)) continue;
    if (IGNORE_DIR_NAMES.has(name)) continue;
    if (["dist", "build", "coverage"].includes(name) || name === ".cache") {
      folderSafe.push(rel + "/ (generated)");
      continue;
    }
    const usedInGraph =
      name === "backend" ||
      name === "frontend" ||
      reachablePathsTouchRoot(name, reachable);
    const explicitKeep = ["database", "docs", ".github", "shared", "scripts", "desktop", "tools", "logs"].includes(
      name,
    );
    if (explicitKeep) {
      folderKeep.push(rel + "/ (used by build, docs, desktop, or tooling — not traced as TS imports)");
      continue;
    }
    if (name === "__updater_test_userData") {
      folderReview.push(rel + "/ (mirror of frontend assets — likely safe to delete from repo if not needed)");
      continue;
    }
    if (!usedInGraph && (name === "logs" || name === "_reports")) {
      folderReview.push(rel + "/");
      continue;
    }
    if (!usedInGraph) {
      folderReview.push(rel + "/ (no imports from frontend/src or backend/src graph)");
    } else {
      folderKeep.push(rel + "/");
    }
  }

  const safeDeleteGenerated = genUnique.map((p) => `${p}/`);
  const safeDeleteConditional = [
    "__updater_test_userData/ (only if you confirm it is a throwaway duplicate of `frontend/public/` — see duplicate groups)",
  ];

  const lines = [];
  lines.push("# Project scan — " + new Date().toISOString());
  lines.push("");
  lines.push("## Definitions");
  lines.push(
    "- **SAFE_DELETE**: Build/packaging output or confirmed throwaway copies. Removing these does not remove source code; re-run build if needed.",
  );
  lines.push(
    "- **REVIEW_REQUIRED**: Heuristic hits (import graph, duplicate bytes, folder reachability). May include false positives (lazy routes, optional features, Prisma-adjacent types).",
  );
  lines.push(
    "- **DO_NOT_DELETE**: Infrastructure, schema, CI, desktop shell, or paths the scanner does not prove unused. Treat as keep unless you intentionally remove a feature.",
  );
  lines.push("");
  lines.push("## Method (short)");
  lines.push("- Unused: TS/JS files under `frontend/src` and `backend/src` not reachable from entry points + HTML + vite/vitest/jest + backend/frontend tests + `worker-entry.ts`.");
  lines.push("- Aliases: `@/*`, `@core/*` (frontend only).");
  lines.push("- Duplicates: SHA-256 of file contents (files ≤2MB).");
  lines.push("- Generated: directories named `dist`, `build`, `coverage`, `.cache`, `win-unpacked`, `out` anywhere.");
  lines.push("- Folders: top-level dirs; `backend`/`frontend` always kept; prisma/docs/desktop/scripts/etc. marked DO_NOT_DELETE.");
  lines.push("");

  lines.push("## SAFE_DELETE");
  for (const p of safeDeleteGenerated) lines.push(`- \`${p}\` — build/packaging output (regenerate with build)`);
  for (const p of safeDeleteConditional) lines.push(`- \`${p}\``);
  lines.push("");

  lines.push("## REVIEW_REQUIRED");
  lines.push("### 1) Unused source files (no static import path from entries — lazy/dynamic may be missing)");
  for (const p of unusedByCat.REVIEW_REQUIRED) lines.push(`- \`${p}\``);
  if (unusedByCat.REVIEW_REQUIRED.length === 0) lines.push("- (none)");
  lines.push("");
  lines.push("### 2) Duplicate content (identical bytes, ≤2MB files)");
  for (const group of dupContent.slice(0, 80)) {
    lines.push(`- ${group.length} files:`);
    for (const p of group) lines.push(`  - \`${p}\``);
  }
  if (dupContent.length > 80) lines.push(`- ... and ${dupContent.length - 80} more groups (see JSON)`);
  lines.push("");
  lines.push("### 3) Same basename / likely overlapping purpose (manual consolidation)");
  for (const [bn, arr] of samePurposeBasenames.sort((a, b) => a[0].localeCompare(b[0]))) {
    lines.push(`- **${bn}**:`);
    for (const p of arr.sort((a, b) => a.localeCompare(b))) lines.push(`  - \`${p}\``);
  }
  if (samePurposeBasenames.length === 0) lines.push("- (none in watch list)");
  lines.push("");
  lines.push("### 4) Top-level folders not referenced by the backend/frontend import graph");
  for (const p of folderReview) lines.push(`- ${p}`);
  if (folderReview.length === 0) lines.push("- (none)");
  lines.push("");

  lines.push("## DO_NOT_DELETE");
  lines.push("### 1) Unused paths flagged by heuristics (tests, public assets, configs, …)");
  for (const p of unusedByCat.DO_NOT_DELETE) lines.push(`- \`${p}\``);
  if (unusedByCat.DO_NOT_DELETE.length === 0) lines.push("- (none)");
  lines.push("");
  lines.push("### 2) Top-level folders — keep (product, DB, CI, desktop, tooling)");
  for (const p of folderKeep) lines.push(`- ${p}`);
  lines.push("");
  lines.push("### 3) Always keep (even if not in TS import graph)");
  lines.push("- `backend/prisma/` (schema + migrations)");
  lines.push("- `backend/plugins/`");
  lines.push("- `database/`");
  lines.push("- `.github/`");
  lines.push("- `desktop/` (Electron app)");
  lines.push("- `docs/`");
  lines.push("- `shared/`, `scripts/`, `tools/`");

  const outTxt = path.join(reportDir, "scan_project_health.txt");
  const outJson = path.join(reportDir, "scan_project_health.json");
  fs.writeFileSync(outTxt, lines.join("\n") + "\n", "utf8");
  fs.writeFileSync(
    outJson,
    JSON.stringify(
      {
        definitions: {
          SAFE_DELETE:
            "Build/packaging output or confirmed throwaway copies; regenerate with build.",
          REVIEW_REQUIRED:
            "Heuristic hits — verify lazy routes, optional modules, and business need before delete.",
          DO_NOT_DELETE: "Infra, schema, CI, desktop, tooling; or scanner cannot prove unused.",
        },
        categorized: {
          SAFE_DELETE: [...safeDeleteGenerated, ...safeDeleteConditional],
          REVIEW_REQUIRED: {
            unusedSourceFiles: unusedByCat.REVIEW_REQUIRED,
            duplicateContentGroups: dupContent,
            sameBasenameWatchList: Object.fromEntries(samePurposeBasenames),
            topLevelFoldersNotInGraph: folderReview,
          },
          DO_NOT_DELETE: {
            unusedHeuristicSkips: unusedByCat.DO_NOT_DELETE,
            topLevelFoldersKeep: folderKeep,
            alwaysKeepNotes: [
              "backend/prisma/",
              "backend/plugins/",
              "database/",
              ".github/",
              "desktop/",
              "docs/",
              "shared/",
              "scripts/",
              "tools/",
            ],
          },
        },
        generatedDirs: genUnique,
        unusedReview: unusedByCat.REVIEW_REQUIRED,
        unusedDoNotDelete: unusedByCat.DO_NOT_DELETE,
        duplicateGroups: dupContent,
        sameBasenameWatchList: Object.fromEntries(samePurposeBasenames),
        topLevelFolders: { review: folderReview, keep: folderKeep, safeDelete: genUnique },
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );

  console.log("Wrote", outTxt, outJson);
}

function reachablePathsTouchRoot(rootDirName, reachableSet) {
  for (const abs of reachableSet) {
    const r = relToRoot(abs);
    if (r.startsWith(rootDirName + "/")) return true;
  }
  return false;
}

main();
