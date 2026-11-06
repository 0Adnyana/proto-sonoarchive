import { describe, expect, it } from 'vitest'
import {
  ipcChannels,
  isImportFolderResult,
  isLibraryFileList,
  isPingRequest,
  isPingSuccess,
} from './ipc'

describe('ipc', () => {
  it('exports the ping channel', () => {
    expect(ipcChannels.ping).toBe('app:ping')
  })

  it('exports the library channels', () => {
    expect(ipcChannels.importFolder).toBe('library:import-folder')
    expect(ipcChannels.listLibrary).toBe('library:list')
    expect(ipcChannels.libraryChanged).toBe('library:changed')
  })

  it('recognises the ping payloads', () => {
    expect(isPingRequest({ type: 'ping' })).toBe(true)
    expect(isPingSuccess({ ok: true })).toBe(true)
    expect(isPingRequest({ ok: true })).toBe(false)
  })

  it('recognises library payloads', () => {
    const file = {
      name: 'tone.wav',
      format: 'wav',
      duration: 1,
      status: 'untagged',
    }
    expect(isLibraryFileList([file])).toBe(true)
    expect(isLibraryFileList([{ ...file, format: 'mp3' }])).toBe(false)
    expect(isImportFolderResult({ stored: 1, failed: ['bad.wav'] })).toBe(true)
    expect(isImportFolderResult({ stored: 1, failed: [1] })).toBe(false)
  })
})
