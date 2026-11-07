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

export function scoreEmbedding(
  embedding: Float32Array,
  probe: ProbeVectors,
): ProbeScore {
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
      dot += probe.weight[offset + i] * embedding[i]
    }
    const logit = dot + probe.bias[label]
    logits[label] = logit
    if (logit > maxLogit) maxLogit = logit
  }

  const scores = new Float64Array(labelCount)
  let sum = 0
  for (let label = 0; label < labelCount; label += 1) {
    const value = Math.exp(logits[label] - maxLogit)
    scores[label] = value
    sum += value
  }
  for (let label = 0; label < labelCount; label += 1) {
    scores[label] /= sum
  }

  const order = Array.from({ length: labelCount }, (_, index) => index)
  order.sort((left, right) => {
    const delta = scores[right] - scores[left]
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
