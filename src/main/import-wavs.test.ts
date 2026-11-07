import { mkdtempSync, statSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Suggestion } from '../shared/ipc'
import {
  countFiles,
  listFiles,
  openLibrary,
  readStoredFile,
  replaceSuggestions,
} from './database'
import { importWavFolder } from './import-wavs'

describe('wav import', () => {
  it('stores one untagged wav and reads the same row after reopen', async () => {
    const folder = mkdtempSync(join(tmpdir(), 'sonoarchive-import-'))
    const dbPath = join(folder, 'library.db')
    const filePath = join(folder, 'tone.WAV')
    writePcmWav(filePath, 1)
    writeFileSync(join(folder, 'skip.mp3'), 'not audio')
    writeFileSync(join(folder, 'broken.wav'), 'not a wav')

    const db = openLibrary(dbPath)
    const imported = await importWavFolder(db, folder)
    const stored = readStoredFile(db, resolve(filePath))
    db.close()

    expect(imported.stored).toBe(1)
    expect(imported.failed).toEqual(['broken.wav'])
    expect(stored).toMatchObject({
      name: 'tone.WAV',
      format: 'wav',
      duration: 1,
      status: 'untagged',
    })

    const reopened = openLibrary(dbPath)
    expect(listFiles(reopened)).toEqual([
      {
        path: resolve(filePath),
        name: 'tone.WAV',
        format: 'wav',
        duration: stored?.duration,
        status: 'untagged',
        catId: null,
        suggestions: [],
        label: null,
      },
    ])
    reopened.close()
  })

  it('updates duration and modified time without adding a row', async () => {
    const folder = mkdtempSync(join(tmpdir(), 'sonoarchive-reimport-'))
    const filePath = join(folder, 'tone.wav')
    const db = openLibrary(join(folder, 'library.db'))
    writePcmWav(filePath, 1)
    utimesSync(
      filePath,
      new Date('2020-01-01T00:00:00Z'),
      new Date('2020-01-01T00:00:00Z'),
    )
    await importWavFolder(db, folder)
    const before = readStoredFile(db, resolve(filePath))

    writePcmWav(filePath, 2)
    utimesSync(
      filePath,
      new Date('2024-06-01T00:00:00Z'),
      new Date('2024-06-01T00:00:00Z'),
    )
    await importWavFolder(db, folder)
    const after = readStoredFile(db, resolve(filePath))

    expect(countFiles(db)).toBe(1)
    expect(after).toMatchObject({
      name: 'tone.wav',
      format: 'wav',
      duration: 2,
      status: 'untagged',
      modifiedTime: Math.trunc(statSync(filePath).mtimeMs),
    })
    expect(after?.modifiedTime).not.toBe(before?.modifiedTime)
    db.close()
  })

  it('clears suggestions when a path is imported longer than 10 seconds', async () => {
    const folder = mkdtempSync(join(tmpdir(), 'sonoarchive-long-'))
    const filePath = join(folder, 'tone.wav')
    const db = openLibrary(join(folder, 'library.db'))
    writePcmWav(filePath, 1)
    await importWavFolder(db, folder)
    replaceSuggestions(
      db,
      resolve(filePath),
      sampleEmbedding(),
      suggestions,
      'probe-a',
    )

    writePcmWav(filePath, 11)
    await importWavFolder(db, folder)

    expect(readStoredFile(db, resolve(filePath))).toMatchObject({
      name: 'tone.wav',
      status: 'untagged',
    })
    expect(readStoredFile(db, resolve(filePath))?.duration).toBeGreaterThan(10)
    expect(listFiles(db)).toEqual([
      {
        path: resolve(filePath),
        name: 'tone.wav',
        format: 'wav',
        duration: readStoredFile(db, resolve(filePath))?.duration,
        status: 'untagged',
        catId: null,
        suggestions: [],
        label: null,
      },
    ])
    expect(countEmbeddings(db)).toBe(0)
    expect(countSuggestions(db)).toBe(0)
    db.close()
  })
})

const suggestions: Suggestion[] = [
  { catId: 'AIRBlow', score: 0.5 },
  { catId: 'AIRBrst', score: 0.25 },
  { catId: 'AIRHiss', score: 0.125 },
  { catId: 'AIRMisc', score: 0.0625 },
  { catId: 'AIRSuck', score: 0.03125 },
]

function sampleEmbedding(): Float32Array {
  return new Float32Array(2048)
}

function countEmbeddings(db: ReturnType<typeof openLibrary>): number {
  const row = db.prepare('SELECT COUNT(*) AS count FROM embeddings').get() as {
    count: number
  }
  return row.count
}

function countSuggestions(db: ReturnType<typeof openLibrary>): number {
  const row = db.prepare('SELECT COUNT(*) AS count FROM suggestions').get() as {
    count: number
  }
  return row.count
}

function writePcmWav(filePath: string, seconds: number): void {
  const sampleRate = 8000
  const numSamples = sampleRate * seconds
  const dataSize = numSamples * 2
  const buffer = Buffer.alloc(44 + dataSize)
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + dataSize, 4)
  buffer.write('WAVE', 8)
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(sampleRate * 2, 28)
  buffer.writeUInt16LE(2, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(dataSize, 40)
  writeFileSync(filePath, buffer)
}
