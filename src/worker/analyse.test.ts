import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { readProbeVersion, storeAnalysis } from '../main/analysis'
import {
  listFiles,
  openLibrary,
  readStoredFile,
  upsertWav,
} from '../main/database'
import { analyseShortWav } from './analyse'

const modelPath = fileURLToPath(
  new URL('../../models/Cnn14_mAP=0.431.onnx', import.meta.url),
)
const probePath = fileURLToPath(
  new URL('../../models/probe.json', import.meta.url),
)

describe('short wav analysis', () => {
  it('returns an analysis error and writes no suggestions', async () => {
    const folder = mkdtempSync(join(tmpdir(), 'sonoarchive-analyse-'))
    const wav = join(folder, 'broken.wav')
    const model = join(folder, 'model.onnx')
    const probe = join(folder, 'probe.json')
    writeFileSync(wav, 'not a wav')
    writeFileSync(model, 'not a model')
    writeFileSync(probe, '{}')
    const db = openLibrary(join(folder, 'library.db'))
    upsertWav(db, {
      path: wav,
      name: 'broken.wav',
      format: 'wav',
      duration: 1,
      status: 'untagged',
      modifiedTime: 1,
    })

    const missingProbe = await analyseShortWav({
      filePath: wav,
      modelPath: model,
      probePath: join(folder, 'missing-probe.json'),
    })
    const failedDecode = await analyseShortWav({
      filePath: wav,
      modelPath: model,
      probePath: probe,
    })

    expect(missingProbe).toEqual({
      ok: false,
      message: 'Probe file is missing.',
    })
    expect(failedDecode).toEqual({
      ok: false,
      message: 'Could not decode the file.',
    })
    expect(failedDecode).not.toHaveProperty('waveform')
    expect(storeAnalysis(db, wav, failedDecode)).toBe(false)
    expect(listFiles(db)).toEqual([
      {
        name: 'broken.wav',
        format: 'wav',
        duration: 1,
        status: 'untagged',
        catId: null,
        suggestions: [],
      },
    ])
    expect(
      readFileSync(new URL('./analyse.ts', import.meta.url), 'utf8'),
    ).not.toContain('replaceSuggestions')
    db.close()
  })

  it('stores one 2048-d embedding and five suggestions for a short wav', {
    timeout: 180_000,
  }, async (context) => {
    if (!existsSync(modelPath)) {
      context.skip('models/Cnn14_mAP=0.431.onnx is absent')
    }

    const folder = mkdtempSync(join(tmpdir(), 'sonoarchive-cnn14-'))
    const wav = join(folder, 'tone.wav')
    writePcmWav(wav, 1)
    const db = openLibrary(join(folder, 'library.db'))
    upsertWav(db, {
      path: wav,
      name: 'tone.wav',
      format: 'wav',
      duration: 1,
      status: 'untagged',
      modifiedTime: 1,
    })

    const result = await analyseShortWav({
      filePath: wav,
      modelPath,
      probePath,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result).not.toHaveProperty('waveform')
    expect(result.embedding).toBeInstanceOf(Float32Array)
    expect(result.embedding.length).toBe(2048)
    expect(result.probeVersion).toBe(readProbeVersion(probePath))
    expect(result.suggestions).toHaveLength(5)
    expect(
      result.suggestions.every(
        (suggestion) =>
          suggestion.catId.length > 0 && Number.isFinite(suggestion.score),
      ),
    ).toBe(true)

    expect(storeAnalysis(db, wav, result)).toBe(true)
    const stored = readStoredFile(db, wav)
    expect(listFiles(db)).toEqual([
      {
        name: 'tone.wav',
        format: 'wav',
        duration: stored?.duration,
        status: 'untagged',
        catId: result.suggestions[0]?.catId,
        suggestions: result.suggestions,
      },
    ])
    const row = db
      .prepare(
        `SELECT embeddings.embedding AS embedding
           FROM files
           JOIN embeddings ON embeddings.rowid = files.rowid
           WHERE files.path = ?`,
      )
      .get(wav) as { embedding: Uint8Array }
    expect(row.embedding.byteLength).toBe(2048 * 4)
    db.close()
  })
})

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
