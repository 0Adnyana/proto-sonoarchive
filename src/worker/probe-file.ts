import { readFileSync } from 'node:fs'
import type { ProbeVectors } from '../main/probe'

const EMBEDDING_DIM = 2048

export function readProbeFile(probePath: string): ProbeVectors {
  const raw: unknown = JSON.parse(readFileSync(probePath, 'utf8'))
  if (!isRecord(raw)) throw new Error('Probe file is not a JSON object')
  if (typeof raw.version !== 'string' || raw.version.length === 0) {
    throw new Error('Probe version is empty')
  }
  if (raw.embedding_dim !== EMBEDDING_DIM) {
    throw new Error('Probe embedding dimension is not 2048')
  }
  if (!Array.isArray(raw.labels) || raw.labels.length === 0) {
    throw new Error('Probe labels are missing')
  }
  const labels = raw.labels.map((label) => {
    if (typeof label !== 'string' || label.length === 0) {
      throw new Error('Probe label is empty')
    }
    return label
  })
  const weight = readArray(raw.weight, [labels.length, EMBEDDING_DIM])
  const bias = readArray(raw.bias, [labels.length])
  return { version: raw.version, labels, weight, bias }
}

function readArray(value: unknown, shape: readonly number[]): Float32Array {
  if (!isRecord(value)) throw new Error('Probe array is missing')
  if (value.dtype !== 'float32') throw new Error('Probe arrays must be float32')
  if (!sameShape(value.shape, shape)) {
    throw new Error('Probe array shape does not match')
  }
  if (typeof value.data !== 'string')
    throw new Error('Probe array data is missing')
  const count = shape.reduce((total, dim) => total * dim, 1)
  const bytes = Buffer.from(value.data, 'base64')
  if (bytes.byteLength !== count * 4) {
    throw new Error('Probe array byte length does not match its shape')
  }
  const copy = new Uint8Array(count * 4)
  copy.set(bytes)
  return new Float32Array(copy.buffer)
}

function sameShape(value: unknown, shape: readonly number[]): boolean {
  return (
    Array.isArray(value) &&
    value.length === shape.length &&
    value.every((dim, index) => dim === shape[index])
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
