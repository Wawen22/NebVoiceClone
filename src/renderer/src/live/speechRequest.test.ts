import { expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '../../../shared/contracts'
import { parseSynthesisRequest } from '../../../shared/geminiRequest'
import { parseSpeechRequest } from '../../../shared/speechRequest'
import { buildLiveSpeechRequest } from './speechRequest'

it('builds a voice request accepted by the real main-process validator', () => {
  const settings = { ...DEFAULT_SETTINGS, geminiVoiceId: 'voice_nebfixture', replicatedVoice: { id: 'voice_nebfixture', displayName: 'Neb', model: DEFAULT_SETTINGS.geminiModel, createdAt: '2026-10-04T00:00:00Z' } }
  const request = buildLiveSpeechRequest(settings, 'Allora, partirei dal problema concreto.')
  expect(parseSynthesisRequest(request).voice).toEqual({ mode: 'stateful', voiceId: settings.geminiVoiceId })
  expect(request.style!.length).toBeLessThanOrEqual(120)
  expect(parseSynthesisRequest(buildLiveSpeechRequest(DEFAULT_SETTINGS, 'Ciao!')).voice).toEqual({ mode: 'prebuilt', voiceId: 'Kore' })
})

for (const language of ['en', 'it', 'ar', 'auto'] as const) {
  it(`keeps text verbatim and applies ${language} to speech without inherited Italian directions`, () => {
    const text = '  Let me explain this code.\n'
    const request = parseSynthesisRequest(buildLiveSpeechRequest(DEFAULT_SETTINGS, text, language))
    expect(request.text).toBe(text)
    expect(request.language).toBe(language === 'auto' ? undefined : language)
    expect(request.style!.length).toBeLessThanOrEqual(120)
    if (language === 'en') expect(request.style).toContain('English only')
  })
}
it('selects Fish Free in Live while Gemini profiles remain unchanged',()=>{
  const settings={...DEFAULT_SETTINGS,providerId:'fish-openrouter' as const,fishVoice:{id:'12345678-1234-4123-8123-123456789abc',displayName:'Test',createdAt:'2026-10-05T00:00:00Z'}}
  expect(parseSpeechRequest(buildLiveSpeechRequest(settings,'Ciao','it'))).toMatchObject({providerId:'fish-openrouter',modelId:settings.fishModel,language:'it',voice:{mode:'reference',voiceId:settings.fishVoice.id}})
})
