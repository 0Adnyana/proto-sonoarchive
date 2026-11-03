import { contextBridge, ipcRenderer } from 'electron'
import {
  ipcChannels,
  isPingSuccess,
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
}

contextBridge.exposeInMainWorld('sonoarchive', api)
