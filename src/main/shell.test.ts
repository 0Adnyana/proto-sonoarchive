import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('renderer bridge', () => {
  const main = readFileSync(new URL('./index.ts', import.meta.url), 'utf8')
  const preload = readFileSync(
    new URL('../preload/index.ts', import.meta.url),
    'utf8',
  )
  const bundle = readFileSync(
    new URL('../../electron.vite.config.ts', import.meta.url),
    'utf8',
  )

  it('keeps context isolation on and node out of the renderer', () => {
    expect(main).toContain('contextIsolation: true')
    expect(main).toContain('nodeIntegration: false')
    expect(main).toContain("getPath('userData')")
    expect(main).toContain('library.db')
    expect(main).toContain("properties: ['openDirectory']")
    expect(preload).toContain('contextBridge.exposeInMainWorld')
    expect(preload).toContain('importFolder')
    expect(preload).toContain('listLibrary')
    expect(preload).toContain('onLibraryChanged')
    expect(preload).not.toMatch(/from 'node:/)
    expect(preload).not.toMatch(/\brequire\(/)
  })

  it('keeps better-sqlite3 external to the Electron bundle', () => {
    expect(bundle).toContain('externalizeDeps: true')
    expect(bundle).toContain('better-sqlite3')
    expect(bundle).toContain('ffmpeg-static')
    expect(bundle).toContain('sqlite-vec')
  })
})
