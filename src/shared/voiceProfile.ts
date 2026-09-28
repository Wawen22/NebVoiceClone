import type { ReplicatedVoiceRecord } from './contracts'
import { isReplicatedVoiceId } from './voiceReplication'

export interface VoiceProfile {
  format: 'neb-voice-profile'
  version: 1
  voice: ReplicatedVoiceRecord
}

export function serializeVoiceProfile(voice: ReplicatedVoiceRecord): string {
  return `${JSON.stringify({ format: 'neb-voice-profile', version: 1, voice } satisfies VoiceProfile, null, 2)}\n`
}

export function parseVoiceProfile(value: unknown): ReplicatedVoiceRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('This is not a NEB voice profile.')
  const profile = value as Record<string, unknown>
  if (profile.format !== 'neb-voice-profile' || profile.version !== 1 || typeof profile.voice !== 'object' || profile.voice === null || Array.isArray(profile.voice)) throw new Error('This is not a supported NEB voice profile.')
  const voice = profile.voice as Record<string, unknown>
  if (!isReplicatedVoiceId(voice.id)) throw new Error('The voice profile has an invalid Gemini voice ID.')
  if (typeof voice.displayName !== 'string' || !voice.displayName.trim() || voice.displayName.length > 60) throw new Error('The voice profile has an invalid voice name.')
  if (voice.model !== 'gemini-3.8-flash-tts' && voice.model !== 'gemini-3.8-flash-lite-tts') throw new Error('The voice profile has an unsupported model.')
  if (typeof voice.createdAt !== 'string' || Number.isNaN(Date.parse(voice.createdAt))) throw new Error('The voice profile has an invalid creation date.')
  if (voice.expiresAt !== undefined && (typeof voice.expiresAt !== 'string' || Number.isNaN(Date.parse(voice.expiresAt)))) throw new Error('The voice profile has an invalid expiration date.')
  return {
    id: voice.id,
    displayName: voice.displayName.trim(),
    model: voice.model,
    createdAt: voice.createdAt,
    ...(typeof voice.expiresAt === 'string' ? { expiresAt: voice.expiresAt } : {})
  }
}
