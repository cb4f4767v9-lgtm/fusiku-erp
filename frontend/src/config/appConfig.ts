import configJson from '../../../shared/config.json';

export type AppConfig = typeof configJson;

export function getApiBaseUrl() {
  // Unified architecture: all clients talk to the same backend API base.
  // Default aligns with required standard: http://localhost:3001/api
  const envUrl = (import.meta as any)?.env?.VITE_API_URL as string | undefined;
  const url = (envUrl || 'http://localhost:3001/api').trim();
  return url.replace(/\/$/, '');
}

export const appConfig = configJson;

