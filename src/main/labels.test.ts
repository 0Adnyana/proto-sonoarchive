import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { LibraryLabel, Suggestion } from '../shared/ipc'
import {
  type LibraryDatabase,
  listFiles,
  listUcs,
  openLibrary,
  readStoredFile,
  replaceSuggestions,
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

describe('labels', () => {
  it('stores rank 2, replaces it, and leaves a rejected save and the wav bytes alone', () => {
    const folder = mkdtempSync(join(tmpdir(), 'sonoarchive-label-'))
    const dbPath = join(folder, 'library.db')
    const wav = join(folder, 'tone.wav')
    writePcmWav(wav)
    const before = hashFile(wav)
    const db = openLibrary(dbPath)
    storeWav(db, wav, 'tone.wav')
    storeWav(db, join(folder, 'quiet.wav'), 'quiet.wav')
    insertCatalog(db)
    replaceSuggestions(db, wav, sampleEmbedding(), suggestions, 'probe-a')

    expect(listFiles(db).find((file) => file.path === wav)).toMatchObject({
      status: 'untagged',
      catId: 'AIRBlow',
      label: null,
      suggestions,
    })

    expect(() =>
      saveLabel(db, {
        path: wav,
        catId: 'AIRBrst',
        fxName: '   ',
        creatorId: 'Ada',
        sourceId: 'Field',
        rank: '2',
      }),
    ).toThrow(/FXName is empty/)
    expect(readLabels(db)).toEqual([])
    expect(readStoredFile(db, wav)?.status).toBe('untagged')

    const started = Date.now()
    saveLabel(db, {
      path: wav,
      catId: 'AIRBrst',
      fxName: '  Door slam ',
      creatorId: ' Ada ',
      sourceId: ' Field ',
      rank: '2',
    })
    const saved = readLabels(db)
    expect(saved).toHaveLength(1)
    expect(saved[0]).toMatchObject({
      path: wav,
      catId: 'AIRBrst',
      fxName: 'Door slam',
      creatorId: 'Ada',
      sourceId: 'Field',
      rank: '2',
    })
    expect(saved[0]?.savedAt).toBe(
      new Date(saved[0]?.savedAt ?? '').toISOString(),
    )
    expect(Date.parse(saved[0]?.savedAt ?? '')).toBeGreaterThanOrEqual(started)
    expect(listFiles(db).find((file) => file.path === wav)).toMatchObject({
      status: 'tagged',
      catId: 'AIRBrst',
      suggestions,
      label: {
        catId: 'AIRBrst',
        fxName: 'Door slam',
        creatorId: 'Ada',
        sourceId: 'Field',
        rank: '2',
      } satisfies LibraryLabel,
    })
    expect(hashFile(wav)).toBe(before)

    const untouched = saved[0]
    expect(() =>
      saveLabel(db, {
        path: wav,
        catId: 'AIRBlow',
        fxName: 'Wrong',
        creatorId: '',
        sourceId: '',
        rank: '2',
      }),
    ).toThrow(/does not match/)
    expect(() =>
      saveLabel(db, {
        path: join(folder, 'missing.wav'),
        catId: 'DOORWood',
        fxName: 'Missing',
        creatorId: '',
        sourceId: '',
        rank: 'manual',
      }),
    ).toThrow(/No stored file/)
    expect(() =>
      saveLabel(db, {
        path: wav,
        catId: 'NOPE',
        fxName: 'Missing',
        creatorId: '',
        sourceId: '',
        rank: 'manual',
      }),
    ).toThrow(/Unknown CatID/)
    expect(readLabels(db)).toEqual([untouched])
    expect(readStoredFile(db, wav)?.status).toBe('tagged')

    saveLabel(db, {
      path: wav,
      catId: 'DOORWood',
      fxName: 'Creak',
      creatorId: '',
      sourceId: '',
      rank: 'manual',
    })
    expect(readLabels(db)).toEqual([
      expect.objectContaining({
        path: wav,
        catId: 'DOORWood',
        fxName: 'Creak',
        creatorId: '',
        sourceId: '',
        rank: 'manual',
      }),
    ])
    expect(hashFile(wav)).toBe(before)

    const replaced = sampleEmbedding()
    replaced[0] = 0.25
    replaceSuggestions(
      db,
      wav,
      replaced,
      suggestions.map((suggestion) => ({ ...suggestion, score: 0.1 })),
      'probe-b',
    )
    upsertWav(db, {
      path: wav,
      name: 'tone.wav',
      format: 'wav',
      duration: 2,
      status: 'untagged',
      modifiedTime: 9,
    })
    const kept = listFiles(db).find((file) => file.path === wav)
    expect(kept?.status).toBe('tagged')
    expect(kept?.label?.rank).toBe('manual')
    expect(kept?.label?.catId).toBe('DOORWood')
    expect(kept?.catId).toBe('DOORWood')
    expect(kept?.suggestions).toHaveLength(5)
    db.close()

    const reopened = openLibrary(dbPath)
    const again = listFiles(reopened).find((file) => file.path === wav)
    expect(again).toMatchObject({
      status: 'tagged',
      catId: 'DOORWood',
      label: {
        catId: 'DOORWood',
        fxName: 'Creak',
        creatorId: '',
        sourceId: '',
        rank: 'manual',
      },
    })
    expect(listUcs(reopened).map((entry) => entry.catId)).toEqual([
      'AIRBlow',
      'AIRBrst',
      'AIRHiss',
      'AIRMisc',
      'AIRSuck',
      'DOORWood',
    ])
    reopened.close()
  })
})

function storeWav(db: LibraryDatabase, path: string, name: string): void {
  upsertWav(db, {
    path,
    name,
    format: 'wav',
    duration: 1.5,
    status: 'untagged',
    modifiedTime: 1,
  })
}

function insertCatalog(db: LibraryDatabase): void {
  const insert = db.prepare(
    `INSERT INTO ucs (CatID, Category, SubCategory, explanation, synonyms)
     VALUES (?, ?, ?, 'note', 'syn')`,
  )
  const rows = [
    ['DOORWood', 'DOORS', 'Wood'],
    ['AIRSuck', 'AIR', 'Suck'],
    ['AIRBlow', 'AIR', 'Blow'],
    ['AIRBrst', 'AIR', 'Burst'],
    ['AIRMisc', 'AIR', 'Miscellaneous'],
    ['AIRHiss', 'AIR', 'Hiss'],
  ]
  for (const [catId, category, subCategory] of rows) {
    insert.run(catId, category, subCategory)
  }
}

function readLabels(
  db: LibraryDatabase,
): Array<LibraryLabel & { path: string; savedAt: string }> {
  return db
    .prepare(
      `SELECT
         path,
         CatID AS catId,
         FXName AS fxName,
         CreatorID AS creatorId,
         SourceID AS sourceId,
         rank,
         saved_at AS savedAt
       FROM labels
       ORDER BY path`,
    )
    .all() as Array<LibraryLabel & { path: string; savedAt: string }>
}

function sampleEmbedding(): Float32Array {
  const values = new Float32Array(2048)
  values[0] = 0.5
  values[2047] = -1.25
  return values
}

function hashFile(filePath: string): string {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex')
}

function writePcmWav(filePath: string): void {
  const dataSize = 16
  const buffer = Buffer.alloc(44 + dataSize)
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + dataSize, 4)
  buffer.write('WAVE', 8)
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(8000, 24)
  buffer.writeUInt32LE(16000, 28)
  buffer.writeUInt16LE(2, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(dataSize, 40)
  writeFileSync(filePath, buffer)
}
