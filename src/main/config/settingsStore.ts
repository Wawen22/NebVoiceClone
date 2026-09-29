import { readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { app } from 'electron'
import { DEFAULT_SETTINGS, GEMINI_PREBUILT_VOICES, type AppSettings, type ReplicatedVoiceRecord } from '../../shared/contracts'
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
  return writeSettings(parseSettings({ ...current, ...validated }))
}

export async function saveReplicatedVoice(record: ReplicatedVoiceRecord): Promise<AppSettings> {
  return writeSettings(parseSettings({ ...(await readSettings()), replicatedVoice: record, geminiVoiceId: record.id }))
}

async function writeSettings(next: AppSettings): Promise<AppSettings> {
  const target = settingsPath()
  const temporary = `${target}.tmp`
  await writeFile(temporary, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 })
  await rename(temporary, target)
  return next
}
