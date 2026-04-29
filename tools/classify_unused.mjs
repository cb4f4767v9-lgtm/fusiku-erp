/**
 * Classifies each file in the static-import "unused" set using:
 * dynamic import(), React lazy routes, v1 route registration, config strings,
 * Prisma seeds, and placeholder heuristics.
 *
 * Output: _reports/unused_classification.txt
 * Run: node tools/classify_unused.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const reportDir = path.join(root, "_reports");
const outFile = path.join(reportDir, "unused_classification.txt");

const IGNORE = new Set([".git", ".cursor", "node_modules", "dist", "build", "coverage", ".next", ".turbo", ".vite", ".cache", "_reports"]);

function isIgnored(abs) {
  const rel = path.relative(root, abs);
  if (rel.startsWith("..")) return true;
  if (rel === "" || rel === ".") return false;
  return rel.split(path.sep).some((p) => IGNORE.has(p));
}

function walkFiles(dir, out) {
  if (isIgnored(dir)) return;
  let e;
  try {
    e = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const x of e) {
    const f = path.join(dir, x.name);
    if (x.isDirectory()) walkFiles(f, out);
    else if (!isIgnored(f)) out.push(f);
  }
}

function relToRoot(abs) {
  return path.relative(root, abs).split(path.sep).join("/");
}

const CODE_EXT = [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"];

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
  return fs.existsSync(base) && fs.statSync(base).isFile() ? base : null;
}

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

function readText(p) {
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return "";
  }
}

function walkFlat(dir) {
  const o = [];
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
      else o.push(p);
    }
  }
  w(dir);
  return o;
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
  const refs = [];
  const re = /(?:src|href)=['"](\/[^'"]+)['"]/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const u = m[1];
    if (u.startsWith("/src/")) refs.push(path.join(root, "frontend", u.replace(/^\//, "")));
    else if (u.startsWith("/")) refs.push(path.join(root, "frontend", "public", u.replace(/^\//, "")));
  }
  return refs;
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

function computeUnused() {
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
    const am = aliasesFor(file);
    for (const spec of specs) {
      const resolved = spec.startsWith(".") ? tryResolve(file, spec, []) : tryResolve(file, spec, am);
      if (!resolved) continue;
      const norm = path.normalize(resolved);
      if (isIgnored(norm)) continue;
      if (!reachable.has(norm)) {
        reachable.add(norm);
        if (CODE_EXT.some((e) => norm.endsWith(e))) queue.push(norm);
      }
    }
  }

  const scanExt = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
  const codeUnder = (prefix) =>
    allFiles.filter((f) => {
      const r = relToRoot(f);
      return r.startsWith(prefix) && scanExt.has(path.extname(f));
    });

  const graph = [...codeUnder("frontend/src/"), ...codeUnder("backend/src/")];
  const unused = graph.filter((f) => !reachable.has(path.normalize(f))).map(relToRoot).sort();
  return { unused, allFiles };
}

/** Collect all dynamic import() specifiers that resolve to `targetAbs`. */
function findDynamicImportsTo(targetAbs, scanRoots) {
  const normTarget = path.normalize(targetAbs);
  const hits = [];
  const dynRe = /\bimport\s*\(\s*['"](\.[^'"]+)['"]\s*\)/g;
  for (const dir of scanRoots) {
    const files = [];
    walkFiles(dir, files);
    for (const file of files) {
      if (!/\.(tsx?|jsx?|mjs|cjs)$/.test(file)) continue;
      const src = readText(file);
      let m;
      while ((m = dynRe.exec(src)) !== null) {
        const spec = m[1];
        const resolved = tryResolve(file, spec, aliasesFor(file));
        if (resolved && path.normalize(resolved) === normTarget) {
          hits.push(`${relToRoot(file)} → import('${spec}')`);
          break;
        }
      }
    }
  }
  return hits;
}

/** Resolve every `import('…')` in AppRoutes to a repo-relative path. */
function parseAppRoutesLazyTargets(appRoutesText) {
  const from = path.join(root, "frontend/src/routes/AppRoutes.tsx");
  if (!fs.existsSync(from)) return new Set();
  const set = new Set();
  const re = /\bimport\s*\(\s*['"](\.\.[^'"]+)['"]\s*\)/g;
  let m;
  while ((m = re.exec(appRoutesText)) !== null) {
    const resolved = tryResolve(from, m[1], aliasesFor(from));
    if (resolved) set.add(relToRoot(path.normalize(resolved)));
  }
  return set;
}

/** Resolve static `from '../foo'` imports in v1/index.ts (route modules + middleware). */
function parseV1ImportTargets(v1Text) {
  const from = path.join(root, "backend/src/routes/v1/index.ts");
  if (!fs.existsSync(from)) return new Set();
  const set = new Set();
  const re = /\bfrom\s+['"](\.\.\/[^'"]+)['"]/g;
  let m;
  while ((m = re.exec(v1Text)) !== null) {
    const resolved = tryResolve(from, m[1], []);
    if (resolved) set.add(relToRoot(path.normalize(resolved)));
  }
  return set;
}

function lazyRouteHits(rel, lazyTargets) {
  return lazyTargets.has(rel) ? ["Matched resolved lazy import() in AppRoutes.tsx"] : [];
}

function v1RouteHits(rel, v1Targets) {
  return v1Targets.has(rel) ? ["Matched static import target from routes/v1/index.ts"] : [];
}

function configHits(rel, blobs) {
  const short = rel.replace(/^(frontend|backend)\/src\//, "");
  const hits = [];
  for (const { name, text } of blobs) {
    if (text.includes(rel) || text.includes(short)) hits.push(name);
  }
  return [...new Set(hits)].slice(0, 6);
}

function prismaHits(rel, prismaBlob) {
  const base = path.posix.basename(rel).replace(/\.(tsx|ts)$/, "");
  if (base.length < 4) return [];
  return prismaBlob.includes(base) ? [`prisma/ seeds or schema mention “${base}”`] : [];
}

function placeholderHeuristic(rel, absPath) {
  const body = readText(absPath);
  const lines = body.split(/\r?\n/).length;
  const lower = body.toLowerCase();
  const todo = (body.match(/\bTODO\b/g) || []).length;
  const stub =
    lower.includes("stub") ||
    lower.includes("placeholder") ||
    lower.includes("not implemented") ||
    lower.includes("no data");
  if (lines <= 25 && stub) return "Small file with stub/placeholder language — possible future module.";
  if (todo >= 3) return "Multiple TODO markers — likely in-progress feature.";
  if (rel.includes("/integrations/")) return "Under integrations/ — often vendor/feature placeholders.";
  return "No strong placeholder signal.";
}

function verdictFromChecks(rel, checks) {
  if (rel.endsWith("vite-env.d.ts")) return "KEEP";
  if (checks.lazy.length || checks.dynamic.length || checks.v1.length) return "KEEP";
  if (checks.db.length) return "KEEP";
  if (rel.endsWith(".d.ts")) return "REVIEW";
  if (/^frontend\/src\/modules\/[^/]+\/index\.ts$/.test(rel)) return "KEEP";
  if (rel.startsWith("backend/src/platform/") && rel.endsWith(".types.ts")) return "KEEP";
  if (rel.startsWith("frontend/src/pages/master-data/Master") && rel.endsWith("Page.tsx") && !rel.includes("MasterDataUnifiedPage")) {
    if (!checks.lazy.length && !checks.dynamic.length && !checks.db.length) return "SAFE_DELETE";
  }
  if (rel === "backend/src/routes/analytics.ts" && !checks.v1.length) return "SAFE_DELETE";
  if (checks.config.length && (rel.includes("config") || rel.endsWith("appConfig.ts"))) return "REVIEW";
  if (checks.dynamic.length === 0 && checks.lazy.length === 0 && checks.v1.length === 0 && rel.startsWith("backend/src/routes/"))
    return "REVIEW";
  return "REVIEW";
}

function rationale(rel, verdict, checks) {
  if (verdict === "KEEP") {
    if (checks.lazy.length) return "Wired through React.lazy / route table.";
    if (checks.dynamic.length) return "Loaded via dynamic import() from reachable code.";
    if (checks.v1.length) return "Mounted on Express v1 router.";
    if (checks.db.length) return "Referenced from Prisma layer or seeds.";
    if (rel.includes("/modules/") && rel.endsWith("/index.ts")) return "Separate module entry path; must not delete as duplicate.";
    if (rel.endsWith("vite-env.d.ts")) return "Vite ambient types.";
    if (rel.endsWith(".types.ts") && rel.includes("/platform/")) return "Shared platform typings.";
    return "Keep — evidence suggests runtime or structural use.";
  }
  if (verdict === "SAFE_DELETE") {
    return "No lazy route, no v1 mount, no dynamic import to file, no prisma hit — superseded or unmounted stub.";
  }
  return "Ambiguous — manual product review before delete.";
}

function loadConfigBlobs() {
  const blobs = [];
  const paths = [
    path.join(root, "frontend/vite.config.ts"),
    path.join(root, "frontend/vitest.config.ts"),
    path.join(root, "backend/package.json"),
    path.join(root, "frontend/package.json"),
    path.join(root, "package.json"),
    path.join(root, "shared/config.json"),
    path.join(root, "backend/src/env.ts"),
    path.join(root, "frontend/src/config/appConfig.ts"),
    path.join(root, "backend/src/config/appConfig.ts"),
  ];
  for (const p of paths) {
    if (fs.existsSync(p)) blobs.push({ name: relToRoot(p), text: readText(p) });
  }
  return blobs;
}

function loadPrismaBlob() {
  const dir = path.join(root, "backend/prisma");
  if (!fs.existsSync(dir)) return "";
  const files = [];
  walkFiles(dir, files);
  return files
    .filter((f) => f.endsWith(".ts") || f.endsWith(".sql"))
    .map((f) => readText(f))
    .join("\n")
    .slice(0, 2_000_000);
}

function main() {
  fs.mkdirSync(reportDir, { recursive: true });
  const { unused } = computeUnused();
  const appRoutesPath = path.join(root, "frontend/src/routes/AppRoutes.tsx");
  const v1Path = path.join(root, "backend/src/routes/v1/index.ts");
  const appRoutesText = fs.existsSync(appRoutesPath) ? readText(appRoutesPath) : "";
  const v1Text = fs.existsSync(v1Path) ? readText(v1Path) : "";
  const lazyTargets = parseAppRoutesLazyTargets(appRoutesText);
  const v1Targets = parseV1ImportTargets(v1Text);
  const configBlobs = loadConfigBlobs();
  const prismaBlob = loadPrismaBlob();
  const scanRoots = [path.join(root, "frontend/src"), path.join(root, "backend/src")];

  const lines = [];
  const L = (s) => lines.push(s);

  L("=".repeat(80));
  L("UNUSED FILE CLASSIFICATION (static graph baseline)");
  L(`Generated: ${new Date().toISOString()}`);
  L(`Total unused (frontend/src + backend/src): ${unused.length}`);
  L("");
  L("For each file, checks 1–6 then VERDICT:");
  L("  KEEP      = evidence of wiring (lazy, v1, dynamic import, prisma) or must-not-delete barrels/types.");
  L("  SAFE_DELETE = strong signal file is superseded or never mounted (still verify product/ops).");
  L("  REVIEW    = default when uncertain.");
  L("");
  L("=".repeat(80));

  for (const rel of unused) {
    const abs = path.join(root, rel.split("/").join(path.sep));
    const dynamic = findDynamicImportsTo(abs, scanRoots);
    const lazy = lazyRouteHits(rel, lazyTargets);
    const v1 = v1RouteHits(rel, v1Targets);
    const cfg = configHits(rel, configBlobs);
    const db = prismaHits(rel, prismaBlob);
    const ph = placeholderHeuristic(rel, abs);

    const checks = { dynamic, lazy, v1, config: cfg, db };

    const v = verdictFromChecks(rel, checks);

    L("");
    L("-".repeat(80));
    L(`FILE: ${rel}`);
    L(`VERDICT: ${v}`);
    L(`1. dynamic import() → ${dynamic.length ? dynamic.join("; ") : "no matching import() chain to this file"}`);
    L(`2. React lazy() → ${lazy.length ? lazy.join("; ") : "not a resolved lazy chunk from AppRoutes.tsx"}`);
    L(`3. backend routes/v1 → ${v1.length ? v1.join("; ") : "not a static import target of routes/v1/index.ts"}`);
    L(`4. config-based loading → ${cfg.length ? "hits: " + cfg.join(", ") : "no path/basename hit in scanned config files"}`);
    L(`5. DB-driven (prisma scan) → ${db.length ? db.join("; ") : "no basename hit in prisma .ts/.sql (truncated corpus)"}`);
    L(`6. future / placeholder → ${ph}`);
    L(`RATIONALE: ${rationale(rel, v, checks)}`);
  }

  L("");
  L("=".repeat(80));
  L("END");
  L("=".repeat(80));

  const body = lines.join("\n") + "\n";
  fs.writeFileSync(outFile, body, "utf8");

  const cleanPath = path.join(reportDir, "clean_recommendation.txt");
  if (fs.existsSync(cleanPath)) {
    const existing = readText(cleanPath);
    const marker = "APPENDIX: UNUSED FILE CLASSIFICATION";
    if (!existing.includes(marker)) {
      fs.appendFileSync(
        cleanPath,
        `\n\n${"=".repeat(80)}\n${marker} (checks 1–6 + VERDICT)\n${"=".repeat(80)}\n` +
          "(Standalone copy: _reports/unused_classification.txt)\n\n" +
          body,
        "utf8",
      );
    }
  }
  // eslint-disable-next-line no-console
  console.log("Wrote", outFile, fs.existsSync(cleanPath) ? "and appended to clean_recommendation.txt" : "");
}

main();
