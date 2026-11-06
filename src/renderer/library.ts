import type { ImportFolderResult, SonoarchiveBridge } from '../shared/ipc'

export type LibraryBridge = Pick<
  SonoarchiveBridge,
  'importFolder' | 'listLibrary' | 'onLibraryChanged'
>

export function formatDurationSeconds(duration: number): string {
  const rounded = Math.round(duration * 1000) / 1000
  return String(rounded)
}

export function formatImportStatus(result: ImportFolderResult): string {
  const noun = result.stored === 1 ? 'file' : 'files'
  const stored = `Stored ${result.stored} ${noun}.`
  if (result.failed.length === 0) return stored
  return `${stored} Could not decode ${result.failed.join(', ')}.`
}

export function errorText(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  return 'Could not open the library.'
}
