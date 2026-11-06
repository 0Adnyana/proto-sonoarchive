import { defineConfig } from 'electron-vite'

const externalNative = ['better-sqlite3', 'ffmpeg-static']

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
  renderer: {},
})
