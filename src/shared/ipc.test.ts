import { describe, expect, it } from 'vitest'
import { ipcChannels, isPingRequest, isPingSuccess } from './ipc'

describe('ipc', () => {
  it('exports the ping channel', () => {
    expect(ipcChannels.ping).toBe('app:ping')
  })

  it('recognises the ping payloads', () => {
    expect(isPingRequest({ type: 'ping' })).toBe(true)
    expect(isPingSuccess({ ok: true })).toBe(true)
    expect(isPingRequest({ ok: true })).toBe(false)
  })
})
