import { useEffect } from 'react';

/** Dev-only: log render + mount order to pinpoint which provider fails. Strip in production. */
export function useProviderDebug(name: string): void {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.debug(`[fusiku:provider] ${name} render`);
  }
  useEffect(() => {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.info(`[fusiku:provider] ${name} mounted`);
    }
  }, [name]);
}
