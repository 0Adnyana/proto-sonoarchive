import {
  accessSync,
  closeSync,
  constants,
  fsyncSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeSync,
} from 'node:fs'
import { basename, dirname, join } from 'node:path'
import {
  type MetadataFieldName,
  type MetadataFieldValues,
  metadataFieldNames,
} from '../shared/metadata-fields'

export const wavMetadataWriteError =
  'Could not write the tags. The file was left unchanged.'

const DESCRIPTION_BYTES = 256
const BEXT_BYTES = 602
const ORIGINATOR_OFFSET = 256
const DATE_OFFSET = 320
const TIME_OFFSET = 330
const VERSION_OFFSET = 346

type WaveChunk = {
  id: string
  payload: Buffer
  raw: Buffer
}

type XmlTag = {
  name: string
  kind: 'open' | 'close' | 'empty'
  start: number
  end: number
}

export type InspectedWav = {
  fields: Partial<Record<MetadataFieldName, string>>
  userChildNames: string[]
  description: string | null
  bextPayload: Buffer | null
  dataPayloads: Buffer[]
  chunkIds: string[]
  chunks: Array<{ id: string; raw: Buffer; payload: Buffer }>
}

export function writeWavMetadata(
  filePath: string,
  values: MetadataFieldValues,
): void {
  try {
    const original = readFileSync(filePath)
    const next = embedWavMetadata(original, values)
    replaceWavAfterReread(filePath, next, (written) =>
      metadataMatches(original, written, values),
    )
  } catch (error) {
    if (isWriteError(error)) throw error
    throw new Error(wavMetadataWriteError, { cause: error })
  }
}

export function replaceWavAfterReread(
  filePath: string,
  bytes: Buffer,
  accept: (written: Buffer) => boolean,
): void {
  const tempPath = join(
    dirname(filePath),
    `.${basename(filePath)}.sonoarchive-tmp`,
  )
  try {
    writeTemp(tempPath, bytes)
    const written = readFileSync(tempPath)
    if (!accept(written)) throw new Error('Re-read did not match')
    accessSync(filePath, constants.R_OK | constants.W_OK)
    renameSync(tempPath, filePath)
  } catch (error) {
    if (isWriteError(error)) throw error
    throw new Error(wavMetadataWriteError, { cause: error })
  } finally {
    removeTemp(tempPath)
  }
}

export function inspectWav(buffer: Buffer): InspectedWav {
  const chunks = parseWave(buffer).map((chunk) => ({
    id: chunk.id,
    raw: Buffer.from(chunk.raw),
    payload: Buffer.from(chunk.payload),
  }))
  const fields: Partial<Record<MetadataFieldName, string>> = {}
  const userChildNames: string[] = []
  for (const chunk of chunks) {
    if (chunk.id !== 'iXML') continue
    readUserBlock(decodeXml(chunk.payload), fields, userChildNames)
  }
  const bext = chunks.find((chunk) => chunk.id === 'bext') ?? null
  return {
    fields,
    userChildNames,
    description: bext ? descriptionText(bext.payload) : null,
    bextPayload: bext?.payload ?? null,
    dataPayloads: chunks
      .filter((chunk) => chunk.id === 'data')
      .map((chunk) => chunk.payload),
    chunkIds: chunks.map((chunk) => chunk.id),
    chunks,
  }
}

function embedWavMetadata(
  original: Buffer,
  values: MetadataFieldValues,
): Buffer {
  assertValues(values)
  const description = descriptionField(values.FXName)
  const parsed = parseWave(original)
  let sawBext = false
  let sawIxml = false
  const chunks: Buffer[] = []
  const appendMissing = (): void => {
    if (!sawBext) {
      chunks.push(encodeChunk('bext', newBext(description, new Date())))
      sawBext = true
    }
    if (!sawIxml) {
      chunks.push(encodeChunk('iXML', Buffer.from(newIxml(values), 'utf8')))
      sawIxml = true
    }
  }
  for (const chunk of parsed) {
    if (chunk.id === 'data') appendMissing()
    if (chunk.id === 'bext') {
      sawBext = true
      chunks.push(
        encodeChunk('bext', withDescription(chunk.payload, description)),
      )
      continue
    }
    if (chunk.id === 'iXML') {
      sawIxml = true
      const xml = updateIxml(decodeXml(chunk.payload), values)
      chunks.push(encodeChunk('iXML', Buffer.from(xml, 'utf8')))
      continue
    }
    chunks.push(Buffer.from(chunk.raw))
  }
  appendMissing()
  return encodeWave(chunks)
}

function metadataMatches(
  original: Buffer,
  written: Buffer,
  values: MetadataFieldValues,
): boolean {
  const inspected = inspectWav(written)
  const description = utf8Prefix(values.FXName, DESCRIPTION_BYTES - 1)
  if (inspected.description !== description) return false
  for (const name of metadataFieldNames) {
    if (inspected.fields[name] !== values[name]) return false
  }
  const before = inspectWav(original).dataPayloads
  if (before.length !== inspected.dataPayloads.length) return false
  return before.every((payload, index) =>
    payload.equals(inspected.dataPayloads[index] ?? Buffer.alloc(0)),
  )
}

function assertValues(values: MetadataFieldValues): void {
  for (const name of metadataFieldNames) {
    const value = values[name]
    if (typeof value !== 'string' || value.includes('\0')) {
      throw new Error(`Cannot write ${name}`)
    }
  }
}

function parseWave(buffer: Buffer): WaveChunk[] {
  if (buffer.length < 12 || buffer.toString('latin1', 0, 4) !== 'RIFF') {
    throw new Error('Not a RIFF WAVE')
  }
  if (buffer.toString('latin1', 8, 12) !== 'WAVE') {
    throw new Error('Not a RIFF WAVE')
  }
  const end = 8 + buffer.readUInt32LE(4)
  if (end !== buffer.length)
    throw new Error('RIFF size does not match the file')
  const chunks: WaveChunk[] = []
  let offset = 12
  while (offset !== end) {
    if (offset + 8 > end) throw new Error('RIFF chunk exceeds the file')
    const id = buffer.toString('latin1', offset, offset + 4)
    const size = buffer.readUInt32LE(offset + 4)
    const payloadEnd = offset + 8 + size
    const paddedEnd = payloadEnd + (size % 2)
    if (payloadEnd > end || paddedEnd > end) {
      throw new Error('RIFF chunk exceeds the file')
    }
    chunks.push({
      id,
      payload: buffer.subarray(offset + 8, payloadEnd),
      raw: buffer.subarray(offset, paddedEnd),
    })
    offset = paddedEnd
  }
  return chunks
}

function encodeWave(chunkBytes: Buffer[]): Buffer {
  const body = Buffer.concat(chunkBytes)
  const riffSize = 4 + body.length
  if (riffSize > 0xffffffff) {
    throw new Error('RIFF size does not fit in a uint32')
  }
  const header = Buffer.alloc(12)
  header.write('RIFF', 0, 'latin1')
  header.writeUInt32LE(riffSize, 4)
  header.write('WAVE', 8, 'latin1')
  return Buffer.concat([header, body])
}

function encodeChunk(id: string, payload: Buffer): Buffer {
  if (id.length !== 4 || payload.length > 0xffffffff) {
    throw new Error('RIFF chunk does not fit in a uint32')
  }
  const header = Buffer.alloc(8)
  header.write(id, 0, 'latin1')
  header.writeUInt32LE(payload.length, 4)
  if (payload.length % 2 === 0) return Buffer.concat([header, payload])
  return Buffer.concat([header, payload, Buffer.from([0])])
}

function withDescription(payload: Buffer, description: Buffer): Buffer {
  if (payload.length < DESCRIPTION_BYTES) {
    throw new Error('bext payload is shorter than the Description')
  }
  const next = Buffer.from(payload)
  description.copy(next, 0)
  return next
}

function newBext(description: Buffer, now: Date): Buffer {
  const payload = Buffer.alloc(BEXT_BYTES)
  description.copy(payload, 0)
  payload.write('Sonoarchive', ORIGINATOR_OFFSET, 'ascii')
  payload.write(bextDate(now), DATE_OFFSET, 'ascii')
  payload.write(bextTime(now), TIME_OFFSET, 'ascii')
  payload.writeUInt16LE(1, VERSION_OFFSET)
  return payload
}

function bextDate(now: Date): string {
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

function bextTime(now: Date): string {
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const seconds = String(now.getSeconds()).padStart(2, '0')
  return `${hours}:${minutes}:${seconds}`
}

function descriptionField(fxName: string): Buffer {
  const field = Buffer.alloc(DESCRIPTION_BYTES)
  Buffer.from(utf8Prefix(fxName, DESCRIPTION_BYTES - 1), 'utf8').copy(field)
  return field
}

function descriptionText(payload: Buffer): string {
  if (payload.length < DESCRIPTION_BYTES) {
    throw new Error('bext payload is shorter than the Description')
  }
  const field = payload.subarray(0, DESCRIPTION_BYTES)
  const nul = field.indexOf(0)
  const bytes = nul === -1 ? field : field.subarray(0, nul)
  return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(
    bytes,
  )
}

function utf8Prefix(text: string, maxBytes: number): string {
  let used = 0
  let index = 0
  for (const char of text) {
    const bytes = Buffer.byteLength(char)
    if (used + bytes > maxBytes) break
    used += bytes
    index += char.length
  }
  return text.slice(0, index)
}

function newIxml(values: MetadataFieldValues): string {
  const elements = metadataFieldNames
    .map((name) => `    <${name}>${escapeXml(values[name])}</${name}>`)
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<BWFXML>\n  <IXML_VERSION>1.27</IXML_VERSION>\n  <USER>\n${elements}\n  </USER>\n</BWFXML>\n`
}

function updateIxml(xml: string, values: MetadataFieldValues): string {
  const tags = xmlTags(xml)
  const user = userElement(tags)
  const children = directChildren(tags, user.open, user.close)
  const seen = new Set<MetadataFieldName>()
  const edits: Array<{ start: number; end: number; text: string }> = []
  for (const child of children) {
    const name = metadataName(child.name)
    if (!name) continue
    seen.add(name)
    const value = escapeXml(values[name])
    if (child.kind === 'empty') {
      edits.push({
        start: child.start,
        end: child.end,
        text: expandedEmpty(
          xml.slice(child.start, child.end),
          child.name,
          value,
        ),
      })
      continue
    }
    const close = elementClose(tags, child)
    if (tags.some((tag) => tag.start >= child.end && tag.start < close.start)) {
      throw new Error('iXML USER element cannot be updated')
    }
    edits.push({ start: child.end, end: close.start, text: value })
  }
  const missing = metadataFieldNames.filter((name) => !seen.has(name))
  if (missing.length > 0) {
    edits.push({
      start: user.close.start,
      end: user.close.start,
      text: missing
        .map((name) => `<${name}>${escapeXml(values[name])}</${name}>`)
        .join(''),
    })
  }
  return applyEdits(xml, edits)
}

function readUserBlock(
  xml: string,
  fields: Partial<Record<MetadataFieldName, string>>,
  userChildNames: string[],
): void {
  const tags = xmlTags(xml)
  const user = tags.find((tag) => tag.name === 'USER' && tag.kind === 'open')
  const close = tags.find(
    (tag) =>
      tag.name === 'USER' &&
      tag.kind === 'close' &&
      user &&
      tag.start > user.start,
  )
  if (!user || !close) return
  for (const child of directChildren(tags, user, close)) {
    userChildNames.push(child.name)
    const name = metadataName(child.name)
    if (!name || fields[name] !== undefined) continue
    fields[name] =
      child.kind === 'empty'
        ? ''
        : unescapeXml(xml.slice(child.end, elementClose(tags, child).start))
  }
}

function userElement(tags: XmlTag[]): { open: XmlTag; close: XmlTag } {
  const open = tags.filter((tag) => tag.name === 'USER' && tag.kind === 'open')
  if (open.length !== 1) throw new Error('iXML USER element cannot be updated')
  const user = open[0]
  if (!user) throw new Error('iXML USER element cannot be updated')
  return { open: user, close: elementClose(tags, user) }
}

function directChildren(tags: XmlTag[], open: XmlTag, close: XmlTag): XmlTag[] {
  const children: XmlTag[] = []
  let depth = 0
  for (const tag of tags) {
    if (tag.start < open.end || tag.start >= close.start) continue
    if (tag.kind === 'close') {
      depth -= 1
      if (depth < 0) throw new Error('iXML USER element cannot be updated')
      continue
    }
    if (depth === 0) children.push(tag)
    if (tag.kind === 'open') depth += 1
  }
  if (depth !== 0) throw new Error('iXML USER element cannot be updated')
  return children
}

function elementClose(tags: XmlTag[], open: XmlTag): XmlTag {
  let depth = 0
  for (const tag of tags) {
    if (tag.start < open.start) continue
    if (tag.kind === 'empty') continue
    if (tag.kind === 'open') {
      depth += 1
      continue
    }
    depth -= 1
    if (depth === 0) {
      if (tag.name !== open.name) {
        throw new Error('iXML USER element cannot be updated')
      }
      return tag
    }
  }
  throw new Error('iXML USER element cannot be updated')
}

function xmlTags(xml: string): XmlTag[] {
  const tags: XmlTag[] = []
  let index = 0
  while (index < xml.length) {
    const start = xml.indexOf('<', index)
    if (start === -1) break
    if (xml.startsWith('<!--', start)) {
      const end = xml.indexOf('-->', start + 4)
      if (end === -1) throw new Error('iXML USER element cannot be updated')
      index = end + 3
      continue
    }
    if (xml.startsWith('<![CDATA[', start)) {
      const end = xml.indexOf(']]>', start + 9)
      if (end === -1) throw new Error('iXML USER element cannot be updated')
      index = end + 3
      continue
    }
    if (xml.startsWith('<?', start)) {
      const end = xml.indexOf('?>', start + 2)
      if (end === -1) throw new Error('iXML USER element cannot be updated')
      index = end + 2
      continue
    }
    const end = endOfTag(xml, start)
    const tag = parseTag(xml.slice(start, end), start, end)
    if (tag) tags.push(tag)
    index = end
  }
  return tags
}

function endOfTag(xml: string, start: number): number {
  let quote = ''
  for (let index = start + 1; index < xml.length; index += 1) {
    const char = xml[index] ?? ''
    if (quote) {
      if (char === quote) quote = ''
      continue
    }
    if (char === '"' || char === "'") {
      quote = char
      continue
    }
    if (char === '>') return index + 1
  }
  throw new Error('iXML USER element cannot be updated')
}

function parseTag(raw: string, start: number, end: number): XmlTag | null {
  const inner = raw.slice(1, -1).trim()
  if (inner.length === 0 || inner.startsWith('!') || inner.startsWith('?')) {
    return null
  }
  const closing = inner.startsWith('/')
  const body = (closing ? inner.slice(1) : inner).trim()
  const empty = !closing && body.endsWith('/')
  const named = (empty ? body.slice(0, body.lastIndexOf('/')) : body).trim()
  const name = /^[A-Za-z_:][A-Za-z0-9_.:-]*/.exec(named)?.[0]
  if (!name) throw new Error('iXML USER element cannot be updated')
  if (closing) return { name, kind: 'close', start, end }
  if (empty) return { name, kind: 'empty', start, end }
  return { name, kind: 'open', start, end }
}

function expandedEmpty(raw: string, name: string, value: string): string {
  const open = raw.replace(/\/\s*>$/, '>')
  if (open === raw) throw new Error('iXML USER element cannot be updated')
  return `${open}${value}</${name}>`
}

function applyEdits(
  xml: string,
  edits: Array<{ start: number; end: number; text: string }>,
): string {
  const ordered = [...edits].sort((left, right) => left.start - right.start)
  let cursor = 0
  let result = ''
  for (const edit of ordered) {
    if (edit.start < cursor) {
      throw new Error('iXML USER element cannot be updated')
    }
    result += xml.slice(cursor, edit.start)
    result += edit.text
    cursor = edit.end
  }
  return result + xml.slice(cursor)
}

function metadataName(name: string): MetadataFieldName | null {
  return metadataFieldNames.find((field) => field === name) ?? null
}

function escapeXml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function unescapeXml(text: string): string {
  if (text.includes('<')) throw new Error('iXML text cannot be read')
  return text.replace(
    /&(#x[0-9A-Fa-f]+|#\d+|[A-Za-z]+);/g,
    (entity, body: string) => {
      if (body === 'amp') return '&'
      if (body === 'lt') return '<'
      if (body === 'gt') return '>'
      if (body === 'quot') return '"'
      if (body === 'apos') return "'"
      if (body.startsWith('#x')) {
        return String.fromCodePoint(Number.parseInt(body.slice(2), 16))
      }
      if (body.startsWith('#')) {
        return String.fromCodePoint(Number.parseInt(body.slice(1), 10))
      }
      throw new Error(`Unknown XML entity ${entity}`)
    },
  )
}

function decodeXml(payload: Buffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(
      payload,
    )
  } catch (error) {
    throw new Error('iXML chunk is not UTF-8', { cause: error })
  }
}

function writeTemp(tempPath: string, bytes: Buffer): void {
  const fd = openSync(tempPath, 'w')
  try {
    let offset = 0
    while (offset < bytes.length) {
      const written = writeSync(fd, bytes, offset)
      if (written <= 0) throw new Error('Temp file write stalled')
      offset += written
    }
    fsyncSync(fd)
  } finally {
    closeSync(fd)
  }
}

function removeTemp(tempPath: string): void {
  try {
    unlinkSync(tempPath)
  } catch (error) {
    if (errorCode(error) !== 'ENOENT') throw error
  }
}

function isWriteError(error: unknown): boolean {
  return error instanceof Error && error.message === wavMetadataWriteError
}

function errorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return undefined
  }
  const code = error.code
  return typeof code === 'string' ? code : undefined
}
