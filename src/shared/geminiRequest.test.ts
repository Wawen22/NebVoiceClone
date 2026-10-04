import { describe, expect, it } from 'vitest'
import { buildGeminiTtsRequest, parseSynthesisRequest } from './geminiRequest'

const request = {
  providerId: 'gemini', modelId: 'gemini-3.8-flash-tts',
  text: '  Hey, could you explain that?\n',
  voice: { mode: 'prebuilt', voiceId: 'Kore' },
  style: 'natural and conversational'
}

describe('Gemini exact script request', () => {
  it('passes the transcript without trimming or rewriting', () => {
    const payload = buildGeminiTtsRequest(parseSynthesisRequest(request))
    expect(payload.input[0].content[0].text).toBe(request.text)
    expect(payload.input[0].content[0].annotations?.[0].style).toBe(request.style)
  })

  it('passes explicit language to Interactions speech_config without changing text', () => {
    const payload = buildGeminiTtsRequest(parseSynthesisRequest({ ...request, language: 'en' }))
    expect(payload.generation_config.speech_config[0].language).toBe('en')
    expect(payload.input[0].content[0].text).toBe(request.text)
    expect(() => parseSynthesisRequest({ ...request, language: 'made-up' })).toThrow('Invalid speech language')
    expect(buildGeminiTtsRequest(parseSynthesisRequest(request)).generation_config.speech_config[0]).not.toHaveProperty('language')
  })

  it('rejects malformed IPC requests before an API call', () => {
    expect(() => parseSynthesisRequest({ ...request, voice: { mode: 'prebuilt', voiceId: 'made-up' } })).toThrow('Invalid Gemini voice')
    expect(() => parseSynthesisRequest({ ...request, text: ' ' })).toThrow('Enter a script')
  })

  it('passes a saved replicated voice ID directly to Gemini', () => {
    const payload = buildGeminiTtsRequest(parseSynthesisRequest({ ...request, voice: { mode: 'stateful', voiceId: 'voice_abc123def456' } }))
    expect(payload.generation_config.speech_config[0].voice).toBe('voice_abc123def456')
  })
})
