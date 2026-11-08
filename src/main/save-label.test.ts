import { createHash } from 'node:crypto'
import {
  chmodSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { LibraryLabel, Suggestion } from '../shared/ipc'
import {
  type LibraryDatabase,
  listFiles,
  openLibrary,
  readStoredFile,
  replaceSuggestions,
  upsertWav,
} from './database'
import { saveTaggedWav } from './save-label'
import { inspectWav } from './wav-metadata'

const suggestions: Suggestion[] = [
  { catId: 'AIRBlow', score: 0.5 },
  { catId: 'AIRBrst', score: 0.25 },
  { catId: 'AIRHiss', score: 0.125 },
  { catId: 'AIRMisc', score: 0.0625 },
  { catId: 'AIRSuck', score: 0.03125 },
]

describe('save tagged wav', () => {
  it('writes rank 2 and a manual rank after the file write succeeds', () => {
    const { db, wav } = libraryWithWav('tone.wav')
    saveTaggedWav(db, {
      path: wav,
      catId: 'AIRBrst',
      fxName: '  Door slam ',
      creatorId: ' Ada ',
      sourceId: ' Field ',
      rank: '2',
    })
    expect(readLabels(db)).toEqual([
      expect.objectContaining({
        path: wav,
        catId: 'AIRBrst',
        fxName: 'Door slam',
        creatorId: 'Ada',
        sourceId: 'Field',
        rank: '2',
      }),
    ])
    expect(readStoredFile(db, wav)?.status).toBe('tagged')
    expect(inspectWav(readFileSync(wav)).fields).toEqual({
      CatID: 'AIRBrst',
      Category: 'AIR',
      SubCategory: 'Burst',
      FXName: 'Door slam',
      CreatorID: 'Ada',
      SourceID: 'Field',
    })

    saveTaggedWav(db, {
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
    expect(listFiles(db).find((file) => file.path === wav)?.status).toBe(
      'tagged',
    )
    expect(inspectWav(readFileSync(wav)).fields).toMatchObject({
      CatID: 'DOORWood',
      Category: 'DOORS',
      SubCategory: 'Wood',
      FXName: 'Creak',
    })
    expect(
      inspectWav(readFileSync(wav)).chunkIds.filter((id) => id === 'iXML'),
    ).toEqual(['iXML'])
    db.close()
  })

  it('leaves the row, the status, and the bytes unchanged when the wav is read-only', () => {
    const { db, wav, folder } = libraryWithWav('locked.wav')
    saveTaggedWav(db, {
      path: wav,
      catId: 'AIRBrst',
      fxName: 'Door slam',
      creatorId: 'Ada',
      sourceId: 'Field',
      rank: '2',
    })
    const row = readLabels(db)
    const bytes = readFileSync(wav)
    chmodSync(wav, 0o444)
    try {
      expect(() =>
        saveTaggedWav(db, {
          path: wav,
          catId: 'DOORWood',
          fxName: 'Creak',
          creatorId: '',
          sourceId: '',
          rank: 'manual',
        }),
      ).toThrow(/left unchanged/)
    } finally {
      chmodSync(wav, 0o644)
    }
    expect(readLabels(db)).toEqual(row)
    expect(readStoredFile(db, wav)?.status).toBe('tagged')
    expect(readFileSync(wav).equals(bytes)).toBe(true)
    expect(
      readdirSync(folder).filter((name) => name.includes('sonoarchive-tmp')),
    ).toEqual([])
    db.close()
  })

  it('does not write the file or the row when the label is rejected', () => {
    const { db, wav } = libraryWithWav('rejected.wav')
    const before = hashFile(wav)
    expect(() =>
      saveTaggedWav(db, {
        path: wav,
        catId: 'AIRBrst',
        fxName: '   ',
        creatorId: 'Ada',
        sourceId: 'Field',
        rank: '2',
      }),
    ).toThrow(/FXName is empty/)
    expect(() =>
      saveTaggedWav(db, {
        path: wav,
        catId: 'NOPE',
        fxName: 'Missing',
        creatorId: '',
        sourceId: '',
        rank: 'manual',
      }),
    ).toThrow(/Unknown CatID/)
    expect(() =>
      saveTaggedWav(db, {
        path: wav,
        catId: 'AIRBlow',
        fxName: 'Wrong',
        creatorId: '',
        sourceId: '',
        rank: '2',
      }),
    ).toThrow(/does not match/)
    expect(readLabels(db)).toEqual([])
    expect(readStoredFile(db, wav)?.status).toBe('untagged')
    expect(hashFile(wav)).toBe(before)
    db.close()
  })
})

function libraryWithWav(name: string): {
  db: LibraryDatabase
  wav: string
  folder: string
} {
  const folder = mkdtempSync(join(tmpdir(), 'sonoarchive-save-'))
  const wav = join(folder, name)
  writeFileSync(wav, pcmWav())
  const db = openLibrary(join(folder, 'library.db'))
  upsertWav(db, {
    path: wav,
    name,
    format: 'wav',
    duration: 1.5,
    status: 'untagged',
    modifiedTime: 1,
  })
  insertCatalog(db)
  replaceSuggestions(db, wav, sampleEmbedding(), suggestions, 'probe-a')
  return { db, wav, folder }
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
  return values
}

function hashFile(filePath: string): string {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex')
}

function pcmWav(): Buffer {
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
  return buffer
}
