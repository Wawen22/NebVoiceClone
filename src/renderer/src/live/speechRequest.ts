import type { AppSettings, SynthesisRequest } from '../../../shared/contracts'
import type { LiveProfile } from '../../../shared/live'

const styles = {
  en: 'English only. Read the supplied text verbatim; no translation or additions. Natural pace and short pauses.',
  it: 'Solo italiano. Leggi il testo senza tradurlo né aggiungere parole. Ritmo naturale e pause brevi.',
  ar: 'Arabic only. Read the supplied text verbatim; no translation or additions. Natural pace and short pauses.',
  auto: 'Read the supplied text verbatim in its language. No translation or additions. Natural pace and short pauses.'
}

export function buildLiveSpeechRequest(settings: AppSettings, text: string, language: LiveProfile['language'] = 'auto'): SynthesisRequest {
  return { providerId: 'gemini', modelId: settings.geminiModel, text,
    voice: settings.replicatedVoice?.id === settings.geminiVoiceId
      ? { mode: 'stateful', voiceId: settings.geminiVoiceId }
      : { mode: 'prebuilt', voiceId: settings.geminiVoiceId },
    ...(language !== 'auto' ? { language } : {}), style: styles[language] }
}
