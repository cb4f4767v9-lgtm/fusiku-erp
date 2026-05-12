import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const root = path.resolve("c:\\fusiku-erp");
const reportDir = path.join(root, "_reports");

const IGNORE_DIRS = new Set([
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
]);

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function toRel(p) {
  return path.relative(root, p).split(path.sep).join("/");
}

function isIgnored(fullPath) {
  const rel = path.relative(root, fullPath);
  if (!rel || rel.startsWith("..")) return true;
  const parts = rel.split(path.sep);
  return parts.some((p) => IGNORE_DIRS.has(p));
}

function walkDir(dir, outFiles, outDirs) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (isIgnored(full)) continue;
    if (ent.isDirectory()) {
      outDirs.push(full);
      walkDir(full, outFiles, outDirs);
    } else if (ent.isFile()) {
      outFiles.push(full);
    }
  }
}

function writeLines(filePath, lines) {
  fs.writeFileSync(filePath, lines.join("\n") + "\n", "utf8");
}

function sha256File(filePath, maxBytes = 2_000_000) {
  try {
    const st = fs.statSync(filePath);
    if (st.size > maxBytes) return null;
    const data = fs.readFileSync(filePath);
    return {
      hash: crypto.createHash("sha256").update(data).digest("hex"),
      size: st.size,
    };
  } catch {
    return null;
  }
}

function main() {
  ensureDir(reportDir);

  const absFiles = [];
  const absDirs = [];
  walkDir(root, absFiles, absDirs);

  const files = absFiles.map(toRel).sort((a, b) => a.localeCompare(b));
  const dirs = absDirs.map(toRel).sort((a, b) => a.localeCompare(b));

  writeLines(path.join(reportDir, "inventory_files.txt"), files);
  writeLines(path.join(reportDir, "inventory_folders.txt"), dirs);

  // Duplicates by filename (quick signal).
  const byName = new Map();
  for (const f of files) {
    const name = path.posix.basename(f);
    const arr = byName.get(name) ?? [];
    arr.push(f);
    byName.set(name, arr);
  }
  const dupByName = [...byName.entries()]
    .filter(([, arr]) => arr.length > 1)
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));

  const dupNameLines = [];
  for (const [name, arr] of dupByName) {
    dupNameLines.push(`### ${name} (${arr.length})`);
    for (const p of arr) dupNameLines.push(` - ${p}`);
    dupNameLines.push("");
  }
  writeLines(path.join(reportDir, "duplicates_by_name.txt"), dupNameLines);

  // Duplicates by content hash (skip >2MB).
  const byHash = new Map();
  for (const abs of absFiles) {
    const info = sha256File(abs);
    if (!info) continue;
    const key = `${info.hash}:${info.size}`;
    const arr = byHash.get(key) ?? [];
    arr.push(toRel(abs));
    byHash.set(key, arr);
  }
  const dupHashGroups = [...byHash.values()].filter((arr) => arr.length > 1);
  const dupHashLines = [];
  for (const arr of dupHashGroups) {
    dupHashLines.push(`### ${arr.length} identical files`);
    for (const p of arr.sort((a, b) => a.localeCompare(b))) dupHashLines.push(` - ${p}`);
    dupHashLines.push("");
  }
  writeLines(path.join(reportDir, "duplicates_by_content.txt"), dupHashLines);

  // Generated dirs snapshot (even though they're ignored for inventory lists).
  const generatedDirsFound = [];
  function walkForGenerated(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      if (!ent.isDirectory()) continue;
      const full = path.join(dir, ent.name);
      if (ent.name === "dist" || ent.name === "build" || ent.name === "coverage") {
        generatedDirsFound.push(toRel(full));
        continue;
      }
      if (ent.name === ".git" || ent.name === "node_modules") continue;
      walkForGenerated(full);
    }
  }
  walkForGenerated(root);
  writeLines(
    path.join(reportDir, "generated_dirs_found.txt"),
    [...new Set(generatedDirsFound)].sort((a, b) => a.localeCompare(b)),
  );

  // Conflict markers (safe scan; skips very large files).
  const conflictHits = [];
  for (const abs of absFiles) {
    try {
      const st = fs.statSync(abs);
      if (st.size > 2_000_000) continue;
      const text = fs.readFileSync(abs, "utf8");
      const lines = text.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.startsWith("<<<<<<<") || line.startsWith("=======") || line.startsWith(">>>>>>>")) {
          conflictHits.push(`${toRel(abs)}:${i + 1}:${line}`);
        }
      }
    } catch {
      // ignore unreadable/binary files
    }
  }
  writeLines(path.join(reportDir, "conflict_markers.txt"), conflictHits);

  const summary = {
    root,
    excluded_dirs: [...IGNORE_DIRS].sort(),
    file_count_excluding_ignored: files.length,
    folder_count_excluding_ignored: dirs.length,
    duplicate_groups_by_name: dupByName.length,
    duplicate_groups_by_content: dupHashGroups.length,
    generated_dirs_found_count: new Set(generatedDirsFound).size,
    conflict_marker_hits: conflictHits.length,
  };
  fs.writeFileSync(path.join(reportDir, "summary.json"), JSON.stringify(summary, null, 2) + "\n", "utf8");
}

main();
