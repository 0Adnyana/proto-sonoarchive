import type {
  AnalysisProgress,
  ImportFolderResult,
  SonoarchiveBridge,
} from '../shared/ipc'

export type LibraryBridge = Pick<
  SonoarchiveBridge,
  | 'importFolder'
  | 'listLibrary'
  | 'searchText'
  | 'findSimilar'
  | 'onLibraryChanged'
  | 'onLibraryNotice'
  | 'onAnalysisProgress'
  | 'listUcs'
  | 'saveLabel'
  | 'mediaUrl'
  | 'resetLibrary'
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

export function formatAnalysisProgress(
  progress: AnalysisProgress | null,
): string {
  if (!progress || progress.total === 0) return ''
  return `${progress.done} / ${progress.total} analysed`
}

export function formatLibraryStatus(
  base: string,
  notices: readonly string[],
  progress: AnalysisProgress | null = null,
  extra = '',
): string {
  const withProgress = appendAnalysisNotice(
    base,
    formatAnalysisProgress(progress),
  )
  const withNotices = notices.reduce(
    (status, notice) => appendAnalysisNotice(status, notice),
    withProgress,
  )
  return appendAnalysisNotice(withNotices, extra)
}

export function errorText(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  return 'Could not open the library.'
}
