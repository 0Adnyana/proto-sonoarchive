import { existsSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { bundledFfmpeg } from '../main/decode'
import {
  decodeWavWaveform,
  WAVEFORM_RATE,
  waveformDecodeArgs,
} from './waveform'

describe('waveform decode', () => {
  it('decodes a 10 second wav whole to 32 kHz mono float32', async () => {
    const folder = mkdtempSync(join(tmpdir(), 'sonoarchive-wave-'))
    const filePath = join(folder, 'tone.wav')
    writePcmWav(filePath, 10)
    const args = waveformDecodeArgs(filePath)

    expect(args).toContain(String(WAVEFORM_RATE))
    expect(args).toContain('f32le')
    expect(args).not.toContain('-t')
    expect(bundledFfmpeg()).not.toBe('ffmpeg')
    expect(existsSync(bundledFfmpeg())).toBe(true)

    const before = readdirSync(folder)
    const waveform = await decodeWavWaveform(filePath)
    expect(waveform).toBeInstanceOf(Float32Array)
    expect(waveform.length).toBe(10 * WAVEFORM_RATE)
    expect(readdirSync(folder)).toEqual(before)
  })
})

function writePcmWav(filePath: string, seconds: number): void {
  const sampleRate = 8000
  const numSamples = sampleRate * seconds
  const dataSize = numSamples * 2
  const buffer = Buffer.alloc(44 + dataSize)
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + dataSize, 4)
  buffer.write('WAVE', 8)
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(sampleRate * 2, 28)
  buffer.writeUInt16LE(2, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(dataSize, 40)
  writeFileSync(filePath, buffer)
}
