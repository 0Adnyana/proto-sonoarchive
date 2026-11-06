import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'electron-vite'

const externalNative = ['better-sqlite3', 'ffmpeg-static']
const rendererRoot = fileURLToPath(new URL('./src/renderer', import.meta.url))

export default defineConfig({
  main: {
    build: {
      externalizeDeps: true,
      rollupOptions: {
        external: externalNative,
      },
    },
  },
  preload: {
    build: {
      externalizeDeps: true,
    },
  },
  renderer: {
    resolve: {
      alias: {
        '@': rendererRoot,
      },
    },
    plugins: [react(), tailwindcss()],
  },
})
