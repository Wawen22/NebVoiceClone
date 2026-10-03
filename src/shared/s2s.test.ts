import { expect, it } from 'vitest'
import { parseS2SAdaptRequest, parseS2STaskContext, isS2SAdaptiveInstruction } from './s2s'

it('preserves explicit scenario metadata and validates user-turn requirements', () => {
  const context = { scenarioType: 'IQ / Knowledge & Learning', skillsTested: 'Guida pedagogica; metodo socratico', adaptationLevel: 'L2', minimumUserTurns: 4, material: 'Brano scelto: il protagonista torna a casa.' }
  expect(parseS2STaskContext(context)).toEqual(context)
  expect(() => parseS2STaskContext({ ...context, minimumUserTurns: 0 })).toThrow()
  expect(() => parseS2STaskContext({ ...context, adaptationLevel: 'unknown' })).toThrow()
})

it('accepts exactly one audio or text source for adaptation', () => {
  const base = { requestId: 'text-1', scenario: 'Scenario', history: [], nextLine: { id: '2', text: 'Limiti?' } }
  expect(parseS2SAdaptRequest({ ...base, transcript: 'La soluzione è economica.' }).transcript).toBe('La soluzione è economica.')
  for (const input of [{}, { transcript: '' }, { transcript: 'Testo', audioPcm: new Uint8Array([0, 0]) }]) expect(() => parseS2SAdaptRequest({ ...base, ...input })).toThrow()
})

it('recognizes adaptive planning instructions that must never be spoken literally', () => {
  expect(isS2SAdaptiveInstruction('[ADAPT LIVE — react to the last response | FALLBACK ONLY IF COMPATIBLE: Va bene]')).toBe(true)
  expect(isS2SAdaptiveInstruction('Come organizzeresti la lezione?')).toBe(false)
})

it('recognizes labelled HOOK and FALLBACK directives without blocking ordinary prose', () => {
  expect(isS2SAdaptiveInstruction('[HOOK: react to the answer]')).toBe(true)
  expect(isS2SAdaptiveInstruction('FALLBACK: ask the original question')).toBe(true)
  expect(isS2SAdaptiveInstruction('Could this hook support the painting?')).toBe(false)
})
