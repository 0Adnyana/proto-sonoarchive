import { readFileSync } from 'node:fs'
import { inflateRawSync } from 'node:zlib'

export const UCS_COUNT = 753

const HEADER: Record<string, string> = {
  A: 'Category',
  B: 'SubCategory',
  C: 'CatID',
  D: 'CatShort',
  E: 'Explanations',
  F: 'Synonyms - Comma Separated',
}

export type UcsRow = {
  CatID: string
  Category: string
  SubCategory: string
  explanation: string
  synonyms: string
}

export class UcsError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UcsError'
  }
}

export function readUcs(workbookPath: string): UcsRow[] {
  let buffer: Buffer
  try {
    buffer = readFileSync(workbookPath)
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'unreadable'
    throw new UcsError(`could not read ${workbookPath}: ${detail}`)
  }

  const entries = readZipEntries(buffer, [
    'xl/sharedStrings.xml',
    'xl/worksheets/sheet1.xml',
  ])
  const stringsXml = entries.get('xl/sharedStrings.xml')
  const sheetXml = entries.get('xl/worksheets/sheet1.xml')
  if (!stringsXml || !sheetXml) {
    throw new UcsError(`${workbookPath} is not the UCS workbook`)
  }

  const rows = sheetRows(
    sheetXml.toString('utf8'),
    sharedStrings(stringsXml.toString('utf8')),
  )
  const headerAt = rows.findIndex((row) => row.C === 'CatID')
  if (headerAt < 0) throw new UcsError(`${workbookPath} has no CatID header`)
  const header = rows[headerAt] ?? {}
  for (const [column, name] of Object.entries(HEADER)) {
    if (header[column] !== name) {
      throw new UcsError(
        `${workbookPath} column ${column} is ${JSON.stringify(header[column])}, expected ${name}`,
      )
    }
  }

  const records: UcsRow[] = []
  for (const row of rows.slice(headerAt + 1)) {
    const catId = row.C
    if (!catId) continue
    const fields = {
      Category: row.A ?? '',
      SubCategory: row.B ?? '',
      CatID: catId,
      CatShort: row.D ?? '',
      explanation: row.E ?? '',
      synonyms: row.F ?? '',
    }
    if (Object.values(fields).some((value) => value.length === 0)) {
      throw new UcsError(`${workbookPath} row for ${catId} is missing a field`)
    }
    records.push({
      CatID: fields.CatID,
      Category: fields.Category,
      SubCategory: fields.SubCategory,
      explanation: fields.explanation,
      synonyms: fields.synonyms,
    })
  }

  const ids = new Set(records.map((row) => row.CatID))
  if (ids.size !== records.length) {
    throw new UcsError(`${workbookPath} has duplicate CatIDs`)
  }
  if (records.length !== UCS_COUNT) {
    throw new UcsError(
      `${workbookPath} has ${records.length} CatIDs, expected ${UCS_COUNT}`,
    )
  }
  return records
}

function readZipEntries(buffer: Buffer, names: string[]): Map<string, Buffer> {
  const wanted = new Set(names)
  const found = new Map<string, Buffer>()
  let offset = 0
  while (offset + 30 <= buffer.length && found.size < wanted.size) {
    if (buffer.readUInt32LE(offset) !== 0x04034b50) break
    const flags = buffer.readUInt16LE(offset + 6)
    const method = buffer.readUInt16LE(offset + 8)
    const compressedSize = buffer.readUInt32LE(offset + 18)
    const nameLength = buffer.readUInt16LE(offset + 26)
    const extraLength = buffer.readUInt16LE(offset + 28)
    const nameStart = offset + 30
    const nameEnd = nameStart + nameLength
    const dataStart = nameEnd + extraLength
    if ((flags & 0x8) !== 0) {
      throw new UcsError('UCS workbook zip uses a data descriptor')
    }
    const dataEnd = dataStart + compressedSize
    if (dataEnd > buffer.length) {
      throw new UcsError('UCS workbook zip entry is truncated')
    }
    const name = buffer.toString('utf8', nameStart, nameEnd)
    if (wanted.has(name)) {
      const compressed = buffer.subarray(dataStart, dataEnd)
      if (method === 0) found.set(name, Buffer.from(compressed))
      else if (method === 8) found.set(name, inflateRawSync(compressed))
      else
        throw new UcsError(`UCS workbook zip method ${method} is unsupported`)
    }
    offset = dataEnd
  }
  return found
}

function sharedStrings(xml: string): string[] {
  const strings: string[] = []
  for (const item of xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) {
    const body = item[1] ?? ''
    let text = ''
    for (const part of body.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)) {
      text += decodeXml(part[1] ?? '')
    }
    strings.push(text)
  }
  return strings
}

function sheetRows(
  xml: string,
  strings: string[],
): Array<Record<string, string>> {
  const rows: Array<Record<string, string>> = []
  for (const item of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const body = item[1] ?? ''
    const values: Record<string, string> = {}
    for (const cell of body.matchAll(/<c\b([^>]*)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cell[1] ?? ''
      const column = /r="([A-Z]+)\d+"/.exec(attrs)?.[1]
      if (!column) continue
      const value = cellText(attrs, cell[2] ?? '', strings)
      if (value) values[column] = value
    }
    rows.push(values)
  }
  return rows
}

function cellText(attrs: string, inner: string, strings: string[]): string {
  const value = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1]
  if (!value) return ''
  if (/\bt="s"/.test(attrs)) return strings[Number(value)] ?? ''
  return decodeXml(value)
}

function decodeXml(text: string): string {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}
