// Keep the backend fully self-contained in packaged Electron builds.
// Some Electron packaging setups do not include `package.json` inside resources,
// so we hardcode the version rather than reading it at runtime.
const APP_VERSION = '1.0.0';

export const versionService = {
  getFull() {
    return {
      version: APP_VERSION,
      environment: process.env.NODE_ENV || 'production',
      buildDate: new Date().toISOString()
    };
  }
};