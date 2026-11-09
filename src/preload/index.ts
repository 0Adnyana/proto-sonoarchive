import { contextBridge, type IpcRendererEvent, ipcRenderer } from 'electron'
import {
  type AnalysisProgress,
  ipcChannels,
  isAnalysisProgress,
  isImportFolderResult,
  isLibraryFileList,
  isLibraryNotice,
  isMediaUrl,
  isPingSuccess,
  isUcsEntryList,
  type LibraryFile,
  type SonoarchiveBridge,
} from '../shared/ipc'
import { createNoticeHub } from '../shared/notice-hub'

const notices = createNoticeHub()
let analysisProgress: AnalysisProgress | undefined
let progressListener: ((progress: AnalysisProgress) => void) | undefined

ipcRenderer.on(
  ipcChannels.libraryNotice,
  (_event: IpcRendererEvent, payload: unknown) => {
    if (!isLibraryNotice(payload)) return
    notices.push(payload)
  },
)

ipcRenderer.on(
  ipcChannels.analysisProgress,
  (_event: IpcRendererEvent, payload: unknown) => {
    if (!isAnalysisProgress(payload)) return
    analysisProgress = payload
    progressListener?.(payload)
  },
)

const api: SonoarchiveBridge = {
  ping: async () => {
    const result: unknown = await ipcRenderer.invoke(ipcChannels.ping)
    if (!isPingSuccess(result)) {
      throw new Error('Unexpected ping response')
    }
    return result
  },
  importFolder: async () => {
    const result: unknown = await ipcRenderer.invoke(ipcChannels.importFolder)
    if (result === null) return null
    if (!isImportFolderResult(result)) {
      throw new Error('Unexpected import response')
    }
    return result
  },
  listLibrary: async () => {
    const result: unknown = await ipcRenderer.invoke(ipcChannels.listLibrary)
    if (!isLibraryFileList(result)) {
      throw new Error('Unexpected library response')
    }
    return result
  },
  onLibraryChanged: (listener: (files: LibraryFile[]) => void) => {
    const wrapped = (_event: IpcRendererEvent, payload: unknown) => {
      if (!isLibraryFileList(payload)) return
      listener(payload)
    }
    ipcRenderer.on(ipcChannels.libraryChanged, wrapped)
    return () => {
      ipcRenderer.removeListener(ipcChannels.libraryChanged, wrapped)
    }
  },
  onLibraryNotice: (listener: (message: string) => void) =>
    notices.subscribe(listener),
  onAnalysisProgress: (listener: (progress: AnalysisProgress) => void) => {
    progressListener = listener
    if (analysisProgress) listener(analysisProgress)
    return () => {
      if (progressListener === listener) progressListener = undefined
    }
  },
  listUcs: async () => {
    const result: unknown = await ipcRenderer.invoke(ipcChannels.listUcs)
    if (!isUcsEntryList(result)) {
      throw new Error('Unexpected catalog response')
    }
    return result
  },
  saveLabel: async (input) => {
    await ipcRenderer.invoke(ipcChannels.saveLabel, input)
  },
  mediaUrl: async (filePath) => {
    const result: unknown = await ipcRenderer.invoke(
      ipcChannels.mediaUrl,
      filePath,
    )
    if (!isMediaUrl(result)) {
      throw new Error('Unexpected media response')
    }
    return result
  },
}

contextBridge.exposeInMainWorld('sonoarchive', api)
