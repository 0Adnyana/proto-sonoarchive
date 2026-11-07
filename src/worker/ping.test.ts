import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { analyseShortWav } from './analyse'
import { dispatchWorkerMessage, onnxRuntime } from './index'
import { responseForWorkerMessage } from './ping'

describe('worker ping', () => {
  it('returns success for a ping', () => {
    expect(responseForWorkerMessage({ type: 'ping' })).toEqual({ ok: true })
    expect(responseForWorkerMessage({ type: 'load-model' })).toBeUndefined()
  })

  it('loads onnxruntime-node from the worker', () => {
    const entry = readFileSync(new URL('./index.ts', import.meta.url), 'utf8')
    const analyse = readFileSync(
      new URL('./analyse.ts', import.meta.url),
      'utf8',
    )
    expect(`${entry}\n${analyse}`).toContain('onnxruntime-node')
    expect(typeof onnxRuntime.InferenceSession.create).toBe('function')
  })

  it('answers a ping when the model and the probe are missing', async () => {
    const result = await analyseShortWav({
      filePath: 'missing.wav',
      modelPath: 'missing-cnn14.onnx',
      probePath: 'missing-probe.json',
    })
    expect(result).toEqual({ ok: false, message: 'CNN14 model is missing.' })
    await expect(dispatchWorkerMessage({ type: 'ping' })).resolves.toEqual({
      ok: true,
    })
  })
})
