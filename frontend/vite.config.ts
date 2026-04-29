import type { ServerResponse } from 'http'
import path from 'path'
import type { Server } from 'http-proxy'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function sendProxyUpstreamError(res: unknown, err: NodeJS.ErrnoException) {
  if (!res || typeof (res as ServerResponse).writeHead !== 'function') return
  const httpRes = res as ServerResponse
  if (httpRes.headersSent) return
  const refused = err?.code === 'ECONNREFUSED' || err?.code === 'ECONNRESET'
  const message = refused
    ? 'Cannot reach the API on port 3001. Start the backend and wait until the terminal shows the Fusiku API ready line (remote DB startup can take 20–60s). From the repo root use: npm run dev — so API and Vite start together.'
    : String(err?.message || 'Proxy error')
  const body = JSON.stringify({
    success: false,
    code: 'API_PROXY_UPSTREAM_UNREACHABLE',
    message,
  })
  httpRes.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8' })
  httpRes.end(body)
}

/** Electron `file://` — strip crossorigin on built index.html only (dev needs default Vite HTML). */
function stripCrossoriginForElectron() {
  return {
    name: 'strip-crossorigin-electron',
    enforce: 'post' as const,
    apply: 'build' as const,
    transformIndexHtml(html: string) {
      return html.replace(/\s+crossorigin(?:="[^"]*")?/g, '')
    }
  }
}

export default defineConfig(({ command, isPreview }) => ({
  plugins: [
    react({
      jsxRuntime: 'automatic',
    }),
    stripCrossoriginForElectron(),
  ],

  /**
   * Absolute asset URLs (`/assets/...`) so deep routes like `/purchases/new` never resolve
   * scripts under `/purchases/assets/...`. Dev server still uses `/` for Vite internals.
   */
  base: '/',

  /**
   * With `VITE_API_URL=/api/v1`, the browser targets same origin. On `vite` dev (:5173), that hits Vite, not Express.
   * Proxy `/api` → backend so `POST /api/v1/auth/login` reaches `app.use('/api/v1/auth', authRoutes)`.
   * If you only run `cd frontend && npm run dev`, the API must already be listening on 3001 or every API call fails.
   */
  ...(command === 'serve' && !isPreview
    ? {
        server: {
          proxy: {
            '/api': {
              // Use localhost to allow IPv4/IPv6 resolution on Windows.
              target: 'http://localhost:3001',
              changeOrigin: true,
              timeout: 60_000,
              proxyTimeout: 60_000,
              configure(proxy: Server) {
                proxy.on('error', (err: NodeJS.ErrnoException, _req, res) => {
                  sendProxyUpstreamError(res, err)
                })
              },
            },
          },
        },
      }
    : {}),

  build: {
    outDir: 'dist',
    emptyOutDir: true,
    modulePreload: false,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/react-dom/') || id.includes('node_modules/react/')) {
            return 'vendor-react';
          }
          if (id.includes('node_modules/react-router')) return 'router';
          if (
            id.includes('node_modules/chart.js') ||
            id.includes('node_modules/react-chartjs-2') ||
            id.includes('node_modules/lightweight-charts')
          ) {
            return 'charts';
          }
          if (id.includes('node_modules/i18next') || id.includes('node_modules/react-i18next')) {
            return 'i18n';
          }
          return undefined;
        },
      },
    },
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, './src/shared'),
      '@core': path.resolve(__dirname, './src/core'),
    },
  },
}))