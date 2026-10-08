import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from './contracts'
import { parseSettings, validateSettingsPatch } from './settings'

describe('settings boundary', () => {
  it('persists speaking direction and migrates older settings to the original delivery', () => {
    const patch = validateSettingsPatch({speechStyle: 'social', customSpeechStyle: 'Naturale, senza recitare'})
    const saved = parseSettings({...DEFAULT_SETTINGS, ...patch})
    expect(saved.speechStyle).toBe('social')
    expect(saved.customSpeechStyle).toBe('Naturale, senza recitare')
    expect(parseSettings({}).speechStyle).toBe('original')
    expect(parseSettings({speechStyle: 'unknown', customSpeechStyle: 42}).customSpeechStyle).toBe('')
    expect(parseSettings({speechStyle: 'unknown'}).speechStyle).toBe('original')
  })

  it('rejects invalid direction updates before saving them', () => {
    expect(() => validateSettingsPatch({speechStyle: 'unknown'})).toThrow()
    expect(() => validateSettingsPatch({customSpeechStyle: 42})).toThrow()
    expect(() => validateSettingsPatch({customSpeechStyle: 'x'.repeat(121)})).toThrow()
    expect(parseSettings({customSpeechStyle: 'x'.repeat(121)}).customSpeechStyle).toBe('')
  })
  it('keeps defaults when persisted data is invalid', () => {
    expect(parseSettings({ geminiModel: 'unknown', outputDeviceId: 7 })).toEqual(DEFAULT_SETTINGS)
  })

  it('rejects unknown or malformed IPC patches', () => {
    expect(() => validateSettingsPatch({ secret: 'abc' })).toThrow('Unsupported setting')
    expect(() => validateSettingsPatch({ geminiKeySource: 'saved' })).toThrow('Unsupported setting')
    expect(() => validateSettingsPatch({ outputDeviceId: 44 })).toThrow('Invalid audio device')
  })

  it('round trips supported settings', () => {
    const patch = validateSettingsPatch({ outputDeviceId: 'cable-1', outputVolume: 0.7, geminiModel: 'gemini-3.8-flash-lite-tts' })
    expect(parseSettings({ ...DEFAULT_SETTINGS, ...patch }).outputDeviceId).toBe('cable-1')
    expect(parseSettings({ ...DEFAULT_SETTINGS, ...patch }).outputVolume).toBe(0.7)
  })

  it('keeps the selected key source in settings without storing a key', () => {
    const settings = parseSettings({ ...DEFAULT_SETTINGS, geminiKeySource: 'saved', apiKey: 'not-persisted' })
    expect(settings.geminiKeySource).toBe('saved')
    expect(settings).not.toHaveProperty('apiKey')
    expect(parseSettings({ ...DEFAULT_SETTINGS, geminiKeySource: 'project' }).geminiKeySource).toBe('project')
  })

  it('isolates the selected voice and replicated profile for each key', () => {
    const originalVoice = { id: 'voice_original123', displayName: 'Voce originale', model: 'gemini-3.8-flash-tts', createdAt: '2026-09-01T00:00:00.000Z' }
    const projectVoice = { id: 'voice_project123', displayName: 'Voce nuova', model: 'gemini-3.8-flash-tts', createdAt: '2026-09-02T00:00:00.000Z' }
    const withProfiles = parseSettings({ ...DEFAULT_SETTINGS, voiceProfiles: {
      environment: { replicatedVoice: originalVoice, selectedVoiceId: originalVoice.id },
      project: { replicatedVoice: projectVoice, selectedVoiceId: projectVoice.id },
      saved: { replicatedVoice: null, selectedVoiceId: 'Kore' }
    } })
    expect(withProfiles.replicatedVoice?.id).toBe(originalVoice.id)
    expect(parseSettings({ ...withProfiles, geminiKeySource: 'project' }).replicatedVoice?.id).toBe(projectVoice.id)
    expect(parseSettings({ ...withProfiles, geminiKeySource: 'project' }).geminiVoiceId).toBe(projectVoice.id)
  })

  it('migrates a legacy single voice into its currently selected key profile', () => {
    const voice = { id: 'voice_legacy123', displayName: 'Voce precedente', model: 'gemini-3.8-flash-tts', createdAt: '2026-09-01T00:00:00.000Z' }
    const settings = parseSettings({ ...DEFAULT_SETTINGS, voiceProfiles: undefined, geminiKeySource: 'project', replicatedVoice: voice, geminiVoiceId: voice.id })
    expect(settings.voiceProfiles.project.replicatedVoice?.id).toBe(voice.id)
    expect(settings.voiceProfiles.environment.replicatedVoice).toBeNull()
  })

  it('rejects an output volume outside the safe range', () => {
    expect(() => validateSettingsPatch({ outputVolume: 1.1 })).toThrow('Invalid output volume')
  })
})
