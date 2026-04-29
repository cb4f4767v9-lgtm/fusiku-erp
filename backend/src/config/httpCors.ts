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