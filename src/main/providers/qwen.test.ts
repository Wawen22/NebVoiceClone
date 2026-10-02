import { afterEach, expect, it, vi } from 'vitest'
import { adaptS2STurn, parseS2SDecision } from './qwen'

afterEach(() => vi.unstubAllGlobals())
const request = {
  requestId: 'turn-2', audioPcm: new Uint8Array([0, 0, 255, 127]),
  nextLine: { id: '2', text: 'Quali svantaggi ci sono?' },
  scenario: 'Confrontare due soluzioni', history: [{ role: 'user' as const, text: 'Descrivi la soluzione.' }]
}

it('sends captured PCM as a valid mono 16kHz WAV and preserves script context', async () => {
  let payload: Record<string, any> = {}
  vi.stubGlobal('fetch', async (_url: string, options: RequestInit) => {
    payload = JSON.parse(String(options.body))
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ action: 'speak', transcript: 'Ha un costo alto.', nextText: 'Oltre al costo, quali svantaggi ci sono?', reason: 'Risposta conclusa.' }) } }], usage: { cost: 0.001 } }))
  })
  const result = await adaptS2STurn(request, { apiKey: 'test' })
  expect(result.action).toBe('speak')
  expect(result.costUsd).toBe(0.001)
  expect(payload.model).toBe('qwen/qwen3.8-omni-flash')
  const content = payload.messages[1].content
  expect(content[0].text).toContain('Quali svantaggi ci sono?')
  expect(content[0].text).toContain('Descrivi la soluzione.')
  const wav = Buffer.from(content[1].input_audio.data, 'base64')
  expect(wav.toString('ascii', 0, 4)).toBe('RIFF')
  expect(wav.readUInt32LE(24)).toBe(16000)
  expect(wav.readUInt16LE(22)).toBe(1)
  expect([...wav.subarray(44)]).toEqual([0, 0, 255, 127])
})

it('accepts contextual waiting and prevents complete from skipping an existing line', () => {
  expect(parseS2SDecision(JSON.stringify({ action: 'wait', transcript: 'Ehm, allora…', nextText: '', reason: 'Frase incompleta.' }), request.nextLine).action).toBe('wait')
  expect(() => parseS2SDecision(JSON.stringify({ action: 'complete', transcript: 'Fine.', nextText: '', reason: 'Fine.' }), request.nextLine)).toThrow()
})

it('requires an audible transcript and a nonempty proposed line before speaking', () => {
  for (const fields of [{ transcript: '', nextText: 'Ciao' }, { transcript: 'Sì', nextText: '' }]) {
    expect(() => parseS2SDecision(JSON.stringify({ action: 'speak', reason: 'Fine', ...fields }), request.nextLine)).toThrow()
  }
  expect(() => parseS2SDecision('not JSON', request.nextLine)).toThrow()
  expect(() => parseS2SDecision(JSON.stringify({ action: 'speak', transcript: 'Sì', nextText: 'Ciao', reason: 'Fine' }), null)).toThrow()
})

it('does not upload empty, odd, oversized audio or aborted requests', async () => {
  let uploads = 0
  vi.stubGlobal('fetch', async () => { uploads++; throw new Error('unexpected upload') })
  for (const audioPcm of [new Uint8Array(), new Uint8Array(3), new Uint8Array(3_840_002)]) {
    await expect(adaptS2STurn({ ...request, audioPcm }, { apiKey: 'test' })).rejects.toThrow()
  }
  await expect(adaptS2STurn(request, { apiKey: 'test', signal: AbortSignal.abort() })).rejects.toThrow()
  expect(uploads).toBe(0)
})

it('reports provider failures without returning a speech proposal', async () => {
  vi.stubGlobal('fetch', async () => new Response('{}', { status: 429 }))
  await expect(adaptS2STurn(request, { apiKey: 'test' })).rejects.toThrow('429')
})
