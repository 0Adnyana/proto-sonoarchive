// @vitest-environment happy-dom

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeEach, describe, expect, it } from 'vitest'
import { selectScreen } from './tabs'

const html = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'index.html'),
  'utf8',
)
const screens = ['library', 'tag', 'search']

const markup = html.replace(/<script[\s\S]*?<\/script>/gi, '')

describe('renderer screens', () => {
  beforeEach(() => {
    document.open()
    document.write(markup)
    document.close()
  })

  it('has a tab and a panel for Library, Tag, and Search', () => {
    for (const screen of screens) {
      expect(document.querySelector(`[data-screen="${screen}"]`)).not.toBeNull()
      expect(document.querySelector(`[data-panel="${screen}"]`)).not.toBeNull()
    }
  })

  it('shows Tag and hides Library and Search', () => {
    selectScreen(document, 'tag')

    expect(
      document.querySelector<HTMLElement>('[data-panel="tag"]')?.hidden,
    ).toBe(false)
    expect(
      document.querySelector<HTMLElement>('[data-panel="library"]')?.hidden,
    ).toBe(true)
    expect(
      document.querySelector<HTMLElement>('[data-panel="search"]')?.hidden,
    ).toBe(true)
  })
})
