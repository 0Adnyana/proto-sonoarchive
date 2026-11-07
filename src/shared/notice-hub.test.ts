import { describe, expect, it } from 'vitest'
import { createNoticeHub } from './notice-hub'

describe('notice hub', () => {
  it('replays notices that arrived before a listener subscribed', () => {
    const hub = createNoticeHub()
    const seen: string[] = []
    hub.push('Could not analyse tone.wav.')

    const unsubscribe = hub.subscribe((message) => {
      seen.push(message)
    })
    hub.push('Could not analyse door.wav.')
    unsubscribe()
    hub.push('Could not analyse later.wav.')

    expect(seen).toEqual([
      'Could not analyse tone.wav.',
      'Could not analyse door.wav.',
    ])

    const replayed: string[] = []
    hub.subscribe((message) => {
      replayed.push(message)
    })
    expect(replayed).toEqual([
      'Could not analyse tone.wav.',
      'Could not analyse door.wav.',
      'Could not analyse later.wav.',
    ])
  })
})
