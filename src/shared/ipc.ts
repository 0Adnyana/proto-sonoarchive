export const ipcChannels = {
  ping: 'app:ping',
} as const

export type PingRequest = {
  type: 'ping'
}

export type PingSuccess = {
  ok: true
}

export type SonoarchiveBridge = {
  ping: () => Promise<PingSuccess>
}

export function isPingRequest(message: unknown): message is PingRequest {
  return isRecord(message) && message.type === 'ping'
}

export function isPingSuccess(message: unknown): message is PingSuccess {
  return isRecord(message) && message.ok === true
}

function isRecord(message: unknown): message is Record<string, unknown> {
  return typeof message === 'object' && message !== null
}
