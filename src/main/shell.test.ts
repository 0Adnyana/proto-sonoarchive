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
    expect(preload).toContain('onLibraryNotice')
    expect(preload).toContain('onAnalysisProgress')
    expect(main).toContain('analysisProgress')
    expect(preload).toContain('listUcs')
    expect(preload).toContain('saveLabel')
    expect(preload).toContain('mediaUrl')
    expect(preload).toContain('resetLibrary')
    expect(main).toContain('resetLibrary')
    expect(main).toContain('cancelAnalysis')
    expect(main.indexOf('registerSchemesAsPrivileged')).toBeGreaterThan(-1)
    expect(main.indexOf('registerSchemesAsPrivileged')).toBeLessThan(
      main.indexOf('app.whenReady'),
    )
    expect(main).toContain("scheme: 'sonoarchive'")
    expect(main).toContain('net.fetch')
    expect(main).toContain('hasStoredFile')
    expect(main).toContain('saveTaggedWav')
    const readyBody = main.slice(main.indexOf('app.whenReady'))
    expect(readyBody.indexOf('registerMediaScheme()')).toBeLessThan(
      readyBody.indexOf('createWindow()'),
    )
    expect(main).toContain('did-finish-load')
    expect(main).toContain('libraryNotice')
    expect(preload).not.toMatch(/from 'node:/)
    expect(preload).not.toMatch(/\brequire\(/)
  })

  it('keeps better-sqlite3 external to the Electron bundle', () => {
    expect(bundle).toContain('externalizeDeps: true')
    expect(bundle).toContain('better-sqlite3')
    expect(bundle).toContain('ffmpeg-static')
    expect(bundle).toContain('sqlite-vec')
    expect(bundle).toContain('onnxruntime-node')
  })
})
