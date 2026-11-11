import { mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname } from 'node:path'
import type Database from 'better-sqlite3'
import type * as SqliteVec from 'sqlite-vec'
import {
  isLabelRank,
  type LibraryFile,
  type LibraryLabel,
  type SaveLabelInput,
  type SearchHit,
  type Suggestion,
  type UcsEntry,
} from '../shared/ipc'
import { readUcs, type UcsRow } from './ucs'

const sqliteRequire = createRequire(import.meta.url)

export type LibraryDatabase = Database.Database

export type StoredFile = {
  path: string
  name: string
  format: 'wav'
  duration: number
  status: 'untagged' | 'tagged'
  modifiedTime: number
}

const EMBEDDING_DIM = 2048
const SUGGESTION_COUNT = 5

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS files (
    path TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    format TEXT NOT NULL,
    duration REAL NOT NULL,
    status TEXT NOT NULL,
    modified_time INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS ucs (
    CatID TEXT PRIMARY KEY,
    Category TEXT NOT NULL,
    SubCategory TEXT NOT NULL,
    explanation TEXT NOT NULL,
    synonyms TEXT NOT NULL
  );
  CREATE VIRTUAL TABLE IF NOT EXISTS embeddings USING vec0(
    embedding float[${EMBEDDING_DIM}]
  );
  CREATE TABLE IF NOT EXISTS suggestions (
    path TEXT NOT NULL,
    rank INTEGER NOT NULL CHECK (rank BETWEEN 1 AND ${SUGGESTION_COUNT}),
    CatID TEXT NOT NULL,
    score REAL NOT NULL,
    probe_version TEXT NOT NULL,
    PRIMARY KEY (path, rank)
  );
  CREATE TABLE IF NOT EXISTS labels (
    path TEXT PRIMARY KEY,
    CatID TEXT NOT NULL,
    FXName TEXT NOT NULL CHECK (length(FXName) > 0),
    CreatorID TEXT NOT NULL,
    SourceID TEXT NOT NULL,
    rank TEXT NOT NULL CHECK (rank IN ('1', '2', '3', '4', '5', 'manual')),
    saved_at TEXT NOT NULL CHECK (length(saved_at) > 0)
  );
`

export function openLibrary(
  dbPath: string,
  ucsWorkbook?: string,
): LibraryDatabase {
  mkdirSync(dirname(dbPath), { recursive: true })
  const db = openDriver(dbPath)
  try {
    db.exec(SCHEMA)
    if (ucsWorkbook) loadUcsIfEmpty(db, ucsWorkbook)
    return db
  } catch (error) {
    db.close()
    throw error
  }
}

function loadUcsIfEmpty(db: LibraryDatabase, workbook: string): number {
  const existing = countRows(db, 'SELECT COUNT(*) AS count FROM ucs')
  if (existing > 0) return existing
  const records = readUcs(workbook)
  const insert = db.prepare(
    `INSERT INTO ucs (CatID, Category, SubCategory, explanation, synonyms)
     VALUES (@CatID, @Category, @SubCategory, @explanation, @synonyms)`,
  )
  const write = db.transaction((rows: UcsRow[]) => {
    for (const row of rows) insert.run(row)
  })
  write(records)
  return records.length
}

export function upsertWav(db: LibraryDatabase, file: StoredFile): void {
  db.prepare(
    `INSERT INTO files (path, name, format, duration, status, modified_time)
     VALUES (@path, @name, @format, @duration, @status, @modifiedTime)
     ON CONFLICT(path) DO UPDATE SET
       duration = excluded.duration,
       modified_time = excluded.modified_time`,
  ).run(file)
}

export function replaceSuggestions(
  db: LibraryDatabase,
  filePath: string,
  embedding: Float32Array,
  suggestions: readonly Suggestion[],
  probeVersion: string,
): void {
  const bytes = embeddingBytes(embedding)
  assertSuggestions(suggestions, probeVersion)
  const findFile = db.prepare('SELECT rowid FROM files WHERE path = ?')
  const deleteSuggestions = db.prepare('DELETE FROM suggestions WHERE path = ?')
  const deleteEmbedding = db.prepare(
    `DELETE FROM embeddings
     WHERE rowid = (SELECT rowid FROM files WHERE path = ?)`,
  )
  const insertEmbedding = db.prepare(
    `INSERT INTO embeddings(rowid, embedding)
     SELECT rowid, ? FROM files WHERE path = ?`,
  )
  const insertSuggestion = db.prepare(
    `INSERT INTO suggestions (path, rank, CatID, score, probe_version)
     VALUES (?, ?, ?, ?, ?)`,
  )
  const write = db.transaction(() => {
    if (!findFile.get(filePath)) {
      throw new Error(`No stored file for ${filePath}`)
    }
    deleteSuggestions.run(filePath)
    deleteEmbedding.run(filePath)
    const inserted = insertEmbedding.run(bytes, filePath)
    if (inserted.changes !== 1) {
      throw new Error(`Could not store an embedding for ${filePath}`)
    }
    suggestions.forEach((suggestion, index) => {
      insertSuggestion.run(
        filePath,
        index + 1,
        suggestion.catId,
        suggestion.score,
        probeVersion,
      )
    })
  })
  write()
}

export function clearSuggestions(db: LibraryDatabase, filePath: string): void {
  const findFile = db.prepare('SELECT rowid FROM files WHERE path = ?')
  const deleteSuggestions = db.prepare('DELETE FROM suggestions WHERE path = ?')
  const deleteEmbedding = db.prepare(
    `DELETE FROM embeddings
     WHERE rowid = (SELECT rowid FROM files WHERE path = ?)`,
  )
  const clear = db.transaction(() => {
    if (!findFile.get(filePath)) {
      throw new Error(`No stored file for ${filePath}`)
    }
    deleteSuggestions.run(filePath)
    deleteEmbedding.run(filePath)
  })
  clear()
}

type ListedRow = {
  path: string
  name: string
  format: string
  duration: number
  status: string
  rank: number | null
  catId: string | null
  score: number | null
  labelCatId: string | null
  fxName: string | null
  creatorId: string | null
  sourceId: string | null
  labelRank: string | null
}

export type AnalysisCandidate = {
  path: string
  name: string
  duration: number
  probeVersion: string | null
}

export function listAnalysisCandidates(
  db: LibraryDatabase,
): AnalysisCandidate[] {
  const rows = db
    .prepare(
      `SELECT
         files.path AS path,
         files.name AS name,
         files.duration AS duration,
         (
           SELECT suggestions.probe_version
           FROM suggestions
           WHERE suggestions.path = files.path AND suggestions.rank = 1
         ) AS probeVersion
       FROM files
       ORDER BY files.name COLLATE NOCASE, files.path`,
    )
    .all() as AnalysisCandidate[]
  return rows.map((row) => ({
    path: row.path,
    name: row.name,
    duration: row.duration,
    probeVersion: row.probeVersion ?? null,
  }))
}

export function listFiles(db: LibraryDatabase): LibraryFile[] {
  const rows = db
    .prepare(
      `SELECT
         files.path AS path,
         files.name AS name,
         files.format AS format,
         files.duration AS duration,
         files.status AS status,
         suggestions.rank AS rank,
         suggestions.CatID AS catId,
         suggestions.score AS score,
         labels.CatID AS labelCatId,
         labels.FXName AS fxName,
         labels.CreatorID AS creatorId,
         labels.SourceID AS sourceId,
         labels.rank AS labelRank
       FROM files
       LEFT JOIN suggestions ON suggestions.path = files.path
       LEFT JOIN labels ON labels.path = files.path
       ORDER BY files.name COLLATE NOCASE, files.path, suggestions.rank`,
    )
    .all() as ListedRow[]
  const listed: LibraryFile[] = []
  const indexByPath = new Map<string, LibraryFile>()
  for (const row of rows) {
    if (row.format !== 'wav' || !isFileStatus(row.status)) {
      throw new Error(
        `Stored file ${row.name} has format ${row.format} and status ${row.status}`,
      )
    }
    let file = indexByPath.get(row.path)
    if (!file) {
      const label = labelFromRow(row)
      if (row.status === 'tagged' && !label) {
        throw new Error(`Stored file ${row.name} is tagged without a label`)
      }
      if (row.status === 'untagged' && label) {
        throw new Error(`Stored file ${row.name} is untagged and has a label`)
      }
      file = {
        path: row.path,
        name: row.name,
        format: 'wav',
        duration: row.duration,
        status: row.status,
        catId: label?.catId ?? null,
        suggestions: [],
        label,
      }
      indexByPath.set(row.path, file)
      listed.push(file)
    }
    if (row.rank == null) continue
    if (row.catId == null || row.score == null) {
      throw new Error(`Stored file ${row.name} has an incomplete suggestion`)
    }
    file.suggestions.push({ catId: row.catId, score: row.score })
    if (row.rank === 1 && file.status === 'untagged') file.catId = row.catId
  }
  for (const file of listed) {
    const count = file.suggestions.length
    if (count !== 0 && count !== SUGGESTION_COUNT) {
      throw new Error(`Stored file ${file.name} has ${count} suggestions`)
    }
    if (file.status === 'untagged') {
      if (count === 0) {
        if (file.catId !== null) {
          throw new Error(`Stored file ${file.name} has ${count} suggestions`)
        }
        continue
      }
      if (file.catId === null || file.suggestions[0]?.catId !== file.catId) {
        throw new Error(`Stored file ${file.name} has ${count} suggestions`)
      }
      continue
    }
    if (!file.label || file.catId !== file.label.catId) {
      throw new Error(`Stored file ${file.name} is tagged without a label`)
    }
  }
  return listed
}

export function assertSavableLabel(
  db: LibraryDatabase,
  input: SaveLabelInput,
): { fxName: string; creatorId: string; sourceId: string } {
  const fxName = input.fxName.trim()
  const creatorId = input.creatorId.trim()
  const sourceId = input.sourceId.trim()
  if (!isLabelRank(input.rank)) {
    throw new Error('Rank is not a suggestion or manual')
  }
  if (fxName.length === 0) {
    throw new Error('FXName is empty')
  }
  if (!db.prepare('SELECT path FROM files WHERE path = ?').get(input.path)) {
    throw new Error(`No stored file for ${input.path}`)
  }
  if (!db.prepare('SELECT CatID FROM ucs WHERE CatID = ?').get(input.catId)) {
    throw new Error(`Unknown CatID ${input.catId}`)
  }
  if (input.rank !== 'manual') {
    const suggestion = db
      .prepare(
        'SELECT CatID AS catId FROM suggestions WHERE path = ? AND rank = ?',
      )
      .get(input.path, Number(input.rank)) as { catId: string } | undefined
    if (!suggestion || suggestion.catId !== input.catId) {
      throw new Error(`Rank ${input.rank} does not match ${input.catId}`)
    }
  }
  return { fxName, creatorId, sourceId }
}

export function saveLabel(db: LibraryDatabase, input: SaveLabelInput): void {
  const upsert = db.prepare(
    `INSERT INTO labels (path, CatID, FXName, CreatorID, SourceID, rank, saved_at)
     VALUES (@path, @catId, @fxName, @creatorId, @sourceId, @rank, @savedAt)
     ON CONFLICT(path) DO UPDATE SET
       CatID = excluded.CatID,
       FXName = excluded.FXName,
       CreatorID = excluded.CreatorID,
       SourceID = excluded.SourceID,
       rank = excluded.rank,
       saved_at = excluded.saved_at`,
  )
  const markTagged = db.prepare(
    `UPDATE files SET status = 'tagged' WHERE path = ?`,
  )
  const savedAt = new Date().toISOString()
  const write = db.transaction(() => {
    const prepared = assertSavableLabel(db, input)
    upsert.run({
      path: input.path,
      catId: input.catId,
      fxName: prepared.fxName,
      creatorId: prepared.creatorId,
      sourceId: prepared.sourceId,
      rank: input.rank,
      savedAt,
    })
    if (markTagged.run(input.path).changes !== 1) {
      throw new Error(`No stored file for ${input.path}`)
    }
  })
  write()
}

export function listUcs(db: LibraryDatabase): UcsEntry[] {
  return db
    .prepare(
      `SELECT CatID AS catId, Category AS category, SubCategory AS subCategory
       FROM ucs
       ORDER BY CatID`,
    )
    .all() as UcsEntry[]
}

export function hasStoredFile(db: LibraryDatabase, filePath: string): boolean {
  return (
    db
      .prepare('SELECT 1 AS present FROM files WHERE path = ?')
      .get(filePath) !== undefined
  )
}

function embeddingBytes(embedding: Float32Array): Buffer {
  if (
    !(embedding instanceof Float32Array) ||
    embedding.length !== EMBEDDING_DIM
  ) {
    throw new Error(`Expected a 2048-d embedding, received ${embedding.length}`)
  }
  return Buffer.from(
    embedding.buffer,
    embedding.byteOffset,
    embedding.byteLength,
  )
}

function assertSuggestions(
  suggestions: readonly Suggestion[],
  probeVersion: string,
): void {
  if (suggestions.length !== SUGGESTION_COUNT) {
    throw new Error(`Expected five suggestions, received ${suggestions.length}`)
  }
  if (probeVersion.length === 0) {
    throw new Error('Probe version is empty')
  }
  for (const suggestion of suggestions) {
    if (suggestion.catId.length === 0) {
      throw new Error('Suggestion CatID is empty')
    }
    if (!Number.isFinite(suggestion.score)) {
      throw new Error('Suggestion score is not finite')
    }
  }
}

export function readStoredFile(
  db: LibraryDatabase,
  filePath: string,
): StoredFile | undefined {
  const row = db
    .prepare(
      `SELECT path, name, format, duration, status, modified_time AS modifiedTime
       FROM files
       WHERE path = ?`,
    )
    .get(filePath) as StoredFile | undefined
  if (!row) return undefined
  if (row.format !== 'wav' || !isFileStatus(row.status)) {
    throw new Error(
      `Stored file ${row.name} has format ${row.format} and status ${row.status}`,
    )
  }
  return row
}

function isFileStatus(status: string): status is 'untagged' | 'tagged' {
  return status === 'untagged' || status === 'tagged'
}

function labelFromRow(row: ListedRow): LibraryLabel | null {
  const fields = [
    row.labelCatId,
    row.fxName,
    row.creatorId,
    row.sourceId,
    row.labelRank,
  ]
  if (fields.every((value) => value == null)) return null
  if (
    row.labelCatId == null ||
    row.fxName == null ||
    row.creatorId == null ||
    row.sourceId == null ||
    row.labelRank == null ||
    !isLabelRank(row.labelRank) ||
    row.fxName.length === 0
  ) {
    throw new Error(`Stored file ${row.name} has an incomplete label`)
  }
  return {
    catId: row.labelCatId,
    fxName: row.fxName,
    creatorId: row.creatorId,
    sourceId: row.sourceId,
    rank: row.labelRank,
  }
}

export function searchText(db: LibraryDatabase, query: string): SearchHit[] {
  const trimmed = query.trim()
  if (trimmed.length === 0) return []
  const pattern = likeContains(trimmed)
  const rows = db
    .prepare(
      `SELECT
         files.path AS path,
         files.name AS name,
         COALESCE(labels.CatID, suggestions.CatID, '') AS catId,
         COALESCE(labels.FXName, '') AS fxName
       FROM files
       LEFT JOIN labels ON labels.path = files.path
       LEFT JOIN suggestions
         ON suggestions.path = files.path AND suggestions.rank = 1
       LEFT JOIN ucs AS label_ucs ON label_ucs.CatID = labels.CatID
       LEFT JOIN ucs AS suggestion_ucs ON suggestion_ucs.CatID = suggestions.CatID
       WHERE files.name LIKE ? ESCAPE '\\'
          OR (
            labels.path IS NOT NULL
            AND (
              labels.CatID LIKE ? ESCAPE '\\'
              OR label_ucs.Category LIKE ? ESCAPE '\\'
              OR label_ucs.SubCategory LIKE ? ESCAPE '\\'
              OR labels.FXName LIKE ? ESCAPE '\\'
            )
          )
          OR (
            labels.path IS NULL
            AND suggestions.CatID IS NOT NULL
            AND (
              suggestions.CatID LIKE ? ESCAPE '\\'
              OR suggestion_ucs.Category LIKE ? ESCAPE '\\'
              OR suggestion_ucs.SubCategory LIKE ? ESCAPE '\\'
            )
          )
       ORDER BY
         CASE WHEN files.name LIKE ? ESCAPE '\\' THEN 0 ELSE 1 END,
         files.name COLLATE NOCASE,
         files.path`,
    )
    .all(
      pattern,
      pattern,
      pattern,
      pattern,
      pattern,
      pattern,
      pattern,
      pattern,
      pattern,
    ) as Array<{
    path: string
    name: string
    catId: string
    fxName: string
  }>
  return rows.map((row) => ({ ...row, similarity: null }))
}

export function findSimilar(
  db: LibraryDatabase,
  filePath: string,
): SearchHit[] {
  const stored = db
    .prepare(
      `SELECT embeddings.embedding AS embedding
       FROM files
       JOIN embeddings ON embeddings.rowid = files.rowid
       WHERE files.path = ?`,
    )
    .get(filePath) as { embedding: Buffer | Uint8Array } | undefined
  if (!stored) {
    if (!hasStoredFile(db, filePath)) {
      throw new Error(`No stored file for ${filePath}`)
    }
    throw new Error(`No stored embedding for ${filePath}`)
  }
  const embedding = Buffer.isBuffer(stored.embedding)
    ? stored.embedding
    : Buffer.from(stored.embedding)
  const rows = db
    .prepare(
      `SELECT
         files.path AS path,
         files.name AS name,
         COALESCE(labels.CatID, suggestions.CatID, '') AS catId,
         COALESCE(labels.FXName, '') AS fxName,
         vec_distance_cosine(embeddings.embedding, ?) AS distance
       FROM embeddings
       JOIN files ON files.rowid = embeddings.rowid
       LEFT JOIN labels ON labels.path = files.path
       LEFT JOIN suggestions
         ON suggestions.path = files.path AND suggestions.rank = 1
       WHERE files.path != ?
       ORDER BY distance ASC, files.name ASC`,
    )
    .all(embedding, filePath) as Array<{
    path: string
    name: string
    catId: string
    fxName: string
    distance: number
  }>
  return rows.map((row) => ({
    path: row.path,
    name: row.name,
    catId: row.catId,
    fxName: row.fxName,
    similarity: 1 - row.distance,
  }))
}

function likeContains(query: string): string {
  return `%${query.replace(/[\\%_]/g, (character) => `\\${character}`)}%`
}

export function resetLibrary(db: LibraryDatabase): void {
  const reset = db.transaction(() => {
    db.exec(`
      DELETE FROM suggestions;
      DELETE FROM labels;
      DELETE FROM embeddings;
      DELETE FROM files;
    `)
  })
  reset()
}

export function countFiles(db: LibraryDatabase): number {
  return countRows(db, 'SELECT COUNT(*) AS count FROM files')
}

export function countUcs(db: LibraryDatabase): number {
  return countRows(db, 'SELECT COUNT(*) AS count FROM ucs')
}

export function countDistinctCatIds(db: LibraryDatabase): number {
  return countRows(db, 'SELECT COUNT(DISTINCT CatID) AS count FROM ucs')
}

function countRows(db: LibraryDatabase, sql: string): number {
  const row = db.prepare(sql).get() as { count: number } | undefined
  return row?.count ?? 0
}

function openDriver(dbPath: string): LibraryDatabase {
  let db: LibraryDatabase | undefined
  try {
    const driver = sqliteRequire('better-sqlite3') as typeof Database
    db = new driver(dbPath)
    const sqliteVec = sqliteRequire('sqlite-vec') as typeof SqliteVec
    sqliteVec.load(db)
    return db
  } catch (error) {
    db?.close()
    const detail = error instanceof Error ? error.message : 'unknown error'
    throw new Error(`Could not load the database driver. ${detail}`)
  }
}
