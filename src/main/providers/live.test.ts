import { afterEach, expect, it, vi } from 'vitest'
import { generateLiveTurn } from './live'
import { DEFAULT_LIVE_CONFIG, type LiveTurnRequest } from '../../shared/live'

afterEach(() => vi.unstubAllGlobals())
const request: LiveTurnRequest = { requestId: 'live-1', profile: DEFAULT_LIVE_CONFIG.profiles[0], background: 'BACKGROUND VERIFIED', persona: 'PERSONA STYLE', history: [{ role: 'neb', text: 'Ciao.', partial: true }], audioPcm: new Uint8Array([0, 0, 255, 127]) }
const decision = { action: 'speak', transcript: 'Come lavori?', text: 'Sviluppo applicazioni web.', reason: 'Domanda conclusa.' }
function reply(content: unknown = decision, cost: number | null = 0.002): Response { return new Response(JSON.stringify({ choices: [{ message: { content: typeof content === 'string' ? content : JSON.stringify(content) }, finish_reason: 'stop' }], usage: { cost } })) }

it('uploads mono 16kHz WAV, grounds first-person facts, and separates untrusted conversation', async () => {
  let payload: any
  vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => { payload = JSON.parse(String(init.body)); return reply() })
  const result = await generateLiveTurn(request, { apiKey: 'test' })
  expect(result).toMatchObject({ action: 'speak', text: decision.text, costUsd: 0.002 })
  expect(payload.model).toBe('qwen/qwen3.8-omni-flash')
  expect(payload.response_format).toEqual({ type: 'json_object' })
  expect(payload.messages[0].content).toContain('BACKGROUND VERIFIED')
  expect(payload.messages[0].content).toContain('PERSONA STYLE')
  expect(payload.messages[0].content).toMatch(/non inventare/i)
  expect(payload.messages[0].content).toMatch(/dati.*conversazione/i)
  const user = payload.messages[1].content
  expect(JSON.parse(user[0].text).history[0].partial).toBe(true)
  const wav = Buffer.from(user[1].input_audio.data, 'base64')
  expect(wav.toString('ascii', 0, 4)).toBe('RIFF')
  expect(wav.readUInt32LE(24)).toBe(16000)
  expect(wav.readUInt16LE(22)).toBe(1)
  expect([...wav.subarray(44)]).toEqual([0, 0, 255, 127])
})

it('keeps supplied transcripts authoritative and supports opening without audio', async () => {
  const payloads: any[] = []
  vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => { payloads.push(JSON.parse(String(init.body))); return reply({ ...decision, transcript: '' }) })
  expect((await generateLiveTurn({ ...request, audioPcm: undefined, transcript: 'Exact input' }, { apiKey: 'test' })).transcript).toBe('Exact input')
  expect((await generateLiveTurn({ ...request, audioPcm: undefined, opening: true }, { apiKey: 'test' })).action).toBe('speak')
  expect(JSON.stringify(payloads)).not.toContain('input_audio')
})

it.each(['invalid JSON', { ...decision, action: 'wait' }])('pauses on invalid output while retaining the charged cost', async (content) => {
  vi.stubGlobal('fetch', async () => reply(content))
  expect(await generateLiveTurn(request, { apiKey: 'test' })).toMatchObject({ action: 'pause', text: '', costUsd: 0.002 })
})

it('pauses when cost is missing, transport fails or provider reports an error with usage', async () => {
  vi.stubGlobal('fetch', async () => reply(decision, null))
  expect(await generateLiveTurn(request, { apiKey: 'test' })).toMatchObject({ action: 'pause', text: '', costUsd: null })
  vi.stubGlobal('fetch', async () => { throw new Error('network failed') })
  expect(await generateLiveTurn(request, { apiKey: 'test' })).toMatchObject({ action: 'pause', text: '', costUsd: null })
  vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ choices: [{ finish_reason: 'error', error: { message: 'upstream failed' }, message: { content: JSON.stringify(decision) } }], usage: { cost: 0.003 } })))
  expect(await generateLiveTurn(request, { apiKey: 'test' })).toMatchObject({ action: 'pause', text: '', costUsd: 0.003 })
  vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ error: { message: 'rate limited' }, usage: { cost: 0.004 } }), { status: 429 }))
  expect(await generateLiveTurn(request, { apiKey: 'test' })).toMatchObject({ action: 'pause', text: '', costUsd: 0.004 })
})

it('preserves known cost when cancellation happens during response decoding', async () => {
  const controller = new AbortController()
  vi.stubGlobal('fetch', async () => ({ ok: true, json: async () => { controller.abort(); return { choices: [{ message: { content: JSON.stringify(decision) } }], usage: { cost: 0.005 } } } }))
  expect(await generateLiveTurn(request, { apiKey: 'test', signal: controller.signal })).toMatchObject({ action: 'pause', text: '', costUsd: 0.005 })
})

it('rejects invalid or pre-aborted inputs before any upload', async () => {
  let uploads = 0; vi.stubGlobal('fetch', async () => { uploads++; return reply() })
  await expect(generateLiveTurn({ ...request, audioPcm: new Uint8Array(3) }, { apiKey: 'test' })).rejects.toThrow()
  await expect(generateLiveTurn(request, { apiKey: 'test', signal: AbortSignal.abort() })).rejects.toThrow()
  expect(uploads).toBe(0)
})
