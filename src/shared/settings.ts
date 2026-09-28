import { DEFAULT_SETTINGS, GEMINI_MODELS, GEMINI_PREBUILT_VOICES, type AppSettings, type ReplicatedVoiceRecord } from './contracts'
import { isReplicatedVoiceId } from './voiceReplication'

function parseReplicatedVoice(value: unknown): ReplicatedVoiceRecord | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  if (!isReplicatedVoiceId(record.id) || typeof record.displayName !== 'string' || !record.displayName || !GEMINI_MODELS.some((model) => model === record.model) || typeof record.createdAt !== 'string') return null
  return { id: record.id, displayName: record.displayName, model: record.model as ReplicatedVoiceRecord['model'], createdAt: record.createdAt, ...(typeof record.expiresAt === 'string' ? { expiresAt: record.expiresAt } : {}) }
}

export function parseSettings(value: unknown): AppSettings {
  if (typeof value !== 'object' || value === null) return { ...DEFAULT_SETTINGS }
  const candidate = value as Record<string, unknown>
  const replicatedVoice = parseReplicatedVoice(candidate.replicatedVoice)
  const geminiVoiceId = GEMINI_PREBUILT_VOICES.find((voice) => voice === candidate.geminiVoiceId)
    ?? (replicatedVoice && replicatedVoice.id === candidate.geminiVoiceId ? replicatedVoice.id : DEFAULT_SETTINGS.geminiVoiceId)
  return {
    schemaVersion: 1,
    providerId: candidate.providerId === 'azure' ? 'azure' : 'gemini',
    geminiModel: GEMINI_MODELS.find((model) => model === candidate.geminiModel) ?? DEFAULT_SETTINGS.geminiModel,
    geminiVoiceId,
    replicatedVoice,
    outputDeviceId: typeof candidate.outputDeviceId === 'string' ? candidate.outputDeviceId : 'default',
    outputVolume: typeof candidate.outputVolume === 'number' && candidate.outputVolume >= 0 && candidate.outputVolume <= 1 ? candidate.outputVolume : DEFAULT_SETTINGS.outputVolume,
    monitorDeviceId: typeof candidate.monitorDeviceId === 'string' ? candidate.monitorDeviceId : '',
    saveScriptHistory: candidate.saveScriptHistory === true
  }
}

export function validateSettingsPatch(value: unknown): Partial<AppSettings> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Invalid settings update.')
  const candidate = value as Record<string, unknown>
  const allowed = new Set(['providerId', 'geminiModel', 'geminiVoiceId', 'outputDeviceId', 'outputVolume', 'monitorDeviceId', 'saveScriptHistory'])
  for (const [key, entry] of Object.entries(candidate)) {
    if (!allowed.has(key)) throw new Error(`Unsupported setting: ${key}`)
    if (key === 'providerId' && entry !== 'gemini' && entry !== 'azure') throw new Error('Invalid provider.')
    if (key === 'geminiModel' && !GEMINI_MODELS.some((model) => model === entry)) throw new Error('Invalid Gemini model.')
    if (key === 'geminiVoiceId' && typeof entry !== 'string') throw new Error('Invalid Gemini voice.')
    if ((key === 'outputDeviceId' || key === 'monitorDeviceId') && typeof entry !== 'string') throw new Error('Invalid audio device.')
    if (key === 'outputVolume' && (typeof entry !== 'number' || !Number.isFinite(entry) || entry < 0 || entry > 1)) throw new Error('Invalid output volume.')
    if (key === 'saveScriptHistory' && typeof entry !== 'boolean') throw new Error('Invalid history setting.')
  }
  return candidate as Partial<AppSettings>
}
