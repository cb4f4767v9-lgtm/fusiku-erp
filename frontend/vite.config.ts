import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

/** Electron loads the UI via file:// — Vite's crossorigin on script/link breaks module/CSS loads. */
function stripCrossoriginForElectron() {
  return {
    name: 'strip-crossorigin-electron',
    enforce: 'post' as const,
    transformIndexHtml(html: string) {
      return html.replace(/\s+crossorigin(?:="[^"]*")?/g, '')
    }
  }
}

export default defineConfig({
  plugins: [react(), stripCrossoriginForElectron()],

  // Relative asset URLs (required for file:// in Electron)
  base: './',

  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Avoid extra modulepreload tags that also use crossorigin and fail under file://
    modulePreload: false
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
})