import { expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from './contracts'
import { buildSpeechRequest, parseSpeechRequest } from './speechRequest'
import { buildGeminiTtsRequest } from './geminiRequest'
const id = '12345678-1234-4123-8123-123456789abc'
it('builds exact Gemini legacy requests and isolated Fish references', () => {
  expect(buildSpeechRequest(DEFAULT_SETTINGS, 'Hello')).toEqual({providerId:'gemini', modelId:DEFAULT_SETTINGS.geminiModel, text:'Hello', voice:{mode:'prebuilt', voiceId:'Kore'}})
  const settings = {...DEFAULT_SETTINGS, providerId:'fish-openrouter' as const, fishVoice:{id, displayName:'Test', createdAt:'2026-10-05T00:00:00Z'}}
  expect(parseSpeechRequest(buildSpeechRequest(settings, 'Hello')).voice).toEqual({mode:'reference', voiceId:id})
  expect(() => buildSpeechRequest({...settings, fishVoice:null}, 'Hello')).toThrow(/Fish/)
  for (const patch of [{modelId:'bad'}, {text:'a'.repeat(10001)}, {voice:{mode:'prebuilt', voiceId:'Kore'}}, {providerId:'azure'}, {language:'bad'}]) expect(() => parseSpeechRequest({...buildSpeechRequest(settings,'Hello'), ...patch})).toThrow()
})

it('sends Reel direction as metadata while preserving the script, cloned voice and language', () => {
  const settings = {...DEFAULT_SETTINGS, speechStyle: 'social' as const, geminiVoiceId: 'voice_abc123def456', replicatedVoice: {id: 'voice_abc123def456', displayName: 'Neb', model: DEFAULT_SETTINGS.geminiModel, createdAt: '2026-10-08'}}
  const text = '  Ciao!\nTi racconto una cosa.'
  const payload = buildGeminiTtsRequest(buildSpeechRequest(settings, text, 'it'))
  expect(payload.input[0].content[0].text).toBe(text)
  expect(payload.input[0].content[0].annotations?.[0].style).toMatch(/friend/i)
  expect(payload.input[0].content[0].annotations?.[0].style).toMatch(/no acting/i)
  expect(payload.generation_config.speech_config[0]).toEqual({voice: 'voice_abc123def456', language: 'it'})
})

it('uses custom direction only when selected and omits blank direction', () => {
  expect(buildSpeechRequest({...DEFAULT_SETTINGS, speechStyle: 'custom', customSpeechStyle: '  Warm and relaxed  '}, 'Ciao').style).toBe('Warm and relaxed')
  expect(buildSpeechRequest({...DEFAULT_SETTINGS, speechStyle: 'custom', customSpeechStyle: '  '}, 'Ciao')).not.toHaveProperty('style')
  expect(buildSpeechRequest({...DEFAULT_SETTINGS, customSpeechStyle: 'Do not use this'}, 'Ciao')).not.toHaveProperty('style')
})

it('does not send Gemini style metadata to Fish', () => {
  const settings = {...DEFAULT_SETTINGS, providerId: 'fish-openrouter' as const, speechStyle: 'social' as const, fishVoice: {id, displayName: 'Test', createdAt: '2026-10-08'}}
  expect(buildSpeechRequest(settings, 'Ciao')).not.toHaveProperty('style')
})
