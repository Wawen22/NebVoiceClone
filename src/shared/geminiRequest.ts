import { GEMINI_MODELS, GEMINI_PREBUILT_VOICES, type SynthesisRequest } from './contracts'
import { isReplicatedVoiceId } from './voiceReplication'

export function parseSynthesisRequest(value: unknown): SynthesisRequest {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Invalid speech request.')
  const request = value as Record<string, unknown>
  if (request.providerId !== 'gemini') throw new Error('This provider is not available yet.')
  if (!GEMINI_MODELS.some((model) => model === request.modelId)) throw new Error('Invalid Gemini model.')
  if (typeof request.text !== 'string' || !request.text.trim() || request.text.length > 12000) throw new Error('Enter a script of up to 12,000 characters.')
  if (typeof request.voice !== 'object' || request.voice === null) throw new Error('Select a voice.')
  const voice = request.voice as Record<string, unknown>
  if (voice.mode === 'prebuilt') {
    if (!GEMINI_PREBUILT_VOICES.some((id) => id === voice.voiceId)) throw new Error('Invalid Gemini voice.')
  } else if (voice.mode === 'stateful') {
    if (!isReplicatedVoiceId(voice.voiceId)) throw new Error('Invalid Gemini voice.')
  } else throw new Error('Invalid Gemini voice.')
  if (request.style !== undefined && (typeof request.style !== 'string' || request.style.length > 120)) throw new Error('Invalid speech style.')
  return request as unknown as SynthesisRequest
}

export function buildGeminiTtsRequest(request: SynthesisRequest) {
  const valid = parseSynthesisRequest(request)
  const voice = valid.voice as { mode: 'prebuilt' | 'stateful'; voiceId: string }
  return {
    model: valid.modelId,
    input: [{
      type: 'user_input' as const,
      content: [{
        type: 'text' as const,
        text: valid.text,
        ...(valid.style ? { annotations: [{ type: 'speech_metadata' as const, style: valid.style }] } : {})
      }]
    }],
    response_format: { type: 'audio' as const },
    generation_config: { speech_config: [{ voice: voice.voiceId }] }
  }
}
