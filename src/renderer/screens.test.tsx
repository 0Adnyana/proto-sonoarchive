// @vitest-environment happy-dom

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { App } from './app'
import type { LibraryBridge } from './library'

const html = readFileSync(
  join(process.cwd(), 'src/renderer/index.html'),
  'utf8',
)
const screens = ['Library', 'Tag', 'Search'] as const

const idleBridge: LibraryBridge = {
  listLibrary: async () => [],
  importFolder: async () => null,
  onLibraryChanged: () => () => {},
  onLibraryNotice: () => () => {},
  onAnalysisProgress: () => () => {},
  listUcs: async () => [],
  saveLabel: async () => {},
  mediaUrl: async (path) => `sonoarchive://media/${encodeURIComponent(path)}`,
}

describe('renderer screens', () => {
  afterEach(() => {
    cleanup()
  })

  it('keeps the HTML document as a single mount node', () => {
    expect(html.match(/id="root"/g)).toEqual(['id="root"'])
    expect(html).toContain('src="/main.tsx"')
    expect(html).not.toContain('Import folder')
    for (const name of screens) {
      expect(html).not.toContain(name)
    }
  })

  it('exposes a tab and a panel for Library, Tag, and Search', () => {
    render(<App bridge={idleBridge} />)

    for (const name of screens) {
      expect(screen.getByRole('tab', { name })).toBeTruthy()
      selectTab(name)
      expect(screen.getByRole('tabpanel', { name })).toBeTruthy()
    }
  })

  it('shows Tag and hides Library and Search', () => {
    render(<App bridge={idleBridge} />)
    selectTab('Tag')

    expect(screen.getByRole('tabpanel', { name: 'Tag' })).toBeTruthy()
    expect(screen.queryByRole('tabpanel', { name: 'Library' })).toBeNull()
    expect(screen.queryByRole('tabpanel', { name: 'Search' })).toBeNull()
  })
})

function selectTab(name: string): void {
  fireEvent.mouseDown(screen.getByRole('tab', { name }), { button: 0 })
}
