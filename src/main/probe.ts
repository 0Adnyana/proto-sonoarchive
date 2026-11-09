import type { Suggestion } from '../shared/ipc'

const TOP_N = 5

export type ProbeVectors = {
  version: string
  labels: readonly string[]
  weight: Float32Array
  bias: Float32Array
}

export type ProbeScore = {
  version: string
  suggestions: Suggestion[]
}

const EMBEDDING_DIM = 2048

export function scoreEmbedding(
  embedding: Float32Array,
  probe: ProbeVectors,
): ProbeScore {
  return rankScores(softmaxVector(embedding, probe), probe)
}

export function softmaxVector(
  embedding: Float32Array,
  probe: ProbeVectors,
): Float64Array {
  const labelCount = probe.labels.length
  const width = embedding.length
  if (labelCount < TOP_N) {
    throw new Error(`Probe has ${labelCount} labels; five are required`)
  }
  if (probe.bias.length !== labelCount) {
    throw new Error('Probe bias length does not match the label list')
  }
  if (probe.weight.length !== labelCount * width) {
    throw new Error('Probe weight length does not match labels and embedding')
  }
  if (probe.version.length === 0) {
    throw new Error('Probe version is empty')
  }

  const logits = new Float64Array(labelCount)
  let maxLogit = Number.NEGATIVE_INFINITY
  for (let label = 0; label < labelCount; label += 1) {
    let dot = 0
    const offset = label * width
    for (let i = 0; i < width; i += 1) {
      dot += (probe.weight[offset + i] ?? 0) * (embedding[i] ?? 0)
    }
    const logit = dot + (probe.bias[label] ?? 0)
    logits[label] = logit
    if (logit > maxLogit) maxLogit = logit
  }

  const scores = new Float64Array(labelCount)
  let sum = 0
  for (let label = 0; label < labelCount; label += 1) {
    const value = Math.exp((logits[label] ?? 0) - maxLogit)
    scores[label] = value
    sum += value
  }
  for (let label = 0; label < labelCount; label += 1) {
    scores[label] = (scores[label] ?? 0) / sum
  }
  return scores
}

export function averageScoreVectors(
  vectors: readonly Float64Array[],
): Float64Array {
  const first = vectors[0]
  if (!first || vectors.length === 0) {
    throw new Error('No window scores to average')
  }
  const mean = new Float64Array(first.length)
  for (const vector of vectors) {
    if (vector.length !== first.length) {
      throw new Error('Window score vectors differ in length')
    }
    for (let index = 0; index < vector.length; index += 1) {
      mean[index] += vector[index] ?? 0
    }
  }
  for (let index = 0; index < mean.length; index += 1) {
    mean[index] = (mean[index] ?? 0) / vectors.length
  }
  return mean
}

export function averageEmbeddings(
  embeddings: readonly Float32Array[],
): Float32Array {
  if (embeddings.length === 0) {
    throw new Error('No window embeddings to average')
  }
  const mean = new Float64Array(EMBEDDING_DIM)
  for (const embedding of embeddings) {
    if (embedding.length !== EMBEDDING_DIM) {
      throw new Error(
        `Expected a 2048-d embedding, received ${embedding.length}`,
      )
    }
    for (let index = 0; index < EMBEDDING_DIM; index += 1) {
      mean[index] += embedding[index] ?? 0
    }
  }
  const stored = new Float32Array(EMBEDDING_DIM)
  for (let index = 0; index < EMBEDDING_DIM; index += 1) {
    stored[index] = (mean[index] ?? 0) / embeddings.length
  }
  return stored
}

export function rankScores(
  scores: Float64Array,
  probe: ProbeVectors,
): ProbeScore {
  const labelCount = probe.labels.length
  if (labelCount < TOP_N) {
    throw new Error(`Probe has ${labelCount} labels; five are required`)
  }
  if (scores.length !== labelCount) {
    throw new Error('Score vector length does not match the label list')
  }
  if (probe.version.length === 0) {
    throw new Error('Probe version is empty')
  }

  const order = Array.from({ length: labelCount }, (_, index) => index)
  order.sort((left, right) => {
    const delta = (scores[right] ?? 0) - (scores[left] ?? 0)
    if (delta !== 0) return delta
    return left - right
  })

  return {
    version: probe.version,
    suggestions: order.slice(0, TOP_N).map((index) => ({
      catId: probe.labels[index] ?? '',
      score: scores[index] ?? 0,
    })),
  }
}
