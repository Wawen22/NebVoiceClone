import { DEFAULT_SETTINGS, FISH_MODELS, GEMINI_MODELS, GEMINI_PREBUILT_VOICES, type AppSettings, type GeminiKeySource, type GeminiVoiceProfiles, type ReplicatedVoiceRecord } from './contracts'
import { parseFishVoiceRecord } from './fishVoice'
import { isReplicatedVoiceId } from './voiceReplication'
import { MAX_SPEECH_STYLE_LENGTH, SPEECH_STYLES } from './speechStyles'

function parseReplicatedVoice(value: unknown): ReplicatedVoiceRecord | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  if (!isReplicatedVoiceId(record.id) || typeof record.displayName !== 'string' || !record.displayName || !GEMINI_MODELS.some((model) => model === record.model) || typeof record.createdAt !== 'string') return null
  return { id: record.id, displayName: record.displayName, model: record.model as ReplicatedVoiceRecord['model'], createdAt: record.createdAt, ...(typeof record.expiresAt === 'string' ? { expiresAt: record.expiresAt } : {}) }
}

export function parseSettings(value: unknown): AppSettings {
  if (typeof value !== 'object' || value === null) return { ...DEFAULT_SETTINGS }
  const candidate = value as Record<string, unknown>
  const geminiKeySource: GeminiKeySource = candidate.geminiKeySource === 'saved' || candidate.geminiKeySource === 'project' ? candidate.geminiKeySource : 'environment'
  const persistedProfiles = typeof candidate.voiceProfiles === 'object' && candidate.voiceProfiles !== null && !Array.isArray(candidate.voiceProfiles) ? candidate.voiceProfiles as Record<string, unknown> : null
  const voiceProfiles = {} as GeminiVoiceProfiles
  for (const source of ['environment', 'project', 'saved'] as const) {
    const raw = persistedProfiles?.[source]
    const profile = typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? raw as Record<string, unknown> : null
    const replicatedVoice = parseReplicatedVoice(profile?.replicatedVoice ?? (!persistedProfiles && source === geminiKeySource ? candidate.replicatedVoice : null))
    const requestedVoiceId = profile?.selectedVoiceId ?? (!persistedProfiles && source === geminiKeySource ? candidate.geminiVoiceId : null)
    const selectedVoiceId = GEMINI_PREBUILT_VOICES.find((voice) => voice === requestedVoiceId)
      ?? (replicatedVoice && replicatedVoice.id === requestedVoiceId ? replicatedVoice.id : DEFAULT_SETTINGS.geminiVoiceId)
    voiceProfiles[source] = { replicatedVoice, selectedVoiceId }
  }
  const { replicatedVoice, selectedVoiceId: geminiVoiceId } = voiceProfiles[geminiKeySource]
  return {
    schemaVersion: 1,
    providerId: candidate.providerId === 'fish-openrouter' ? 'fish-openrouter' : candidate.providerId === 'azure' ? 'azure' : 'gemini',
    fishModel: FISH_MODELS.find(model => model === candidate.fishModel) ?? DEFAULT_SETTINGS.fishModel,
    fishVoice: parseFishVoiceRecord(candidate.fishVoice),
    geminiModel: GEMINI_MODELS.find((model) => model === candidate.geminiModel) ?? DEFAULT_SETTINGS.geminiModel,
    geminiKeySource,
    geminiVoiceId,
    speechStyle: SPEECH_STYLES.find(style => style.id === candidate.speechStyle)?.id ?? DEFAULT_SETTINGS.speechStyle,
    customSpeechStyle: typeof candidate.customSpeechStyle === 'string' && candidate.customSpeechStyle.length <= MAX_SPEECH_STYLE_LENGTH ? candidate.customSpeechStyle : '',
    replicatedVoice,
    voiceProfiles,
    outputDeviceId: typeof candidate.outputDeviceId === 'string' ? candidate.outputDeviceId : 'default',
    outputVolume: typeof candidate.outputVolume === 'number' && candidate.outputVolume >= 0 && candidate.outputVolume <= 1 ? candidate.outputVolume : DEFAULT_SETTINGS.outputVolume,
    monitorDeviceId: typeof candidate.monitorDeviceId === 'string' ? candidate.monitorDeviceId : '',
    saveScriptHistory: candidate.saveScriptHistory === true
  }
}

export function validateSettingsPatch(value: unknown): Partial<AppSettings> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Invalid settings update.')
  const candidate = value as Record<string, unknown>
  const allowed = new Set(['providerId', 'fishModel', 'geminiModel', 'geminiVoiceId', 'speechStyle', 'customSpeechStyle', 'outputDeviceId', 'outputVolume', 'monitorDeviceId', 'saveScriptHistory'])
  for (const [key, entry] of Object.entries(candidate)) {
    if (!allowed.has(key)) throw new Error(`Unsupported setting: ${key}`)
    if (key === 'speechStyle' && !SPEECH_STYLES.some(style => style.id === entry)) throw new Error('Invalid speech style.')
    if (key === 'customSpeechStyle' && (typeof entry !== 'string' || entry.length > MAX_SPEECH_STYLE_LENGTH)) throw new Error('Invalid custom speech style.')
    if (key === 'providerId' && entry !== 'gemini' && entry !== 'azure' && entry !== 'fish-openrouter') throw new Error('Invalid provider.')
    if (key === 'fishModel' && !FISH_MODELS.some(model => model === entry)) throw new Error('Invalid Fish model.')
    if (key === 'geminiModel' && !GEMINI_MODELS.some((model) => model === entry)) throw new Error('Invalid Gemini model.')
    if (key === 'geminiVoiceId' && typeof entry !== 'string') throw new Error('Invalid Gemini voice.')
    if ((key === 'outputDeviceId' || key === 'monitorDeviceId') && typeof entry !== 'string') throw new Error('Invalid audio device.')
    if (key === 'outputVolume' && (typeof entry !== 'number' || !Number.isFinite(entry) || entry < 0 || entry > 1)) throw new Error('Invalid output volume.')
    if (key === 'saveScriptHistory' && typeof entry !== 'boolean') throw new Error('Invalid history setting.')
  }
  return candidate as Partial<AppSettings>
}
