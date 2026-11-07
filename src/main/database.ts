import { mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname } from 'node:path'
import type Database from 'better-sqlite3'
import type * as SqliteVec from 'sqlite-vec'
import type { LibraryFile, Suggestion } from '../shared/ipc'
import { readUcs, type UcsRow } from './ucs'

const sqliteRequire = createRequire(import.meta.url)

export type LibraryDatabase = Database.Database

export type StoredFile = {
  path: string
  name: string
  format: 'wav'
  duration: number
  status: 'untagged'
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
         suggestions.score AS score
       FROM files
       LEFT JOIN suggestions ON suggestions.path = files.path
       ORDER BY files.name COLLATE NOCASE, files.path, suggestions.rank`,
    )
    .all() as ListedRow[]
  const listed: LibraryFile[] = []
  const indexByPath = new Map<string, LibraryFile>()
  for (const row of rows) {
    if (row.format !== 'wav' || row.status !== 'untagged') {
      throw new Error(
        `Stored file ${row.name} has format ${row.format} and status ${row.status}`,
      )
    }
    let file = indexByPath.get(row.path)
    if (!file) {
      file = {
        name: row.name,
        format: row.format,
        duration: row.duration,
        status: row.status,
        catId: null,
        suggestions: [],
      }
      indexByPath.set(row.path, file)
      listed.push(file)
    }
    if (row.rank == null) continue
    if (row.catId == null || row.score == null) {
      throw new Error(`Stored file ${row.name} has an incomplete suggestion`)
    }
    file.suggestions.push({ catId: row.catId, score: row.score })
    if (row.rank === 1) file.catId = row.catId
  }
  for (const file of listed) {
    const count = file.suggestions.length
    if (count === 0) continue
    if (
      count !== SUGGESTION_COUNT ||
      file.catId === null ||
      file.suggestions[0]?.catId !== file.catId
    ) {
      throw new Error(`Stored file ${file.name} has ${count} suggestions`)
    }
  }
  return listed
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
  if (row.format !== 'wav' || row.status !== 'untagged') {
    throw new Error(
      `Stored file ${row.name} has format ${row.format} and status ${row.status}`,
    )
  }
  return row
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
