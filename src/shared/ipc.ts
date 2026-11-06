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

export type LibraryFile = {
  name: string
  format: 'wav'
  duration: number
  status: 'untagged'
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

export function isLibraryFile(value: unknown): value is LibraryFile {
  return (
    isRecord(value) &&
    typeof value.name === 'string' &&
    value.format === 'wav' &&
    typeof value.duration === 'number' &&
    Number.isFinite(value.duration) &&
    value.status === 'untagged'
  )
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
