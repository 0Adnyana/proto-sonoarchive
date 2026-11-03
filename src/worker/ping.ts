import { isPingRequest, type PingSuccess } from '../shared/ipc'

export function responseForWorkerMessage(
  message: unknown,
): PingSuccess | undefined {
  if (!isPingRequest(message)) return undefined
  return { ok: true }
}
