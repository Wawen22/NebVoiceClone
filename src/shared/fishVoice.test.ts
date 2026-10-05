import { describe, expect, it } from 'vitest'
import { parseFishVoiceImport } from './fishVoice'
import { DEFAULT_SETTINGS } from './contracts'
import { parseSettings, validateSettingsPatch } from './settings'
import { wav, voiceInput } from './fishVoiceFixtures'

describe('Fish references and settings', () => {
  it('keeps Gemini profiles unchanged and defaults Fish to Free', () => {
    const original = parseSettings(DEFAULT_SETTINGS)
    const next = parseSettings({ ...original, providerId: 'fish-openrouter' })
    expect(next.voiceProfiles).toEqual(original.voiceProfiles)
    expect(next.geminiVoiceId).toBe(original.geminiVoiceId)
    expect(next.providerId).toBe('fish-openrouter')
    expect(next.fishModel).toBe('fish-audio/s2.1-pro-free:free')
    expect(next.fishVoice).toBeNull()
    expect(() => validateSettingsPatch({ fishVoice: {} })).toThrow()
    expect(() => validateSettingsPatch({ fishModel: 'unlisted' })).toThrow()
  })
  it('accepts PCM16 mono at the four allowed rates', () => {
    for (const rate of [16000, 24000, 44100, 48000]) {
      const sourceAudio = wav(rate)
      expect(parseFishVoiceImport({ ...voiceInput(), sourceAudio }).sourceAudio).toBe(sourceAudio)
    }
  })
  it('rejects malformed audio, invalid duration, missing consent and invalid metadata', () => {
    const stereo = wav(); new DataView(stereo.buffer).setUint16(22, 2, true)
    const float = wav(); new DataView(float.buffer).setUint16(20, 3, true)
    const chunk = wav(); new DataView(chunk.buffer).setUint32(40, chunk.length, true)
    for (const sourceAudio of [stereo, float, chunk, wav().slice(0, 50), wav(24000, 4.99), wav(24000, 60.01), new Uint8Array(6 * 1024 * 1024 + 1)]) expect(() => parseFishVoiceImport({ ...voiceInput(), sourceAudio })).toThrow()
    for (const patch of [{ consentConfirmed: false }, { displayName: '' }, { transcript: '' }, { transcript: 'a'.repeat(10001) }, { displayName: 'a'.repeat(101) }]) expect(() => parseFishVoiceImport({ ...voiceInput(), ...patch })).toThrow()
  })
  it('accepts bounded extra RIFF chunks', () => {
    const original = wav()
    const extra = new Uint8Array(10); extra.set(new TextEncoder().encode('JUNK')); new DataView(extra.buffer).setUint32(4, 1, true)
    const bytes = new Uint8Array(original.length + extra.length)
    bytes.set(original.subarray(0, 12)); bytes.set(extra, 12); bytes.set(original.subarray(12), 22)
    new DataView(bytes.buffer).setUint32(4, bytes.length - 8, true)
    expect(parseFishVoiceImport({ ...voiceInput(), sourceAudio: bytes }).sourceAudio.length).toBe(bytes.length)
  })
})
