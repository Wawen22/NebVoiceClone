import { describe, expect, it, vi } from 'vitest'

const clients = vi.hoisted(() => ({ keys: [] as string[] }))

vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = { get: async () => ({}) }
    constructor(options: { apiKey: string }) { clients.keys.push(options.apiKey) }
  }
}))

import { GeminiTtsProvider } from './gemini'

describe('Gemini key selection', () => {
  it('uses the currently selected key for each new request', async () => {
    let active = 'first-test-key'
    const provider = new GeminiTtsProvider(async () => active)

    expect((await provider.validateConfiguration()).ready).toBe(true)
    active = 'second-test-key'
    expect((await provider.validateConfiguration()).ready).toBe(true)
    expect(clients.keys).toEqual(['first-test-key', 'second-test-key'])
  })
})
