// @vitest-environment happy-dom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { toast } from 'sonner'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type {
  AnalysisProgress,
  LibraryFile,
  SaveWavInput,
  UcsEntry,
} from '../shared/ipc'
import { App } from './app'
import type { LibraryBridge } from './library'

const suggestions = [
  { catId: 'AIRBlow', score: 0.5 },
  { catId: 'AIRBrst', score: 0.25 },
  { catId: 'AIRHiss', score: 0.125 },
  { catId: 'AIRMisc', score: 0.0625 },
  { catId: 'AIRSuck', score: 0.03125 },
]

const catalog: UcsEntry[] = [
  { catId: 'AIRBlow', category: 'AIR', subCategory: 'Blow' },
  { catId: 'AIRBrst', category: 'AIR', subCategory: 'Burst' },
  { catId: 'AIRHiss', category: 'AIR', subCategory: 'Hiss' },
  { catId: 'AIRMisc', category: 'AIR', subCategory: 'Miscellaneous' },
  { catId: 'AIRSuck', category: 'AIR', subCategory: 'Suck' },
  { catId: 'DOORWood', category: 'DOORS', subCategory: 'Wood' },
]

const tone: LibraryFile = {
  path: '/library/tone.wav',
  name: 'tone.wav',
  format: 'wav',
  duration: 1.5,
  status: 'untagged',
  catId: 'AIRBlow',
  suggestions,
  label: null,
}

const door: LibraryFile = {
  path: '/library/door.wav',
  name: 'door.wav',
  format: 'wav',
  duration: 2,
  status: 'tagged',
  catId: 'DOORWood',
  suggestions,
  label: {
    catId: 'DOORWood',
    fxName: 'Creak',
    creatorId: 'Ada',
    sourceId: 'Field',
    rank: 'manual',
  },
}

const quiet: LibraryFile = {
  path: '/library/quiet.wav',
  name: 'quiet.wav',
  format: 'wav',
  duration: 1,
  status: 'untagged',
  catId: null,
  suggestions: [],
  label: null,
}

describe('tag slideover', () => {
  afterEach(() => {
    toast.dismiss()
    cleanup()
  })

  it('opens a library row in the slideover and plays it from the stored path', async () => {
    const play = vi.fn(() => Promise.resolve())
    const pause = vi.fn()
    let currentTime = 4
    stubMedia({
      play,
      pause,
      getTime: () => currentTime,
      setTime: (value) => {
        currentTime = value
      },
    })
    const mediaPaths: string[] = []
    render(
      <App
        bridge={bridge({
          listLibrary: async () => [tone],
          mediaUrl: async (path) => {
            mediaPaths.push(path)
            return `sonoarchive://media/${encodeURIComponent(path)}`
          },
        })}
      />,
    )
    expect(await screen.findByRole('cell', { name: 'tone.wav' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Play' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Stop' })).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()

    fireEvent.click(screen.getByRole('cell', { name: 'tone.wav' }))

    const sheet = openSheet()
    expect(sheet.textContent).toContain('tone.wav')
    expect(screen.getByRole('cell', { name: 'tone.wav' })).toBeTruthy()
    expect(
      await screen.findByRole('radio', { name: 'AIRBrst AIR › Burst 0.250' }),
    ).toBeTruthy()
    expect(
      screen.getByRole('radio', { name: 'AIRBlow AIR › Blow 0.500' }),
    ).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Play' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Next file' })).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Find similar to selected file' }),
    ).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Play' }))
    expect(await screen.findByRole('button', { name: 'Stop' })).toBeTruthy()
    expect(play).toHaveBeenCalledOnce()
    expect(mediaPaths).toEqual(['/library/tone.wav'])
    expect(document.querySelector('audio')?.getAttribute('src')).toBe(
      'sonoarchive://media/%2Flibrary%2Ftone.wav',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Stop' }))
    expect(screen.getByRole('button', { name: 'Play' })).toBeTruthy()
    expect(pause).toHaveBeenCalledOnce()
    expect(currentTime).toBe(0)
  })

  it('replaces the open file when another row is clicked', async () => {
    render(<App bridge={bridge({ listLibrary: async () => [tone, door] })} />)
    fireEvent.click(await screen.findByRole('cell', { name: 'tone.wav' }))
    expect(openSheet().textContent).toContain('tone.wav')

    fireEvent.click(screen.getByRole('cell', { name: 'door.wav' }))
    await waitFor(() => {
      expect(openSheet().textContent).toContain('door.wav')
    })
    expect(screen.getByRole('cell', { name: 'tone.wav' })).toBeTruthy()
  })

  it('keeps Save disabled until a CatID and a non-blank FXName are set', async () => {
    const saved: SaveWavInput[] = []
    let files = [tone, door, quiet]
    let publish: (rows: LibraryFile[]) => void = () => {}
    render(
      <App
        bridge={bridge({
          listLibrary: async () => files,
          onLibraryChanged: (listener) => {
            publish = listener
            return () => {}
          },
          saveLabel: async (input) => {
            saved.push(input)
            files = files.map((file) =>
              file.path === input.path
                ? {
                    ...file,
                    status: 'tagged',
                    catId: input.catId,
                    label: {
                      catId: input.catId,
                      fxName: input.fxName.trim(),
                      creatorId: input.creatorId.trim(),
                      sourceId: input.sourceId.trim(),
                      rank: input.rank,
                    },
                  }
                : file,
            )
            publish(files)
            return input.path
          },
        })}
      />,
    )
    fireEvent.click(await screen.findByRole('cell', { name: 'quiet.wav' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next file' }))
    expect(openSheet().textContent).toContain('tone.wav')
    expect(openSheet().textContent).not.toContain('door.wav')

    const save = () =>
      screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement
    expect(save().disabled).toBe(true)

    fireEvent.click(
      await screen.findByRole('radio', { name: 'AIRBrst AIR › Burst 0.250' }),
    )
    expect(save().disabled).toBe(true)
    fireEvent.change(screen.getByRole('textbox', { name: 'FXName' }), {
      target: { value: '   ' },
    })
    expect(save().disabled).toBe(true)

    fireEvent.change(screen.getByRole('textbox', { name: 'FXName' }), {
      target: { value: 'Door slam' },
    })
    expect(screen.getByRole('textbox', { name: 'CreatorID' })).toHaveProperty(
      'value',
      '',
    )
    expect(screen.getByRole('textbox', { name: 'SourceID' })).toHaveProperty(
      'value',
      '',
    )
    expect(save().disabled).toBe(false)
    expect(
      screen
        .getByRole('radio', { name: /AIRBrst/ })
        .getAttribute('aria-checked'),
    ).toBe('true')

    openOther()
    fireEvent.click(
      screen.getByRole('option', { name: 'DOORWood DOORS › Wood' }),
    )
    expect(
      screen
        .getByRole('radio', { name: /AIRBrst/ })
        .getAttribute('aria-checked'),
    ).toBe('false')
    expect(
      screen.getByRole('combobox', { name: 'Other…' }).textContent,
    ).toContain('DOORWood')

    fireEvent.click(screen.getByRole('radio', { name: /AIRBrst/ }))
    expect(
      screen.getByRole('combobox', { name: 'Other…' }).textContent,
    ).not.toContain('DOORWood')
    fireEvent.click(save())

    await waitFor(() => {
      expect(saved).toEqual([
        {
          path: '/library/tone.wav',
          catId: 'AIRBrst',
          fxName: 'Door slam',
          creatorId: '',
          sourceId: '',
          rank: '2',
          rename: false,
        },
      ])
    })
    expect(await screen.findByText('Saved tone.wav as AIRBrst')).toBeTruthy()

    expect(cellText()).toEqual([
      'tone.wav',
      'wav',
      '1.5',
      'tagged',
      'AIRBrst',
      'door.wav',
      'wav',
      '2',
      'tagged',
      'DOORWood',
      'quiet.wav',
      'wav',
      '1',
      'untagged',
      '',
    ])

    fireEvent.click(screen.getByRole('cell', { name: 'tone.wav' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next file' }))
    expect(openSheet().textContent).toContain('quiet.wav')
    expect(openSheet().textContent).not.toContain('door.wav')

    fireEvent.click(screen.getByRole('button', { name: 'Next file' }))
    expect(openSheet().textContent).toContain('quiet.wav')
    expect(openSheet().textContent).not.toContain('tone.wav')
  })

  it('fills the form from a saved rank and lists every catalog CatID under Other', async () => {
    const full = [
      ...catalog,
      ...Array.from({ length: 753 - catalog.length }, (_, index) => ({
        catId: `CAT${String(index).padStart(4, '0')}`,
        category: 'CAT',
        subCategory: `Sub ${index}`,
      })),
    ]
    const ranked: LibraryFile = {
      ...tone,
      status: 'tagged',
      catId: 'AIRBrst',
      label: {
        catId: 'AIRBrst',
        fxName: 'Door slam',
        creatorId: 'Ada',
        sourceId: 'Field',
        rank: '2',
      },
    }
    render(
      <App
        bridge={bridge({
          listLibrary: async () => [ranked, door],
          listUcs: async () => full,
        })}
      />,
    )

    fireEvent.click(await screen.findByRole('cell', { name: 'tone.wav' }))
    expect(
      screen
        .getByRole('radio', { name: /AIRBrst/ })
        .getAttribute('aria-checked'),
    ).toBe('true')
    expect(screen.getByRole('textbox', { name: 'FXName' })).toHaveProperty(
      'value',
      'Door slam',
    )
    expect(screen.getByRole('textbox', { name: 'CreatorID' })).toHaveProperty(
      'value',
      'Ada',
    )
    expect(screen.getByRole('textbox', { name: 'SourceID' })).toHaveProperty(
      'value',
      'Field',
    )

    fireEvent.click(screen.getByRole('cell', { name: 'door.wav' }))
    expect(
      screen
        .getByRole('radio', { name: /AIRBrst/ })
        .getAttribute('aria-checked'),
    ).toBe('false')
    expect(
      screen.getByRole('combobox', { name: 'Other…' }).textContent,
    ).toContain('DOORWood')
    expect(screen.getByRole('textbox', { name: 'FXName' })).toHaveProperty(
      'value',
      'Creak',
    )

    openOther()
    expect(full).toHaveLength(753)
    expect(screen.getAllByRole('option')).toHaveLength(753)
    expect(
      screen.getByRole('option', {
        name: `CAT${String(753 - catalog.length - 1).padStart(4, '0')} CAT › Sub ${753 - catalog.length - 1}`,
      }),
    ).toBeTruthy()
  })

  it('opens a finished file and saves it while another file is still queued', async () => {
    const saved: string[] = []
    let publishProgress: (progress: AnalysisProgress) => void = () => {}
    render(
      <App
        bridge={bridge({
          listLibrary: async () => [tone, quiet],
          onAnalysisProgress: (listener) => {
            publishProgress = listener
            return () => {}
          },
          saveLabel: async (input) => {
            saved.push(input.path)
            return input.path
          },
        })}
      />,
    )

    publishProgress({ done: 0, total: 1 })
    fireEvent.click(await screen.findByRole('cell', { name: 'tone.wav' }))
    expect(openSheet().textContent).toContain('tone.wav')
    fireEvent.click(
      await screen.findByRole('radio', { name: 'AIRBlow AIR › Blow 0.500' }),
    )
    fireEvent.change(screen.getByRole('textbox', { name: 'FXName' }), {
      target: { value: 'Gust' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(saved).toEqual(['/library/tone.wav'])
    })
    expect(
      screen.getByRole('status', { name: 'Library status' }).textContent,
    ).toContain('0 / 1 analysed')
  })

  it('shows a thrown save error on the status line without the success toast', async () => {
    render(
      <App
        bridge={bridge({
          listLibrary: async () => [tone],
          saveLabel: async () => {
            throw new Error(
              'Could not write the tags. The file was left unchanged.',
            )
          },
        })}
      />,
    )
    fireEvent.click(await screen.findByRole('cell', { name: 'tone.wav' }))
    fireEvent.click(
      await screen.findByRole('radio', { name: 'AIRBrst AIR › Burst 0.250' }),
    )
    fireEvent.change(screen.getByRole('textbox', { name: 'FXName' }), {
      target: { value: 'Door slam' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    const sheet = openSheet()
    await waitFor(() => {
      expect(sheet.textContent).toContain(
        'Could not write the tags. The file was left unchanged.',
      )
    })
    expect(sheet.querySelector('[role="status"]')?.textContent).toBe(
      'Could not write the tags. The file was left unchanged.',
    )
    expect(screen.queryByText('Saved tone.wav as AIRBrst')).toBeNull()
  })

  it('starts unticked and previews the filename as FXName changes', async () => {
    render(<App bridge={bridge({ listLibrary: async () => [tone, door] })} />)
    fireEvent.click(await screen.findByRole('cell', { name: 'tone.wav' }))
    const checkbox = () =>
      screen.getByRole('checkbox', { name: 'Rename to UCS filename' })
    expect(checkbox().getAttribute('aria-checked')).toBe('false')

    fireEvent.click(
      await screen.findByRole('radio', { name: 'AIRBrst AIR › Burst 0.250' }),
    )
    fireEvent.change(screen.getByRole('textbox', { name: 'FXName' }), {
      target: { value: 'Creak' },
    })
    expect(screen.getByText('AIRBrst_Creak__.wav')).toBeTruthy()
    fireEvent.change(screen.getByRole('textbox', { name: 'FXName' }), {
      target: { value: 'Slam' },
    })
    expect(screen.queryByText('AIRBrst_Creak__.wav')).toBeNull()
    expect(screen.getByText('AIRBrst_Slam__.wav')).toBeTruthy()

    fireEvent.click(screen.getByRole('cell', { name: 'door.wav' }))
    expect(checkbox().getAttribute('aria-checked')).toBe('false')
    expect(screen.getByText('DOORWood_Creak_Ada_Field.wav')).toBeTruthy()
  })

  it('stays on the renamed file, lists it once, and plays the new path', async () => {
    const play = vi.fn(() => Promise.resolve())
    stubMedia({
      play,
      pause: vi.fn(),
      getTime: () => 0,
      setTime: () => {},
    })
    const mediaPaths: string[] = []
    const nextName = 'AIRBrst_Door slam_Ada_Field.wav'
    const nextPath = `/library/${nextName}`
    let files = [tone]
    let publish: (rows: LibraryFile[]) => void = () => {}
    const saved: SaveWavInput[] = []
    render(
      <App
        bridge={bridge({
          listLibrary: async () => files,
          onLibraryChanged: (listener) => {
            publish = listener
            return () => {}
          },
          saveLabel: async (input) => {
            saved.push(input)
            files = [
              {
                ...tone,
                path: nextPath,
                name: nextName,
                status: 'tagged',
                catId: input.catId,
                label: {
                  catId: input.catId,
                  fxName: input.fxName.trim(),
                  creatorId: input.creatorId.trim(),
                  sourceId: input.sourceId.trim(),
                  rank: input.rank,
                },
              },
            ]
            publish(files)
            return nextPath
          },
          mediaUrl: async (path) => {
            mediaPaths.push(path)
            return `sonoarchive://media/${encodeURIComponent(path)}`
          },
        })}
      />,
    )
    fireEvent.click(await screen.findByRole('cell', { name: 'tone.wav' }))
    fireEvent.click(
      await screen.findByRole('radio', { name: 'AIRBrst AIR › Burst 0.250' }),
    )
    fireEvent.change(screen.getByRole('textbox', { name: 'FXName' }), {
      target: { value: 'Door slam' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: 'CreatorID' }), {
      target: { value: 'Ada' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: 'SourceID' }), {
      target: { value: 'Field' },
    })
    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Rename to UCS filename' }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    const sheet = openSheet()
    await waitFor(() => {
      expect(sheet.textContent).toContain(nextName)
    })
    expect(sheet.textContent).not.toContain('tone.wav')
    expect(saved).toEqual([
      expect.objectContaining({
        path: '/library/tone.wav',
        rename: true,
        catId: 'AIRBrst',
        fxName: 'Door slam',
      }),
    ])
    expect(
      screen
        .getByRole('checkbox', { name: 'Rename to UCS filename' })
        .getAttribute('aria-checked'),
    ).toBe('false')

    expect(screen.getAllByRole('cell', { name: nextName })).toHaveLength(1)
    expect(screen.queryByRole('cell', { name: 'tone.wav' })).toBeNull()
    expect(cellText()).toEqual([nextName, 'wav', '1.5', 'tagged', 'AIRBrst'])

    fireEvent.click(screen.getByRole('cell', { name: nextName }))
    fireEvent.click(screen.getByRole('button', { name: 'Play' }))
    await waitFor(() => {
      expect(mediaPaths).toEqual([nextPath])
    })
    expect(play).toHaveBeenCalledOnce()
  })

  it('shows a collision on the original file', async () => {
    render(
      <App
        bridge={bridge({
          listLibrary: async () => [tone],
          saveLabel: async () => {
            throw new Error(
              'A file named AIRBrst_Door slam__.wav already exists.',
            )
          },
        })}
      />,
    )
    fireEvent.click(await screen.findByRole('cell', { name: 'tone.wav' }))
    fireEvent.click(
      await screen.findByRole('radio', { name: 'AIRBrst AIR › Burst 0.250' }),
    )
    fireEvent.change(screen.getByRole('textbox', { name: 'FXName' }), {
      target: { value: 'Door slam' },
    })
    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Rename to UCS filename' }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    const sheet = openSheet()
    await waitFor(() => {
      expect(sheet.textContent).toContain(
        'A file named AIRBrst_Door slam__.wav already exists.',
      )
    })
    expect(sheet.textContent).toContain('tone.wav')
    expect(screen.queryByText('Saved tone.wav as AIRBrst')).toBeNull()
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
    listUcs: async () => catalog,
    saveLabel: async () => '',
    mediaUrl: async (path) => `sonoarchive://media/${encodeURIComponent(path)}`,
    resetLibrary: async () => {},
    ...overrides,
  }
}

function cellText(): string[] {
  return screen.getAllByRole('cell').map((cell) => cell.textContent ?? '')
}

function openSheet(): HTMLElement {
  return screen.getByRole('dialog')
}

function openOther(): void {
  const trigger = screen.getByRole('combobox', { name: 'Other…' })
  fireEvent.pointerDown(trigger, { button: 0, pointerType: 'mouse' })
  fireEvent.click(trigger)
}

function stubMedia(handlers: {
  play: () => Promise<void>
  pause: () => void
  getTime: () => number
  setTime: (value: number) => void
}): void {
  Object.defineProperty(HTMLMediaElement.prototype, 'play', {
    configurable: true,
    value: handlers.play,
  })
  Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
    configurable: true,
    value: handlers.pause,
  })
  Object.defineProperty(HTMLMediaElement.prototype, 'currentTime', {
    configurable: true,
    get: handlers.getTime,
    set: handlers.setTime,
  })
}
