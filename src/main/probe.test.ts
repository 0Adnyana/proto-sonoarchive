import { describe, expect, it } from 'vitest'
import { scoreEmbedding } from './probe'

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
})
