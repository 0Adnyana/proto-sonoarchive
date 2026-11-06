// @vitest-environment happy-dom

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeEach, describe, expect, it } from 'vitest'
import type { ImportFolderResult, LibraryFile } from '../shared/ipc'
import { formatImportStatus, startLibrary } from './library'
import { selectScreen } from './tabs'

const html = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'index.html'),
  'utf8',
)
const markup = html.replace(/<script[\s\S]*?<\/script>/gi, '')

const tone: LibraryFile = {
  name: 'tone.wav',
  format: 'wav',
  duration: 1.5,
  status: 'untagged',
}

describe('library screen', () => {
  beforeEach(() => {
    document.open()
    document.write(markup)
    document.close()
  })

  it('loads stored files when the view starts', async () => {
    startLibrary(document, {
      listLibrary: async () => [tone],
      importFolder: async () => null,
      onLibraryChanged: () => () => {},
    })
    await flush()

    expect(rowText()).toEqual(['tone.wav', 'wav', '1.5', 'untagged'])
  })

  it('reports a stored import and names a file that failed', async () => {
    let finish: (result: ImportFolderResult | null) => void = () => {}
    startLibrary(document, {
      listLibrary: async () => [],
      importFolder: () =>
        new Promise((resolve) => {
          finish = resolve
        }),
      onLibraryChanged: () => () => {},
    })

    document.querySelector<HTMLButtonElement>('#import-folder')?.click()
    finish({ stored: 2, failed: ['broken.wav'] })
    await flush()

    expect(statusText()).toBe('Stored 2 files. Could not decode broken.wav.')
    expect(formatImportStatus({ stored: 1, failed: [] })).toBe('Stored 1 file.')
  })

  it('leaves the library unchanged when the picker is cancelled', async () => {
    startLibrary(document, {
      listLibrary: async () => [tone],
      importFolder: async () => null,
      onLibraryChanged: () => () => {},
    })
    await flush()
    document.querySelector<HTMLButtonElement>('#import-folder')?.click()
    await flush()

    expect(statusText()).toBe('')
    expect(rowText()).toEqual(['tone.wav', 'wav', '1.5', 'untagged'])
  })

  it('replaces the table when the library changes and keeps it across tabs', async () => {
    let publish: (files: LibraryFile[]) => void = () => {}
    startLibrary(document, {
      listLibrary: async () => [],
      importFolder: async () => null,
      onLibraryChanged: (listener) => {
        publish = listener
        return () => {}
      },
    })

    publish([tone])
    selectScreen(document, 'tag')
    selectScreen(document, 'library')

    expect(rowText()).toEqual(['tone.wav', 'wav', '1.5', 'untagged'])
    expect(
      document.querySelector('[data-panel="tag"]')?.textContent,
    ).not.toContain('tone.wav')
    expect(
      document.querySelector('[data-panel="search"]')?.textContent,
    ).not.toContain('tone.wav')
  })

  it('shows a database failure on the status line', async () => {
    startLibrary(document, {
      listLibrary: async () => {
        throw new Error('Could not open the library. native module')
      },
      importFolder: async () => null,
      onLibraryChanged: () => () => {},
    })
    await flush()

    expect(statusText()).toContain('Could not open the library.')
  })
})

function rowText(): string[] {
  return [...document.querySelectorAll('[data-library-rows] td')].map(
    (cell) => cell.textContent ?? '',
  )
}

function statusText(): string {
  return document.querySelector('[data-library-status]')?.textContent ?? ''
}

async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0))
}
