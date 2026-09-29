import { GoogleGenAI } from '@google/genai'
import type { CreateReplicatedVoiceRequest, ProviderStatus, ReplicatedVoiceRecord, StreamedAudioResult, SynthesizedAudio, SynthesisRequest, TtsProvider, VoiceReference } from '../../shared/contracts'
import { buildGeminiTtsRequest } from '../../shared/geminiRequest'
import { isReplicatedVoiceId } from '../../shared/voiceReplication'

export function normalizeGeminiError(error: unknown): Error {
  if (error instanceof Error && error.name === 'AbortError') return new Error('Generation cancelled.')
  if (error instanceof Error && error.message === 'Unexpected audio response') return new Error('Gemini returned no playable WAV audio. Try a shorter script or another voice.')
  const status = typeof error === 'object' && error !== null && 'status' in error ? Number(error.status) : 0
  if (status === 401 || status === 403) return new Error('Gemini rejected the API key or project access. Check the key in Google AI Studio.')
  if (status === 404) return new Error('The selected Gemini TTS model is unavailable for this project.')
  if (status === 429) return new Error('Gemini rate limit reached. Check your project quota and try again shortly.')
  if (status === 400) return new Error('Gemini rejected the speech request. Check the script, model, and voice.')
  return new Error('Gemini could not complete the request. Check your connection and try again.')
}

export function normalizeGeminiVoiceError(error: unknown): Error {
  const status = typeof error === 'object' && error !== null && 'status' in error ? Number(error.status) : 0
  if (status === 500 || status === 502 || status === 503 || status === 504) return new Error(`Google returned HTTP ${status} while creating the voice. The audio passed local format checks, but Google did not explain whether its processing or speaker verification failed. Check the saved voice list before retrying; if this persists, record reference and consent together in the same quiet room.`)
  if (status === 400) return new Error('Google rejected the voice request (HTTP 400). Check that both recordings are clear, from the same speaker, and the consent phrase is exact.')
  if (status === 401 || status === 403) return new Error(`Google denied voice creation (HTTP ${status}). Check the API key and whether this project has access to voice replication.`)
  if (status === 429) return new Error('Google rate limited voice creation (HTTP 429). Check project quota before trying again.')
  if (error && typeof error === 'object' && 'name' in error && typeof error.name === 'string' && /Connection|Timeout|Fetch/i.test(error.name)) return new Error('Network connection failed while creating the voice. Check connectivity and whether a voice was saved before retrying.')
  return normalizeGeminiError(error)
}

export class GeminiTtsProvider implements TtsProvider {
  readonly id = 'gemini'
  readonly displayName = 'Google Gemini'

  private client(): GoogleGenAI {
    const apiKey = process.env.GEMINI_API_KEY?.trim()
    if (!apiKey) throw new Error('Gemini API key is missing. Set GEMINI_API_KEY in your local environment.')
    return new GoogleGenAI({ apiKey })
  }

  async validateConfiguration(): Promise<ProviderStatus> {
    try {
      await this.client().models.get({ model: 'gemini-3.8-flash-tts' })
      return { ready: true, message: 'Gemini connected' }
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Gemini API key is missing')) return { ready: false, message: error.message }
      return { ready: false, message: normalizeGeminiError(error).message }
    }
  }

  async listVoices(): Promise<VoiceReference[]> {
    return [{ mode: 'prebuilt', voiceId: 'Kore' }, { mode: 'prebuilt', voiceId: 'Puck' }]
  }

  async createReplicatedVoice(request: CreateReplicatedVoiceRequest): Promise<ReplicatedVoiceRecord> {
    try {
      const voice = await this.client().voices.create({
        store: true,
        voice: {
          model: 'gemini-3.8-flash-tts',
          type: 'replicated',
          display_name: request.displayName,
          replicated: {
            source_audio: { mime_type: 'audio/wav', data: Buffer.from(request.sourceAudio).toString('base64') },
            consent_audio: { mime_type: 'audio/wav', data: Buffer.from(request.consentAudio).toString('base64') }
          }
        }
      }, { maxRetries: 0, timeout: 120000 })
      if (!isReplicatedVoiceId(voice.id)) throw new Error('Gemini did not return a saved voice ID.')
      return { id: voice.id, displayName: voice.display_name || request.displayName, model: 'gemini-3.8-flash-tts', createdAt: new Date().toISOString(), ...(voice.expire_time ? { expiresAt: voice.expire_time } : {}) }
    } catch (error) {
      if (error instanceof Error && error.message === 'Gemini did not return a saved voice ID.') throw error
      throw normalizeGeminiVoiceError(error)
    }
  }

  async synthesize(request: SynthesisRequest, signal: AbortSignal): Promise<SynthesizedAudio> {
    const client = this.client()
    const started = performance.now()
    try {
      const interaction = await client.interactions.create(buildGeminiTtsRequest(request), { signal })
      if (signal.aborted) throw new DOMException('Generation cancelled', 'AbortError')
      const audio = interaction.output_audio
      if (!audio?.data || audio.mime_type !== 'audio/wav') throw new Error('Unexpected audio response')
      return {
        data: Uint8Array.from(Buffer.from(audio.data, 'base64')),
        mimeType: audio.mime_type,
        generationMs: Math.round(performance.now() - started)
      }
    } catch (error) {
      if (signal.aborted) throw new Error('Generation cancelled.')
      throw normalizeGeminiError(error)
    }
  }

  async synthesizeStream(request: SynthesisRequest, signal: AbortSignal, onChunk: (chunk: Uint8Array) => void): Promise<StreamedAudioResult> {
    const started = performance.now()
    let receivedAudio = false
    try {
      const stream = await this.client().interactions.create({ ...buildGeminiTtsRequest(request), stream: true }, { signal })
      for await (const event of stream) {
        if (signal.aborted) throw new DOMException('Generation cancelled', 'AbortError')
        if (event.event_type === 'error') throw new Error('Gemini stopped the audio stream.')
        if (event.event_type !== 'step.delta' || event.delta.type !== 'audio' || !event.delta.data) continue
        if (event.delta.mime_type && event.delta.mime_type !== 'audio/l16') throw new Error('Unexpected streaming audio format')
        if (event.delta.sample_rate && event.delta.sample_rate !== 24000) throw new Error('Unexpected streaming audio sample rate')
        if (event.delta.channels && event.delta.channels !== 1) throw new Error('Unexpected streaming audio channel count')
        const chunk = Uint8Array.from(Buffer.from(event.delta.data, 'base64'))
        if (chunk.length === 0 || chunk.length % 2 !== 0) throw new Error('Unexpected streaming audio data')
        receivedAudio = true
        onChunk(chunk)
      }
      if (!receivedAudio) throw new Error('Unexpected audio response')
      return { generationMs: Math.round(performance.now() - started) }
    } catch (error) {
      if (signal.aborted) throw new Error('Generation cancelled.')
      throw normalizeGeminiError(error)
    }
  }
}
