import { readFileSync } from 'node:fs'
import { inflateRawSync } from 'node:zlib'
import type { LibraryDatabase } from '../main/database'

const EMBEDDING_DIM = 2048

export type Top5Entry = {
  top5: Array<{ CatID: string; score: number }>
}

export function readTop5(filePath: string): Record<string, Top5Entry> {
  const raw: unknown = JSON.parse(readFileSync(filePath, 'utf8'))
  if (!isRecord(raw)) throw new Error('top5.json is not an object')
  const entries: Record<string, Top5Entry> = {}
  for (const [name, value] of Object.entries(raw)) {
    if (!isTop5Entry(value)) throw new Error(`${name} is not a top-5 entry`)
    entries[name] = value
  }
  return entries
}

export function readNpzEmbeddings(filePath: string): Map<string, Float32Array> {
  const data = readFileSync(filePath)
  const embeddings = new Map<string, Float32Array>()
  let offset = 0
  while (offset + 30 <= data.length) {
    if (data.readUInt32LE(offset) !== 0x04034b50) break
    const flags = data.readUInt16LE(offset + 6)
    if ((flags & 0x8) !== 0) {
      throw new Error('npz data descriptor is unsupported')
    }
    const method = data.readUInt16LE(offset + 8)
    const nameLength = data.readUInt16LE(offset + 26)
    const extraLength = data.readUInt16LE(offset + 28)
    const nameStart = offset + 30
    const extraStart = nameStart + nameLength
    const name = data.toString('utf8', nameStart, extraStart)
    const sizes = zip64Sizes(
      data.subarray(extraStart, extraStart + extraLength),
      data.readUInt32LE(offset + 18),
      data.readUInt32LE(offset + 22),
    )
    const dataStart = extraStart + extraLength
    const compressed = data.subarray(
      dataStart,
      dataStart + sizes.compressedSize,
    )
    const raw = method === 0 ? compressed : inflateRawSync(compressed)
    if (name.endsWith('.npy')) {
      embeddings.set(name.slice(0, -'.npy'.length), readNpyFloat32(raw))
    }
    offset = dataStart + sizes.compressedSize
  }
  return embeddings
}

export function readStoredEmbeddings(
  db: LibraryDatabase,
): Map<string, Float32Array> {
  const rows = db
    .prepare(
      `SELECT files.name AS name, embeddings.embedding AS embedding
       FROM files
       JOIN embeddings ON embeddings.rowid = files.rowid`,
    )
    .all() as Array<{ name: string; embedding: Uint8Array }>
  const embeddings = new Map<string, Float32Array>()
  for (const row of rows) {
    const bytes = Buffer.from(row.embedding)
    if (bytes.byteLength !== EMBEDDING_DIM * 4) {
      throw new Error(
        `${row.name} stored embedding is ${bytes.byteLength} bytes`,
      )
    }
    embeddings.set(
      row.name,
      new Float32Array(bytes.buffer, bytes.byteOffset, EMBEDDING_DIM),
    )
  }
  return embeddings
}

export function cosineSimilarity(
  left: Float32Array | undefined,
  right: Float32Array | undefined,
): number {
  if (!left || !right || left.length !== right.length || left.length === 0) {
    return 0
  }
  let dot = 0
  let leftNorm = 0
  let rightNorm = 0
  for (let index = 0; index < left.length; index += 1) {
    const leftValue = left[index] ?? 0
    const rightValue = right[index] ?? 0
    dot += leftValue * rightValue
    leftNorm += leftValue * leftValue
    rightNorm += rightValue * rightValue
  }
  const denom = Math.sqrt(leftNorm) * Math.sqrt(rightNorm)
  if (denom === 0) return 0
  return dot / denom
}

function zip64Sizes(
  extra: Buffer,
  compressedSize: number,
  uncompressedSize: number,
): { compressedSize: number; uncompressedSize: number } {
  let cursor = 0
  while (cursor + 4 <= extra.length) {
    const id = extra.readUInt16LE(cursor)
    const size = extra.readUInt16LE(cursor + 2)
    const body = extra.subarray(cursor + 4, cursor + 4 + size)
    cursor += 4 + size
    if (id !== 0x0001) continue
    let view = 0
    let uncompressed = uncompressedSize
    let compressed = compressedSize
    if (uncompressed === 0xffffffff) {
      uncompressed = Number(body.readBigUInt64LE(view))
      view += 8
    }
    if (compressed === 0xffffffff) {
      compressed = Number(body.readBigUInt64LE(view))
    }
    return { compressedSize: compressed, uncompressedSize: uncompressed }
  }
  return { compressedSize, uncompressedSize }
}

function readNpyFloat32(raw: Buffer): Float32Array {
  if (raw.subarray(0, 6).toString('latin1') !== '\u0093NUMPY') {
    throw new Error('embedding is not a npy array')
  }
  const major = raw[6]
  const headerLength = major === 1 ? raw.readUInt16LE(8) : raw.readUInt32LE(8)
  const headerStart = major === 1 ? 10 : 12
  const header = raw.toString('latin1', headerStart, headerStart + headerLength)
  if (
    !header.includes("'descr': '<f4'") ||
    !header.includes("'fortran_order': False")
  ) {
    throw new Error(`embedding header is not little-endian float32: ${header}`)
  }
  const shape = /'shape':\s*\((\d+),\s*\)/.exec(header)
  if (!shape || Number(shape[1]) !== EMBEDDING_DIM) {
    throw new Error(`embedding header shape is unexpected: ${header}`)
  }
  const body = raw.subarray(headerStart + headerLength)
  if (body.length !== EMBEDDING_DIM * 4) {
    throw new Error(`embedding byte length is ${body.length}`)
  }
  const bytes = Buffer.from(body)
  return new Float32Array(bytes.buffer, bytes.byteOffset, EMBEDDING_DIM)
}

function isTop5Entry(value: unknown): value is Top5Entry {
  if (
    !isRecord(value) ||
    !Array.isArray(value.top5) ||
    value.top5.length !== 5
  ) {
    return false
  }
  return value.top5.every(
    (row) =>
      isRecord(row) &&
      typeof row.CatID === 'string' &&
      row.CatID.length > 0 &&
      typeof row.score === 'number' &&
      Number.isFinite(row.score),
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
