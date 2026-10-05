import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { app, safeStorage } from 'electron'
import type { FishVoiceRecord } from '../../shared/contracts'
import { parseFishVoiceImport, parseFishVoiceRecord } from '../../shared/fishVoice'

const target = (): string => join(app.getPath('userData'), 'fish-voice.json')
let queue: Promise<unknown> = Promise.resolve()
function serialize<T>(operation: () => Promise<T>): Promise<T> {
  const next = queue.then(operation, operation)
  queue = next.catch(() => undefined)
  return next
}
async function secure(): Promise<void> {
  if (!await safeStorage.isAsyncEncryptionAvailable() || (process.platform === 'linux' && safeStorage.getSelectedStorageBackend() === 'basic_text')) throw new Error('Archiviazione cifrata Fish non disponibile.')
}
export function saveFishVoice(value: unknown): Promise<FishVoiceRecord> {
  return serialize(async () => {
    const input = parseFishVoiceImport(value)
    await secure()
    const record = {id: randomUUID(), displayName: input.displayName, createdAt: new Date().toISOString()}
    const temporary = `${target()}.${randomUUID()}.tmp`
    try {
      const encrypted = await safeStorage.encryptStringAsync(JSON.stringify({record, audio: Buffer.from(input.sourceAudio).toString('base64'), transcript: input.transcript, consentConfirmed: true}))
      await mkdir(app.getPath('userData'), {recursive: true})
      await writeFile(temporary, JSON.stringify({version: 1, encrypted: encrypted.toString('base64')}), {mode: 0o600, flag: 'wx'})
      await rename(temporary, target())
      return record
    } catch {
      await unlink(temporary).catch(() => undefined)
      throw new Error('Impossibile salvare il riferimento Fish cifrato.')
    }
  })
}
export function readFishVoice(id: string): Promise<{sourceAudio: Uint8Array; transcript: string}> {
  return serialize(async () => {
    await secure()
    try {
      const envelope = JSON.parse(await readFile(target(), 'utf8'))
      if (envelope.version !== 1 || typeof envelope.encrypted !== 'string') throw new Error()
      const {result} = await safeStorage.decryptStringAsync(Buffer.from(envelope.encrypted, 'base64'))
      const payload = JSON.parse(result)
      const record = parseFishVoiceRecord(payload.record)
      if (!record || record.id !== id || typeof payload.audio !== 'string') throw new Error()
      const input = parseFishVoiceImport({displayName: record.displayName, sourceAudio: Uint8Array.from(Buffer.from(payload.audio, 'base64')), transcript: payload.transcript, consentConfirmed: payload.consentConfirmed})
      return {sourceAudio: input.sourceAudio, transcript: input.transcript}
    } catch { throw new Error('Impossibile leggere il riferimento Fish cifrato.') }
  })
}
export function removeFishVoice(): Promise<void> {
  return serialize(async () => {
    try { await unlink(target()) }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw new Error('Impossibile rimuovere il riferimento Fish.') }
  })
}
