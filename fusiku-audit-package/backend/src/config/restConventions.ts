/**
 * Shared REST list/pagination defaults for JSON APIs (web, mobile, integrations).
 * Route handlers can import these when implementing `?page=&pageSize=` style queries.
 */
export const REST_LIST_DEFAULTS = {
  page: 1,
  pageSize: 50,
  maxPageSize: 200,
} as const;

/** Suggested client hint header for API evolution (optional; not enforced yet). */
export const API_CLIENT_VERSION_HEADER = 'x-api-client-version';
