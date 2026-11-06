import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  type UtilityProcess,
  utilityProcess,
} from 'electron'
import {
  type ImportFolderResult,
  ipcChannels,
  isPingSuccess,
  type LibraryFile,
  type PingSuccess,
} from '../shared/ipc'
import workerPath from '../worker/index?modulePath'
import { type LibraryDatabase, listFiles, openLibrary } from './database'
import { importWavFolder } from './import-wavs'

const UCS_FILE = 'UCS v8.2.1 Full List.xlsx'

const preloadPath = fileURLToPath(
  new URL('../preload/index.mjs', import.meta.url),
)

let worker: UtilityProcess | undefined
let library: LibraryDatabase | undefined
let libraryError: Error | undefined

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
      event.sender.send(ipcChannels.libraryChanged, listFiles(db))
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

void app.whenReady().then(() => {
  worker = startWorker()
  openAppLibrary()
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
