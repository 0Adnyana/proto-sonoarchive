import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { isAbsolute, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Suggestion } from '../shared/ipc'
import {
  analysisNotice,
  CNN14_FILENAME,
  drainAnalysis,
  PROBE_FILENAME,
  pendingAnalysisPaths,
  queueAnalysisBatch,
  readProbeVersion,
  resolveBundledFile,
  settleAnalysis,
  storeAnalysis,
} from './analysis'
import {
  listAnalysisCandidates,
  listFiles,
  openLibrary,
  upsertWav,
} from './database'

const suggestions: Suggestion[] = [
  { catId: 'AIRBlow', score: 0.5 },
  { catId: 'AIRBrst', score: 0.25 },
  { catId: 'AIRHiss', score: 0.125 },
  { catId: 'AIRMisc', score: 0.0625 },
  { catId: 'AIRSuck', score: 0.03125 },
]

describe('analysis queue', () => {
  it('resolves model files from the app path, then the working directory', () => {
    const root = mkdtempSync(join(tmpdir(), 'sonoarchive-models-'))
    const appPath = join(root, 'app')
    const cwd = join(root, 'cwd')
    mkdirSync(join(appPath, 'models'), { recursive: true })
    mkdirSync(join(cwd, 'models'), { recursive: true })
    const appModel = join(appPath, 'models', CNN14_FILENAME)
    const cwdModel = join(cwd, 'models', CNN14_FILENAME)
    const cwdProbe = join(cwd, 'models', PROBE_FILENAME)

    expect(resolveBundledFile(CNN14_FILENAME, appPath, cwd)).toBe(cwdModel)
    expect(isAbsolute(resolveBundledFile(PROBE_FILENAME, appPath, cwd))).toBe(
      true,
    )

    writeFileSync(cwdProbe, '{"version":"from-cwd"}')
    writeFileSync(appModel, 'cnn14')
    writeFileSync(cwdModel, 'other')

    expect(resolveBundledFile(CNN14_FILENAME, appPath, cwd)).toBe(appModel)
    expect(resolveBundledFile(PROBE_FILENAME, appPath, cwd)).toBe(cwdProbe)
    expect(readProbeVersion(cwdProbe)).toBe('from-cwd')
    expect(
      readProbeVersion(join(cwd, 'models', 'missing.json')),
    ).toBeUndefined()
  })

  it('keeps a 10 second file and a longer one, and skips a current probe version', () => {
    const files = [
      {
        path: '/exact.wav',
        name: 'exact.wav',
        duration: 10,
        probeVersion: null,
      },
      {
        path: '/long.wav',
        name: 'long.wav',
        duration: 10.001,
        probeVersion: null,
      },
      {
        path: '/done.wav',
        name: 'done.wav',
        duration: 2,
        probeVersion: 'probe-a',
      },
    ]

    expect(
      pendingAnalysisPaths(files, 'probe-a').map((file) => file.path),
    ).toEqual(['/exact.wav', '/long.wav'])
    expect(analysisNotice('/library/tone.wav', 'CNN14 model is missing.')).toBe(
      'Could not analyse tone.wav. CNN14 model is missing.',
    )
  })

  it('queues stored files that lack suggestions for this probe version', () => {
    const folder = mkdtempSync(join(tmpdir(), 'sonoarchive-pending-'))
    const db = openLibrary(join(folder, 'library.db'))
    const tone = join(folder, 'tone.wav')
    const quiet = join(folder, 'quiet.wav')
    const long = join(folder, 'long.wav')
    store(db, tone, 'tone.wav', 2)
    store(db, quiet, 'quiet.wav', 1)
    store(db, long, 'long.wav', 11)
    storeAnalysis(db, tone, {
      ok: true,
      embedding: new Float32Array(2048),
      probeVersion: 'probe-a',
      suggestions,
    })

    const pending = pendingAnalysisPaths(
      listAnalysisCandidates(db),
      'probe-a',
    ).map((file) => file.name)
    expect(pending).toEqual(['long.wav', 'quiet.wav'])
    expect(
      listFiles(db).find((file) => file.name === 'long.wav'),
    ).toMatchObject({ catId: null, suggestions: [] })
    db.close()
  })

  it('writes nothing when analysis fails', () => {
    const folder = mkdtempSync(join(tmpdir(), 'sonoarchive-fail-'))
    const db = openLibrary(join(folder, 'library.db'))
    const tone = join(folder, 'tone.wav')
    store(db, tone, 'tone.wav', 1)

    const wrote = storeAnalysis(db, tone, {
      ok: false,
      message: 'CNN14 model is missing.',
    })

    expect(wrote).toBe(false)
    expect(listFiles(db)).toEqual([
      {
        path: tone,
        name: 'tone.wav',
        format: 'wav',
        duration: 1,
        status: 'untagged',
        catId: null,
        suggestions: [],
        label: null,
      },
    ])
    db.close()
  })

  it('analyses one file at a time', async () => {
    let started = 0
    let releaseFirst: () => void = () => {}
    const gate = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })
    const files = [
      { path: '/a.wav', name: 'a.wav', duration: 1, probeVersion: null },
      { path: '/b.wav', name: 'b.wav', duration: 1, probeVersion: null },
    ]
    const seen: string[] = []
    const done = drainAnalysis(
      files,
      async (file) => {
        started += 1
        seen.push(file.path)
        if (file.path === '/a.wav') await gate
        return { ok: false, message: 'Analysis failed.' }
      },
      () => {},
    )

    expect(started).toBe(1)
    expect(seen).toEqual(['/a.wav'])
    releaseFirst()
    await done
    expect(seen).toEqual(['/a.wav', '/b.wav'])
  })

  it('counts a settled failure and appends a later batch', () => {
    let progress = queueAnalysisBatch({ done: 0, total: 0 }, 2)
    progress = settleAnalysis(progress)
    progress = settleAnalysis(progress)
    expect(progress).toEqual({ done: 2, total: 2 })
    expect(queueAnalysisBatch(progress, 1)).toEqual({ done: 2, total: 3 })
    expect(queueAnalysisBatch({ done: 0, total: 0 }, 0)).toEqual({
      done: 0,
      total: 0,
    })
  })
})

function store(
  db: ReturnType<typeof openLibrary>,
  path: string,
  name: string,
  duration: number,
): void {
  upsertWav(db, {
    path,
    name,
    format: 'wav',
    duration,
    status: 'untagged',
    modifiedTime: 1,
  })
}
