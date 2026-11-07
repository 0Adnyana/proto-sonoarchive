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
    expect(ipcChannels.libraryNotice).toBe('library:notice')
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
      catId: null,
      suggestions: [],
    }
    const suggestions = [
      { catId: 'AIRBlow', score: 0.5 },
      { catId: 'AIRBrst', score: 0.25 },
      { catId: 'AIRHiss', score: 0.125 },
      { catId: 'AIRMisc', score: 0.0625 },
      { catId: 'AIRSuck', score: 0.03125 },
    ]
    expect(isLibraryFileList([file])).toBe(true)
    expect(
      isLibraryFileList([{ ...file, catId: 'AIRBlow', suggestions }]),
    ).toBe(true)
    expect(isLibraryFileList([{ ...file, format: 'mp3' }])).toBe(false)
    expect(isLibraryFileList([{ ...file, catId: 'AIRBlow' }])).toBe(false)
    expect(
      isLibraryFileList([
        { ...file, suggestions: [{ catId: 'AIRBlow', score: Number.NaN }] },
      ]),
    ).toBe(false)
    expect(isImportFolderResult({ stored: 1, failed: ['bad.wav'] })).toBe(true)
    expect(isImportFolderResult({ stored: 1, failed: [1] })).toBe(false)
  })
})
