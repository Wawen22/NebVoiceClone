import { expect, it } from 'vitest'
import { SilentSpeechPreparation } from './preparedSpeech'
import type { SynthesisRequest } from '../../../shared/contracts'
const request: SynthesisRequest = { providerId: 'gemini', modelId: 'gemini-3.8-flash-tts', text: 'Battuta adattata.', voice: { mode: 'prebuilt', voiceId: 'Kore' } }
const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve() }

it('queues silent generation after MODEL generation and reuses PCM without another paid request', async () => {
  let release!: () => void, calls = 0
  const after = new Promise<void>((resolve) => { release = resolve })
  const cache = new SilentSpeechPreparation({ synthesizeStream: async (_request, onChunk) => { calls++; onChunk(new Uint8Array([0, 1])); return { generationMs: 20 } }, stopGeneration: async () => {} })
  const preparing = cache.prepare(request, new AbortController().signal, after)
  await flush(); expect(calls).toBe(0)
  release(); await preparing
  const chunks: Uint8Array[] = []
  await cache.playbackApi(request.text)!.synthesizeStream(request, (pcm) => chunks.push(pcm))
  expect(calls).toBe(1)
  expect(chunks).toEqual([new Uint8Array([0, 1])])
  expect(cache.playbackApi('Altro testo')).toBeNull()
})

it('never starts generation if cancelled while still queued behind MODEL A', async () => {
  let release!: () => void, calls = 0
  const after = new Promise<void>((resolve) => { release = resolve }), abort = new AbortController()
  const cache = new SilentSpeechPreparation({ synthesizeStream: async () => { calls++; return { generationMs: 0 } }, stopGeneration: async () => {} })
  const promise = cache.prepare(request, abort.signal, after)
  const rejected = expect(promise).rejects.toThrow()
  abort.abort(); release(); await rejected; await flush()
  expect(calls).toBe(0)
  expect(cache.playbackApi(request.text)).toBeNull()
})

it('cancels pending synthesis and suppresses late samples after clearing the preparation', async () => {
  let release!: () => void, chunk!: (pcm: Uint8Array) => void, stopped = 0
  const cache = new SilentSpeechPreparation({ synthesizeStream: async (_request, onChunk) => { chunk = onChunk; await new Promise<void>((resolve) => { release = resolve }); return { generationMs: 0 } }, stopGeneration: async () => { stopped++ } })
  const promise = cache.prepare(request, new AbortController().signal, Promise.resolve())
  const rejected = expect(promise).rejects.toThrow()
  await flush(); cache.clear(); chunk(new Uint8Array([0, 1])); release(); await rejected
  expect(stopped).toBe(1)
  expect(cache.playbackApi(request.text)).toBeNull()
})
