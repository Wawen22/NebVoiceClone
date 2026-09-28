import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from './contracts'
import { parseSettings, validateSettingsPatch } from './settings'

describe('settings boundary', () => {
  it('keeps defaults when persisted data is invalid', () => {
    expect(parseSettings({ geminiModel: 'unknown', outputDeviceId: 7 })).toEqual(DEFAULT_SETTINGS)
  })

  it('rejects unknown or malformed IPC patches', () => {
    expect(() => validateSettingsPatch({ secret: 'abc' })).toThrow('Unsupported setting')
    expect(() => validateSettingsPatch({ outputDeviceId: 44 })).toThrow('Invalid audio device')
  })

  it('round trips supported settings', () => {
    const patch = validateSettingsPatch({ outputDeviceId: 'cable-1', outputVolume: 0.7, geminiModel: 'gemini-3.8-flash-lite-tts' })
    expect(parseSettings({ ...DEFAULT_SETTINGS, ...patch }).outputDeviceId).toBe('cable-1')
    expect(parseSettings({ ...DEFAULT_SETTINGS, ...patch }).outputVolume).toBe(0.7)
  })

  it('rejects an output volume outside the safe range', () => {
    expect(() => validateSettingsPatch({ outputVolume: 1.1 })).toThrow('Invalid output volume')
  })
})
