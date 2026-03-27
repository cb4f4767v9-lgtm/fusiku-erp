import fs from 'fs';
import path from 'path';

export type AppConfig = {
  app?: { name?: string; slogan?: string };
  branding?: { poweredBy?: string };
  ports?: { backend?: number; frontendDev?: number };
  api?: { baseUrlDesktop?: string; baseUrlWeb?: string };
};

function readJsonSafe(p: string): AppConfig | null {
  try {
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, 'utf8')) as AppConfig;
  } catch {
    return null;
  }
}

function guessConfigPaths(): string[] {
  const explicit = process.env.FUSIKU_CONFIG_PATH;
  const paths: string[] = [];
  if (explicit) paths.push(explicit);

  // When running normally (dev), cwd is often backend/
  paths.push(path.join(process.cwd(), 'config.json'));

  // When running compiled, __dirname is backend/dist/
  paths.push(path.resolve(__dirname, '../config.json'));

  // When invoked from repo root
  paths.push(path.resolve(process.cwd(), 'shared', 'config.json'));
  paths.push(path.resolve(__dirname, '../../shared/config.json'));

  return [...new Set(paths)];
}

export function loadAppConfig(): { config: AppConfig; path?: string } {
  for (const p of guessConfigPaths()) {
    const cfg = readJsonSafe(p);
    if (cfg) return { config: cfg, path: p };
  }
  return { config: {} };
}

