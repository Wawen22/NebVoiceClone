import { expect, it, vi } from 'vitest'
import { streamS2SSpeech } from './speechPlayer'
import type { SynthesisRequest } from '../../../shared/contracts'

const request: SynthesisRequest = { providerId: 'gemini', modelId: 'gemini-3.8-flash-tts', text: 'Ciao', voice: { mode: 'prebuilt', voiceId: 'Kore' } }
const flush = async (): Promise<void> => { for (let i = 0; i < 6; i++) await Promise.resolve() }
it('reports the first accepted audio chunk once, separately from playback start', async () => {
  const f = fixture(), firstChunk = vi.fn()
  f.api.synthesizeStream = async (_request, onChunk) => { onChunk(new Uint8Array([1, 2])); onChunk(new Uint8Array([3, 4])); return { generationMs: 10 } }
  const playing = streamS2SSpeech(f.api, f.engine, request, 'cable', new AbortController().signal, () => true, { onFirstChunk: firstChunk })
  await flush(); expect(firstChunk).toHaveBeenCalledOnce(); f.end(); await playing
})
function fixture() {
  let ended = () => {}
  const samples: number[] = []
  let stopped = 0, cancelled = 0, generations = 0
  const engine = {
    beginStream: async (): Promise<void> => undefined, appendPcm: (chunk: Uint8Array) => samples.push(...chunk),
    finishStream: () => 1, onEnded: (callback: () => void) => { ended = callback }, stop: () => { stopped++ }
  }
  const api = { synthesizeStream: async (_request: SynthesisRequest, onChunk: (chunk: Uint8Array) => void) => { generations++; onChunk(new Uint8Array([1, 2])); return { generationMs: 100 } }, stopGeneration: async () => { cancelled++ } }
  return { engine, api, samples, end: () => ended(), stopped: () => stopped, cancelled: () => cancelled, generations: () => generations }
}

it('resolves only after generated audio has actually finished playing', async () => {
  const f = fixture()
  let finished = false
  const playing = streamS2SSpeech(f.api, f.engine, request, 'cable', new AbortController().signal, () => true).then(() => { finished = true })
  await flush()
  expect(f.samples).toEqual([1, 2])
  expect(finished).toBe(false)
  f.end(); await playing
  expect(finished).toBe(true)
})

it('aborts during playback and ignores an obsolete ended callback', async () => {
  const f = fixture(), abort = new AbortController()
  const playing = streamS2SSpeech(f.api, f.engine, request, 'cable', abort.signal, () => true)
  const rejected = expect(playing).rejects.toThrow()
  await flush(); abort.abort(); await rejected
  f.end()
  expect(f.stopped()).toBeGreaterThan(0)
  expect(f.cancelled()).toBe(1)
})

it('does not synthesize if Stop arrives while the output device is initializing', async () => {
  const f = fixture(), abort = new AbortController()
  let begin!: () => void
  f.engine.beginStream = () => new Promise<void>((resolve) => { begin = resolve })
  const playing = streamS2SSpeech(f.api, f.engine, request, 'cable', abort.signal, () => true)
  const rejected = expect(playing).rejects.toThrow()
  abort.abort(); await rejected; begin(); await flush()
  expect(f.generations()).toBe(0)
})

it('suppresses the first audio chunk if Outlier resumes before playback starts', async () => {
  const f = fixture()
  await expect(streamS2SSpeech(f.api, f.engine, request, 'cable', new AbortController().signal, () => false)).rejects.toThrow()
  expect(f.samples).toEqual([])
  expect(f.cancelled()).toBe(1)
})

it('drains queued Live audio on a provider failure before reporting a partial response', async () => {
  const f = fixture()
  f.api.synthesizeStream = async (_request, onChunk) => { onChunk(new Uint8Array([1, 2])); throw new Error('Provider stream failed') }
  let finished = false
  const playing = streamS2SSpeech(f.api, f.engine, request, 'cable', new AbortController().signal, () => true, { drainOnError: true }).finally(() => { finished = true })
  const rejected = expect(playing).rejects.toThrow('Provider stream failed')
  await flush()
  expect(f.samples).toEqual([1, 2]); expect(f.stopped()).toBe(0); expect(finished).toBe(false)
  f.end(); await rejected
  expect(finished).toBe(true)
})

it('still honors Stop immediately while draining a failed Live stream', async () => {
  const f = fixture(), abort = new AbortController()
  f.api.synthesizeStream = async (_request, onChunk) => { onChunk(new Uint8Array([1, 2])); throw new Error('Provider stream failed') }
  const playing = streamS2SSpeech(f.api, f.engine, request, 'cable', abort.signal, () => true, { drainOnError: true })
  const rejected = expect(playing).rejects.toThrow('interrotta')
  await flush(); abort.abort(); await rejected
  expect(f.stopped()).toBeGreaterThan(0)
})

it('reports a provider failure before any audio without waiting for playback', async () => {
  const f = fixture()
  f.api.synthesizeStream = async () => { throw new Error('No audio') }
  await expect(streamS2SSpeech(f.api, f.engine, request, 'cable', new AbortController().signal, () => true, { drainOnError: true })).rejects.toThrow('No audio')
})

it('uses the received avatar speaking event and rejects async playback failure', async () => {
  const f = fixture(), started = () => true
  let start!: () => boolean, fail!: (error: Error) => void
  const engine = { ...f.engine, onStarted: (callback: () => boolean) => { start = callback }, onError: (callback: (error: Error) => void) => { fail = callback } }
  const onStarted = vi.fn(started)
  const pending = streamS2SSpeech(f.api, engine, request, 'cable', new AbortController().signal, onStarted)
  const rejected = expect(pending).rejects.toThrow('Disconnected')
  await flush(); expect(onStarted).not.toHaveBeenCalled()
  start(); expect(onStarted).toHaveBeenCalledOnce()
  fail(new Error('Disconnected')); await rejected
})
