import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import type { Suggestion } from '../shared/ipc'
import {
  clearSuggestions,
  countFiles,
  countUcs,
  type LibraryDatabase,
  listFiles,
  openLibrary,
  readStoredFile,
  replaceSuggestions,
  upsertWav,
} from './database'

const firstSuggestions: Suggestion[] = [
  { catId: 'AIRBlow', score: 0.5 },
  { catId: 'AIRBrst', score: 0.25 },
  { catId: 'AIRHiss', score: 0.125 },
  { catId: 'AIRMisc', score: 0.0625 },
  { catId: 'AIRSuck', score: 0.03125 },
]

const secondSuggestions: Suggestion[] = [
  { catId: 'AERODoor', score: 0.5 },
  { catId: 'AEROHeli', score: 0.25 },
  { catId: 'AEROInt', score: 0.125 },
  { catId: 'AEROJet', score: 0.0625 },
  { catId: 'AEROMech', score: 0.03125 },
]

describe('suggestion store', () => {
  it('replaces one embedding and five rows, then reads them after reopen', () => {
    const folder = mkdtempSync(join(tmpdir(), 'sonoarchive-suggest-'))
    const dbPath = join(folder, 'library.db')
    const tonePath = join(folder, 'tone.wav')
    const quietPath = join(folder, 'quiet.wav')
    const db = openLibrary(dbPath)
    storeWav(db, tonePath, 'tone.wav', 1.5)
    storeWav(db, quietPath, 'quiet.wav', 2)

    const first = sampleEmbedding(0.5, -1.25)
    replaceSuggestions(db, tonePath, first, firstSuggestions, 'probe-a')

    expect(countFiles(db)).toBe(2)
    expect(readEmbedding(db, tonePath)).toEqual(bytesOf(first))
    expect(readSuggestionRows(db, tonePath)).toEqual(
      ranked(firstSuggestions, 'probe-a'),
    )
    expect(listFiles(db)).toEqual([
      {
        path: quietPath,
        name: 'quiet.wav',
        format: 'wav',
        duration: 2,
        status: 'untagged',
        catId: null,
        suggestions: [],
        label: null,
      },
      {
        path: tonePath,
        name: 'tone.wav',
        format: 'wav',
        duration: 1.5,
        status: 'untagged',
        catId: 'AIRBlow',
        suggestions: firstSuggestions,
        label: null,
      },
    ])
    db.close()

    const reopened = openLibrary(dbPath)
    expect(readEmbedding(reopened, tonePath)).toEqual(bytesOf(first))
    expect(readSuggestionRows(reopened, tonePath)).toEqual(
      ranked(firstSuggestions, 'probe-a'),
    )
    expect(listFiles(reopened)[1]).toEqual({
      path: tonePath,
      name: 'tone.wav',
      format: 'wav',
      duration: 1.5,
      status: 'untagged',
      catId: 'AIRBlow',
      suggestions: firstSuggestions,
      label: null,
    })

    const second = sampleEmbedding(-0.25, 0.75)
    replaceSuggestions(reopened, tonePath, second, secondSuggestions, 'probe-b')
    expect(countFiles(reopened)).toBe(2)
    expect(countPath(reopened, tonePath)).toBe(1)
    expect(readStoredFile(reopened, tonePath)?.status).toBe('untagged')
    expect(readEmbedding(reopened, tonePath)).toEqual(bytesOf(second))
    expect(readSuggestionRows(reopened, tonePath)).toEqual(
      ranked(secondSuggestions, 'probe-b'),
    )
    expect(listFiles(reopened)[1]?.suggestions).toEqual(secondSuggestions)
    reopened.close()

    const cleared = openLibrary(dbPath)
    clearSuggestions(cleared, tonePath)
    expect(countFiles(cleared)).toBe(2)
    expect(readStoredFile(cleared, tonePath)).toMatchObject({
      name: 'tone.wav',
      status: 'untagged',
    })
    expect(readEmbedding(cleared, tonePath)).toBeUndefined()
    expect(readSuggestionRows(cleared, tonePath)).toEqual([])
    expect(listFiles(cleared)[1]).toEqual({
      path: tonePath,
      name: 'tone.wav',
      format: 'wav',
      duration: 1.5,
      status: 'untagged',
      catId: null,
      suggestions: [],
      label: null,
    })
    cleared.close()
  })

  it('adds the vector tables beside an existing library', () => {
    const folder = mkdtempSync(join(tmpdir(), 'sonoarchive-legacy-'))
    const dbPath = join(folder, 'library.db')
    const legacy = new Database(dbPath)
    legacy.exec(`
      CREATE TABLE files (
        path TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        format TEXT NOT NULL,
        duration REAL NOT NULL,
        status TEXT NOT NULL,
        modified_time INTEGER NOT NULL
      );
      CREATE TABLE ucs (
        CatID TEXT PRIMARY KEY,
        Category TEXT NOT NULL,
        SubCategory TEXT NOT NULL,
        explanation TEXT NOT NULL,
        synonyms TEXT NOT NULL
      );
    `)
    legacy
      .prepare(
        `INSERT INTO files (path, name, format, duration, status, modified_time)
         VALUES (?, ?, 'wav', 1, 'untagged', 1)`,
      )
      .run('/tone.wav', 'tone.wav')
    legacy
      .prepare(
        `INSERT INTO ucs (CatID, Category, SubCategory, explanation, synonyms)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run('AIRBlow', 'AIR', 'Blow', 'air', 'wind')
    legacy.close()

    const db = openLibrary(dbPath)
    expect(countFiles(db)).toBe(1)
    expect(countUcs(db)).toBe(1)
    expect(listFiles(db)).toEqual([
      {
        path: '/tone.wav',
        name: 'tone.wav',
        format: 'wav',
        duration: 1,
        status: 'untagged',
        catId: null,
        suggestions: [],
        label: null,
      },
    ])
    replaceSuggestions(
      db,
      '/tone.wav',
      sampleEmbedding(0.5, -1.25),
      firstSuggestions,
      'probe-a',
    )
    expect(listFiles(db)[0]?.catId).toBe('AIRBlow')
    db.close()
  })
})

function storeWav(
  db: LibraryDatabase,
  path: string,
  name: string,
  duration: number,
): void {
  upsertWav(db, {
    path,
    name,
    format: 'wav',
    duration,
    status: 'untagged',
    modifiedTime: 1,
  })
}

function sampleEmbedding(first: number, last: number): Float32Array {
  const values = new Float32Array(2048)
  values[0] = first
  values[2047] = last
  return values
}

function bytesOf(values: Float32Array): Buffer {
  return Buffer.from(values.buffer, values.byteOffset, values.byteLength)
}

function readEmbedding(
  db: LibraryDatabase,
  filePath: string,
): Buffer | undefined {
  const row = db
    .prepare(
      `SELECT embeddings.embedding AS embedding
       FROM files
       JOIN embeddings ON embeddings.rowid = files.rowid
       WHERE files.path = ?`,
    )
    .get(filePath) as { embedding: Uint8Array } | undefined
  if (!row) return undefined
  return Buffer.from(row.embedding)
}

function readSuggestionRows(
  db: LibraryDatabase,
  filePath: string,
): Array<Suggestion & { rank: number; probeVersion: string }> {
  return db
    .prepare(
      `SELECT rank, CatID AS catId, score, probe_version AS probeVersion
       FROM suggestions
       WHERE path = ?
       ORDER BY rank`,
    )
    .all(filePath) as Array<Suggestion & { rank: number; probeVersion: string }>
}

function ranked(
  suggestions: Suggestion[],
  probeVersion: string,
): Array<Suggestion & { rank: number; probeVersion: string }> {
  return suggestions.map((suggestion, index) => ({
    rank: index + 1,
    catId: suggestion.catId,
    score: suggestion.score,
    probeVersion,
  }))
}

function countPath(db: LibraryDatabase, filePath: string): number {
  const row = db
    .prepare('SELECT COUNT(*) AS count FROM files WHERE path = ?')
    .get(filePath) as { count: number }
  return row.count
}
