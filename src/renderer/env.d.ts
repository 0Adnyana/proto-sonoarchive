/// <reference types="vite/client" />

import type { SonoarchiveBridge } from '../shared/ipc'

declare global {
  interface Window {
    sonoarchive: SonoarchiveBridge
  }
}
