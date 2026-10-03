import { afterEach, expect, it, vi } from 'vitest'
import { adaptS2STurn, parseS2SDecision } from './qwen'

afterEach(() => vi.unstubAllGlobals())
const request = {
  requestId: 'turn-2', audioPcm: new Uint8Array([0, 0, 255, 127]),
  nextLine: { id: '2', text: 'Quali svantaggi ci sono?' },
  scenario: 'Confrontare due soluzioni', history: [{ role: 'user' as const, text: 'Descrivi la soluzione.' }]
}

function reply(nextText: string, cost: number | null = 0.001): Response {
  return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ action: 'speak', transcript: 'Ha un costo alto.', nextText, reason: 'Risposta conclusa.' }) } }], usage: { cost } }))
}

it('repairs an unchanged line using the transcript without uploading the audio twice', async () => {
  const bodies: any[] = []
  vi.stubGlobal('fetch', async (_url: string, options: RequestInit) => {
    bodies.push(JSON.parse(String(options.body)))
    return bodies.length === 1 ? reply(' quali svantaggi ci sono! ') : reply('Oltre al costo alto, quali altri svantaggi ci sono?')
  })
  const result = await adaptS2STurn(request, { apiKey: 'test' })
  expect(result.nextText).toBe('Oltre al costo alto, quali altri svantaggi ci sono?')
  expect(result.transcript).toBe('Ha un costo alto.')
  expect(result.costUsd).toBe(0.002)
  expect(bodies).toHaveLength(2)
  expect(JSON.stringify(bodies[1])).not.toContain('input_audio')
  expect(JSON.stringify(bodies[1])).toContain('Ha un costo alto.')
})

it('pauses after one ineffective repair instead of pronouncing an unchanged script', async () => {
  const fetcher = vi.fn(async () => reply(request.nextLine.text))
  vi.stubGlobal('fetch', fetcher)
  const result = await adaptS2STurn(request, { apiKey: 'test' })
  expect(result.action).toBe('pause')
  expect(result.nextText).toBe('')
  expect(result.costUsd).toBe(0.002)
  expect(fetcher).toHaveBeenCalledTimes(2)
})

it.each([null, 0.001])('does not start a paid repair with unknown or exhausted remaining budget (%s)', async (cost) => {
  const fetcher = vi.fn(async () => reply(request.nextLine.text, cost))
  vi.stubGlobal('fetch', fetcher)
  const result = await adaptS2STurn({ ...request, remainingCostUsd: 0.001 }, { apiKey: 'test' })
  expect(result.action).toBe('pause')
  expect(fetcher).toHaveBeenCalledTimes(1)
})

it('preserves the observed initial charge and flags uncertain repair cost on cancellation', async () => {
  const abort = new AbortController()
  let calls = 0
  vi.stubGlobal('fetch', async () => {
    if (++calls === 1) return reply(request.nextLine.text)
    abort.abort()
    throw new DOMException('Cancelled', 'AbortError')
  })
  const result = await adaptS2STurn(request, { apiKey: 'test', signal: abort.signal })
  expect(result.action).toBe('pause')
  expect(result.costUsd).toBeNull()
  expect(result.knownCostUsd).toBe(0.001)
})

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

it('prepares a compact text decision with the task skills and preserves the supplied transcript', async () => {
  let payload: any
  vi.stubGlobal('fetch', async (_url: string, options: RequestInit) => {
    payload = JSON.parse(String(options.body))
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ action: 'speak', nextText: 'Oltre al costo, quali limiti ha?', reason: 'Approfondimento', liveState: 'Soluzione costosa; limiti ancora da chiarire.' }) } }], usage: { cost: 0.001 } }))
  })
  const result = await adaptS2STurn({ ...request, audioPcm: undefined, transcript: 'La soluzione costa molto.', taskContext: { scenarioType: 'IQ', skillsTested: 'Metodo socratico', adaptationLevel: 'L1', minimumUserTurns: 3, material: '' } }, { apiKey: 'test' })
  expect(result.transcript).toBe('La soluzione costa molto.')
  expect(result.liveState).toContain('costosa')
  expect(JSON.stringify(payload)).not.toContain('input_audio')
  expect(JSON.stringify(payload)).toContain('Metodo socratico')
  expect(payload.response_format.json_schema.schema.required).not.toContain('transcript')
})

it('allows task-required fixed wording only in L0', async () => {
  const fetcher = vi.fn(async () => reply(request.nextLine.text))
  vi.stubGlobal('fetch', fetcher)
  const result = await adaptS2STurn({ ...request, taskContext: { scenarioType: 'Voice steerability', skillsTested: '', adaptationLevel: 'L0', minimumUserTurns: null, material: '' } }, { apiKey: 'test' })
  expect(result.action).toBe('speak')
  expect(fetcher).toHaveBeenCalledTimes(1)
})

it('retains the known charge when cancelled while decoding the response', async () => {
  const abort = new AbortController()
  vi.stubGlobal('fetch', async () => ({ ok: true, json: async () => {
    abort.abort()
    return { choices: [{ message: { content: JSON.stringify({ action: 'speak', transcript: 'Costa molto.', nextText: 'Quanto costa?', reason: 'Approfondimento' }) } }], usage: { cost: 0.002 } }
  } }))
  const result = await adaptS2STurn(request, { apiKey: 'test', signal: abort.signal })
  expect(result.action).toBe('pause')
  expect(result.nextText).toBe('')
  expect(result.costUsd).toBe(0.002)
})

it('retains the known charge when the returned decision is invalid', async () => {
  vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ choices: [{ message: { content: 'invalid' } }], usage: { cost: 0.002 } })))
  const result = await adaptS2STurn(request, { apiKey: 'test' })
  expect(result.action).toBe('pause')
  expect(result.costUsd).toBe(0.002)
})
