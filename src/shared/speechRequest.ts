import { FISH_MODELS, type AppSettings, type SynthesisRequest } from './contracts'
import { parseSynthesisRequest } from './geminiRequest'
import { isFishVoiceId } from './fishVoice'
import { SPEECH_STYLES } from './speechStyles'

export function parseSpeechRequest(value: unknown): SynthesisRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Richiesta vocale non valida.')
  const request = value as Record<string, unknown>
  if (request.providerId !== 'fish-openrouter') return parseSynthesisRequest(value)
  if (!FISH_MODELS.some(model => model === request.modelId)) throw new Error('Modello Fish non valido.')
  if (typeof request.text !== 'string' || !request.text.trim() || request.text.length > 10000) throw new Error('Fish: inserisci fino a 10.000 caratteri.')
  const voice = request.voice as Record<string, unknown> | null
  if (!voice || voice.mode !== 'reference' || !isFishVoiceId(voice.voiceId)) throw new Error('Seleziona un riferimento Fish salvato.')
  if (request.language !== undefined && !['en','it','ar'].includes(request.language as string)) throw new Error('Lingua vocale non valida.')
  if (request.style !== undefined && (typeof request.style !== 'string' || request.style.length > 120)) throw new Error('Stile vocale non valido.')
  return {providerId:'fish-openrouter', modelId:request.modelId as string, text:request.text.trim(), voice:{mode:'reference', voiceId:voice.voiceId}, ...(request.language ? {language:request.language as SynthesisRequest['language']} : {})}
}
export function buildSpeechRequest(settings: AppSettings, text: string, language?: SynthesisRequest['language']): SynthesisRequest {
  if (settings.providerId === 'fish-openrouter') {
    if (!settings.fishVoice) throw new Error('Importa prima il riferimento vocale Fish nelle Impostazioni.')
    return {providerId:'fish-openrouter',modelId:settings.fishModel,text,voice:{mode:'reference',voiceId:settings.fishVoice.id},...(language ? {language} : {})}
  }
  if (settings.providerId !== 'gemini') throw new Error('Provider vocale non disponibile.')
  const style = settings.speechStyle === 'custom' ? settings.customSpeechStyle.trim() : SPEECH_STYLES.find(preset => preset.id === settings.speechStyle)?.direction
  return {providerId:'gemini',modelId:settings.geminiModel,text,voice:settings.replicatedVoice?.id === settings.geminiVoiceId ? {mode:'stateful',voiceId:settings.geminiVoiceId} : {mode:'prebuilt',voiceId:settings.geminiVoiceId},...(language ? {language} : {}),...(style ? {style} : {})}
}
export function speechVoiceLabel(settings: AppSettings): string {
  return settings.providerId === 'fish-openrouter' ? settings.fishVoice?.displayName ?? 'Profilo Fish mancante' : settings.replicatedVoice?.id === settings.geminiVoiceId ? settings.replicatedVoice.displayName : settings.geminiVoiceId
}
