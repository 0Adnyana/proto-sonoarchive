import { createHash } from 'node:crypto'
import {
  chmodSync,
  existsSync,
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
    const savedPath = saveTaggedWav(db, {
      path: wav,
      catId: 'AIRBrst',
      fxName: '  Door slam ',
      creatorId: ' Ada ',
      sourceId: ' Field ',
      rank: '2',
      rename: false,
    })
    expect(savedPath).toBe(wav)
    expect(existsSync(wav)).toBe(true)
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
      rename: false,
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
      rename: false,
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
          rename: false,
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
        rename: false,
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
        rename: false,
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
        rename: false,
      }),
    ).toThrow(/does not match/)
    expect(readLabels(db)).toEqual([])
    expect(readStoredFile(db, wav)?.status).toBe('untagged')
    expect(hashFile(wav)).toBe(before)
    db.close()
  })

  it('renames one row, keeps the embedding, and reads the six fields back', () => {
    const { db, wav, folder } = libraryWithWav('tone.wav')
    const before = db
      .prepare('SELECT rowid AS id FROM files WHERE path = ?')
      .get(wav) as { id: number }
    const embedding = readEmbedding(db, wav)
    const destination = join(folder, 'DOORWood_Creak_JS_01.wav')
    const savedPath = saveTaggedWav(db, {
      path: wav,
      catId: 'DOORWood',
      fxName: 'Creak',
      creatorId: 'JS',
      sourceId: '01',
      rank: 'manual',
      rename: true,
    })
    expect(savedPath).toBe(destination)
    expect(existsSync(wav)).toBe(false)
    expect(existsSync(destination)).toBe(true)
    const after = db
      .prepare('SELECT rowid AS id FROM files WHERE path = ?')
      .get(destination) as { id: number }
    expect(after.id).toBe(before.id)
    expect(
      readEmbedding(db, destination)?.equals(embedding ?? Buffer.alloc(0)),
    ).toBe(true)
    expect(readEmbedding(db, wav)).toBeUndefined()
    expect(suggestionCount(db, wav)).toBe(0)
    expect(suggestionCount(db, destination)).toBe(5)
    expect(listFiles(db)).toEqual([
      expect.objectContaining({
        path: destination,
        name: 'DOORWood_Creak_JS_01.wav',
        status: 'tagged',
        catId: 'DOORWood',
      }),
    ])
    expect(readLabels(db)).toEqual([
      expect.objectContaining({
        path: destination,
        catId: 'DOORWood',
        fxName: 'Creak',
        creatorId: 'JS',
        sourceId: '01',
        rank: 'manual',
      }),
    ])
    expect(inspectWav(readFileSync(destination)).fields).toEqual({
      CatID: 'DOORWood',
      Category: 'DOORS',
      SubCategory: 'Wood',
      FXName: 'Creak',
      CreatorID: 'JS',
      SourceID: '01',
    })
    db.close()
    const reopened = openLibrary(join(folder, 'library.db'))
    expect(listFiles(reopened)).toEqual([
      expect.objectContaining({
        path: destination,
        name: 'DOORWood_Creak_JS_01.wav',
        status: 'tagged',
        catId: 'DOORWood',
      }),
    ])
    reopened.close()
  })

  it('keeps the original path when the previewed name is already taken', () => {
    const { db, wav, folder } = libraryWithWav('tone.wav')
    const onDisk = join(folder, 'DOORWood_Creak__.wav')
    writeFileSync(onDisk, Buffer.from('other-bytes'))
    expect(() =>
      saveTaggedWav(db, {
        path: wav,
        catId: 'DOORWood',
        fxName: 'Creak',
        creatorId: '',
        sourceId: '',
        rank: 'manual',
        rename: true,
      }),
    ).toThrow('A file named DOORWood_Creak__.wav already exists.')
    expect(existsSync(wav)).toBe(true)
    expect(readFileSync(onDisk).equals(Buffer.from('other-bytes'))).toBe(true)
    expect(readStoredFile(db, wav)?.name).toBe('tone.wav')
    expect(readLabels(db)).toEqual([
      expect.objectContaining({
        path: wav,
        catId: 'DOORWood',
        fxName: 'Creak',
      }),
    ])
    expect(inspectWav(readFileSync(wav)).fields).toMatchObject({
      CatID: 'DOORWood',
      FXName: 'Creak',
      CreatorID: '',
      SourceID: '',
    })

    const taken = join(folder, 'AIRBrst_Gust_Ada_Field.wav')
    upsertWav(db, {
      path: taken,
      name: 'AIRBrst_Gust_Ada_Field.wav',
      format: 'wav',
      duration: 1,
      status: 'untagged',
      modifiedTime: 2,
    })
    expect(() =>
      saveTaggedWav(db, {
        path: wav,
        catId: 'AIRBrst',
        fxName: 'Gust',
        creatorId: 'Ada',
        sourceId: 'Field',
        rank: '2',
        rename: true,
      }),
    ).toThrow('A file named AIRBrst_Gust_Ada_Field.wav already exists.')
    expect(existsSync(wav)).toBe(true)
    expect(existsSync(taken)).toBe(false)
    expect(readStoredFile(db, wav)?.name).toBe('tone.wav')
    expect(readLabels(db)).toEqual([
      expect.objectContaining({
        path: wav,
        catId: 'AIRBrst',
        fxName: 'Gust',
        rank: '2',
      }),
    ])
    db.close()
  })

  it('saves a file that already has the previewed name without renaming', () => {
    const name = 'DOORWood_Creak_JS_01.wav'
    const { db, wav } = libraryWithWav(name)
    const savedPath = saveTaggedWav(db, {
      path: wav,
      catId: 'DOORWood',
      fxName: 'Creak',
      creatorId: 'JS',
      sourceId: '01',
      rank: 'manual',
      rename: true,
    })
    expect(savedPath).toBe(wav)
    expect(readStoredFile(db, wav)?.name).toBe(name)
    expect(readLabels(db)).toEqual([
      expect.objectContaining({ path: wav, fxName: 'Creak', creatorId: 'JS' }),
    ])
    expect(inspectWav(readFileSync(wav)).fields.FXName).toBe('Creak')
    db.close()
  })

  it('renames the file back when the database update fails', () => {
    const { db, wav, folder } = libraryWithWav('tone.wav')
    const destination = join(folder, 'DOORWood_Creak__.wav')
    db.exec(`
      CREATE TRIGGER fail_path_update
      BEFORE UPDATE OF path ON files
      WHEN NEW.path <> OLD.path
      BEGIN
        SELECT RAISE(ABORT, 'forced path update failure');
      END;
    `)
    expect(() =>
      saveTaggedWav(db, {
        path: wav,
        catId: 'DOORWood',
        fxName: 'Creak',
        creatorId: '',
        sourceId: '',
        rank: 'manual',
        rename: true,
      }),
    ).toThrow(/forced path update failure/)
    expect(existsSync(wav)).toBe(true)
    expect(existsSync(destination)).toBe(false)
    expect(readStoredFile(db, wav)?.name).toBe('tone.wav')
    expect(readLabels(db)).toEqual([
      expect.objectContaining({
        path: wav,
        catId: 'DOORWood',
        fxName: 'Creak',
      }),
    ])
    expect(inspectWav(readFileSync(wav)).fields.CatID).toBe('DOORWood')
    db.close()
  })

  it('keeps the original path when the basename is rejected', () => {
    const { db, wav, folder } = libraryWithWav('tone.wav')
    expect(() =>
      saveTaggedWav(db, {
        path: wav,
        catId: 'DOORWood',
        fxName: 'bad/name',
        creatorId: '',
        sourceId: '',
        rank: 'manual',
        rename: true,
      }),
    ).toThrow('Could not rename the file to DOORWood_bad/name__.wav.')
    expect(existsSync(wav)).toBe(true)
    expect(readdirSync(folder)).not.toContain('bad')
    expect(readStoredFile(db, wav)?.name).toBe('tone.wav')
    expect(readLabels(db)).toEqual([
      expect.objectContaining({ path: wav, fxName: 'bad/name' }),
    ])
    expect(inspectWav(readFileSync(wav)).fields.FXName).toBe('bad/name')
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

function suggestionCount(db: LibraryDatabase, filePath: string): number {
  const row = db
    .prepare('SELECT COUNT(*) AS count FROM suggestions WHERE path = ?')
    .get(filePath) as { count: number }
  return row.count
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
