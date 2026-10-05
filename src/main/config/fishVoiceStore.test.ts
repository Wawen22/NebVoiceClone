import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { voiceInput } from '../../shared/fishVoiceFixtures'

const state = vi.hoisted(() => ({ dir: '', available: true, failDecrypt: false }))
vi.mock('electron', () => ({ app: { getPath: () => state.dir }, safeStorage: {
  isAsyncEncryptionAvailable: async () => state.available,
  getSelectedStorageBackend: () => 'gnome_libsecret',
  encryptStringAsync: async (text: string) => Buffer.from(text).map(b => b ^ 123),
  decryptStringAsync: async (bytes: Buffer) => { if (state.failDecrypt) throw Error('private details'); return {result: bytes.map(b => b ^ 123).toString(), shouldReEncrypt: false} }
} }))
import { saveFishVoice, readFishVoice, removeFishVoice } from './fishVoiceStore'
beforeEach(async () => { state.dir = await mkdtemp(join(tmpdir(), 'neb-fish-')); state.available = true; state.failDecrypt = false })
afterEach(async () => { await rm(state.dir, {recursive: true, force: true}) })
it('stores encrypted audio and transcript, resolves only the current ID and removes idempotently', async () => {
  const input = voiceInput(), record = await saveFishVoice(input)
  const file = await readFile(join(state.dir, 'fish-voice.json'), 'utf8')
  expect(file).not.toContain(input.transcript)
  expect(file).not.toContain(Buffer.from(input.sourceAudio).toString('base64'))
  const restored = await readFishVoice(record.id)
  expect(restored.transcript).toBe(input.transcript)
  expect(Buffer.from(restored.sourceAudio).equals(Buffer.from(input.sourceAudio))).toBe(true)
  await expect(readFishVoice('other')).rejects.toThrow()
  await removeFishVoice(); await removeFishVoice()
  await expect(readFishVoice(record.id)).rejects.toThrow()
})
it('fails closed when encryption is unavailable and redacts decryption errors', async () => {
  state.available = false
  await expect(saveFishVoice(voiceInput())).rejects.toThrow(/cifrata/)
  await expect(readFile(join(state.dir, 'fish-voice.json'))).rejects.toMatchObject({code:'ENOENT'})
  state.available = true
  const record = await saveFishVoice(voiceInput())
  state.failDecrypt = true
  await expect(readFishVoice(record.id)).rejects.toThrow('Impossibile leggere il riferimento Fish cifrato.')
})
