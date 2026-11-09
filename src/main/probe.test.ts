import { describe, expect, it } from 'vitest'
import {
  averageEmbeddings,
  averageScoreVectors,
  rankScores,
  scoreEmbedding,
  softmaxVector,
} from './probe'

describe('probe scoring', () => {
  it('keeps the five highest scores, the earlier label on a tie, and the probe version', () => {
    const labels = ['A', 'B', 'C', 'D', 'E', 'F']
    const embedding = new Float32Array([1, 0])
    const weight = new Float32Array([1, 0, 1, 0, 3, 0, 2, 0, 0, 0, -1, 0])
    const bias = new Float32Array(labels.length)
    const scored = scoreEmbedding(embedding, {
      version: 'tiny/v1',
      labels,
      weight,
      bias,
    })

    const logits = [1, 1, 3, 2, 0, -1]
    const maxLogit = Math.max(...logits)
    const shifted = logits.map((logit) => Math.exp(logit - maxLogit))
    const sum = shifted.reduce((total, value) => total + value, 0)
    const expected = shifted.map((value) => value / sum)

    expect(scored.version).toBe('tiny/v1')
    expect(scored.suggestions.map((suggestion) => suggestion.catId)).toEqual([
      'C',
      'D',
      'A',
      'B',
      'E',
    ])
    expect(scored.suggestions.map((suggestion) => suggestion.score)).toEqual([
      expected[2],
      expected[3],
      expected[0],
      expected[1],
      expected[4],
    ])
    expect(scored.suggestions[2]?.score).toBe(scored.suggestions[3]?.score)
    expect(scored.suggestions[0]?.score).toBeGreaterThan(
      scored.suggestions[1]?.score ?? 0,
    )
  })

  it('ranks the mean of window scores and keeps the earlier label on an equal mean', () => {
    const labels = ['A', 'B', 'C', 'D', 'E', 'F']
    const probe = {
      version: 'tiny/v1',
      labels,
      weight: new Float32Array([2, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0]),
      bias: new Float32Array(labels.length),
    }
    const ranked = rankScores(
      averageScoreVectors([
        softmaxVector(new Float32Array([1, 0]), probe),
        softmaxVector(new Float32Array([0, 1]), probe),
      ]),
      probe,
    )

    expect(ranked.suggestions[0]?.catId).toBe('A')
    expect(ranked.suggestions[1]?.catId).toBe('B')
    expect(ranked.suggestions[0]?.score).toBe(ranked.suggestions[1]?.score)
  })

  it('does not score the averaged embedding', () => {
    const labels = ['A', 'B', 'C', 'D', 'E', 'F']
    const probe = {
      version: 'tiny/v1',
      labels,
      weight: new Float32Array([8, 0, 0, 8, 5, 5, 0, 0, 0, 0, -1, -1]),
      bias: new Float32Array(labels.length),
    }
    const ranked = rankScores(
      averageScoreVectors([
        softmaxVector(new Float32Array([1, 0]), probe),
        softmaxVector(new Float32Array([0, 1]), probe),
      ]),
      probe,
    )
    const scoredMean = scoreEmbedding(new Float32Array([0.5, 0.5]), probe)

    expect(ranked.suggestions[0]?.catId).toBe('A')
    expect(scoredMean.suggestions[0]?.catId).toBe('C')
  })

  it('stores the mean of window embeddings as one float32 vector', () => {
    const left = new Float32Array(2048)
    const right = new Float32Array(2048)
    left[0] = 1
    right[0] = 3
    left[2047] = 4
    right[2047] = 6
    const mean = averageEmbeddings([left, right])

    expect(mean).toBeInstanceOf(Float32Array)
    expect(mean.length).toBe(2048)
    expect(mean[0]).toBe(2)
    expect(mean[2047]).toBe(5)
    expect(mean[1]).toBe(0)
  })
})
