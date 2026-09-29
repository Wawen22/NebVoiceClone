import type { CreateReplicatedVoiceRequest } from './contracts'

export const GEMINI_CONSENT_PHRASE_IT = 'Sono il proprietario di questa voce e acconsento che Google la utilizzi per creare un modello di voce sintetica.'
export const GEMINI_VOICE_REPLICATION_DOCS = 'https://ai.google.dev/gemini-api/docs/voice-replication'
export const MAX_VOICE_AUDIO_BYTES = 4_000_000

export interface WavDetails {
  durationSeconds: number
  sampleRate: number
  channels: number
  bitsPerSample: number
  audioFormat: number
  byteLength: number
}

export function inspectWav(bytes: Uint8Array): WavDetails {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength < 44 || bytes.byteLength > MAX_VOICE_AUDIO_BYTES) throw new Error('Choose a readable WAV file smaller than 4 MB.')
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const tag = (offset: number): string => String.fromCharCode(...bytes.subarray(offset, offset + 4))
  if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') throw new Error('This file is not a RIFF/WAV recording.')
  let offset = 12
  let format: { audioFormat: number; channels: number; sampleRate: number; byteRate: number; bitsPerSample: number } | null = null
  let dataLength = 0
  while (offset + 8 <= bytes.byteLength) {
    const length = view.getUint32(offset + 4, true)
    const end = offset + 8 + length
    if (end > bytes.byteLength) throw new Error('The WAV file is incomplete.')
    if (tag(offset) === 'fmt ' && length >= 16) {
      format = {
        audioFormat: view.getUint16(offset + 8, true),
        channels: view.getUint16(offset + 10, true),
        sampleRate: view.getUint32(offset + 12, true),
        byteRate: view.getUint32(offset + 16, true),
        bitsPerSample: view.getUint16(offset + 22, true)
      }
    }
    if (tag(offset) === 'data') dataLength += length
    offset = end + (length % 2)
  }
  if (!format || !dataLength || !format.byteRate || !format.sampleRate || !format.channels) throw new Error('The WAV recording has no readable audio data.')
  return { durationSeconds: dataLength / format.byteRate, sampleRate: format.sampleRate, channels: format.channels, bitsPerSample: format.bitsPerSample, audioFormat: format.audioFormat, byteLength: bytes.byteLength }
}

export function isGeminiReadyWav(details: WavDetails): boolean {
  return details.audioFormat === 1 && details.channels === 1 && details.sampleRate === 24000 && details.bitsPerSample === 16
}

export function parseCreateReplicatedVoiceRequest(value: unknown): CreateReplicatedVoiceRequest {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Invalid voice creation request.')
  const request = value as Record<string, unknown>
  const name = typeof request.displayName === 'string' ? request.displayName.trim() : ''
  if (!name || name.length > 60) throw new Error('Enter a voice name of up to 60 characters.')
  if (request.consentConfirmed !== true) throw new Error('Confirm that both recordings are your voice and that you consent to voice replication.')
  const sourceAudio = request.sourceAudio
  const consentAudio = request.consentAudio
  if (!(sourceAudio instanceof Uint8Array) || !(consentAudio instanceof Uint8Array)) throw new Error('Choose both voice recordings.')
  const source = inspectWav(sourceAudio)
  const consent = inspectWav(consentAudio)
  if (!isGeminiReadyWav(source) || !isGeminiReadyWav(consent)) throw new Error('Both recordings must be mono, 24 kHz, 16-bit PCM WAV. Convert them locally first.')
  if (source.durationSeconds < 10 || source.durationSeconds > 30) throw new Error('Reference audio must be 10 to 30 seconds long.')
  if (consent.durationSeconds < 1 || consent.durationSeconds > 30) throw new Error('Consent audio must be 1 to 30 seconds long.')
  return { displayName: name, sourceAudio, consentAudio, consentConfirmed: true }
}

export function isReplicatedVoiceId(value: unknown): value is string {
  return typeof value === 'string' && /^voice_[A-Za-z0-9_-]{4,128}$/.test(value)
}
