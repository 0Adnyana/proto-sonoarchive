import { existsSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { bundledFfmpeg } from '../main/decode'
import {
  decodeWavWaveform,
  HOP_SAMPLES,
  sliceCompleteWindows,
  WAVEFORM_RATE,
  WINDOW_SAMPLES,
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

  it('keeps five complete windows from a 30 second buffer and drops a short tail', () => {
    const exact = sliceCompleteWindows(new Float32Array(960_000))
    expect(exact).toHaveLength(5)
    expect(exact.every((window) => window.length === WINDOW_SAMPLES)).toBe(true)
    expect(WINDOW_SAMPLES).toBe(320_000)
    expect(HOP_SAMPLES).toBe(160_000)

    const tailed = new Float32Array(960_000 + HOP_SAMPLES - 1)
    tailed[0] = 1
    tailed[HOP_SAMPLES] = 2
    tailed[960_000] = 9
    const windows = sliceCompleteWindows(tailed)
    expect(windows).toHaveLength(5)
    expect(windows[0]?.[0]).toBe(1)
    expect(windows[1]?.[0]).toBe(2)
    expect(windows[4]?.[WINDOW_SAMPLES - 1]).toBe(0)
  })

  it('does not slice a buffer of 10 seconds or fewer', () => {
    expect(sliceCompleteWindows(new Float32Array(WINDOW_SAMPLES))).toEqual([])
    expect(sliceCompleteWindows(new Float32Array(WAVEFORM_RATE))).toEqual([])
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
