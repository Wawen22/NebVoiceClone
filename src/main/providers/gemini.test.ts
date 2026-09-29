import { describe, expect, it } from 'vitest'
import { normalizeGeminiError, normalizeGeminiVoiceError } from './gemini'

describe('Gemini errors', () => {
  it('explains key and quota failures without exposing provider internals', () => {
    expect(normalizeGeminiError({ status: 403 }).message).toContain('API key')
    expect(normalizeGeminiError({ status: 429 }).message).toContain('rate limit')
  })

  it('reports cancellation clearly', () => {
    expect(normalizeGeminiError(new DOMException('aborted', 'AbortError')).message).toBe('Generation cancelled.')
  })

  it('reports an upstream voice creation failure with its HTTP status and no raw provider body', () => {
    const error = { status: 500, message: 'Internal error encountered. secret payload here' }
    expect(normalizeGeminiVoiceError(error).message).toContain('HTTP 500')
    expect(normalizeGeminiVoiceError(error).message).not.toContain('secret payload')
  })

  it('distinguishes a network failure from a Google server response', () => {
    const error = { name: 'APIConnectionError', message: 'Unexpected HTTP client error' }
    expect(normalizeGeminiVoiceError(error).message).toContain('Network connection')
    expect(normalizeGeminiVoiceError(error).message).not.toContain('HTTP 500')
  })
})
