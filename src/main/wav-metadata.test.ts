import { createHash } from 'node:crypto'
import {
  chmodSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  type MetadataFieldValues,
  metadataFieldNames,
} from '../shared/metadata-fields'
import {
  inspectWav,
  replaceWavAfterReread,
  wavMetadataWriteError,
  writeWavMetadata,
} from './wav-metadata'

const saved: MetadataFieldValues = {
  CatID: 'AIRBrst',
  Category: 'AIR',
  SubCategory: 'Burst',
  FXName: 'Door slam',
  CreatorID: 'Ada',
  SourceID: 'Field',
}

describe('wav metadata', () => {
  it('keeps the six field names in mapping-table order', () => {
    expect([...metadataFieldNames]).toEqual([
      'CatID',
      'Category',
      'SubCategory',
      'FXName',
      'CreatorID',
      'SourceID',
    ])
  })

  it('writes the six values, an empty pair, and a byte-identical data chunk', () => {
    const wav = writeSample(sampleWave())
    const before = readFileSync(wav)
    const beforeHash = dataHashes(before)

    writeWavMetadata(wav, saved)
    const written = readFileSync(wav)
    const inspected = inspectWav(written)
    expect(inspected.fields).toEqual(saved)
    expect(inspected.description).toBe('Door slam')
    expect(inspected.chunkIds.filter((id) => id === 'iXML')).toEqual(['iXML'])
    expect(inspected.bextPayload?.length).toBe(602)
    expect(inspected.bextPayload?.subarray(256, 267).toString('ascii')).toBe(
      'Sonoarchive',
    )
    expect(inspected.bextPayload?.readUInt16LE(346)).toBe(1)
    expect(inspected.bextPayload?.subarray(320, 330).toString('ascii')).toMatch(
      /^\d{4}-\d{2}-\d{2}$/,
    )
    expect(inspected.bextPayload?.subarray(330, 338).toString('ascii')).toMatch(
      /^\d{2}:\d{2}:\d{2}$/,
    )
    expect(dataHashes(written)).toEqual(beforeHash)
    expect(rawChunks(written, 'data')).toEqual(rawChunks(before, 'data'))
    expect(rawChunks(written, 'JUNK')).toEqual(rawChunks(before, 'JUNK'))
    expect(tempNames(wav)).toEqual([])

    writeWavMetadata(wav, {
      ...saved,
      CreatorID: '',
      SourceID: '',
    })
    expect(inspectWav(readFileSync(wav)).fields).toMatchObject({
      CreatorID: '',
      SourceID: '',
    })
  })

  it('updates one iXML chunk, keeps another USER child, and round-trips an ampersand', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<BWFXML>
  <IXML_VERSION>1.5</IXML_VERSION>
  <USER>
    <Notes>keep me</Notes>
    <!-- stay -->
    <CatID>OLD</CatID>
  </USER>
</BWFXML>`
    const wav = writeSample(
      wave([
        chunk('fmt ', Buffer.alloc(16, 1)),
        chunk('iXML', Buffer.from(xml, 'utf8')),
        chunk('data', Buffer.from([9, 8, 7])),
      ]),
    )

    writeWavMetadata(wav, { ...saved, FXName: 'Rock & Roll' })
    writeWavMetadata(wav, {
      ...saved,
      CatID: 'DOORWood',
      Category: 'DOORS',
      SubCategory: 'Wood',
      FXName: 'Rock & Roll',
    })

    const inspected = inspectWav(readFileSync(wav))
    const ixml = inspected.chunks.find((part) => part.id === 'iXML')
    const text = ixml?.payload.toString('utf8') ?? ''
    expect(inspected.chunkIds.filter((id) => id === 'iXML')).toEqual(['iXML'])
    expect(inspected.fields).toMatchObject({
      CatID: 'DOORWood',
      Category: 'DOORS',
      SubCategory: 'Wood',
      FXName: 'Rock & Roll',
    })
    expect(inspected.userChildNames).toContain('Notes')
    expect(text).toContain('<IXML_VERSION>1.5</IXML_VERSION>')
    expect(text).toContain('<Notes>keep me</Notes>')
    expect(text).toContain('<!-- stay -->')
    expect(text).toContain('Rock &amp; Roll')
  })

  it('keeps a long FXName in iXML and the bext tail after the Description', () => {
    const fxName = `${'a'.repeat(254)}ézzz`
    const bext = Buffer.alloc(610, 0x22)
    bext.write('previous', 0, 'ascii')
    const tail = Buffer.from(bext.subarray(256))
    const wav = writeSample(
      wave([
        chunk('fmt ', Buffer.alloc(16, 1)),
        chunk('bext', bext),
        chunk('data', Buffer.alloc(16, 4)),
      ]),
    )

    writeWavMetadata(wav, { ...saved, FXName: fxName })
    const inspected = inspectWav(readFileSync(wav))
    expect(inspected.fields.FXName).toBe(fxName)
    expect(inspected.description).toBe('a'.repeat(254))
    expect(inspected.bextPayload?.subarray(256)).toEqual(tail)
  })

  it('replaces the original only after a clean re-read and removes the temp file', () => {
    const folder = mkdtempSync(join(tmpdir(), 'sonoarchive-wav-meta-'))
    const wav = join(folder, 'tone.wav')
    const original = sampleWave()
    writeFileSync(wav, original)

    writeWavMetadata(wav, saved)
    const written = readFileSync(wav)
    expect(written.equals(original)).toBe(false)
    expect(inspectWav(written).fields).toEqual(saved)
    expect(inspectWav(written).description).toBe(saved.FXName)
    expect(dataHashes(written)).toEqual(dataHashes(original))
    expect(tempNames(wav)).toEqual([])

    expect(() =>
      replaceWavAfterReread(wav, Buffer.from('not a wave'), () => false),
    ).toThrow(wavMetadataWriteError)
    expect(readFileSync(wav).equals(written)).toBe(true)
    expect(tempNames(wav)).toEqual([])

    chmodSync(wav, 0o444)
    try {
      expect(() =>
        writeWavMetadata(wav, { ...saved, FXName: 'Changed' }),
      ).toThrow(wavMetadataWriteError)
      expect(readFileSync(wav).equals(written)).toBe(true)
      expect(tempNames(wav)).toEqual([])
    } finally {
      chmodSync(wav, 0o644)
    }

    chmodSync(folder, 0o555)
    try {
      expect(() => writeWavMetadata(wav, saved)).toThrow(wavMetadataWriteError)
      expect(readFileSync(wav).equals(written)).toBe(true)
    } finally {
      chmodSync(folder, 0o755)
    }
    expect(tempNames(wav)).toEqual([])
  })
})

function dataHashes(buffer: Buffer): string[] {
  return inspectWav(buffer)
    .chunks.filter((part) => part.id === 'data')
    .map((part) =>
      createHash('sha256')
        .update(part.raw.subarray(0, 8 + part.payload.length))
        .digest('hex'),
    )
}

function rawChunks(buffer: Buffer, id: string): Buffer[] {
  return inspectWav(buffer)
    .chunks.filter((part) => part.id === id)
    .map((part) => part.raw)
}

function tempNames(filePath: string): string[] {
  return readdirSync(join(filePath, '..')).filter((name) =>
    name.includes('sonoarchive-tmp'),
  )
}

function writeSample(buffer: Buffer): string {
  const folder = mkdtempSync(join(tmpdir(), 'sonoarchive-wav-meta-'))
  const wav = join(folder, 'tone.wav')
  writeFileSync(wav, buffer)
  return wav
}

function sampleWave(): Buffer {
  return wave([
    chunk('fmt ', Buffer.alloc(16, 1)),
    chunk('JUNK', Buffer.from('ODD'), 0x11),
    chunk(
      'data',
      Buffer.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]),
      0x5a,
    ),
  ])
}

function wave(parts: Buffer[]): Buffer {
  const body = Buffer.concat(parts)
  const header = Buffer.alloc(12)
  header.write('RIFF', 0, 'latin1')
  header.writeUInt32LE(4 + body.length, 4)
  header.write('WAVE', 8, 'latin1')
  return Buffer.concat([header, body])
}

function chunk(id: string, payload: Buffer, pad = 0): Buffer {
  const header = Buffer.alloc(8)
  header.write(id, 0, 'latin1')
  header.writeUInt32LE(payload.length, 4)
  if (payload.length % 2 === 0) return Buffer.concat([header, payload])
  return Buffer.concat([header, payload, Buffer.from([pad])])
}
