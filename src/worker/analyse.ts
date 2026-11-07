import { existsSync } from 'node:fs'
import * as ort from 'onnxruntime-node'
import { DecodeError } from '../main/decode'
import type { ProbeVectors } from '../main/probe'
import { scoreEmbedding } from '../main/probe'
import type { AnalysisPayload } from '../shared/ipc'
import { readProbeFile } from './probe-file'
import { decodeWavWaveform, WAVEFORM_RATE } from './waveform'

const EMBEDDING_DIM = 2048

export const onnxRuntime = ort

ort.env.logLevel = 'error'

type AnalyseInput = {
  filePath: string
  modelPath: string
  probePath: string
}

let cachedModelPath: string | undefined
let cachedSession: Promise<ort.InferenceSession> | undefined
let cachedProbePath: string | undefined
let cachedProbe: ProbeVectors | undefined

export async function analyseShortWav(
  input: AnalyseInput,
): Promise<AnalysisPayload> {
  if (!existsSync(input.modelPath)) {
    return { ok: false, message: 'CNN14 model is missing.' }
  }
  if (!existsSync(input.probePath)) {
    return { ok: false, message: 'Probe file is missing.' }
  }
  let waveform: Float32Array | undefined
  try {
    waveform = await decodeWavWaveform(input.filePath)
    const embedding = await embedWaveform(input.modelPath, waveform)
    const scored = scoreEmbedding(embedding, probeFor(input.probePath))
    if (
      scored.suggestions.length !== 5 ||
      scored.suggestions.some(
        (suggestion) =>
          suggestion.catId.length === 0 || !Number.isFinite(suggestion.score),
      )
    ) {
      return { ok: false, message: 'Analysis failed.' }
    }
    return {
      ok: true,
      embedding,
      probeVersion: scored.version,
      suggestions: scored.suggestions,
    }
  } catch (error) {
    if (error instanceof DecodeError) {
      return { ok: false, message: 'Could not decode the file.' }
    }
    console.error(error)
    return { ok: false, message: 'Analysis failed.' }
  } finally {
    waveform?.fill(0)
  }
}

async function embedWaveform(
  modelPath: string,
  waveform: Float32Array,
): Promise<Float32Array> {
  const session = await sessionFor(modelPath)
  const samples = padToOneSecond(waveform)
  const tensor = new ort.Tensor('float32', samples, [1, samples.length])
  try {
    const results = await session.run({ waveform: tensor })
    const output = results.embedding
    const embedded = output?.type === 'float32' ? output.data : undefined
    if (
      !(embedded instanceof Float32Array) ||
      embedded.length !== EMBEDDING_DIM
    ) {
      throw new Error('CNN14 returned an unexpected embedding')
    }
    return new Float32Array(embedded)
  } finally {
    tensor.dispose()
    if (samples !== waveform) samples.fill(0)
  }
}

// Traced on one second of zeros. Shorter buffers disagree with PyTorch until
// they are padded with silence to that length.
function padToOneSecond(waveform: Float32Array): Float32Array {
  if (waveform.length >= WAVEFORM_RATE) return waveform
  const padded = new Float32Array(WAVEFORM_RATE)
  padded.set(waveform)
  return padded
}

async function sessionFor(modelPath: string): Promise<ort.InferenceSession> {
  if (cachedSession && cachedModelPath === modelPath) return cachedSession
  cachedModelPath = modelPath
  const session = ort.InferenceSession.create(modelPath, {
    executionProviders: ['cpu'],
  })
  cachedSession = session
  try {
    return await session
  } catch (error) {
    cachedSession = undefined
    cachedModelPath = undefined
    throw error
  }
}

function probeFor(probePath: string): ProbeVectors {
  if (cachedProbe && cachedProbePath === probePath) return cachedProbe
  const probe = readProbeFile(probePath)
  cachedProbe = probe
  cachedProbePath = probePath
  return probe
}
