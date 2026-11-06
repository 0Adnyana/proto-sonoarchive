import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'

const ffmpegRequire = createRequire(import.meta.url)

const DECODED_RATE = 48000
const DECODED_BYTES_PER_SECOND = DECODED_RATE * 2

export class DecodeError extends Error {
  readonly code: 'missing-ffmpeg' | 'decode-failed'

  constructor(
    message: string,
    code: 'missing-ffmpeg' | 'decode-failed' = 'decode-failed',
  ) {
    super(message)
    this.name = 'DecodeError'
    this.code = code
  }
}

// Count decoded PCM and discard it. The null muxer's progress time stops short of the last packet.
export function decodeWavDuration(filePath: string): Promise<number> {
  const ffmpegPath = bundledFfmpeg()
  return new Promise((resolve, reject) => {
    const child = spawn(
      ffmpegPath,
      [
        '-nostdin',
        '-hide_banner',
        '-i',
        filePath,
        '-vn',
        '-ac',
        '1',
        '-ar',
        String(DECODED_RATE),
        '-f',
        's16le',
        'pipe:1',
      ],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    )
    let bytes = 0
    let stderr = ''
    let settled = false
    const fail = (error: Error) => {
      if (settled) return
      settled = true
      reject(error)
    }
    const succeed = (seconds: number) => {
      if (settled) return
      settled = true
      resolve(seconds)
    }

    if (!child.stdout || !child.stderr) {
      child.kill()
      fail(new DecodeError('ffmpeg pipes were not created'))
      return
    }

    child.stdout.on('data', (chunk: Buffer) => {
      bytes += chunk.length
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
      const seconds = bytes / DECODED_BYTES_PER_SECOND
      if (!(seconds > 0)) {
        fail(new DecodeError('ffmpeg reported no duration'))
        return
      }
      succeed(seconds)
    })
  })
}

function bundledFfmpeg(): string {
  const ffmpegPath = ffmpegRequire('ffmpeg-static') as string | null
  if (!ffmpegPath || !existsSync(ffmpegPath)) {
    throw new DecodeError('bundled ffmpeg is missing', 'missing-ffmpeg')
  }
  return ffmpegPath
}
