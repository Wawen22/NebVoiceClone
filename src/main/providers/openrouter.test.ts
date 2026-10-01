import { describe, expect, it, vi, beforeEach } from 'vitest'
import { paraphraseSingleLine, paraphraseWithNemotron, parseParaphraseResponse } from './openrouter'

describe('parseParaphraseResponse', () => {
  it('parses valid JSON array correctly', () => {
    const raw = '["Ciao, tutto bene?", "Hai preso le medicine stamattina?"]'
    const result = parseParaphraseResponse(raw, 2)
    expect(result).toEqual(['Ciao, tutto bene?', 'Hai preso le medicine stamattina?'])
  })

  it('parses markdown code-fenced JSON array', () => {
    const raw = '```json\n["Prima battuta", "Seconda battuta"]\n```'
    const result = parseParaphraseResponse(raw, 2)
    expect(result).toEqual(['Prima battuta', 'Seconda battuta'])
  })

  it('handles fallback for bulleted list if JSON is slightly off', () => {
    const raw = '1. Ciao, come va oggi?\n2. Ricordati di prendere i farmaci.'
    const result = parseParaphraseResponse(raw, 2)
    expect(result).toEqual(['Ciao, come va oggi?', 'Ricordati di prendere i farmaci.'])
  })
})

describe('paraphraseWithNemotron', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    delete process.env.OPENROUTER_API_KEY
  })

  it('returns empty array if input is empty', async () => {
    const result = await paraphraseWithNemotron([])
    expect(result).toEqual([])
  })

  it('throws error if API key is missing', async () => {
    await expect(paraphraseWithNemotron(['Test'])).rejects.toThrow('Chiave OPENROUTER_API_KEY assente')
  })

  it('calls OpenRouter with correct payload and returns paraphrased lines', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify(['Ciao, come stai?', 'Hai preso i farmaci oggi?'])
            }
          }
        ]
      })
    })
    globalThis.fetch = fakeFetch

    const result = await paraphraseWithNemotron(
      ['Hey come va?', 'Hai preso le medicine?'],
      { apiKey: 'sk-or-fake-key' }
    )

    expect(result).toEqual(['Ciao, come stai?', 'Hai preso i farmaci oggi?'])
    expect(fakeFetch).toHaveBeenCalledTimes(1)
    const [url, options] = fakeFetch.mock.calls[0]
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions')
    expect(options.headers['Authorization']).toBe('Bearer sk-or-fake-key')
    const body = JSON.parse(options.body)
    expect(body.model).toBe('nvidia/nemotron-3-ultra-550b-a55b:free')
    expect(body.reasoning).toEqual({ enabled: true })
  })

  it('handles API error with message', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: async () => ({
        error: { message: 'Invalid API key' }
      })
    })

    await expect(
      paraphraseWithNemotron(['Test'], { apiKey: 'bad-key' })
    ).rejects.toThrow('Errore OpenRouter: Invalid API key')
  })
})

describe('paraphraseSingleLine', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    delete process.env.OPENROUTER_API_KEY
  })

  it('returns empty string if text is empty', async () => {
    const res = await paraphraseSingleLine('   ')
    expect(res).toBe('')
  })

  it('calls OpenRouter and includes avoid variation instruction', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: '"Ciao, come procede la giornata?"'
            }
          }
        ]
      })
    })
    globalThis.fetch = fakeFetch

    const res = await paraphraseSingleLine(
      'Hey ciao come va?',
      'Ciao, come stai?',
      { apiKey: 'sk-or-fake-key' }
    )

    expect(res).toBe('Ciao, come procede la giornata?')
    expect(fakeFetch).toHaveBeenCalledTimes(1)
    const [url, options] = fakeFetch.mock.calls[0]
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions')
    const body = JSON.parse(options.body)
    expect(body.messages[0].content).toContain('fornisci una formulazione diversa da questa versione già esistente: "Ciao, come stai?"')
  })
})
