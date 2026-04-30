import { CorsOptions } from 'cors';

export function getHttpCorsOptions(): CorsOptions {
  return {
    origin: [
      'http://localhost:5173',
      'https://fusiku-erp-production.up.railway.app'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  };
}

// Socket.IO accepts the same CORS shape (it forwards to the underlying engine).
export function getSocketIoCors(): CorsOptions {
  return getHttpCorsOptions();
}
