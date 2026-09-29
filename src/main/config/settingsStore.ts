import { readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { app } from 'electron'
import { DEFAULT_SETTINGS, GEMINI_PREBUILT_VOICES, type AppSettings, type GeminiKeySource, type ReplicatedVoiceRecord } from '../../shared/contracts'
import { parseSettings, validateSettingsPatch } from '../../shared/settings'

function settingsPath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

export async function readSettings(): Promise<AppSettings> {
  try {
    return parseSettings(JSON.parse(await readFile(settingsPath(), 'utf8')))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { ...DEFAULT_SETTINGS }
    throw new Error('Could not read local settings. Check the application data folder.', { cause: error })
  }
}

export async function updateSettings(patch: unknown): Promise<AppSettings> {
  const current = await readSettings()
  const validated = validateSettingsPatch(patch)
  if (validated.geminiVoiceId && !GEMINI_PREBUILT_VOICES.some((voice) => voice === validated.geminiVoiceId) && validated.geminiVoiceId !== current.replicatedVoice?.id) throw new Error('Select a voice saved in this application.')
  const voiceProfiles = validated.geminiVoiceId
    ? { ...current.voiceProfiles, [current.geminiKeySource]: { ...current.voiceProfiles[current.geminiKeySource], selectedVoiceId: validated.geminiVoiceId } }
    : current.voiceProfiles
  return writeSettings(parseSettings({ ...current, ...validated, voiceProfiles }))
}

export async function saveReplicatedVoice(record: ReplicatedVoiceRecord, source?: GeminiKeySource): Promise<AppSettings> {
  const current = await readSettings()
  const voiceProfiles = { ...current.voiceProfiles, [source ?? current.geminiKeySource]: { replicatedVoice: record, selectedVoiceId: record.id } }
  return writeSettings(parseSettings({ ...current, voiceProfiles }))
}

export async function setGeminiKeySource(source: GeminiKeySource): Promise<AppSettings> {
  if (source !== 'environment' && source !== 'project' && source !== 'saved') throw new Error('Invalid Gemini key source.')
  return writeSettings(parseSettings({ ...(await readSettings()), geminiKeySource: source }))
}

export async function clearGeminiVoiceProfile(source: GeminiKeySource): Promise<AppSettings> {
  const current = await readSettings()
  const voiceProfiles = { ...current.voiceProfiles, [source]: { replicatedVoice: null, selectedVoiceId: DEFAULT_SETTINGS.geminiVoiceId } }
  return writeSettings(parseSettings({ ...current, voiceProfiles }))
}

async function writeSettings(next: AppSettings): Promise<AppSettings> {
  const target = settingsPath()
  const temporary = `${target}.tmp`
  await writeFile(temporary, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 })
  await rename(temporary, target)
  return next
}
