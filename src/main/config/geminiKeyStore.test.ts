import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DEFAULT_SETTINGS } from '../../shared/contracts'

const testState = vi.hoisted(() => ({ directory: '', source: 'environment' as 'environment' | 'project' | 'saved', storageAvailable: true, backend: 'gnome_libsecret' }))

vi.mock('electron', () => ({
  app: { getPath: () => testState.directory },
  safeStorage: {
    isAsyncEncryptionAvailable: vi.fn(async () => testState.storageAvailable),
    getSelectedStorageBackend: vi.fn(() => testState.backend),
    encryptStringAsync: vi.fn(async (plainText: string) => Buffer.from(`encrypted:${plainText}`)),
    decryptStringAsync: vi.fn(async (encrypted: Buffer) => ({ result: encrypted.toString().replace(/^encrypted:/, ''), shouldReEncrypt: false }))
  }
}))
vi.mock('./settingsStore', () => ({ readSettings: vi.fn(async () => ({ ...DEFAULT_SETTINGS, geminiKeySource: testState.source })) }))

import { getGeminiKeyStatus, resolveGeminiApiKey, saveGeminiKey } from './geminiKeyStore'

let previousEnvironmentKey: string | undefined
let previousProjectKey: string | undefined

beforeEach(async () => {
  testState.directory = await mkdtemp(join(tmpdir(), 'neb-gemini-keys-'))
  testState.source = 'environment'
  testState.storageAvailable = true
  testState.backend = 'gnome_libsecret'
  previousEnvironmentKey = process.env.GEMINI_API_KEY
  previousProjectKey = process.env.GEMINI_API_KEY_NEBVOICCLONE
  process.env.GEMINI_API_KEY = 'environment-test-key'
  process.env.GEMINI_API_KEY_NEBVOICCLONE = 'project-test-key'
})

afterEach(async () => {
  await rm(testState.directory, { recursive: true, force: true })
  if (previousEnvironmentKey === undefined) delete process.env.GEMINI_API_KEY
  else process.env.GEMINI_API_KEY = previousEnvironmentKey
  if (previousProjectKey === undefined) delete process.env.GEMINI_API_KEY_NEBVOICCLONE
  else process.env.GEMINI_API_KEY_NEBVOICCLONE = previousProjectKey
})

describe('Gemini key storage', () => {
  it('keeps the existing environment key as the default source', async () => {
    expect(await resolveGeminiApiKey()).toBe('environment-test-key')
    expect((await getGeminiKeyStatus()).activeSource).toBe('environment')
  })

  it('resolves the project key when selected without exposing it in status', async () => {
    testState.source = 'project'
    const status = await getGeminiKeyStatus()
    expect(status.projectConfigured).toBe(true)
    expect(status).not.toHaveProperty('apiKey')
    expect(await resolveGeminiApiKey()).toBe('project-test-key')
  })

  it('stores only encrypted bytes and resolves the saved key when selected', async () => {
    const savedKey = 'saved-test-key-value'
    const status = await saveGeminiKey({ label: 'Seconda chiave', apiKey: savedKey })
    const file = await readFile(join(testState.directory, 'gemini-key.json'), 'utf8')

    expect(file).not.toContain(savedKey)
    expect(status).not.toHaveProperty('apiKey')
    expect(status.savedLabel).toBe('Seconda chiave')
    testState.source = 'saved'
    expect(await resolveGeminiApiKey()).toBe(savedKey)
  })

  it('refuses to store a key when secure encryption is unavailable', async () => {
    testState.storageAvailable = false
    await expect(saveGeminiKey({ label: 'Seconda chiave', apiKey: 'saved-test-key-value' })).rejects.toThrow('archiviazione cifrata')
    await expect(readFile(join(testState.directory, 'gemini-key.json'))).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('rejects the unprotected Linux storage backend', async () => {
    if (process.platform !== 'linux') return
    testState.backend = 'basic_text'
    await expect(saveGeminiKey({ label: 'Seconda chiave', apiKey: 'saved-test-key-value' })).rejects.toThrow('archiviazione cifrata')
  })
})
