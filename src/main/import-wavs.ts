import { statSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import type { ImportFolderResult } from '../shared/ipc'
import type { LibraryDatabase } from './database'
import { upsertWav } from './database'
import { DecodeError, decodeWavDuration } from './decode'
import { wavFilesInFolder } from './wav'

export async function importWavFolder(
  db: LibraryDatabase,
  folder: string,
): Promise<ImportFolderResult> {
  const failed: string[] = []
  let stored = 0
  for (const filePath of wavFilesInFolder(folder)) {
    const name = basename(filePath)
    try {
      const duration = await decodeWavDuration(filePath)
      const storedPath = resolve(filePath)
      upsertWav(db, {
        path: storedPath,
        name,
        format: 'wav',
        duration,
        status: 'untagged',
        modifiedTime: Math.trunc(statSync(filePath).mtimeMs),
      })
      stored += 1
    } catch (error) {
      if (error instanceof DecodeError && error.code === 'missing-ffmpeg') {
        throw error
      }
      failed.push(name)
    }
  }
  return { stored, failed }
}
