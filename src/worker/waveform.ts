import { spawn } from 'node:child_process'
import { bundledFfmpeg, DecodeError } from '../main/decode'

export const WAVEFORM_RATE = 32000

export function waveformDecodeArgs(filePath: string): string[] {
  return [
    '-nostdin',
    '-hide_banner',
    '-i',
    filePath,
    '-vn',
    '-ac',
    '1',
    '-ar',
    String(WAVEFORM_RATE),
    '-f',
    'f32le',
    'pipe:1',
  ]
}

// The returned samples live only for the analysis call. Callers do not store them.
export function decodeWavWaveform(filePath: string): Promise<Float32Array> {
  const ffmpegPath = bundledFfmpeg()
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, waveformDecodeArgs(filePath), {
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const chunks: Buffer[] = []
    let stderr = ''
    let settled = false
    const fail = (error: Error) => {
      if (settled) return
      settled = true
      reject(error)
    }
    const succeed = (waveform: Float32Array) => {
      if (settled) return
      settled = true
      resolve(waveform)
    }

    if (!child.stdout || !child.stderr) {
      child.kill()
      fail(new DecodeError('ffmpeg pipes were not created'))
      return
    }

    child.stdout.on('data', (chunk: Buffer) => {
      chunks.push(chunk)
    })
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk
    })
    child.on('error', (error) => {
      fail(new DecodeError(error.message))
    })
    child.on('close', (code) => {
      if (code !== 0) {
        fail(new DecodeError(stderr.trim() || `ffmpeg exited ${code}`))
        return
      }
      const pcm = Buffer.concat(chunks)
      if (pcm.length === 0 || pcm.length % 4 !== 0) {
        fail(new DecodeError('ffmpeg reported no samples'))
        return
      }
      const waveform = new Float32Array(pcm.length / 4)
      Buffer.from(waveform.buffer).set(pcm)
      succeed(waveform)
    })
  })
}
