/**
 * Plugin loader - dynamically load plugins at startup
 * Phase 10 - Platform API & Extension Ecosystem
 */
import { Router, Express } from 'express';
import path from 'path';
import fs from 'fs';
import { pathToFileURL } from 'url';
import { logger } from './utils/logger';

export interface PluginDefinition {
  name: string;
  routes?: (router: Router) => void;
  onLoad?: () => Promise<void>;
}

export async function loadPlugins(app: Express): Promise<void> {
  const pluginsDir = path.join(process.cwd(), 'plugins');

  if (!fs.existsSync(pluginsDir)) {
    logger.info('No plugins directory found');
    return;
  }

  const dirs = fs.readdirSync(pluginsDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  for (const name of dirs) {
    try {
      const jsPath = path.join(pluginsDir, name, 'index.js');

      if (!fs.existsSync(jsPath)) {
        logger.warn({ plugin: name }, 'Plugin skipped (no index.js)');
        continue;
      }

      const resolved = path.resolve(jsPath);
      const mod = await import(pathToFileURL(resolved).href);

      const plugin: PluginDefinition = mod.default || mod;

      if (!plugin?.name) {
        logger.warn({ plugin: name }, 'Invalid plugin format');
        continue;
      }

      if (plugin.onLoad) {
        await plugin.onLoad();
      }

      if (plugin.routes) {
        const router = Router();
        plugin.routes(router);
        app.use(`/api/plugins/${plugin.name}`, router);
        logger.info({ plugin: plugin.name }, 'Plugin loaded');
      }

    } catch (err: any) {
      logger.warn({ plugin: name, err: err.message }, 'Plugin load failed');
    }
  }
}