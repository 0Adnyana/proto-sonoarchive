import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { responseForWorkerMessage } from './ping'

describe('worker ping', () => {
  it('returns success for a ping', () => {
    expect(responseForWorkerMessage({ type: 'ping' })).toEqual({ ok: true })
    expect(responseForWorkerMessage({ type: 'load-model' })).toBeUndefined()
  })

  it('does not reference a model runtime', () => {
    const entry = readFileSync(new URL('./index.ts', import.meta.url), 'utf8')
    const handler = readFileSync(new URL('./ping.ts', import.meta.url), 'utf8')
    const source = `${entry}\n${handler}`

    expect(source).not.toContain('onnxruntime')
    expect(source).not.toMatch(/\.onnx\b/)
  })
})
