import type { FishVoiceImport, FishVoiceRecord } from './contracts'

export const MAX_FISH_AUDIO_BYTES = 6 * 1024 * 1024
export const isFishVoiceId = (id: unknown): id is string => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)

export function parseFishVoiceRecord(value: unknown): FishVoiceRecord | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  return isFishVoiceId(record.id) && typeof record.displayName === 'string' && record.displayName.trim().length > 0 && record.displayName.length <= 100 && typeof record.createdAt === 'string' && Number.isFinite(Date.parse(record.createdAt))
    ? { id: record.id, displayName: record.displayName, createdAt: record.createdAt } : null
}

export function validateFishWav(bytes: Uint8Array): void {
  const invalid = (): never => { throw new Error('WAV Fish non valido: serve PCM 16-bit mono, 16/24/44.1/48 kHz, 5-60 secondi, massimo 6 MiB.') }
  if (!(bytes instanceof Uint8Array) || bytes.length < 44 || bytes.length > MAX_FISH_AUDIO_BYTES) invalid()
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const tag = (at: number): string => String.fromCharCode(...bytes.subarray(at, at + 4))
  if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE' || view.getUint32(4, true) + 8 !== bytes.length) invalid()
  let rate = 0, dataSize: number | null = null, offset = 12
  while (offset + 8 <= bytes.length) {
    const kind = tag(offset), size = view.getUint32(offset + 4, true), start = offset + 8
    if (start + size > bytes.length) invalid()
    if (kind === 'fmt ') {
      if (rate || size < 16) invalid()
      rate = view.getUint32(start + 4, true)
      if (view.getUint16(start, true) !== 1 || view.getUint16(start + 2, true) !== 1 || ![16000, 24000, 44100, 48000].includes(rate) || view.getUint32(start + 8, true) !== rate * 2 || view.getUint16(start + 12, true) !== 2 || view.getUint16(start + 14, true) !== 16) invalid()
    } else if (kind === 'data') {
      if (dataSize !== null || !size || size % 2) invalid()
      dataSize = size
    }
    offset = start + size + size % 2
  }
  if (offset !== bytes.length || !rate || dataSize === null || dataSize / (rate * 2) < 5 || dataSize / (rate * 2) > 60) invalid()
}

export function parseFishVoiceImport(value: unknown): FishVoiceImport & { consentConfirmed: true } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Profilo Fish non valido.')
  const input = value as Record<string, unknown>
  if (input.consentConfirmed !== true) throw new Error('Conferma il consenso all\'invio a OpenRouter/Fish.')
  if (typeof input.displayName !== 'string' || !input.displayName.trim() || input.displayName.length > 100 || /[\x00-\x1f]/.test(input.displayName)) throw new Error('Inserisci un nome di massimo 100 caratteri.')
  if (typeof input.transcript !== 'string' || !input.transcript.trim() || input.transcript.length > 10000) throw new Error('Inserisci la trascrizione esatta, massimo 10.000 caratteri.')
  validateFishWav(input.sourceAudio as Uint8Array)
  return {displayName: input.displayName.trim(), transcript: input.transcript.trim(), sourceAudio: input.sourceAudio as Uint8Array, consentConfirmed: true}
}
