import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { app, safeStorage } from 'electron'
import type { GeminiKeyStatus, SaveGeminiKeyRequest } from '../../shared/contracts'
import { readSettings } from './settingsStore'

interface SavedKeyRecord {
  version: 1
  label: string
  encrypted: string
}

function keyPath(): string {
  return join(app.getPath('userData'), 'gemini-key.json')
}

async function secureStorageAvailable(): Promise<boolean> {
  if (!await safeStorage.isAsyncEncryptionAvailable()) return false
  return process.platform !== 'linux' || safeStorage.getSelectedStorageBackend() !== 'basic_text'
}

async function readSavedRecord(): Promise<SavedKeyRecord | null> {
  let value: unknown
  try {
    value = JSON.parse(await readFile(keyPath(), 'utf8'))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw new Error('La chiave Gemini salvata non può essere letta.', { cause: error })
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Il file della chiave Gemini non è valido.')
  const record = value as Record<string, unknown>
  if (record.version !== 1 || typeof record.label !== 'string' || !record.label.trim() || typeof record.encrypted !== 'string' || !record.encrypted) throw new Error('Il file della chiave Gemini non è valido.')
  return { version: 1, label: record.label, encrypted: record.encrypted }
}

export async function getGeminiKeyStatus(): Promise<GeminiKeyStatus> {
  const [settings, saved, available] = await Promise.all([readSettings(), readSavedRecord(), secureStorageAvailable()])
  return {
    activeSource: settings.geminiKeySource,
    environmentConfigured: Boolean(process.env.GEMINI_API_KEY?.trim()),
    projectConfigured: Boolean(process.env.GEMINI_API_KEY_NEBVOICCLONE?.trim()),
    environmentLabel: process.env.NEB_GEMINI_LABEL_ORIGINAL?.trim().slice(0, 80) || 'Chiave originale',
    projectLabel: process.env.NEB_GEMINI_LABEL_PROJECT?.trim().slice(0, 80) || 'NebVoicClone',
    savedLabel: saved?.label ?? null,
    secureStorageAvailable: available
  }
}

export async function saveGeminiKey(value: unknown): Promise<GeminiKeyStatus> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Dati della chiave Gemini non validi.')
  const request = value as Partial<SaveGeminiKeyRequest>
  const label = typeof request.label === 'string' ? request.label.trim() : ''
  const key = typeof request.apiKey === 'string' ? request.apiKey.trim() : ''
  if (!label || label.length > 40 || [...label].some((character) => character.charCodeAt(0) < 32)) throw new Error('Inserisci un nome di massimo 40 caratteri.')
  if (key.length < 10 || key.length > 1024 || /\s/.test(key)) throw new Error('Inserisci una chiave API valida, senza spazi.')
  if (!await secureStorageAvailable()) throw new Error('L’archiviazione cifrata non è disponibile su questo sistema.')

  let encrypted: Buffer
  try {
    encrypted = await safeStorage.encryptStringAsync(key)
  } catch {
    throw new Error('Impossibile cifrare la chiave Gemini su questo sistema.')
  }
  const target = keyPath()
  const temporary = `${target}.${randomUUID()}.tmp`
  await mkdir(app.getPath('userData'), { recursive: true })
  try {
    await writeFile(temporary, JSON.stringify({ version: 1, label, encrypted: encrypted.toString('base64') } satisfies SavedKeyRecord), { mode: 0o600, flag: 'wx' })
    await rename(temporary, target)
  } catch {
    await unlink(temporary).catch(() => undefined)
    throw new Error('Impossibile salvare la chiave Gemini cifrata.')
  }
  return getGeminiKeyStatus()
}

export async function removeSavedGeminiKey(): Promise<void> {
  try {
    await unlink(keyPath())
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw new Error('Impossibile rimuovere la chiave Gemini salvata.', { cause: error })
  }
}

export async function resolveGeminiApiKey(): Promise<string> {
  const settings = await readSettings()
  if (settings.geminiKeySource === 'environment') {
    const key = process.env.GEMINI_API_KEY?.trim()
    if (!key) throw new Error('Gemini API key is missing. Set GEMINI_API_KEY in your local environment.')
    return key
  }
  if (settings.geminiKeySource === 'project') {
    const key = process.env.GEMINI_API_KEY_NEBVOICCLONE?.trim()
    if (!key) throw new Error('La seconda chiave Gemini non è configurata in questo ambiente.')
    return key
  }
  const saved = await readSavedRecord()
  if (!saved) throw new Error('La chiave Gemini aggiuntiva non è stata ancora salvata.')
  if (!await secureStorageAvailable()) throw new Error('L’archiviazione cifrata non è disponibile su questo sistema.')
  try {
    const { result } = await safeStorage.decryptStringAsync(Buffer.from(saved.encrypted, 'base64'))
    if (!result) throw new Error('Empty Gemini key')
    return result
  } catch {
    throw new Error('La chiave Gemini salvata non può essere decifrata su questo computer.')
  }
}
