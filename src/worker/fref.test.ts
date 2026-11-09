import { existsSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  drainAnalysis,
  pendingAnalysisPaths,
  readProbeVersion,
  storeAnalysis,
} from '../main/analysis'
import {
  listAnalysisCandidates,
  listFiles,
  openLibrary,
} from '../main/database'
import { importWavFolder } from '../main/import-wavs'
import { readAnalyseMessage } from '../shared/ipc'
import { dispatchWorkerMessage } from './index'
import {
  cosineSimilarity,
  readNpzEmbeddings,
  readStoredEmbeddings,
  readTop5,
} from './reference-fixtures'

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
const top5Path = fileURLToPath(
  new URL('../../fixtures/F-ref/top5.json', import.meta.url),
)
const embeddingsPath = fileURLToPath(
  new URL('../../fixtures/F-ref/embeddings.npz', import.meta.url),
)

describe('F-ref match', () => {
  it('stores F-short suggestions and embeddings that match the reference', {
    timeout: 1_200_000,
  }, async (context) => {
    if (!existsSync(modelPath)) {
      context.skip('models/Cnn14_mAP=0.431.onnx is absent')
    }

    const reference = readTop5(top5Path)
    const referenceEmbeddings = readNpzEmbeddings(embeddingsPath)
    const referenceNames = Object.keys(reference).sort()
    expect([...referenceEmbeddings.keys()].sort()).toEqual(referenceNames)

    const folder = mkdtempSync(join(tmpdir(), 'sonoarchive-fref-'))
    const db = openLibrary(join(folder, 'library.db'))
    try {
      const imported = await importWavFolder(db, fShortDir)
      expect(imported.failed).toEqual([])
      expect(
        listFiles(db)
          .map((file) => file.name)
          .sort(),
      ).toEqual(referenceNames)

      const pending = pendingAnalysisPaths(
        listAnalysisCandidates(db),
        readProbeVersion(probePath),
      )
      expect(pending.map((file) => file.name).sort()).toEqual(referenceNames)

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
          if (!storeAnalysis(db, file.path, result)) {
            throw new Error(`${file.name}: ${result.message}`)
          }
        },
      )

      const stored = listFiles(db)
      const storedEmbeddings = readStoredEmbeddings(db)
      const misses: string[] = []
      let lowestCosine = 1
      for (const name of referenceNames) {
        const file = stored.find((entry) => entry.name === name)
        const expected = reference[name]
        const embedding = storedEmbeddings.get(name)
        if (!file || !expected || !embedding) {
          misses.push(`${name} has no stored row`)
          continue
        }
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
        lowestCosine = Math.min(lowestCosine, similarity)
        if (similarity < COSINE_MIN) {
          misses.push(`${name} cosine ${similarity}`)
        }
      }
      console.log(`lowest cosine ${lowestCosine}`)
      expect(misses).toEqual([])
    } finally {
      db.close()
    }
  })
})
