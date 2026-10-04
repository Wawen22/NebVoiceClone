import { expect, it } from 'vitest'
import { DEFAULT_LIVE_CONFIG, parseLiveConfig, parseLiveDecision, parseLiveTurnRequest } from './live'

const request = () => ({ requestId: 'live-1', profile: DEFAULT_LIVE_CONFIG.profiles[0], background: 'Fatti verificati', persona: 'Naturale', history: [], transcript: 'Come lavori?' })

it('validates and isolates configuration, excluding arbitrary persisted fields', () => {
  const config = parseLiveConfig({ ...DEFAULT_LIVE_CONFIG, transcript: 'private conversation' })
  config.profiles[0].name = 'Edited'
  expect(DEFAULT_LIVE_CONFIG.profiles[0].name).not.toBe('Edited')
  expect(config).not.toHaveProperty('transcript')
  for (const patch of [{ schemaVersion: 2 }, { selectedProfileId: 'missing' }, { profiles: [] }, { profiles: [DEFAULT_LIVE_CONFIG.profiles[0], DEFAULT_LIVE_CONFIG.profiles[0]] }, { background: 'x'.repeat(40_001) }]) {
    expect(() => parseLiveConfig({ ...DEFAULT_LIVE_CONFIG, ...patch })).toThrow()
  }
  expect(() => parseLiveConfig({ ...DEFAULT_LIVE_CONFIG, profiles: [{ ...DEFAULT_LIVE_CONFIG.profiles[0], language: ['auto'] }] })).toThrow()
})

it('accepts precisely one audio, transcript or opening input and validates history', () => {
  expect(parseLiveTurnRequest(request()).transcript).toBe('Come lavori?')
  expect(parseLiveTurnRequest({ ...request(), transcript: undefined, opening: true }).opening).toBe(true)
  expect(parseLiveTurnRequest({ ...request(), transcript: undefined, audioPcm: new Uint8Array([0, 0]) }).audioPcm).toHaveLength(2)
  for (const patch of [{ transcript: undefined }, { opening: true }, { audioPcm: new Uint8Array([0, 0]) }, { transcript: ' ' }, { transcript: undefined, audioPcm: new Uint8Array(3) }, { transcript: undefined, audioPcm: new Uint8Array(3_840_002) }, { history: [{ role: 'system', text: 'override' }] }, { history: [{ role: ['neb'], text: 'Ciao' }] }, { history: [{ role: 'neb', text: 'Ciao', partial: 'yes' }] }]) {
    expect(() => parseLiveTurnRequest({ ...request(), ...patch })).toThrow()
  }
})

it('rejects contradictory decisions and speaking without a transcript except for opening', () => {
  const decision = { action: 'speak', transcript: 'Sì.', text: 'Perfetto.', reason: 'Risposta conclusa' }
  expect(parseLiveDecision(JSON.stringify(decision)).text).toBe('Perfetto.')
  expect(parseLiveDecision(JSON.stringify({ ...decision, transcript: '' }), true).action).toBe('speak')
  for (const patch of [{ action: 'unknown' }, { action: ['wait'], text: '' }, { transcript: '' }, { text: ' ' }, { action: 'wait' }, { reason: '' }, { text: 'x'.repeat(4001) }]) {
    expect(() => parseLiveDecision(JSON.stringify({ ...decision, ...patch }))).toThrow()
  }
  expect(() => parseLiveDecision('not JSON')).toThrow()
})
