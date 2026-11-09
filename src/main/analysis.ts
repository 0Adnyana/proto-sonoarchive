import { existsSync, readFileSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import type {
  AnalysisPayload,
  AnalysisProgress,
  AnalysisSuccess,
} from '../shared/ipc'
import {
  type AnalysisCandidate,
  type LibraryDatabase,
  replaceSuggestions,
} from './database'

export const ANALYSIS_TIMEOUT_MS = 180_000
export const CNN14_FILENAME = 'Cnn14_mAP=0.431.onnx'
export const PROBE_FILENAME = 'probe.json'

export function resolveBundledFile(
  fileName: string,
  appPath: string,
  cwd: string,
): string {
  const fromApp = resolve(appPath, 'models', fileName)
  if (existsSync(fromApp)) return fromApp
  return resolve(cwd, 'models', fileName)
}

export function readProbeVersion(probePath: string): string | undefined {
  if (!existsSync(probePath)) return undefined
  try {
    const raw: unknown = JSON.parse(readFileSync(probePath, 'utf8'))
    if (!isRecord(raw)) return undefined
    if (typeof raw.version !== 'string' || raw.version.length === 0) {
      return undefined
    }
    return raw.version
  } catch {
    return undefined
  }
}

export function pendingAnalysisPaths(
  candidates: readonly AnalysisCandidate[],
  probeVersion: string | undefined,
): AnalysisCandidate[] {
  return candidates.filter((candidate) => {
    if (probeVersion === undefined) return true
    return candidate.probeVersion !== probeVersion
  })
}

export function queueAnalysisBatch(
  progress: AnalysisProgress,
  count: number,
): AnalysisProgress {
  return { done: progress.done, total: progress.total + count }
}

export function settleAnalysis(progress: AnalysisProgress): AnalysisProgress {
  return { done: progress.done + 1, total: progress.total }
}

export function analysisNotice(filePath: string, message: string): string {
  return `Could not analyse ${basename(filePath)}. ${message}`
}

export function storeAnalysis(
  db: LibraryDatabase,
  filePath: string,
  result: AnalysisPayload,
): result is AnalysisSuccess {
  if (!result.ok) return false
  replaceSuggestions(
    db,
    filePath,
    result.embedding,
    result.suggestions,
    result.probeVersion,
  )
  return true
}

export async function drainAnalysis(
  files: readonly AnalysisCandidate[],
  analyse: (file: AnalysisCandidate) => Promise<AnalysisPayload>,
  settle: (file: AnalysisCandidate, result: AnalysisPayload) => void,
): Promise<void> {
  for (const file of files) {
    const result = await analyse(file)
    settle(file, result)
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
