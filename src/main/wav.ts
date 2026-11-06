import { readdirSync } from 'node:fs'
import { join } from 'node:path'

export function isWavFileName(name: string): boolean {
  return name.toLowerCase().endsWith('.wav')
}

export function wavFilesInFolder(folder: string): string[] {
  return readdirSync(folder, { withFileTypes: true })
    .filter((entry) => entry.isFile() && isWavFileName(entry.name))
    .map((entry) => join(folder, entry.name))
    .sort((left, right) => left.localeCompare(right))
}
