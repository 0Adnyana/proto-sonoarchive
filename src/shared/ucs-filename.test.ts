import { extname } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ucsFilename } from './ucs-filename'

describe('ucs filename', () => {
  it('joins the trimmed fields and keeps the stored extension case', () => {
    expect(
      ucsFilename('/library/door.wav', {
        catId: 'DOORWood',
        fxName: ' Creak ',
        creatorId: ' JS ',
        sourceId: '01',
      }),
    ).toBe('DOORWood_Creak_JS_01.wav')
    expect(
      ucsFilename('/library/door.wav', {
        catId: 'DOORWood',
        fxName: 'Creak',
        creatorId: '',
        sourceId: ' ',
      }),
    ).toBe('DOORWood_Creak__.wav')
    const upper = '/library/door.WAV'
    expect(
      ucsFilename(upper, {
        catId: 'DOORWood',
        fxName: 'Creak',
        creatorId: 'JS',
        sourceId: '01',
      }),
    ).toBe(`DOORWood_Creak_JS_01${extname(upper)}`)
  })
})
