import { contextBridge, type IpcRendererEvent, ipcRenderer } from 'electron'
import {
  ipcChannels,
  isImportFolderResult,
  isLibraryFileList,
  isPingSuccess,
  type LibraryFile,
  type SonoarchiveBridge,
} from '../shared/ipc'

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
}

contextBridge.exposeInMainWorld('sonoarchive', api)
