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

describe('search screen', () => {
  afterEach(() => {
    cleanup()
  })

  it('starts with column headers and no file names', async () => {
    render(<App bridge={bridge({ listLibrary: async () => [tone] })} />)
    expect(await screen.findByRole('cell', { name: 'tone.wav' })).toBeTruthy()

    selectTab('Search')
    const search = screen.getByRole('tabpanel', { name: 'Search' })
    expect(
      within(search).getByRole('columnheader', { name: 'File' }),
    ).toBeTruthy()
    expect(
      within(search).getByRole('columnheader', { name: 'CatID' }),
    ).toBeTruthy()
    expect(
      within(search).getByRole('columnheader', { name: 'FXName' }),
    ).toBeTruthy()
    expect(
      within(search).getByRole('columnheader', { name: 'Similarity' }),
    ).toBeTruthy()
    expect(search.textContent).not.toContain('tone.wav')
    expect(within(search).queryByRole('cell')).toBeNull()
  })

  it('fills the table from a text query', async () => {
    const queries: string[] = []
    render(
      <App
        bridge={bridge({
          searchText: async (query) => {
            queries.push(query)
            return [toneHit]
          },
        })}
      />,
    )

    selectTab('Search')
    fireEvent.change(screen.getByRole('textbox', { name: 'Query' }), {
      target: { value: 'slam' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))

    const search = screen.getByRole('tabpanel', { name: 'Search' })
    expect(
      await within(search).findByRole('cell', { name: 'tone.wav' }),
    ).toBeTruthy()
    expect(cellText(search)).toEqual(['tone.wav', 'AIRBrst', 'Door slam', ''])
    expect(queries).toEqual(['slam'])
  })

  it('disables find similar until a file is open', async () => {
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

    selectTab('Search')
    const disabled = screen.getByRole('button', {
      name: 'Find similar to selected file',
    }) as HTMLButtonElement
    expect(disabled.disabled).toBe(true)
    fireEvent.click(disabled)
    expect(paths).toEqual([])

    selectTab('Library')
    fireEvent.click(screen.getByRole('cell', { name: 'tone.wav' }))
    selectTab('Search')
    const enabled = screen.getByRole('button', {
      name: 'Find similar to selected file',
    }) as HTMLButtonElement
    expect(enabled.disabled).toBe(false)
    fireEvent.click(enabled)

    const search = screen.getByRole('tabpanel', { name: 'Search' })
    expect(
      await within(search).findByRole('cell', { name: 'door.wav' }),
    ).toBeTruthy()
    expect(cellText(search)).toEqual(['door.wav', 'AERODoor', '', '0.910'])
    expect(paths).toEqual([tone.path])
  })

  it('opens the file on Tag when a result is clicked', async () => {
    render(
      <App
        bridge={bridge({
          listLibrary: async () => [tone],
          searchText: async () => [toneHit],
        })}
      />,
    )
    expect(await screen.findByRole('cell', { name: 'tone.wav' })).toBeTruthy()

    selectTab('Search')
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))
    const search = screen.getByRole('tabpanel', { name: 'Search' })
    fireEvent.click(
      await within(search).findByRole('cell', { name: 'tone.wav' }),
    )

    expect(screen.getByRole('tabpanel', { name: 'Tag' }).textContent).toContain(
      'tone.wav',
    )
  })

  it('shows a failed query and no file name', async () => {
    let calls = 0
    render(
      <App
        bridge={bridge({
          searchText: async () => {
            calls += 1
            if (calls === 1) return [toneHit]
            throw new Error('Could not search the library.')
          },
        })}
      />,
    )

    selectTab('Search')
    const search = screen.getByRole('tabpanel', { name: 'Search' })
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))
    expect(
      await within(search).findByRole('cell', { name: 'tone.wav' }),
    ).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Search' }))
    await waitFor(() => {
      expect(within(search).getByRole('status').textContent).toContain(
        'Could not search the library.',
      )
    })
    expect(search.textContent).not.toContain('tone.wav')
    expect(within(search).queryByRole('cell', { name: 'tone.wav' })).toBeNull()
  })

  it('keeps hits when the user switches tabs', async () => {
    render(
      <App
        bridge={bridge({
          listLibrary: async () => [tone],
          searchText: async () => [toneHit],
        })}
      />,
    )
    expect(await screen.findByRole('cell', { name: 'tone.wav' })).toBeTruthy()

    selectTab('Search')
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))
    expect(
      await within(screen.getByRole('tabpanel', { name: 'Search' })).findByRole(
        'cell',
        { name: 'tone.wav' },
      ),
    ).toBeTruthy()

    selectTab('Library')
    expect(screen.getByRole('cell', { name: 'tone.wav' })).toBeTruthy()
    selectTab('Search')
    expect(
      within(screen.getByRole('tabpanel', { name: 'Search' })).getByRole(
        'cell',
        { name: 'tone.wav' },
      ),
    ).toBeTruthy()
  })

  it('clears hits when the library is reset', async () => {
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

    selectTab('Search')
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))
    expect(
      await within(screen.getByRole('tabpanel', { name: 'Search' })).findByRole(
        'cell',
        { name: 'tone.wav' },
      ),
    ).toBeTruthy()

    selectTab('Library')
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

    selectTab('Search')
    const search = screen.getByRole('tabpanel', { name: 'Search' })
    expect(search.textContent).not.toContain('tone.wav')
    expect(within(search).queryByRole('cell')).toBeNull()
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

function selectTab(name: string): void {
  fireEvent.mouseDown(screen.getByRole('tab', { name }), { button: 0 })
}

function cellText(panel: HTMLElement): string[] {
  return within(panel)
    .getAllByRole('cell')
    .map((cell) => cell.textContent ?? '')
}
