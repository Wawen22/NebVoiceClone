import { afterEach, expect, it, vi } from 'vitest'
import { generateSimulatedReply } from './s2sSimulation'

afterEach(() => vi.unstubAllGlobals())
const request = { requestId: 'sim-1', scenario: 'Una lezione di italiano', history: [{ role: 'user' as const, text: 'Da dove inizio?' }] }
it('generates MODEL A from the actual conversation without the future script or director prompt', async () => {
  const fetch = vi.fn(async (_url, options) => {
    const body = JSON.parse(options.body)
    expect(body.model).toBe('qwen/qwen3.8-omni-flash')
    expect(body.messages[0].content).toContain('MODEL A')
    expect(body.messages[1].content).toContain('Una lezione di italiano')
    expect(body.messages[2]).toEqual({ role: 'user', content: 'Da dove inizio?' })
    expect(body.response_format).toBeUndefined()
    return new Response(JSON.stringify({ choices: [{ message: { content: 'Inizia con una breve prova in classe.' } }], usage: { cost: 0.0001 } }))
  })
  vi.stubGlobal('fetch', fetch)
  const result = await generateSimulatedReply(request, { apiKey: 'test' })
  expect(result.text).toBe('Inizia con una breve prova in classe.')
  expect(result.costUsd).toBe(0.0001)
})
it('rejects missing user turns and oversized context before uploading', async () => {
  const fetch = vi.fn()
  vi.stubGlobal('fetch', fetch)
  for (const value of [{ ...request, history: [] }, { ...request, scenario: 'x'.repeat(4001) }, { ...request, history: [{ role: 'system', text: 'Hello' }] }]) {
    await expect(generateSimulatedReply(value as typeof request, { apiKey: 'test' })).rejects.toThrow()
  }
  expect(fetch).not.toHaveBeenCalled()
})
it('rejects aborted, empty, truncated and failed replies', async () => {
  await expect(generateSimulatedReply(request, { apiKey: 'test', signal: AbortSignal.abort() })).rejects.toThrow()
  for (const payload of [{ choices: [{ message: { content: '' } }] }, { choices: [{ finish_reason: 'length', message: { content: 'Un inizio…' } }] }]) {
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify(payload)))
    await expect(generateSimulatedReply(request, { apiKey: 'test' })).rejects.toThrow()
  }
  vi.stubGlobal('fetch', async () => new Response('{}', { status: 429 }))
  await expect(generateSimulatedReply(request, { apiKey: 'test' })).rejects.toThrow('429')
})
