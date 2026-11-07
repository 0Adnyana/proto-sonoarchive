import type { ImportFolderResult, SonoarchiveBridge } from '../shared/ipc'

export type LibraryBridge = Pick<
  SonoarchiveBridge,
  | 'importFolder'
  | 'listLibrary'
  | 'onLibraryChanged'
  | 'onLibraryNotice'
  | 'listUcs'
  | 'saveLabel'
  | 'mediaUrl'
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

export function appendAnalysisNotice(status: string, notice: string): string {
  if (notice.length === 0) return status
  if (status.length === 0) return notice
  return `${status} ${notice}`
}

export function formatLibraryStatus(
  base: string,
  notices: readonly string[],
): string {
  return notices.reduce(
    (status, notice) => appendAnalysisNotice(status, notice),
    base,
  )
}

export function errorText(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  return 'Could not open the library.'
}
