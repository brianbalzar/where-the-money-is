import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages project page is served from /<repo>/. The deploy workflow sets
// VITE_BASE from the repository name, so this default only matters locally.
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE ?? '/',
  build: { outDir: 'dist', chunkSizeWarningLimit: 1500 },
  // Polling so edits made from outside VS Code (e.g. by Claude) trigger reloads on Windows.
  server: { watch: { usePolling: true, interval: 400 } },
})
