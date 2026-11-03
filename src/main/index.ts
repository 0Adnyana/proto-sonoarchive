import { fileURLToPath } from 'node:url'
import {
  app,
  BrowserWindow,
  ipcMain,
  type UtilityProcess,
  utilityProcess,
} from 'electron'
import { ipcChannels, isPingSuccess, type PingSuccess } from '../shared/ipc'
import workerPath from '../worker/index?modulePath'

const preloadPath = fileURLToPath(
  new URL('../preload/index.mjs', import.meta.url),
)

let worker: UtilityProcess | undefined

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
})
