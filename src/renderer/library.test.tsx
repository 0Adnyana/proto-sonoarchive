// @vitest-environment happy-dom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { ImportFolderResult, LibraryFile } from '../shared/ipc'
import { App } from './app'
import { formatImportStatus, type LibraryBridge } from './library'

const tone: LibraryFile = {
  path: '/library/tone.wav',
  name: 'tone.wav',
  format: 'wav',
  duration: 1.5,
  status: 'untagged',
  catId: null,
  suggestions: [],
  label: null,
}

const scored: LibraryFile = {
  path: '/library/door.wav',
  name: 'door.wav',
  format: 'wav',
  duration: 2,
  status: 'untagged',
  catId: 'AERODoor',
  suggestions: [
    { catId: 'AERODoor', score: 0.5 },
    { catId: 'AEROHeli', score: 0.25 },
    { catId: 'AEROInt', score: 0.125 },
    { catId: 'AEROJet', score: 0.0625 },
    { catId: 'AEROMech', score: 0.03125 },
  ],
  label: null,
}

describe('library screen', () => {
  afterEach(() => {
    cleanup()
  })

  it('loads stored files when the view starts', async () => {
    render(<App bridge={bridge({ listLibrary: async () => [tone] })} />)

    expect(await screen.findByRole('cell', { name: 'tone.wav' })).toBeTruthy()
    expect(cellText()).toEqual(['tone.wav', 'wav', '1.5', 'untagged', ''])
    expect(screen.getByRole('columnheader', { name: 'File name' })).toBeTruthy()
    expect(screen.getByRole('columnheader', { name: 'Format' })).toBeTruthy()
    expect(
      screen.getByRole('columnheader', { name: 'Duration (seconds)' }),
    ).toBeTruthy()
    expect(screen.getByRole('columnheader', { name: 'Status' })).toBeTruthy()
    expect(screen.getByRole('columnheader', { name: 'CatID' })).toBeTruthy()
  })

  it('reports a stored import and names a file that failed', async () => {
    let finish: (result: ImportFolderResult | null) => void = () => {}
    render(
      <App
        bridge={bridge({
          importFolder: () =>
            new Promise((resolve) => {
              finish = resolve
            }),
        })}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Import folder' }))
    finish({ stored: 2, failed: ['broken.wav'] })

    expect(await screen.findByRole('status')).toHaveProperty(
      'textContent',
      'Stored 2 files. Could not decode broken.wav.',
    )
    expect(formatImportStatus({ stored: 1, failed: [] })).toBe('Stored 1 file.')
  })

  it('keeps the stored-files sentence when analysis fails', async () => {
    let finish: (result: ImportFolderResult | null) => void = () => {}
    let publish: (notice: string) => void = () => {}
    render(
      <App
        bridge={bridge({
          importFolder: () =>
            new Promise((resolve) => {
              finish = resolve
            }),
          onLibraryNotice: (listener) => {
            publish = listener
            return () => {}
          },
        })}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Import folder' }))
    finish({ stored: 2, failed: [] })

    expect(await screen.findByRole('status')).toHaveProperty(
      'textContent',
      'Stored 2 files.',
    )
    publish('Could not analyse tone.wav. CNN14 model is missing.')

    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toBe(
        'Stored 2 files. Could not analyse tone.wav. CNN14 model is missing.',
      )
    })
  })

  it('leaves the library unchanged when the picker is cancelled', async () => {
    let imported = false
    render(
      <App
        bridge={bridge({
          listLibrary: async () => [tone],
          importFolder: async () => {
            imported = true
            return null
          },
        })}
      />,
    )
    expect(await screen.findByRole('cell', { name: 'tone.wav' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Import folder' }))
    await waitFor(() => {
      expect(imported).toBe(true)
    })

    expect(screen.getByRole('status').textContent).toBe('')
    expect(cellText()).toEqual(['tone.wav', 'wav', '1.5', 'untagged', ''])
  })

  it('replaces the table when the library changes and keeps it across tabs', async () => {
    let publish: (files: LibraryFile[]) => void = () => {}
    render(
      <App
        bridge={bridge({
          onLibraryChanged: (listener) => {
            publish = listener
            return () => {}
          },
        })}
      />,
    )

    publish([tone])
    expect(await screen.findByRole('cell', { name: 'tone.wav' })).toBeTruthy()

    selectTab('Tag')
    expect(
      screen.getByRole('tabpanel', { name: 'Tag' }).textContent,
    ).not.toContain('tone.wav')
    expect(screen.queryByRole('button', { name: 'Import folder' })).toBeNull()
    expect(screen.queryByRole('table')).toBeNull()

    selectTab('Search')
    expect(
      screen.getByRole('tabpanel', { name: 'Search' }).textContent,
    ).not.toContain('tone.wav')
    expect(screen.queryByRole('button', { name: 'Import folder' })).toBeNull()
    expect(screen.queryByRole('table')).toBeNull()

    selectTab('Library')
    expect(cellText()).toEqual(['tone.wav', 'wav', '1.5', 'untagged', ''])
  })

  it('shows a top-1 CatID and hides file names on the other tabs', async () => {
    render(<App bridge={bridge({ listLibrary: async () => [tone, scored] })} />)

    expect(await screen.findByRole('cell', { name: 'AERODoor' })).toBeTruthy()
    expect(cellText()).toEqual([
      'tone.wav',
      'wav',
      '1.5',
      'untagged',
      '',
      'door.wav',
      'wav',
      '2',
      'untagged',
      'AERODoor',
    ])

    selectTab('Tag')
    expect(
      screen.getByRole('tabpanel', { name: 'Tag' }).textContent,
    ).not.toContain('tone.wav')
    expect(
      screen.getByRole('tabpanel', { name: 'Tag' }).textContent,
    ).not.toContain('door.wav')
    expect(screen.queryByRole('table')).toBeNull()

    selectTab('Search')
    expect(
      screen.getByRole('tabpanel', { name: 'Search' }).textContent,
    ).not.toContain('tone.wav')
    expect(
      screen.getByRole('tabpanel', { name: 'Search' }).textContent,
    ).not.toContain('door.wav')
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('shows a database failure on the status line', async () => {
    render(
      <App
        bridge={bridge({
          listLibrary: async () => {
            throw new Error('Could not open the library. native module')
          },
        })}
      />,
    )

    expect((await screen.findByRole('status')).textContent).toContain(
      'Could not open the library.',
    )
  })
})

function bridge(overrides: Partial<LibraryBridge> = {}): LibraryBridge {
  return {
    listLibrary: async () => [],
    importFolder: async () => null,
    onLibraryChanged: () => () => {},
    onLibraryNotice: () => () => {},
    listUcs: async () => [],
    saveLabel: async () => {},
    mediaUrl: async (path) => `sonoarchive://media/${encodeURIComponent(path)}`,
    ...overrides,
  }
}

function selectTab(name: string): void {
  fireEvent.mouseDown(screen.getByRole('tab', { name }), { button: 0 })
}

function cellText(): string[] {
  return screen.getAllByRole('cell').map((cell) => cell.textContent ?? '')
}
