import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { Suggestion } from '../shared/ipc'
import { readNpzEmbeddings } from '../worker/reference-fixtures'
import {
  findSimilar,
  type LibraryDatabase,
  openLibrary,
  replaceSuggestions,
  saveLabel,
  searchText,
  upsertWav,
} from './database'

const manifestPath = fileURLToPath(
  new URL('../../fixtures/manifest.json', import.meta.url),
)
const embeddingsPath = fileURLToPath(
  new URL('../../fixtures/F-ref/embeddings.npz', import.meta.url),
)

describe('search', () => {
  it('matches one FXName, one category, an untagged rank-1 CatID, and leaves out empty queries', () => {
    const { db, paths } = openTaggedLibrary()
    try {
      expect(searchText(db, 'creak')).toEqual([
        hit(paths.alder, 'alder.wav', 'DOORWood', 'Wood creak'),
      ])
      expect(searchText(db, 'CREAK')).toEqual([
        hit(paths.alder, 'alder.wav', 'DOORWood', 'Wood creak'),
      ])
      expect(searchText(db, 'doors')).toEqual([
        hit(paths.alder, 'alder.wav', 'DOORWood', 'Wood creak'),
        hit(paths.beech, 'beech.wav', 'DOORWood', 'Panel close'),
      ])
      expect(searchText(db, 'WATRDrip')).toEqual([
        hit(paths.drip, 'drip.wav', 'WATRDrip', ''),
      ])
      expect(searchText(db, '')).toEqual([])
      expect(searchText(db, '   ')).toEqual([])
      expect(searchText(db, String.raw`a\b%_c`)).toEqual([
        hit(paths.slam, 'slam.wav', 'AIRBrst', String.raw`a\b%_c`),
      ])
      expect(searchText(db, '%')).toEqual([
        hit(paths.slam, 'slam.wav', 'AIRBrst', String.raw`a\b%_c`),
      ])
      expect(searchText(db, '_')).toEqual([
        hit(paths.slam, 'slam.wav', 'AIRBrst', String.raw`a\b%_c`),
      ])
    } finally {
      db.close()
    }
  })

  it('matches file names and untagged rank-1 fields, and leaves out rank 2', () => {
    const { db, paths } = openTaggedLibrary()
    try {
      const folder = dirname(paths.alder)
      const acacia = join(folder, 'acacia.wav')
      const hiss = join(folder, 'hiss.wav')
      upsertWav(db, {
        path: acacia,
        name: 'acacia.wav',
        format: 'wav',
        duration: 1.5,
        status: 'untagged',
        modifiedTime: 1,
      })
      upsertWav(db, {
        path: hiss,
        name: 'hiss.wav',
        format: 'wav',
        duration: 1.5,
        status: 'untagged',
        modifiedTime: 1,
      })
      replaceSuggestions(db, acacia, axis(3), five('DOORWood'), 'probe')
      replaceSuggestions(
        db,
        hiss,
        axis(4),
        [
          { catId: 'AIRHiss', score: 0.5 },
          { catId: 'AIRMisc', score: 0.4 },
          { catId: 'AIRBlow', score: 0.3 },
          { catId: 'AIRBrst', score: 0.2 },
          { catId: 'WATRDrip', score: 0.1 },
        ],
        'probe',
      )

      expect(searchText(db, 'doors')).toEqual([
        hit(acacia, 'acacia.wav', 'DOORWood', ''),
        hit(paths.alder, 'alder.wav', 'DOORWood', 'Wood creak'),
        hit(paths.beech, 'beech.wav', 'DOORWood', 'Panel close'),
      ])
      expect(searchText(db, 'bare')).toEqual([
        hit(paths.bare, 'bare.wav', '', ''),
      ])
      expect(searchText(db, 'acacia')).toEqual([
        hit(acacia, 'acacia.wav', 'DOORWood', ''),
      ])
      expect(searchText(db, 'p')).toEqual([
        hit(paths.drip, 'drip.wav', 'WATRDrip', ''),
        hit(paths.beech, 'beech.wav', 'DOORWood', 'Panel close'),
      ])
      expect(searchText(db, 'AIRMisc')).toEqual([])
    } finally {
      db.close()
    }
  })

  it('lists a nearer embedding first and excludes the query file', () => {
    const { db, paths } = openTaggedLibrary()
    try {
      const hits = findSimilar(db, paths.alder)
      expect(hits.map((row) => row.name)).toEqual([
        'drip.wav',
        'beech.wav',
        'slam.wav',
      ])
      expect(hits.map((row) => row.path)).not.toContain(paths.alder)
      expect(hits.map((row) => row.path)).not.toContain(paths.bare)
      expect(hits[0]).toMatchObject({
        catId: 'WATRDrip',
        fxName: '',
      })
      expect(hits[0]?.similarity).toBeCloseTo(1, 5)
      expect(hits[1]).toMatchObject({
        catId: 'DOORWood',
        fxName: 'Panel close',
      })
      expect(hits[1]?.similarity).toBeCloseTo(0, 5)
    } finally {
      db.close()
    }
  })

  it('returns an F-short subcategory twin in the top 3 within a second', () => {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
      files: Array<{ filename: string; duration: number; CatID: string }>
    }
    const embeddings = readNpzEmbeddings(embeddingsPath)
    const folder = mkdtempSync(join(tmpdir(), 'sonoarchive-fshort-'))
    const db = openLibrary(join(folder, 'library.db'))
    try {
      const paths = new Map<string, string>()
      for (const file of manifest.files) {
        const embedding = embeddings.get(file.filename)
        if (!embedding) throw new Error(`No embedding for ${file.filename}`)
        const path = join(folder, file.filename)
        paths.set(file.filename, path)
        upsertWav(db, {
          path,
          name: file.filename,
          format: 'wav',
          duration: file.duration,
          status: 'untagged',
          modifiedTime: 1,
        })
        replaceSuggestions(db, path, embedding, five(file.CatID), 'f-short')
      }

      // These two share ICE / BREAK, and each is in the other's top 3.
      const queryName = '173604.wav'
      const twinName = '179263.wav'
      const queryPath = paths.get(queryName)
      if (!queryPath) throw new Error(`No stored file for ${queryName}`)
      const started = performance.now()
      const hits = findSimilar(db, queryPath)
      expect(performance.now() - started).toBeLessThan(1000)
      expect(hits).toHaveLength(manifest.files.length - 1)
      expect(hits.map((row) => row.name)).not.toContain(queryName)
      expect(hits.slice(0, 3).map((row) => row.name)).toContain(twinName)
    } finally {
      db.close()
    }
  })
})

function hit(
  path: string,
  name: string,
  catId: string,
  fxName: string,
): {
  path: string
  name: string
  catId: string
  fxName: string
  similarity: null
} {
  return { path, name, catId, fxName, similarity: null }
}

function openTaggedLibrary(): {
  db: LibraryDatabase
  paths: Record<string, string>
} {
  const folder = mkdtempSync(join(tmpdir(), 'sonoarchive-search-'))
  const db = openLibrary(join(folder, 'library.db'))
  insertCatalog(db)
  const names = ['alder.wav', 'beech.wav', 'slam.wav', 'drip.wav', 'bare.wav']
  const paths: Record<string, string> = {}
  for (const name of names) {
    const path = join(folder, name)
    paths[name.replace('.wav', '')] = path
    upsertWav(db, {
      path,
      name,
      format: 'wav',
      duration: 1.5,
      status: 'untagged',
      modifiedTime: 1,
    })
  }
  replaceSuggestions(db, paths.alder, axis(0), five('DOORWood'), 'probe')
  replaceSuggestions(db, paths.beech, axis(1), five('AIRBlow'), 'probe')
  replaceSuggestions(db, paths.slam, axis(2), five('AIRBrst'), 'probe')
  replaceSuggestions(db, paths.drip, axis(0), five('WATRDrip'), 'probe')
  saveLabel(db, {
    path: paths.alder,
    catId: 'DOORWood',
    fxName: 'Wood creak',
    creatorId: '',
    sourceId: '',
    rank: 'manual',
  })
  saveLabel(db, {
    path: paths.beech,
    catId: 'DOORWood',
    fxName: 'Panel close',
    creatorId: '',
    sourceId: '',
    rank: 'manual',
  })
  saveLabel(db, {
    path: paths.slam,
    catId: 'AIRBrst',
    fxName: String.raw`a\b%_c`,
    creatorId: '',
    sourceId: '',
    rank: 'manual',
  })
  return { db, paths }
}

function insertCatalog(db: LibraryDatabase): void {
  const insert = db.prepare(
    `INSERT INTO ucs (CatID, Category, SubCategory, explanation, synonyms)
     VALUES (?, ?, ?, 'note', 'syn')`,
  )
  const rows = [
    ['DOORWood', 'DOORS', 'Wood'],
    ['AIRBlow', 'AIR', 'Blow'],
    ['AIRBrst', 'AIR', 'Burst'],
    ['AIRHiss', 'AIR', 'Hiss'],
    ['AIRMisc', 'AIR', 'Miscellaneous'],
    ['WATRDrip', 'WATER', 'Drip'],
  ]
  for (const [catId, category, subCategory] of rows) {
    insert.run(catId, category, subCategory)
  }
}

function five(catId: string): Suggestion[] {
  return [0.5, 0.4, 0.3, 0.2, 0.1].map((score) => ({ catId, score }))
}

function axis(index: number): Float32Array {
  const values = new Float32Array(2048)
  values[index] = 1
  return values
}
