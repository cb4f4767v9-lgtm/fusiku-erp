import { CorsOptions } from 'cors';

export function getHttpCorsOptions(): CorsOptions {
  return {
    origin: [
      'http://localhost:5173',
      'https://fusiku-erp-production.up.railway.app'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    // Must include all headers the frontend may send; otherwise the browser preflight fails
    // and Axios reports a generic "Network Error" even though the backend handled the request.
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'x-lang',
      'x-currency',
      'x-tenant-id',
      'x-request-id',
      'x-idempotency-key',
      'x-api-key',
      'x-internal-register-token',
      // Observability headers (Sentry / tracing)
      'sentry-trace',
      'baggage',
    ],
  };
}

// Socket.IO accepts the same CORS shape (it forwards to the underlying engine).
export function getSocketIoCors(): CorsOptions {
  return getHttpCorsOptions();
}
