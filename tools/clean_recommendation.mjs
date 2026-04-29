/**
 * Generates _reports/clean_recommendation.txt — unused files, duplicates,
 * generated dirs, suspicious folders with WHY / WHERE / RISK.
 *
 * Run: node tools/clean_recommendation.mjs
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const reportDir = path.join(root, "_reports");
const outFile = path.join(reportDir, "clean_recommendation.txt");

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
  if (rel === "" || rel === ".") return false;
  return rel.split(path.sep).some((p) => IGNORE_DIR_NAMES.has(p));
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
    if (ent.isDirectory()) walkFiles(full, out);
    else if (!isIgnoredPath(full)) out.push(full);
  }
}

function toPosix(p) {
  return p.split(path.sep).join("/");
}

function relToRoot(abs) {
  return toPosix(path.relative(root, abs));
}

const CODE_EXT = [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"];

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
    while ((m = re.exec(source)) !== null) specs.add(m[1]);
  }
  return [...specs];
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
  if (fs.existsSync(base) && fs.statSync(base).isFile()) return base;
  return null;
}

function tryResolve(fromFile, specifier, aliasMap) {
  if (!specifier.startsWith(".")) {
    const entries = [...aliasMap.entries()].sort((a, b) => b[0].length - a[0].length);
    for (const [prefix, targetDir] of entries) {
      if (!targetDir) continue;
      if (specifier === prefix || specifier.startsWith(prefix)) {
        const rest = specifier.slice(prefix.length).replace(/^\//, "");
        return resolveWithExtensions(path.join(targetDir, rest));
      }
    }
    return null;
  }
  return resolveWithExtensions(path.resolve(path.dirname(fromFile), specifier));
}

function readText(abs) {
  try {
    return fs.readFileSync(abs, "utf8");
  } catch {
    return "";
  }
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

function collectTestEntries() {
  const entries = [];
  const bt = path.join(root, "backend/tests");
  if (fs.existsSync(bt)) {
    for (const f of walkFlat(bt)) {
      if (f.endsWith(".test.ts") || f.endsWith(".test.js")) entries.push(f);
    }
  }
  for (const d of [path.join(root, "frontend/tests"), path.join(root, "frontend/src/tests")]) {
    if (!fs.existsSync(d)) continue;
    for (const f of walkFlat(d)) {
      if (/\.test\.(ts|tsx)$/.test(f)) entries.push(f);
    }
  }
  return entries;
}

function htmlAssetRefs(htmlPath) {
  const html = readText(htmlPath);
  const refs = new Set();
  const re = /(?:src|href)=['"](\/[^'"]+)['"]/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const u = m[1];
    if (u.startsWith("/src/")) refs.add(path.join(root, "frontend", u.replace(/^\//, "")));
    else if (u.startsWith("/")) refs.add(path.join(root, "frontend", "public", u.replace(/^\//, "")));
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

/** Index text files under dirs for substring search (coarse "runtime" mention). */
function buildSourceCorpus(dirs) {
  const chunks = [];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    const files = [];
    walkFiles(dir, files);
    for (const f of files) {
      if (!/\.(ts|tsx|js|cjs|mjs|json|html|md|yml|yaml|bat|ps1)$/.test(f)) continue;
      if (f.includes(`${path.sep}node_modules${path.sep}`)) continue;
      try {
        const st = fs.statSync(f);
        if (st.size > 800_000) continue;
        chunks.push({ path: relToRoot(f), text: readText(f) });
      } catch {
        /* skip */
      }
    }
  }
  return chunks;
}

function stringMentionsTarget(corpus, relPosix, baseName) {
  const hits = [];
  const needles = [
    relPosix,
    relPosix.replace(/\//g, "\\"),
    `./${baseName}`,
    baseName,
  ];
  for (const { path: p, text } of corpus) {
    if (p === relPosix) continue;
    for (const n of needles) {
      if (n.length < 4 && n === baseName) continue;
      if (n.length >= 4 && text.includes(n)) {
        hits.push(p);
        break;
      }
    }
  }
  return [...new Set(hits)].filter((h) => !h.startsWith("tools/") && !h.startsWith("_reports/")).slice(0, 8);
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

function whyWhereRiskUnused(rel, corpus) {
  const base = path.posix.basename(rel);
  const mentions = stringMentionsTarget(corpus, rel, base);
  const inAppRoutes = fs.existsSync(path.join(root, "frontend/src/routes/AppRoutes.tsx"))
    ? readText(path.join(root, "frontend/src/routes/AppRoutes.tsx")).includes(base.replace(/\.tsx$/, ""))
    : false;

  let why =
    "Not reachable from the static entry graph (frontend `main.tsx` chain, `backend/src/index.ts` → `http/application.ts`, tests, configs, `worker-entry.ts`, and string-literal imports only).";
  if (mentions.length) {
    why +=
      " Other source files contain a text substring matching this path or filename (may be a comment, doc, or dynamic path — not a proven import).";
  }

  let where = "N/A — treat as dead code or a stub unless you plan a feature.";
  let risk = "MEDIUM";

  if (rel.startsWith("frontend/src/pages/") && rel.endsWith("Page.tsx")) {
    where = `If this screen should ship: add a \`lazy(() => import('…'))\` route in \`frontend/src/routes/AppRoutes.tsx\` (and path in sidebar if needed).`;
    risk = inAppRoutes ? "LOW (name appears in AppRoutes — graph may be incomplete; verify lazy path)" : "MEDIUM (likely unlinked page)";
  } else if (rel.startsWith("backend/src/routes/") && rel.endsWith(".ts")) {
    where = `If this API should be live: register the router in \`backend/src/routes/v1/index.ts\` (or the router that mounts it).`;
    risk = "HIGH if you delete while ops still call URLs; LOW if never mounted and never advertised.";
  } else if (rel.includes(".test.") || rel.includes("/tests/")) {
    where = "Run via Vitest/Jest; not part of production bundle graph.";
    risk = "HIGH if deleted — breaks CI/tests.";
  } else if (rel.startsWith("backend/src/platform/") || rel.endsWith(".types.ts")) {
    where = "Often shared contracts; may become imported when a feature wires in.";
    risk = "MEDIUM — deleting can block future imports.";
  } else if (/frontend\/src\/modules\/[^/]+\/index\.ts$/.test(rel)) {
    where = "Module barrel; keep unless you merge module entrypoints and update all `@/modules/…` imports.";
    risk = "HIGH — duplicate-looking barrels can still be different modules.";
  } else if (rel.startsWith("backend/src/jobs/") || rel.startsWith("backend/src/integrations/")) {
    where = "May be scheduled or wired from env flags; search for filename in repo before delete.";
    risk = "MEDIUM";
  }

  if (mentions.length) {
    where = `Review mentions in: ${mentions.join(", ")}. ${where}`;
    risk = "MEDIUM (string references exist)";
  }

  if (rel.endsWith("vite-env.d.ts")) {
    why = "Ambient typings for Vite; not imported as a module.";
    where = "Keep; referenced implicitly via `tsconfig` / `vite/client` types.";
    risk = "HIGH — deleting breaks `import.meta.env` typing in the frontend.";
  } else if (rel.endsWith(".d.ts") || rel.includes("/public/")) {
    why = "Declaration or public asset outside TS graph.";
    where = "N/A";
    risk = "HIGH if asset is used only by URL (not scanned).";
  }

  return { why, where, risk };
}

function findGeneratedDirs() {
  const found = [];
  function walk(dir) {
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
      if (["dist", "build", "coverage", ".cache", "win-unpacked", "out", "tmp", ".turbo", ".vite"].includes(x.name)) {
        found.push(relToRoot(full));
      }
      walk(full);
    }
  }
  walk(root);
  return [...new Set(found)].sort();
}

function suspiciousFolders() {
  const top = fs
    .readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
  const patterns = [
    /^__updater/i,
    /^logs$/i,
    /^tmp$/i,
    /^temp$/i,
    /^\.pytest_cache$/i,
    /^__pycache__$/i,
    /^uploads$/i,
  ];
  const hits = [];
  for (const name of top) {
    if (IGNORE_DIR_NAMES.has(name)) continue;
    if (patterns.some((re) => re.test(name)) || name === "logs" || name === "tmp") {
      hits.push(name);
    }
  }
  if (fs.existsSync(path.join(root, "backend", "uploads"))) hits.push("backend/uploads (user/runtime uploads)");
  if (fs.existsSync(path.join(root, "backend", "data"))) hits.push("backend/data (runtime/local data)");
  return [...new Set(hits)];
}

function main() {
  fs.mkdirSync(reportDir, { recursive: true });

  const allFiles = [];
  walkFiles(root, allFiles);

  const entries = new Set();
  const add = (p) => {
    if (fs.existsSync(p)) entries.add(path.normalize(p));
  };
  add(path.join(root, "frontend/src/main.tsx"));
  add(path.join(root, "backend/src/index.ts"));
  add(path.join(root, "desktop/electron-main.js"));
  add(path.join(root, "frontend/vite.config.ts"));
  add(path.join(root, "frontend/vitest.config.ts"));
  add(path.join(root, "backend/jest.config.cjs"));
  add(path.join(root, "backend/src/worker-entry.ts"));

  const feIndexHtml = path.join(root, "frontend/index.html");
  if (fs.existsSync(feIndexHtml)) {
    for (const a of htmlAssetRefs(feIndexHtml)) add(path.resolve(a));
  }
  for (const t of collectTestEntries()) add(t);

  const reachable = new Set([...entries]);
  const queue = [...entries];

  while (queue.length) {
    const file = queue.pop();
    const ext = path.extname(file);
    if (!CODE_EXT.includes(ext) && !file.endsWith(".ts") && !file.endsWith(".tsx")) continue;
    const src = readText(file);
    const specs = extractRelativeImports(src);
    const aliasMap = aliasesFor(file);
    for (const spec of specs) {
      const resolved = spec.startsWith(".")
        ? tryResolve(file, spec, [])
        : tryResolve(file, spec, aliasMap);
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
  const codeUnder = (prefix) =>
    allFiles.filter((f) => {
      const r = relToRoot(f);
      return r.startsWith(prefix) && scanExtensions.has(path.extname(f));
    });

  const graphScoped = [...codeUnder("frontend/src/"), ...codeUnder("backend/src/")];
  const unused = graphScoped.filter((f) => !reachable.has(path.normalize(f))).map(relToRoot).sort();

  // Omit `tools/` — scanner sources list paths and create false-positive “mentions”.
  const corpusDirs = [
    path.join(root, "frontend/src"),
    path.join(root, "backend/src"),
    path.join(root, "desktop"),
    path.join(root, "scripts"),
    path.join(root, "shared"),
  ];
  const corpus = buildSourceCorpus(corpusDirs);

  const byHash = new Map();
  for (const abs of allFiles) {
    const info = sha256File(abs);
    if (!info) continue;
    const key = `${info.h}:${info.size}`;
    const arr = byHash.get(key) ?? [];
    arr.push(relToRoot(abs));
    byHash.set(key, arr);
  }
  const dupGroups = [...byHash.values()].filter((a) => a.length > 1).sort((a, b) => b.length - a.length);

  const WATCH = new Set(["branchGuard.ts", "Sidebar.tsx", "api.ts", "appConfig.ts"]);
  const byBn = new Map();
  for (const f of allFiles) {
    const r = relToRoot(f);
    if (!/\/src\//.test(r)) continue;
    if (!scanExtensions.has(path.extname(f))) continue;
    const bn = path.posix.basename(r);
    if (!WATCH.has(bn)) continue;
    const arr = byBn.get(bn) ?? [];
    arr.push(r);
    byBn.set(bn, arr);
  }
  const purposeDupes = [...byBn.entries()].filter(([, a]) => a.length > 1).sort((a, b) => a[0].localeCompare(b[0]));

  const generated = findGeneratedDirs();
  const suspicious = suspiciousFolders();

  const lines = [];
  const L = (s) => lines.push(s);

  L("================================================================================");
  L("CLEAN RECOMMENDATION REPORT");
  L(`Generated (UTC): ${new Date().toISOString()}`);
  L(`Repository root: ${toPosix(root)}`);
  L("");
  L("SCOPE NOTES");
  L("- “Unused” = not reachable via static import/require/import() with string literal from known entrypoints.");
  L("- Does NOT prove absence of: dynamic path assembly, eval, shell scripts, DB-stored paths, or Electron file reads.");
  L("- String mention scan: other text files checked for path/filename substring (see per-file hits).");
  L("");
  L("================================================================================");
  L("1. FILES NOT USED IN THE STATIC IMPORT GRAPH (frontend/src + backend/src)");
  L("================================================================================");
  L(`Count: ${unused.length}`);
  L("");

  for (const rel of unused) {
    const { why, where, risk } = whyWhereRiskUnused(rel, corpus);
    L("--------------------------------------------------------------------------------");
    L(`FILE: ${rel}`);
    L(`WHY:  ${why}`);
    L(`WHERE: ${where}`);
    const riskTail = rel.endsWith("vite-env.d.ts")
      ? ""
      : " — deleting removes code/tests/types that nothing in the scanned graph imports; verify product/ops before removal.";
    L(`RISK: ${risk}${riskTail}`);
    L("");
  }

  L("================================================================================");
  L("2. DUPLICATE FILES (identical content, SHA-256, files ≤ 2MB)");
  L("================================================================================");
  L(`Group count: ${dupGroups.length}`);
  L("");

  for (const group of dupGroups) {
    const sorted = [...group].sort((a, b) => a.localeCompare(b));
    const prefer = sorted.find((p) => p.startsWith("frontend/public/")) || sorted[0];
    const allModuleBarrels =
      sorted.length >= 2 &&
      sorted.every((p) => /^frontend\/src\/modules\/[^/]+\/index\.ts$/.test(p));
    const allGitkeep = sorted.every((p) => p.endsWith("/.gitkeep"));
    L("--------------------------------------------------------------------------------");
    L(`GROUP (${sorted.length} files):`);
    for (const p of sorted) L(`  - ${p}`);
    L(`WHY:  Same file bytes (hash+size match).`);
    if (allModuleBarrels) {
      L(
        `WHERE: Do not delete as redundant — each path is a separate module entry (\`@/modules/inventory\`, \`@/modules/pos\`, …). Refactor only by merging exports and updating every importer.`,
      );
      L(`RISK: HIGH — deleting any file breaks that module’s import path.`);
    } else if (allGitkeep) {
      L(`WHERE: Keep both files — they anchor different empty directories for Git; identical content is coincidental.`);
      L(`RISK: MEDIUM — removing one may stop Git from tracking an otherwise-empty folder.`);
    } else {
      L(
        `WHERE: Prefer keeping \`${prefer}\` as the canonical asset; remove other paths only after confirming no DB/config/installer references the duplicate path.`,
      );
      L(
        `RISK: MEDIUM–HIGH — deleting a path that is still referenced (upload UUID, installer, docs) breaks runtime or builds.`,
      );
    }
    L("");
  }

  L("Same-purpose basename watch (not necessarily identical bytes):");
  for (const [bn, arr] of purposeDupes) {
    L("--------------------------------------------------------------------------------");
    L(`BASENAME: ${bn}`);
    for (const p of arr.sort((a, b) => a.localeCompare(b))) L(`  - ${p}`);
    L(`WHY:  Same filename in different packages — often parallel implementations or legacy vs new.`);
    L(`WHERE: Consolidate imports to one module after code review; update all importers.`);
    L(`RISK: HIGH — easy to break imports or tenant/auth behavior if wrong file wins.`);
    L("");
  }

  L("================================================================================");
  L("3. GENERATED / CACHE-STYLE DIRECTORIES (if present on disk)");
  L("================================================================================");
  if (generated.length === 0) {
    L("(none found under current tree — may have been removed or not built.)");
  } else {
    for (const d of generated) {
      L("--------------------------------------------------------------------------------");
      L(`PATH: ${d}/`);
      L(`WHY:  Directory name matches build, packager, test coverage, or tool cache output.`);
      L(`WHERE: Recreated by \`npm run build\`, \`electron-builder\`, tests, or tooling; should not be edited as source.`);
      L(`RISK: LOW for deletion of contents if you can rebuild — HIGH if you delete the only copy of a shipped installer you still need.`);
      L("");
    }
  }
  L("");

  L("================================================================================");
  L("4. SUSPICIOUS / NON-SOURCE FOLDERS (test data, temp, updater, logs, uploads)");
  L("================================================================================");
  for (const hint of suspicious) {
    L("--------------------------------------------------------------------------------");
    L(`FOLDER / AREA: ${hint}`);
    L(`WHY:  Matches common patterns for mirrors, logs, temp, or user-generated content.`);
    L(`WHERE: Prefer .gitignore + documented backup location for production data; keep uploads outside VCS when possible.`);
    L(`RISK: HIGH if it contains real customer data or the only copy of assets; LOW if confirmed disposable test mirror.`);
    L("");
  }

  L("================================================================================");
  L("END OF REPORT");
  L("================================================================================");

  fs.writeFileSync(outFile, lines.join("\n") + "\n", "utf8");
  // eslint-disable-next-line no-console
  console.log("Wrote", outFile);
}

main();
