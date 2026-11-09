import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  drainAnalysis,
  pendingAnalysisPaths,
  queueAnalysisBatch,
  readProbeVersion,
  settleAnalysis,
  storeAnalysis,
} from '../main/analysis'
import {
  listAnalysisCandidates,
  listFiles,
  openLibrary,
  readStoredFile,
} from '../main/database'
import { importWavFolder } from '../main/import-wavs'
import { saveTaggedWav } from '../main/save-label'
import { formatAnalysisProgress } from '../renderer/library'
import type { AnalysisProgress, Suggestion } from '../shared/ipc'
import { readAnalyseMessage } from '../shared/ipc'
import { dispatchWorkerMessage } from './index'
import {
  cosineSimilarity,
  readNpzEmbeddings,
  readStoredEmbeddings,
  readTop5,
} from './reference-fixtures'
import { decodeWavWaveform, sliceCompleteWindows } from './waveform'

const SCORE_TOLERANCE = 0.001
const COSINE_MIN = 0.999

const modelPath = fileURLToPath(
  new URL('../../models/Cnn14_mAP=0.431.onnx', import.meta.url),
)
const probePath = fileURLToPath(
  new URL('../../models/probe.json', import.meta.url),
)
const fShortDir = fileURLToPath(
  new URL('../../fixtures/F-short', import.meta.url),
)
const fLongDir = fileURLToPath(
  new URL('../../fixtures/F-long', import.meta.url),
)
const top5Path = fileURLToPath(
  new URL('../../fixtures/F-long/top5.json', import.meta.url),
)
const embeddingsPath = fileURLToPath(
  new URL('../../fixtures/F-long/embeddings.npz', import.meta.url),
)
const ucsPath = fileURLToPath(
  new URL('../../fixtures/UCS v8.2.1 Full List.xlsx', import.meta.url),
)

const suggestions: Suggestion[] = [
  { catId: 'AIRBlow', score: 0.5 },
  { catId: 'AIRBrst', score: 0.25 },
  { catId: 'AIRHiss', score: 0.125 },
  { catId: 'AIRMisc', score: 0.0625 },
  { catId: 'AIRSuck', score: 0.03125 },
]

describe('F-long match', () => {
  it('imports F-long with F-short, matches the reference, and counts to M / M', {
    timeout: 1_200_000,
  }, async (context) => {
    if (!existsSync(modelPath)) {
      context.skip('models/Cnn14_mAP=0.431.onnx is absent')
    }

    const reference = readTop5(top5Path)
    const referenceEmbeddings = readNpzEmbeddings(embeddingsPath)
    const longNames = Object.keys(reference).sort()
    expect(longNames).toEqual(['365091.wav', '41183.wav'])
    expect([...referenceEmbeddings.keys()].sort()).toEqual(longNames)

    for (const name of longNames) {
      const waveform = await decodeWavWaveform(join(fLongDir, name))
      expect(sliceCompleteWindows(waveform)).toHaveLength(5)
      waveform.fill(0)
    }

    const folder = mkdtempSync(join(tmpdir(), 'sonoarchive-flong-'))
    copyWavs(fShortDir, folder)
    copyWavs(fLongDir, folder)
    const db = openLibrary(join(folder, 'library.db'))
    try {
      const imported = await importWavFolder(db, folder)
      expect(imported.failed).toEqual([])
      const names = listFiles(db)
        .map((file) => file.name)
        .sort()
      expect(names).toEqual(
        [...readdirSync(fShortDir), ...longNames]
          .filter((name) => name.toLowerCase().endsWith('.wav'))
          .sort(),
      )

      const probeVersion = readProbeVersion(probePath)
      const pending = pendingAnalysisPaths(
        listAnalysisCandidates(db),
        probeVersion,
      )
      expect(pending).toHaveLength(names.length)

      let progress: AnalysisProgress = queueAnalysisBatch(
        { done: 0, total: 0 },
        pending.length,
      )
      const counts = [formatAnalysisProgress(progress)]
      let id = 0
      await drainAnalysis(
        pending,
        async (file) => {
          id += 1
          const response = await dispatchWorkerMessage({
            type: 'analyse',
            id,
            filePath: file.path,
            modelPath,
            probePath,
          })
          const parsed = readAnalyseMessage(response)
          if (!parsed || parsed.filePath !== file.path) {
            return { ok: false, message: 'Analysis failed.' }
          }
          return parsed.result
        },
        (file, result) => {
          progress = settleAnalysis(progress)
          counts.push(formatAnalysisProgress(progress))
          if (!storeAnalysis(db, file.path, result)) {
            throw new Error(`${file.name}: ${result.message}`)
          }
        },
      )

      expect(counts.at(-1)).toBe(
        `${pending.length} / ${pending.length} analysed`,
      )
      expect(counts).toContain(`1 / ${pending.length} analysed`)
      expect(new Set(counts).size).toBe(pending.length + 1)

      const stored = listFiles(db)
      const storedEmbeddings = readStoredEmbeddings(db)
      const misses: string[] = []
      for (const name of longNames) {
        const file = stored.find((entry) => entry.name === name)
        const expected = reference[name]
        const embedding = storedEmbeddings.get(name)
        if (!file || !expected || !embedding) {
          misses.push(`${name} has no stored row`)
          continue
        }
        expect(file.suggestions).toHaveLength(5)
        const catIds = file.suggestions.map((suggestion) => suggestion.catId)
        const expectedIds = expected.top5.map((row) => row.CatID)
        if (catIds.join('\0') !== expectedIds.join('\0')) {
          misses.push(
            `${name} CatIDs ${catIds.join(', ')} != ${expectedIds.join(', ')}`,
          )
        }
        expected.top5.forEach((row, index) => {
          const score = file.suggestions[index]?.score
          if (score === undefined) return
          const gap = Math.abs(score - row.score)
          if (gap > SCORE_TOLERANCE) {
            misses.push(`${name} rank ${index + 1} score differs by ${gap}`)
          }
        })
        const similarity = cosineSimilarity(
          embedding,
          referenceEmbeddings.get(name),
        )
        if (similarity < COSINE_MIN) {
          misses.push(`${name} cosine ${similarity}`)
        }
      }
      expect(misses).toEqual([])
    } finally {
      db.close()
    }
  })

  it('resumes only files that still have no suggestions for the current probe', async () => {
    const folder = mkdtempSync(join(tmpdir(), 'sonoarchive-resume-'))
    const done = join(folder, 'done.wav')
    const waiting = join(folder, 'waiting.wav')
    writePcmWav(done, 1)
    writePcmWav(waiting, 11)
    const db = openLibrary(join(folder, 'library.db'))
    await importWavFolder(db, folder)
    const donePath = resolve(done)
    storeAnalysis(db, donePath, {
      ok: true,
      embedding: new Float32Array(2048),
      probeVersion: 'probe-a',
      suggestions,
    })

    const analysed: string[] = []
    const pending = pendingAnalysisPaths(listAnalysisCandidates(db), 'probe-a')
    expect(pending.map((file) => file.name)).toEqual(['waiting.wav'])
    await drainAnalysis(
      pending,
      async (file) => {
        analysed.push(file.path)
        return {
          ok: true,
          embedding: new Float32Array(2048),
          probeVersion: 'probe-a',
          suggestions,
        }
      },
      (file, result) => {
        storeAnalysis(db, file.path, result)
      },
    )

    expect(analysed).toEqual([resolve(waiting)])
    expect(pendingAnalysisPaths(listAnalysisCandidates(db), 'probe-a')).toEqual(
      [],
    )
    db.close()
  })

  it('saves a label for a finished file while another file is still queued', async () => {
    const folder = mkdtempSync(join(tmpdir(), 'sonoarchive-tag-queue-'))
    const done = join(folder, 'done.wav')
    const waiting = join(folder, 'waiting.wav')
    writePcmWav(done, 1)
    writePcmWav(waiting, 11)
    const db = openLibrary(join(folder, 'library.db'), ucsPath)
    await importWavFolder(db, folder)
    const donePath = resolve(done)
    storeAnalysis(db, donePath, {
      ok: true,
      embedding: new Float32Array(2048),
      probeVersion: 'probe-a',
      suggestions,
    })

    let release: () => void = () => {}
    const gate = new Promise<void>((resolveGate) => {
      release = resolveGate
    })
    let waitingStarted = false
    const pending = pendingAnalysisPaths(listAnalysisCandidates(db), 'probe-a')
    expect(pending.map((file) => file.name)).toEqual(['waiting.wav'])
    const drained = drainAnalysis(
      pending,
      async () => {
        waitingStarted = true
        await gate
        return { ok: false, message: 'Analysis failed.' }
      },
      () => {},
    )

    expect(waitingStarted).toBe(true)
    saveTaggedWav(db, {
      path: donePath,
      catId: 'AIRBlow',
      fxName: 'Gust',
      creatorId: 'Ada',
      sourceId: 'Field',
      rank: '1',
    })
    expect(readStoredFile(db, donePath)?.status).toBe('tagged')
    expect(waitingStarted).toBe(true)
    release()
    await drained
    db.close()
  })
})

function copyWavs(from: string, to: string): void {
  for (const name of readdirSync(from)) {
    if (!name.toLowerCase().endsWith('.wav')) continue
    copyFileSync(join(from, name), join(to, name))
  }
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
