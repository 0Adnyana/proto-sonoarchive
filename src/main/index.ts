import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  net,
  protocol,
  type UtilityProcess,
  utilityProcess,
} from 'electron'
import {
  type AnalysisPayload,
  type ImportFolderResult,
  ipcChannels,
  isPingSuccess,
  isSaveLabelInput,
  type LibraryFile,
  type PingSuccess,
  readAnalyseMessage,
} from '../shared/ipc'
import { filePathFromMediaUrl, mediaUrlFor } from '../shared/media-url'
import workerPath from '../worker/index?modulePath'
import {
  ANALYSIS_TIMEOUT_MS,
  analysisNotice,
  CNN14_FILENAME,
  drainAnalysis,
  PROBE_FILENAME,
  pendingAnalysisPaths,
  readProbeVersion,
  resolveBundledFile,
  storeAnalysis,
} from './analysis'
import {
  hasStoredFile,
  type LibraryDatabase,
  listAnalysisCandidates,
  listFiles,
  listUcs,
  openLibrary,
  saveLabel,
} from './database'
import { importWavFolder } from './import-wavs'

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'sonoarchive',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      corsEnabled: true,
    },
  },
])

const UCS_FILE = 'UCS v8.2.1 Full List.xlsx'

const preloadPath = fileURLToPath(
  new URL('../preload/index.mjs', import.meta.url),
)

let worker: UtilityProcess | undefined
let library: LibraryDatabase | undefined
let libraryError: Error | undefined
let analysisId = 0
let analysisTail: Promise<void> = Promise.resolve()
const analysisQueued = new Set<string>()
const analysisWaiters = new Map<
  number,
  {
    filePath: string
    resolve: (value: AnalysisPayload) => void
    timer: ReturnType<typeof setTimeout>
  }
>()

function resolveModelPath(): string {
  return resolveBundledFile(CNN14_FILENAME, app.getAppPath(), process.cwd())
}

function resolveProbePath(): string {
  return resolveBundledFile(PROBE_FILENAME, app.getAppPath(), process.cwd())
}

function ucsWorkbookPath(): string | undefined {
  const candidates = [
    join(app.getAppPath(), 'fixtures', UCS_FILE),
    join(process.cwd(), 'fixtures', UCS_FILE),
  ]
  return candidates.find((candidate) => existsSync(candidate))
}

function openAppLibrary(): void {
  try {
    library = openLibrary(
      join(app.getPath('userData'), 'library.db'),
      ucsWorkbookPath(),
    )
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'unknown error'
    libraryError = new Error(`Could not open the library. ${detail}`)
    console.error(libraryError)
  }
}

function requireLibrary(): LibraryDatabase {
  if (!library) {
    throw libraryError ?? new Error('Could not open the library.')
  }
  return library
}

function registerLibraryHandlers(): void {
  ipcMain.handle(ipcChannels.listLibrary, (): LibraryFile[] => {
    return listFiles(requireLibrary())
  })

  ipcMain.handle(ipcChannels.listUcs, () => {
    return listUcs(requireLibrary())
  })

  ipcMain.handle(ipcChannels.saveLabel, (_event, payload: unknown) => {
    if (!isSaveLabelInput(payload)) {
      throw new Error('Could not save the label.')
    }
    saveLabel(requireLibrary(), payload)
    broadcastLibrary()
  })

  ipcMain.handle(ipcChannels.mediaUrl, (_event, filePath: unknown) => {
    if (typeof filePath !== 'string' || filePath.length === 0) {
      throw new Error('Unknown file')
    }
    if (!hasStoredFile(requireLibrary(), filePath)) {
      throw new Error('Unknown file')
    }
    return mediaUrlFor(filePath)
  })

  ipcMain.handle(
    ipcChannels.importFolder,
    async (event): Promise<ImportFolderResult | null> => {
      const db = requireLibrary()
      const parent = BrowserWindow.fromWebContents(event.sender)
      const picked = parent
        ? await dialog.showOpenDialog(parent, {
            properties: ['openDirectory'],
          })
        : await dialog.showOpenDialog({ properties: ['openDirectory'] })
      const folder = picked.filePaths[0]
      if (picked.canceled || !folder) return null
      const result = await importWavFolder(db, folder)
      broadcastLibrary()
      enqueuePendingAnalysis()
      return { stored: result.stored, failed: result.failed }
    },
  )
}

function createWindow(): void {
  const window = new BrowserWindow({
    width: 960,
    height: 640,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      // ESM preload files cannot run inside the sandbox. contextIsolation still
      // keeps Node out of the renderer; the preload is the only bridge.
      sandbox: false,
    },
  })

  window.webContents.on('did-finish-load', () => {
    enqueuePendingAnalysis()
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL)
    return
  }

  void window.loadFile(
    fileURLToPath(new URL('../renderer/index.html', import.meta.url)),
  )
}

function startWorker(): UtilityProcess {
  const child = utilityProcess.fork(workerPath)
  const pending: Array<(value: PingSuccess) => void> = []

  child.on('message', (message: unknown) => {
    const analysed = readAnalyseMessage(message)
    if (analysed) {
      const waiter = analysisWaiters.get(analysed.id)
      if (!waiter || waiter.filePath !== analysed.filePath) return
      clearTimeout(waiter.timer)
      analysisWaiters.delete(analysed.id)
      waiter.resolve(analysed.result)
      return
    }
    if (!isPingSuccess(message)) return
    pending.shift()?.(message)
  })

  const ping = (): Promise<PingSuccess> =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Worker ping timed out'))
      }, 5000)
      pending.push((value) => {
        clearTimeout(timer)
        resolve(value)
      })
      child.postMessage({ type: 'ping' })
    })

  ipcMain.handle(ipcChannels.ping, () => ping())
  void ping().catch((error: unknown) => {
    console.error(error)
  })

  return child
}

function registerMediaScheme(): void {
  protocol.handle('sonoarchive', (request) => {
    const filePath = filePathFromMediaUrl(request.url)
    if (!filePath || !library || !hasStoredFile(library, filePath)) {
      return new Response(null, { status: 404 })
    }
    return net.fetch(pathToFileURL(filePath).href)
  })
}

function broadcastLibrary(): void {
  if (!library) return
  const files = listFiles(library)
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(ipcChannels.libraryChanged, files)
  }
}

function broadcastNotice(message: string): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(ipcChannels.libraryNotice, message)
  }
}

function requestAnalysis(filePath: string): Promise<AnalysisPayload> {
  const child = worker
  if (!child) return Promise.resolve({ ok: false, message: 'Analysis failed.' })
  const id = analysisId + 1
  analysisId = id
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      analysisWaiters.delete(id)
      resolve({ ok: false, message: 'Analysis failed.' })
    }, ANALYSIS_TIMEOUT_MS)
    analysisWaiters.set(id, { filePath, resolve, timer })
    child.postMessage({
      type: 'analyse',
      id,
      filePath,
      modelPath: resolveModelPath(),
      probePath: resolveProbePath(),
    })
  })
}

function enqueuePendingAnalysis(): void {
  if (!library) return
  const db = library
  const pending = pendingAnalysisPaths(
    listAnalysisCandidates(db),
    readProbeVersion(resolveProbePath()),
  ).filter((file) => !analysisQueued.has(file.path))
  if (pending.length === 0) return
  for (const file of pending) analysisQueued.add(file.path)
  analysisTail = analysisTail
    .then(() =>
      drainAnalysis(
        pending,
        (file) =>
          requestAnalysis(file.path).catch((error: unknown) => {
            console.error(error)
            return { ok: false, message: 'Analysis failed.' }
          }),
        (file, result) => {
          analysisQueued.delete(file.path)
          if (!library) return
          try {
            if (!storeAnalysis(library, file.path, result)) {
              broadcastNotice(analysisNotice(file.path, result.message))
              return
            }
            broadcastLibrary()
          } catch (error) {
            console.error(error)
            broadcastNotice(analysisNotice(file.path, 'Analysis failed.'))
          }
        },
      ),
    )
    .catch((error: unknown) => {
      console.error(error)
    })
}

void app.whenReady().then(() => {
  worker = startWorker()
  openAppLibrary()
  registerMediaScheme()
  registerLibraryHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  worker?.kill()
  library?.close()
})
