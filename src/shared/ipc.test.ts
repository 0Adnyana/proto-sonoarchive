import { describe, expect, it } from 'vitest'
import {
  ipcChannels,
  isAnalysisProgress,
  isImportFolderResult,
  isLibraryFileList,
  isPingRequest,
  isPingSuccess,
  isSearchHitList,
} from './ipc'

describe('ipc', () => {
  it('exports the ping channel', () => {
    expect(ipcChannels.ping).toBe('app:ping')
  })

  it('exports the library channels', () => {
    expect(ipcChannels.importFolder).toBe('library:import-folder')
    expect(ipcChannels.listLibrary).toBe('library:list')
    expect(ipcChannels.searchText).toBe('library:search-text')
    expect(ipcChannels.findSimilar).toBe('library:find-similar')
    expect(ipcChannels.libraryChanged).toBe('library:changed')
    expect(ipcChannels.libraryNotice).toBe('library:notice')
    expect(ipcChannels.analysisProgress).toBe('library:analysis-progress')
    expect(ipcChannels.listUcs).toBe('library:list-ucs')
    expect(ipcChannels.saveLabel).toBe('library:save-label')
    expect(ipcChannels.mediaUrl).toBe('library:media-url')
    expect(ipcChannels.resetLibrary).toBe('library:reset')
  })

  it('recognises the ping payloads', () => {
    expect(isPingRequest({ type: 'ping' })).toBe(true)
    expect(isPingSuccess({ ok: true })).toBe(true)
    expect(isPingRequest({ ok: true })).toBe(false)
  })

  it('recognises library payloads', () => {
    const file = {
      path: '/library/tone.wav',
      name: 'tone.wav',
      format: 'wav',
      duration: 1,
      status: 'untagged',
      catId: null,
      suggestions: [],
      label: null,
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
    const label = {
      catId: 'DOORWood',
      fxName: 'Door',
      creatorId: '',
      sourceId: '',
      rank: 'manual',
    }
    expect(
      isLibraryFileList([
        {
          ...file,
          status: 'tagged',
          catId: 'DOORWood',
          suggestions,
          label,
        },
      ]),
    ).toBe(true)
    expect(
      isLibraryFileList([
        { ...file, status: 'tagged', catId: 'DOORWood', label },
      ]),
    ).toBe(true)
    expect(
      isLibraryFileList([
        { ...file, status: 'tagged', catId: 'AIRBlow', label },
      ]),
    ).toBe(false)
    expect(isLibraryFileList([{ ...file, status: 'tagged', label }])).toBe(
      false,
    )
    expect(isLibraryFileList([{ ...file, label }])).toBe(false)
    expect(isLibraryFileList([{ ...file, format: 'mp3' }])).toBe(false)
    expect(isLibraryFileList([{ ...file, catId: 'AIRBlow' }])).toBe(false)
    expect(
      isLibraryFileList([
        { ...file, suggestions: [{ catId: 'AIRBlow', score: Number.NaN }] },
      ]),
    ).toBe(false)
    expect(isAnalysisProgress({ done: 1, total: 2 })).toBe(true)
    expect(isAnalysisProgress({ done: 3, total: 2 })).toBe(false)
    expect(isAnalysisProgress({ done: 1, total: 2, extra: true })).toBe(false)
    expect(
      isSearchHitList([
        {
          path: '/library/tone.wav',
          name: 'tone.wav',
          catId: 'DOORWood',
          fxName: 'Creak',
          similarity: null,
        },
      ]),
    ).toBe(true)
    expect(
      isSearchHitList([
        {
          path: '/library/door.wav',
          name: 'door.wav',
          catId: 'AIRBlow',
          fxName: '',
          similarity: 0.5,
        },
      ]),
    ).toBe(true)
    expect(
      isSearchHitList([
        {
          path: '/library/door.wav',
          name: 'door.wav',
          catId: '',
          fxName: '',
          similarity: Number.NaN,
        },
      ]),
    ).toBe(false)
    expect(isImportFolderResult({ stored: 1, failed: ['bad.wav'] })).toBe(true)
    expect(isImportFolderResult({ stored: 1, failed: [1] })).toBe(false)
  })
})
