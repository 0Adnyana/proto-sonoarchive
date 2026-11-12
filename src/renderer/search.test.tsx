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
import type { LibraryFile, SearchHit } from '../shared/ipc'
import { App } from './app'
import type { LibraryBridge } from './library'

const tone: LibraryFile = {
  path: '/library/tone.wav',
  name: 'tone.wav',
  format: 'wav',
  duration: 1.5,
  status: 'tagged',
  catId: 'AIRBrst',
  suggestions: [],
  label: {
    catId: 'AIRBrst',
    fxName: 'Door slam',
    creatorId: '',
    sourceId: '',
    rank: 'manual',
  },
}

const toneHit: SearchHit = {
  path: tone.path,
  name: tone.name,
  catId: 'AIRBrst',
  fxName: 'Door slam',
  similarity: null,
}

const doorHit: SearchHit = {
  path: '/library/door.wav',
  name: 'door.wav',
  catId: 'AERODoor',
  fxName: '',
  similarity: 0.91,
}

describe('library search', () => {
  afterEach(() => {
    cleanup()
  })

  it('starts with stored files and no Similarity column', async () => {
    render(<App bridge={bridge({ listLibrary: async () => [tone] })} />)
    expect(await screen.findByRole('cell', { name: 'tone.wav' })).toBeTruthy()
    expect(screen.getByRole('columnheader', { name: 'File name' })).toBeTruthy()
    expect(
      screen.queryByRole('columnheader', { name: 'Similarity' }),
    ).toBeNull()
    expect(
      screen.queryByRole('button', { name: 'Find similar to selected file' }),
    ).toBeNull()
    expect(screen.queryByRole('button', { name: 'Clear results' })).toBeNull()
  })

  it('fills the library table from a text query', async () => {
    const queries: string[] = []
    render(
      <App
        bridge={bridge({
          listLibrary: async () => [tone],
          searchText: async (query) => {
            queries.push(query)
            return [toneHit]
          },
        })}
      />,
    )
    expect(await screen.findByRole('cell', { name: 'tone.wav' })).toBeTruthy()

    fireEvent.change(screen.getByRole('textbox', { name: 'Query' }), {
      target: { value: 'slam' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))

    expect(
      await screen.findByRole('columnheader', { name: 'Similarity' }),
    ).toBeTruthy()
    expect(screen.getByRole('columnheader', { name: 'FXName' })).toBeTruthy()
    expect(cellText()).toEqual([
      'tone.wav',
      'wav',
      '1.5',
      'tagged',
      'AIRBrst',
      'Door slam',
      '',
    ])
    expect(queries).toEqual(['slam'])
  })

  it('keeps stored files when the query is empty or only spaces', async () => {
    let calls = 0
    render(
      <App
        bridge={bridge({
          listLibrary: async () => [tone],
          searchText: async () => {
            calls += 1
            return [toneHit]
          },
        })}
      />,
    )
    expect(await screen.findByRole('cell', { name: 'tone.wav' })).toBeTruthy()

    submitQuery('')
    submitQuery('   ')
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))
    expect(calls).toBe(0)
    expect(cellText()).toEqual(['tone.wav', 'wav', '1.5', 'tagged', 'AIRBrst'])
    expect(
      screen.queryByRole('columnheader', { name: 'Similarity' }),
    ).toBeNull()
  })

  it('finds similar from the open file and replaces the table', async () => {
    const paths: string[] = []
    render(
      <App
        bridge={bridge({
          listLibrary: async () => [tone],
          findSimilar: async (path) => {
            paths.push(path)
            return [doorHit]
          },
        })}
      />,
    )
    expect(await screen.findByRole('cell', { name: 'tone.wav' })).toBeTruthy()
    expect(
      screen.queryByRole('button', { name: 'Find similar to selected file' }),
    ).toBeNull()

    fireEvent.click(screen.getByRole('cell', { name: 'tone.wav' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Query' }), {
      target: { value: 'slam' },
    })
    fireEvent.click(
      screen.getByRole('button', { name: 'Find similar to selected file' }),
    )

    expect(await screen.findByRole('cell', { name: 'door.wav' })).toBeTruthy()
    expect(cellText()).toEqual([
      'door.wav',
      '',
      '',
      '',
      'AERODoor',
      '',
      '0.910',
    ])
    expect(paths).toEqual([tone.path])
    expect(screen.getByRole('textbox', { name: 'Query' })).toHaveProperty(
      'value',
      '',
    )
    expect(openSheet().textContent).toContain('tone.wav')
  })

  it('opens a hit in the slideover beside the list', async () => {
    render(
      <App
        bridge={bridge({
          listLibrary: async () => [tone],
          searchText: async () => [toneHit],
        })}
      />,
    )
    expect(await screen.findByRole('cell', { name: 'tone.wav' })).toBeTruthy()

    submitQuery('slam')
    fireEvent.click(await screen.findByRole('cell', { name: 'tone.wav' }))

    expect(openSheet().textContent).toContain('tone.wav')
    expect(screen.getByRole('cell', { name: 'tone.wav' })).toBeTruthy()
    expect(screen.getByRole('textbox', { name: 'Query' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Import folder' })).toBeTruthy()
  })

  it('clears hits, restores stored files, and leaves the slideover open', async () => {
    render(
      <App
        bridge={bridge({
          listLibrary: async () => [tone],
          searchText: async () => [toneHit, doorHit],
        })}
      />,
    )
    expect(await screen.findByRole('cell', { name: 'tone.wav' })).toBeTruthy()

    submitQuery('slam')
    expect(await screen.findByRole('cell', { name: 'door.wav' })).toBeTruthy()
    fireEvent.click(screen.getByRole('cell', { name: 'tone.wav' }))
    expect(openSheet().textContent).toContain('tone.wav')

    fireEvent.click(screen.getByRole('button', { name: 'Clear results' }))
    expect(await screen.findByRole('cell', { name: 'tone.wav' })).toBeTruthy()
    expect(screen.queryByRole('cell', { name: 'door.wav' })).toBeNull()
    expect(
      screen.queryByRole('columnheader', { name: 'Similarity' }),
    ).toBeNull()
    expect(screen.queryByRole('button', { name: 'Clear results' })).toBeNull()
    expect(openSheet().textContent).toContain('tone.wav')
  })

  it('shows a failed query on the library status line and no file name', async () => {
    let calls = 0
    render(
      <App
        bridge={bridge({
          listLibrary: async () => [tone],
          searchText: async () => {
            calls += 1
            if (calls === 1) return [toneHit]
            throw new Error('Could not search the library.')
          },
        })}
      />,
    )
    expect(await screen.findByRole('cell', { name: 'tone.wav' })).toBeTruthy()

    submitQuery('slam')
    expect(
      await screen.findByRole('columnheader', { name: 'FXName' }),
    ).toBeTruthy()
    expect(screen.getByRole('cell', { name: 'tone.wav' })).toBeTruthy()

    submitQuery('slam')
    await waitFor(() => {
      expect(libraryStatus().textContent).toContain(
        'Could not search the library.',
      )
    })
    expect(screen.queryByRole('cell', { name: 'tone.wav' })).toBeNull()
  })

  it('keeps an import result when text search fails', async () => {
    let finish: (result: { stored: number; failed: string[] } | null) => void =
      () => {}
    render(
      <App
        bridge={bridge({
          importFolder: () =>
            new Promise((resolve) => {
              finish = resolve
            }),
          searchText: async () => {
            throw new Error('Could not search the library.')
          },
        })}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Import folder' }))
    finish({ stored: 2, failed: [] })
    expect(
      await screen.findByRole('status', { name: 'Library status' }),
    ).toHaveProperty('textContent', 'Stored 2 files.')

    submitQuery('slam')
    await waitFor(() => {
      expect(libraryStatus().textContent).toBe(
        'Stored 2 files. Could not search the library.',
      )
    })
    expect(screen.queryByRole('cell', { name: 'tone.wav' })).toBeNull()
  })

  it('replaces find-similar hits with a later text query', async () => {
    render(
      <App
        bridge={bridge({
          listLibrary: async () => [tone],
          findSimilar: async () => [doorHit],
          searchText: async () => [toneHit],
        })}
      />,
    )
    fireEvent.click(await screen.findByRole('cell', { name: 'tone.wav' }))
    fireEvent.click(
      screen.getByRole('button', { name: 'Find similar to selected file' }),
    )
    expect(await screen.findByRole('cell', { name: 'door.wav' })).toBeTruthy()

    submitQuery('slam')
    expect(await screen.findByRole('cell', { name: 'tone.wav' })).toBeTruthy()
    expect(screen.queryByRole('cell', { name: 'door.wav' })).toBeNull()
  })

  it('clears hits and the query when the library is reset', async () => {
    let publish: (rows: LibraryFile[]) => void = () => {}
    render(
      <App
        bridge={bridge({
          listLibrary: async () => [tone],
          onLibraryChanged: (listener) => {
            publish = listener
            return () => {}
          },
          resetLibrary: async () => {
            publish([])
          },
          searchText: async () => [toneHit],
        })}
      />,
    )
    expect(await screen.findByRole('cell', { name: 'tone.wav' })).toBeTruthy()

    submitQuery('slam')
    expect(
      await screen.findByRole('columnheader', { name: 'Similarity' }),
    ).toBeTruthy()
    fireEvent.click(screen.getByRole('cell', { name: 'tone.wav' }))

    fireEvent.click(screen.getByRole('button', { name: 'Reset database' }))
    const confirm = await screen.findByRole('alertdialog', {
      name: 'Reset database?',
    })
    fireEvent.click(
      within(confirm).getByRole('button', { name: 'Reset database' }),
    )
    expect(
      await screen.findByRole('status', { name: 'Library status' }),
    ).toHaveProperty('textContent', 'Database reset.')

    expect(screen.queryByRole('cell', { name: 'tone.wav' })).toBeNull()
    expect(
      screen.queryByRole('columnheader', { name: 'Similarity' }),
    ).toBeNull()
    expect(screen.getByRole('textbox', { name: 'Query' })).toHaveProperty(
      'value',
      '',
    )
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

function bridge(overrides: Partial<LibraryBridge> = {}): LibraryBridge {
  return {
    listLibrary: async () => [],
    searchText: async () => [],
    findSimilar: async () => [],
    importFolder: async () => null,
    onLibraryChanged: () => () => {},
    onLibraryNotice: () => () => {},
    onAnalysisProgress: () => () => {},
    listUcs: async () => [],
    saveLabel: async () => '',
    mediaUrl: async (path) => `sonoarchive://media/${encodeURIComponent(path)}`,
    resetLibrary: async () => {},
    ...overrides,
  }
}

function submitQuery(value: string): void {
  const input = screen.getByRole('textbox', { name: 'Query' })
  fireEvent.change(input, { target: { value } })
  fireEvent.keyDown(input, { key: 'Enter' })
}

function cellText(): string[] {
  return screen.getAllByRole('cell').map((cell) => cell.textContent ?? '')
}

function libraryStatus(): HTMLElement {
  return screen.getByRole('status', { name: 'Library status' })
}

function openSheet(): HTMLElement {
  return screen.getByRole('dialog')
}
