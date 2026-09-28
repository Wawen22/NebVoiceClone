import { describe, expect, it } from 'vitest'
import { parseVoiceProfile, serializeVoiceProfile } from './voiceProfile'

const voice = {
  id: 'voice_abc123',
  displayName: 'Voce di Neb',
  model: 'gemini-3.8-flash-tts' as const,
  createdAt: '2026-09-28T20:00:00.000Z'
}

describe('voice profiles', () => {
  it('round trips only the saved voice metadata', () => {
    const exported = JSON.parse(serializeVoiceProfile(voice)) as Record<string, unknown>
    expect(exported).toEqual({ format: 'neb-voice-profile', version: 1, voice })
    expect(parseVoiceProfile(exported)).toEqual(voice)
  })

  it('rejects invalid or unsupported voice profiles', () => {
    expect(() => parseVoiceProfile({ format: 'neb-voice-profile', version: 2, voice })).toThrow('supported')
    expect(() => parseVoiceProfile({ format: 'neb-voice-profile', version: 1, voice: { ...voice, id: 'not-a-gemini-voice' } })).toThrow('voice ID')
  })
})
