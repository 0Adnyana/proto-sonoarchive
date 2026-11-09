import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Suggestion } from '../shared/ipc'
import {
  countFiles,
  countUcs,
  type LibraryDatabase,
  listFiles,
  openLibrary,
  replaceSuggestions,
  resetLibrary,
  saveLabel,
  upsertWav,
} from './database'

const suggestions: Suggestion[] = [
  { catId: 'AIRBlow', score: 0.5 },
  { catId: 'AIRBrst', score: 0.25 },
  { catId: 'AIRHiss', score: 0.125 },
  { catId: 'AIRMisc', score: 0.0625 },
  { catId: 'AIRSuck', score: 0.03125 },
]

describe('reset library', () => {
  it('clears imported rows and keeps the UCS catalog', () => {
    const folder = mkdtempSync(join(tmpdir(), 'sonoarchive-reset-'))
    const dbPath = join(folder, 'library.db')
    const tonePath = join(folder, 'tone.wav')
    const db = openLibrary(dbPath)
    insertCatalog(db)
    upsertWav(db, {
      path: tonePath,
      name: 'tone.wav',
      format: 'wav',
      duration: 1.5,
      status: 'untagged',
      modifiedTime: 1,
    })
    const embedding = new Float32Array(2048)
    embedding[0] = 0.5
    replaceSuggestions(db, tonePath, embedding, suggestions, 'probe-a')
    saveLabel(db, {
      path: tonePath,
      catId: 'AIRBlow',
      fxName: 'Gust',
      creatorId: 'BA',
      sourceId: 'Studio',
      rank: '1',
    })
    expect(countFiles(db)).toBe(1)
    expect(countRows(db, 'suggestions')).toBe(5)
    expect(countRows(db, 'labels')).toBe(1)
    expect(countRows(db, 'embeddings')).toBe(1)
    expect(countUcs(db)).toBe(5)

    resetLibrary(db)

    expect(listFiles(db)).toEqual([])
    expect(countFiles(db)).toBe(0)
    expect(countRows(db, 'suggestions')).toBe(0)
    expect(countRows(db, 'labels')).toBe(0)
    expect(countRows(db, 'embeddings')).toBe(0)
    expect(countUcs(db)).toBe(5)
    db.close()

    const reopened = openLibrary(dbPath)
    expect(listFiles(reopened)).toEqual([])
    expect(countUcs(reopened)).toBe(5)
    reopened.close()
  })
})

function insertCatalog(db: LibraryDatabase): void {
  const insert = db.prepare(
    `INSERT INTO ucs (CatID, Category, SubCategory, explanation, synonyms)
     VALUES (?, ?, ?, 'note', 'syn')`,
  )
  for (const [catId, category, subCategory] of [
    ['AIRBlow', 'AIR', 'Blow'],
    ['AIRBrst', 'AIR', 'Burst'],
    ['AIRHiss', 'AIR', 'Hiss'],
    ['AIRMisc', 'AIR', 'Miscellaneous'],
    ['AIRSuck', 'AIR', 'Suck'],
  ]) {
    insert.run(catId, category, subCategory)
  }
}

function countRows(db: LibraryDatabase, table: string): number {
  const row = db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as
    | { count: number }
    | undefined
  return row?.count ?? 0
}
