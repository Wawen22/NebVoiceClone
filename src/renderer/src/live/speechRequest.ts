import type { AppSettings, SynthesisRequest } from '../../../shared/contracts'

export function buildLiveSpeechRequest(settings: AppSettings, text: string): SynthesisRequest {
  return { providerId: 'gemini', modelId: settings.geminiModel, text,
    voice: settings.replicatedVoice?.id === settings.geminiVoiceId
      ? { mode: 'stateful', voiceId: settings.geminiVoiceId }
      : { mode: 'prebuilt', voiceId: settings.geminiVoiceId },
    style: 'Parlato spontaneo, competente e accessibile. Ritmo dinamico, pause brevi e naturali secondo il senso.' }
}
