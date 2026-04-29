/** Shared kernel — gradual migration: prefer `import { … } from '@/shared'` for new files. */
export { resolveApiV1BaseUrl, resolveBackendOrigin } from '../config/apiBase';
export { canAccessModule } from '../utils/permissions';
export { getErrorMessage } from '../utils/getErrorMessage';
export { PageRouteFallback } from './components/PageRouteFallback';
