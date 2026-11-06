import { mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname } from 'node:path'
import type Database from 'better-sqlite3'
import type { LibraryFile } from '../shared/ipc'
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

export function listFiles(db: LibraryDatabase): LibraryFile[] {
  const rows = db
    .prepare(
      `SELECT name, format, duration, status
       FROM files
       ORDER BY name COLLATE NOCASE`,
    )
    .all() as Array<{
    name: string
    format: string
    duration: number
    status: string
  }>
  return rows.map((row) => {
    if (row.format !== 'wav' || row.status !== 'untagged') {
      throw new Error(
        `Stored file ${row.name} has format ${row.format} and status ${row.status}`,
      )
    }
    return {
      name: row.name,
      format: row.format,
      duration: row.duration,
      status: row.status,
    }
  })
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
  try {
    const driver = sqliteRequire('better-sqlite3') as typeof Database
    return new driver(dbPath)
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'unknown error'
    throw new Error(`Could not load the database driver. ${detail}`)
  }
}
