import { filePathFromMediaUrl } from './media-url'

export const ipcChannels = {
  ping: 'app:ping',
  importFolder: 'library:import-folder',
  listLibrary: 'library:list',
  libraryChanged: 'library:changed',
  libraryNotice: 'library:notice',
  analysisProgress: 'library:analysis-progress',
  listUcs: 'library:list-ucs',
  saveLabel: 'library:save-label',
  mediaUrl: 'library:media-url',
  resetLibrary: 'library:reset',
} as const

export type PingRequest = {
  type: 'ping'
}

export type PingSuccess = {
  ok: true
}

export type AnalyseRequest = {
  type: 'analyse'
  id: number
  filePath: string
  modelPath: string
  probePath: string
}

export type AnalysisSuccess = {
  ok: true
  embedding: Float32Array
  probeVersion: string
  suggestions: Suggestion[]
}

export type AnalysisFailure = {
  ok: false
  message: string
}

export type AnalysisPayload = AnalysisSuccess | AnalysisFailure

export type AnalyseResponse = AnalysisPayload & {
  type: 'analyse'
  id: number
  filePath: string
}

export type Suggestion = {
  catId: string
  score: number
}

export const labelRanks = ['1', '2', '3', '4', '5', 'manual'] as const

export type LabelRank = (typeof labelRanks)[number]

export type LibraryLabel = {
  catId: string
  fxName: string
  creatorId: string
  sourceId: string
  rank: LabelRank
}

export type LibraryFile = {
  path: string
  name: string
  format: 'wav'
  duration: number
  status: 'untagged' | 'tagged'
  catId: string | null
  suggestions: Suggestion[]
  label: LibraryLabel | null
}

export type UcsEntry = {
  catId: string
  category: string
  subCategory: string
}

export type SaveLabelInput = {
  path: string
  catId: string
  fxName: string
  creatorId: string
  sourceId: string
  rank: LabelRank
}

export type ImportFolderResult = {
  stored: number
  failed: string[]
}

export type AnalysisProgress = {
  done: number
  total: number
}

export type SonoarchiveBridge = {
  ping: () => Promise<PingSuccess>
  importFolder: () => Promise<ImportFolderResult | null>
  listLibrary: () => Promise<LibraryFile[]>
  onLibraryChanged: (listener: (files: LibraryFile[]) => void) => () => void
  onLibraryNotice: (listener: (message: string) => void) => () => void
  onAnalysisProgress: (
    listener: (progress: AnalysisProgress) => void,
  ) => () => void
  listUcs: () => Promise<UcsEntry[]>
  saveLabel: (input: SaveLabelInput) => Promise<void>
  mediaUrl: (path: string) => Promise<string>
  resetLibrary: () => Promise<void>
}

export function isPingRequest(message: unknown): message is PingRequest {
  return isRecord(message) && message.type === 'ping'
}

export function isPingSuccess(message: unknown): message is PingSuccess {
  return (
    isRecord(message) &&
    message.ok === true &&
    Object.keys(message).every((key) => key === 'ok')
  )
}

export function isAnalyseRequest(message: unknown): message is AnalyseRequest {
  return (
    isRecord(message) &&
    message.type === 'analyse' &&
    typeof message.id === 'number' &&
    Number.isInteger(message.id) &&
    isNonEmptyString(message.filePath) &&
    isNonEmptyString(message.modelPath) &&
    isNonEmptyString(message.probePath)
  )
}

export function readAnalyseMessage(message: unknown):
  | {
      id: number
      filePath: string
      result: AnalysisPayload
    }
  | undefined {
  if (!isRecord(message) || message.type !== 'analyse') return undefined
  if (typeof message.id !== 'number' || !Number.isInteger(message.id))
    return undefined
  if (!isNonEmptyString(message.filePath)) return undefined
  if (message.ok === false) {
    if (!isNonEmptyString(message.message)) return undefined
    return {
      id: message.id,
      filePath: message.filePath,
      result: { ok: false, message: message.message },
    }
  }
  if (message.ok !== true) return undefined
  const embedding = copyEmbedding(message.embedding)
  if (!embedding || !isNonEmptyString(message.probeVersion)) return undefined
  if (
    !Array.isArray(message.suggestions) ||
    message.suggestions.length !== 5 ||
    !message.suggestions.every(isSuggestion)
  ) {
    return undefined
  }
  return {
    id: message.id,
    filePath: message.filePath,
    result: {
      ok: true,
      embedding,
      probeVersion: message.probeVersion,
      suggestions: message.suggestions,
    },
  }
}

export function isAnalyseResponse(
  message: unknown,
): message is AnalyseResponse {
  return readAnalyseMessage(message) !== undefined
}

export function isLibraryNotice(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

export function isAnalysisProgress(value: unknown): value is AnalysisProgress {
  return (
    isRecord(value) &&
    Object.keys(value).length === 2 &&
    isWholeNumber(value.done) &&
    isWholeNumber(value.total) &&
    value.done <= value.total
  )
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

export function isLabelRank(value: unknown): value is LabelRank {
  return (
    typeof value === 'string' &&
    (labelRanks as readonly string[]).includes(value)
  )
}

function isLibraryLabel(value: unknown): value is LibraryLabel {
  return (
    isRecord(value) &&
    isNonEmptyString(value.catId) &&
    isNonEmptyString(value.fxName) &&
    typeof value.creatorId === 'string' &&
    typeof value.sourceId === 'string' &&
    isLabelRank(value.rank)
  )
}

export function isLibraryFile(value: unknown): value is LibraryFile {
  if (!isRecord(value)) return false
  const { path, name, format, duration, status, catId, suggestions, label } =
    value
  if (!isNonEmptyString(path)) return false
  if (typeof name !== 'string') return false
  if (format !== 'wav') return false
  if (typeof duration !== 'number' || !Number.isFinite(duration)) return false
  if (status !== 'untagged' && status !== 'tagged') return false
  if (catId !== null && !isNonEmptyString(catId)) return false
  if (!Array.isArray(suggestions) || !suggestions.every(isSuggestion)) {
    return false
  }
  if (suggestions.length !== 0 && suggestions.length !== 5) return false
  if (status === 'untagged') {
    if (label !== null) return false
    if (catId === null) return suggestions.length === 0
    return suggestions.length === 5 && suggestions[0]?.catId === catId
  }
  if (!isLibraryLabel(label) || label.catId !== catId) return false
  return true
}

export function isUcsEntry(value: unknown): value is UcsEntry {
  return (
    isRecord(value) &&
    isNonEmptyString(value.catId) &&
    isNonEmptyString(value.category) &&
    isNonEmptyString(value.subCategory)
  )
}

export function isUcsEntryList(value: unknown): value is UcsEntry[] {
  return Array.isArray(value) && value.every(isUcsEntry)
}

export function isSaveLabelInput(value: unknown): value is SaveLabelInput {
  return (
    isRecord(value) &&
    isNonEmptyString(value.path) &&
    isNonEmptyString(value.catId) &&
    typeof value.fxName === 'string' &&
    typeof value.creatorId === 'string' &&
    typeof value.sourceId === 'string' &&
    isLabelRank(value.rank)
  )
}

export function isMediaUrl(value: unknown): value is string {
  return typeof value === 'string' && filePathFromMediaUrl(value) !== undefined
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

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

function isWholeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

function copyEmbedding(value: unknown): Float32Array | undefined {
  if (value instanceof Float32Array && value.length === 2048) {
    return new Float32Array(value)
  }
  if (!Array.isArray(value) || value.length !== 2048) return undefined
  const embedding = new Float32Array(2048)
  for (let index = 0; index < embedding.length; index += 1) {
    const sample = value[index]
    if (typeof sample !== 'number' || !Number.isFinite(sample)) return undefined
    embedding[index] = sample
  }
  return embedding
}
