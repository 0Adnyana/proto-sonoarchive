import { existsSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { countDistinctCatIds, countUcs, listUcs, openLibrary } from './database'

const workbook = fileURLToPath(
  new URL('../../fixtures/UCS v8.2.1 Full List.xlsx', import.meta.url),
)

describe('ucs catalog', () => {
  it.skipIf(!existsSync(workbook))(
    'loads 753 distinct CatIDs and keeps that count after reopen',
    () => {
      const folder = mkdtempSync(join(tmpdir(), 'sonoarchive-ucs-'))
      const dbPath = join(folder, 'library.db')
      const db = openLibrary(dbPath, workbook)
      expect(countUcs(db)).toBe(753)
      expect(countDistinctCatIds(db)).toBe(753)
      const entries = listUcs(db)
      expect(entries).toHaveLength(753)
      expect(entries.map((entry) => entry.catId)).toEqual(
        [...entries.map((entry) => entry.catId)].sort(),
      )
      expect(entries.find((entry) => entry.catId === 'AIRBlow')).toMatchObject({
        category: 'AIR',
      })
      const air = db
        .prepare('SELECT Category FROM ucs WHERE CatID = ?')
        .get('AIRBlow') as { Category: string }
      const mix = db
        .prepare('SELECT synonyms FROM ucs WHERE CatID = ?')
        .get('MIX') as { synonyms: string }
      const publicPlace = db
        .prepare('SELECT synonyms FROM ucs WHERE CatID = ?')
        .get('AMBPubl') as { synonyms: string }
      expect(air.Category).toBe('AIR')
      expect(mix.synonyms).toContain('M&E')
      expect(publicPlace.synonyms).toContain('Convenience')
      db.close()

      const reopened = openLibrary(dbPath, join(folder, 'missing.xlsx'))
      expect(countUcs(reopened)).toBe(753)
      expect(countDistinctCatIds(reopened)).toBe(753)
      reopened.close()
    },
  )
})
