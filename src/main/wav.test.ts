import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { isWavFileName, wavFilesInFolder } from './wav'

describe('wav filter', () => {
  it('accepts a wav extension in any case', () => {
    expect(isWavFileName('door.wav')).toBe(true)
    expect(isWavFileName('door.WAV')).toBe(true)
    expect(isWavFileName('door.Wav')).toBe(true)
    expect(isWavFileName('door.mp3')).toBe(false)
    expect(isWavFileName('door.wav.txt')).toBe(false)
    expect(isWavFileName('wav')).toBe(false)
  })

  it('keeps wav files directly in the folder', () => {
    const folder = mkdtempSync(join(tmpdir(), 'sonoarchive-wav-'))
    writeFileSync(join(folder, 'keep.WAV'), '')
    writeFileSync(join(folder, 'skip.mp3'), '')
    mkdirSync(join(folder, 'nested.wav'))
    const nested = join(folder, 'nested')
    mkdirSync(nested)
    writeFileSync(join(nested, 'hidden.wav'), '')

    expect(
      wavFilesInFolder(folder).map((file) => file.split('/').at(-1)),
    ).toEqual(['keep.WAV'])
  })
})
