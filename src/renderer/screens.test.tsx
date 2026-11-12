// @vitest-environment happy-dom

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { App } from './app'
import type { LibraryBridge } from './library'

const html = readFileSync(
  join(process.cwd(), 'src/renderer/index.html'),
  'utf8',
)

const idleBridge: LibraryBridge = {
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
}

describe('renderer screens', () => {
  afterEach(() => {
    cleanup()
  })

  it('keeps the HTML document as a single mount node', () => {
    expect(html.match(/id="root"/g)).toEqual(['id="root"'])
    expect(html).toContain('src="/main.tsx"')
    expect(html).not.toContain('Import folder')
    expect(html).not.toContain('Query')
    expect(html).not.toContain('Library')
    expect(html).not.toContain('Tag')
    expect(html).not.toContain('Search')
  })

  it('shows the library and search field with no screen tabs', () => {
    render(<App bridge={idleBridge} />)

    expect(screen.getByRole('heading', { name: 'Library' })).toBeTruthy()
    expect(screen.getByRole('textbox', { name: 'Query' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Search' })).toBeTruthy()
    expect(screen.queryByRole('tab', { name: 'Library' })).toBeNull()
    expect(screen.queryByRole('tab', { name: 'Tag' })).toBeNull()
    expect(screen.queryByRole('tab', { name: 'Search' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Play' })).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
