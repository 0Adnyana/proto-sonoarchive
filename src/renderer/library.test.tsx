// @vitest-environment happy-dom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type {
  AnalysisProgress,
  ImportFolderResult,
  LibraryFile,
} from '../shared/ipc'
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
    expect(screen.getByRole('status').textContent).not.toContain('analysed')
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

  it('replaces the analysis count, keeps a failure beside it, and keeps the count across tabs', async () => {
    let finish: (result: ImportFolderResult | null) => void = () => {}
    let publishProgress: (progress: AnalysisProgress) => void = () => {}
    let publishNotice: (notice: string) => void = () => {}
    render(
      <App
        bridge={bridge({
          importFolder: () =>
            new Promise((resolve) => {
              finish = resolve
            }),
          onAnalysisProgress: (listener) => {
            publishProgress = listener
            return () => {}
          },
          onLibraryNotice: (listener) => {
            publishNotice = listener
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

    publishProgress({ done: 1, total: 2 })
    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toBe(
        'Stored 2 files. 1 / 2 analysed',
      )
    })

    selectTab('Tag')
    publishProgress({ done: 2, total: 2 })
    selectTab('Library')
    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toBe(
        'Stored 2 files. 2 / 2 analysed',
      )
    })
    expect(screen.getByRole('status').textContent).not.toContain(
      '1 / 2 analysed',
    )

    publishNotice('Could not analyse tone.wav. CNN14 model is missing.')
    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toBe(
        'Stored 2 files. 2 / 2 analysed Could not analyse tone.wav. CNN14 model is missing.',
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

  it('asks before resetting the database and then clears the library', async () => {
    let publish: (rows: LibraryFile[]) => void = () => {}
    let resets = 0
    render(
      <App
        bridge={bridge({
          listLibrary: async () => [tone],
          onLibraryChanged: (listener) => {
            publish = listener
            return () => {}
          },
          resetLibrary: async () => {
            resets += 1
            publish([])
          },
        })}
      />,
    )

    expect(await screen.findByRole('cell', { name: 'tone.wav' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Reset database' }))

    const dialog = await screen.findByRole('alertdialog', {
      name: 'Reset database?',
    })
    expect(dialog.textContent).toContain('Audio files on disk stay')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(resets).toBe(0)
    expect(screen.getByRole('cell', { name: 'tone.wav' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Reset database' }))
    const confirm = await screen.findByRole('alertdialog', {
      name: 'Reset database?',
    })
    fireEvent.click(
      within(confirm).getByRole('button', { name: 'Reset database' }),
    )

    expect(await screen.findByRole('status')).toHaveProperty(
      'textContent',
      'Database reset.',
    )
    expect(screen.queryByRole('cell', { name: 'tone.wav' })).toBeNull()
    expect(resets).toBe(1)
  })

  it('leaves the library in place and re-enables reset when reset fails', async () => {
    render(
      <App
        bridge={bridge({
          listLibrary: async () => [tone],
          resetLibrary: async () => {
            throw new Error('Could not reset the library.')
          },
        })}
      />,
    )

    expect(await screen.findByRole('cell', { name: 'tone.wav' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Reset database' }))
    const dialog = await screen.findByRole('alertdialog', {
      name: 'Reset database?',
    })
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Reset database' }),
    )

    expect(await screen.findByRole('status')).toHaveProperty(
      'textContent',
      'Could not reset the library.',
    )
    expect(screen.getByRole('cell', { name: 'tone.wav' })).toBeTruthy()
    expect(
      screen
        .getByRole('button', { name: 'Reset database' })
        .hasAttribute('disabled'),
    ).toBe(false)
    expect(screen.queryByRole('alertdialog')).toBeNull()
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
    onAnalysisProgress: () => () => {},
    listUcs: async () => [],
    saveLabel: async () => {},
    mediaUrl: async (path) => `sonoarchive://media/${encodeURIComponent(path)}`,
    resetLibrary: async () => {},
    ...overrides,
  }
}

function selectTab(name: string): void {
  fireEvent.mouseDown(screen.getByRole('tab', { name }), { button: 0 })
}

function cellText(): string[] {
  return screen.getAllByRole('cell').map((cell) => cell.textContent ?? '')
}
