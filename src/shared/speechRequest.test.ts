import { expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from './contracts'
import { buildSpeechRequest, parseSpeechRequest } from './speechRequest'
const id = '12345678-1234-4123-8123-123456789abc'
it('builds exact Gemini legacy requests and isolated Fish references', () => {
  expect(buildSpeechRequest(DEFAULT_SETTINGS, 'Hello')).toEqual({providerId:'gemini', modelId:DEFAULT_SETTINGS.geminiModel, text:'Hello', voice:{mode:'prebuilt', voiceId:'Kore'}})
  const settings = {...DEFAULT_SETTINGS, providerId:'fish-openrouter' as const, fishVoice:{id, displayName:'Test', createdAt:'2026-10-05T00:00:00Z'}}
  expect(parseSpeechRequest(buildSpeechRequest(settings, 'Hello')).voice).toEqual({mode:'reference', voiceId:id})
  expect(() => buildSpeechRequest({...settings, fishVoice:null}, 'Hello')).toThrow(/Fish/)
  for (const patch of [{modelId:'bad'}, {text:'a'.repeat(10001)}, {voice:{mode:'prebuilt', voiceId:'Kore'}}, {providerId:'azure'}, {language:'bad'}]) expect(() => parseSpeechRequest({...buildSpeechRequest(settings,'Hello'), ...patch})).toThrow()
})
