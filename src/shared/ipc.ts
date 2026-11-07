export const ipcChannels = {
  ping: 'app:ping',
  importFolder: 'library:import-folder',
  listLibrary: 'library:list',
  libraryChanged: 'library:changed',
} as const

export type PingRequest = {
  type: 'ping'
}

export type PingSuccess = {
  ok: true
}

export type Suggestion = {
  catId: string
  score: number
}

export type LibraryFile = {
  name: string
  format: 'wav'
  duration: number
  status: 'untagged'
  catId: string | null
  suggestions: Suggestion[]
}

export type ImportFolderResult = {
  stored: number
  failed: string[]
}

export type SonoarchiveBridge = {
  ping: () => Promise<PingSuccess>
  importFolder: () => Promise<ImportFolderResult | null>
  listLibrary: () => Promise<LibraryFile[]>
  onLibraryChanged: (listener: (files: LibraryFile[]) => void) => () => void
}

export function isPingRequest(message: unknown): message is PingRequest {
  return isRecord(message) && message.type === 'ping'
}

export function isPingSuccess(message: unknown): message is PingSuccess {
  return isRecord(message) && message.ok === true
}

function isSuggestion(value: unknown): value is Suggestion {
  return (
    isRecord(value) &&
    typeof value.catId === 'string' &&
    value.catId.length > 0 &&
    typeof value.score === 'number' &&
    Number.isFinite(value.score)
  )
}

export function isLibraryFile(value: unknown): value is LibraryFile {
  if (!isRecord(value)) return false
  const { name, format, duration, status, catId, suggestions } = value
  if (typeof name !== 'string') return false
  if (format !== 'wav') return false
  if (typeof duration !== 'number' || !Number.isFinite(duration)) return false
  if (status !== 'untagged') return false
  if (catId !== null && (typeof catId !== 'string' || catId.length === 0)) {
    return false
  }
  if (!Array.isArray(suggestions) || !suggestions.every(isSuggestion)) {
    return false
  }
  if (catId === null) return suggestions.length === 0
  return suggestions.length === 5 && suggestions[0]?.catId === catId
}

export function isLibraryFileList(value: unknown): value is LibraryFile[] {
  return Array.isArray(value) && value.every(isLibraryFile)
}

export function isImportFolderResult(
  value: unknown,
): value is ImportFolderResult {
  return (
    isRecord(value) &&
    typeof value.stored === 'number' &&
    Number.isInteger(value.stored) &&
    value.stored >= 0 &&
    Array.isArray(value.failed) &&
    value.failed.every((name) => typeof name === 'string')
  )
}

function isRecord(message: unknown): message is Record<string, unknown> {
  return typeof message === 'object' && message !== null
}
