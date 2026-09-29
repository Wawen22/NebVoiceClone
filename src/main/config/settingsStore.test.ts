import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const testState = vi.hoisted(() => ({ directory: '' }))
vi.mock('electron', () => ({ app: { getPath: () => testState.directory } }))

import { readSettings, saveReplicatedVoice, setGeminiKeySource, updateSettings } from './settingsStore'

beforeEach(async () => { testState.directory = await mkdtemp(join(tmpdir(), 'neb-voice-settings-')) })
afterEach(async () => { await rm(testState.directory, { recursive: true, force: true }) })

describe('voice profiles by Gemini key', () => {
  it('keeps the original and project voices and selections separate across switches and reloads', async () => {
    const originalVoice = { id: 'voice_original123', displayName: 'Originale', model: 'gemini-3.8-flash-tts' as const, createdAt: '2026-09-01T00:00:00.000Z' }
    const projectVoice = { id: 'voice_project123', displayName: 'NebVoicClone', model: 'gemini-3.8-flash-tts' as const, createdAt: '2026-09-02T00:00:00.000Z' }
    await saveReplicatedVoice(originalVoice)
    expect((await readSettings()).geminiVoiceId).toBe(originalVoice.id)
    await setGeminiKeySource('project')
    expect((await readSettings()).replicatedVoice).toBeNull()
    expect((await readSettings()).geminiVoiceId).toBe('Kore')
    await saveReplicatedVoice(projectVoice)
    await updateSettings({ geminiVoiceId: 'Puck' })
    expect((await readSettings()).geminiVoiceId).toBe('Puck')
    await setGeminiKeySource('environment')
    expect((await readSettings()).replicatedVoice?.id).toBe(originalVoice.id)
    expect((await readSettings()).geminiVoiceId).toBe(originalVoice.id)
    await setGeminiKeySource('project')
    expect((await readSettings()).replicatedVoice?.id).toBe(projectVoice.id)
    expect((await readSettings()).geminiVoiceId).toBe('Puck')
  })
})
