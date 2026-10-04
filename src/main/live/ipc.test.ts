import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { WebContents } from 'electron'
import type { WindowPresentationController } from '../windowPresentation'
import { DEFAULT_LIVE_CONFIG, type LiveTurnRequest } from '../../shared/live'

const fake = vi.hoisted(() => ({ path: '', handlers: new Map<string, (...args: unknown[]) => unknown>() }))
vi.mock('electron', () => ({ app: { getPath: () => fake.path }, BrowserWindow: {}, dialog: {}, safeStorage: {}, desktopCapturer: {}, clipboard: {}, nativeImage: {}, ipcMain: { handle: (channel: string, handler: (...args: unknown[]) => unknown) => fake.handlers.set(channel, handler) } }))
import { registerIpc } from '../ipc/registerIpc'
import { GeminiTtsProvider } from '../providers/gemini'
import type { ReplicatedVoiceRecord } from '../../shared/contracts'

const frame = {} as Electron.WebFrameMain
const sender = { mainFrame: frame } as WebContents
const event = { sender, senderFrame: frame }
const request: LiveTurnRequest = { requestId: 'live-a', profile: DEFAULT_LIVE_CONFIG.profiles[0], background: '', persona: '', history: [], transcript: 'Ciao' }
const invoke = (channel: string, ...args: unknown[]): unknown => fake.handlers.get(channel)!(...args)
beforeEach(async () => {
  fake.path = await mkdtemp(join(tmpdir(), 'neb-live-ipc-'))
  fake.handlers.clear()
  registerIpc(() => sender, {} as WindowPresentationController)
  vi.stubEnv('OPENROUTER_API_KEY', 'test')
})
afterEach(async () => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); await rm(fake.path, { force: true, recursive: true }) })

it('rejects unauthorized windows and child frames before reading, saving or generating', async () => {
  for (const channel of ['live:getConfig', 'live:saveConfig', 'live:generate', 'live:cancel', 'live:captureSources', 'live:captureSource', 'live:clipboardImage', 'live:importImage']) {
    for (const untrusted of [{ sender: {}, senderFrame: frame }, { sender, senderFrame: {} }]) {
      await expect(Promise.resolve().then(() => invoke(channel, untrusted, channel === 'live:saveConfig' ? DEFAULT_LIVE_CONFIG : request))).rejects.toThrow('Untrusted')
    }
  }
  expect(await invoke('live:getConfig', event)).toMatchObject({ selectedProfileId: 'full-stack' })
  await invoke('live:saveConfig', event, { ...DEFAULT_LIVE_CONFIG, background: 'Saved locally' })
  expect(await invoke('live:getConfig', event)).toMatchObject({ background: 'Saved locally' })
})

it('cancels only the matching operation and old completion cannot clear the replacement', async () => {
  const signals: AbortSignal[] = []
  const complete: (() => void)[] = []
  vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
    signals.push(init.signal as AbortSignal)
    await new Promise<void>((resolve) => complete.push(resolve))
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ action: 'speak', transcript: 'Ciao', text: 'Ciao!', reason: 'Saluto' }) } }], usage: { cost: 0.001 } }))
  })
  const old = invoke('live:generate', event, request)
  const current = invoke('live:generate', event, { ...request, requestId: 'live-b' })
  expect(signals[0].aborted).toBe(true)
  invoke('live:cancel', event, 'live-a')
  expect(signals[1].aborted).toBe(false)
  complete[0]()
  expect(await old).toMatchObject({ action: 'pause', costUsd: 0.001 })
  invoke('live:cancel', event, 'live-b')
  expect(signals[1].aborted).toBe(true)
  complete[1]()
  expect(await current).toMatchObject({ action: 'pause', costUsd: 0.001 })
  expect(() => invoke('live:cancel', event, { requestId: 'bad' })).toThrow()
})

function voiceWav(seconds: number): Uint8Array {
  const pcmBytes = seconds * 24000 * 2
  const wav = Buffer.alloc(44 + pcmBytes)
  wav.write('RIFF', 0); wav.writeUInt32LE(36 + pcmBytes, 4); wav.write('WAVEfmt ', 8)
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22)
  wav.writeUInt32LE(24000, 24); wav.writeUInt32LE(48000, 28)
  wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36)
  wav.writeUInt32LE(pcmBytes, 40)
  return wav
}

it('marks the provider unavailable and rejects Live turns while voice creation survives page navigation', async () => {
  let release!: (record: ReplicatedVoiceRecord) => void
  let entered!: () => void
  const providerEntered = new Promise<void>((resolve) => { entered = resolve })
  vi.spyOn(GeminiTtsProvider.prototype, 'createReplicatedVoice').mockImplementation(async () => {
    entered()
    return new Promise<ReplicatedVoiceRecord>((resolve) => { release = resolve })
  })
  let uploads = 0
  vi.stubGlobal('fetch', async () => { uploads++; throw new Error('Unexpected API upload') })
  const cloning = invoke('gemini:createReplicatedVoice', event, { displayName: 'Test voice', sourceAudio: voiceWav(10), consentAudio: voiceWav(2), consentConfirmed: true })
  await providerEntered
  try {
    expect(invoke('s2s:providerStatus', event)).toMatchObject({ ready: false, message: expect.stringMatching(/creazione.*voce/i) })
    await expect(invoke('live:generate', event, request)).rejects.toThrow(/creazione.*voce/i)
    expect(uploads).toBe(0)
  } finally {
    release({ id: 'voice_fixture', displayName: 'Test voice', model: 'gemini-3.8-flash-tts', createdAt: '2026-10-04T00:00:00Z' })
    await cloning
  }
  expect(invoke('s2s:providerStatus', event)).toMatchObject({ ready: true })
})
