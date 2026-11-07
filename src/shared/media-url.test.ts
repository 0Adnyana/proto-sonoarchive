import { describe, expect, it } from 'vitest'
import { filePathFromMediaUrl, mediaUrlFor } from './media-url'

describe('media url', () => {
  it('round-trips a stored path', () => {
    const filePath = '/Users/a b/tone.wav'
    const url = mediaUrlFor(filePath)
    expect(url.startsWith('sonoarchive://media/')).toBe(true)
    expect(filePathFromMediaUrl(url)).toBe(filePath)
  })

  it('ignores a url that is not a stored media path', () => {
    expect(filePathFromMediaUrl('https://example.com/tone.wav')).toBeUndefined()
    expect(filePathFromMediaUrl('sonoarchive://other/tone.wav')).toBeUndefined()
    expect(filePathFromMediaUrl('sonoarchive://media/')).toBeUndefined()
    expect(filePathFromMediaUrl('not a url')).toBeUndefined()
  })
})
