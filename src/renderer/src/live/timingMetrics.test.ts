import { describe, expect, it } from 'vitest'
import type { LiveLog } from './controller'
import { responseBreakdown, summarizeLiveTimings } from './timingMetrics'

const response = (responseId: string, durationMs: number, turnNumber: number): LiveLog => ({ kind: 'turn-response', text: '', atMs: turnNumber * 10000, responseId, durationMs, turnNumber })

describe('Live timing metrics', () => {
  it('partitions elapsed time without adding overlapping first-chunk timing', () => {
    expect(responseBreakdown(1000, 2500, 3200, 3500, 4300)).toEqual({ beforeQwenMs: 1500, qwenMs: 700, beforeVoiceMs: 300, voiceStartMs: 800 })
    expect(responseBreakdown(1000, 900, 3200, 3500, 4300)).toBeNull()
    expect(responseBreakdown(1000, 2500, 2400, 3500, 4300)).toBeNull()
    expect(responseBreakdown(1000, NaN, 3200, 3500, 4300)).toBeNull()
  })
  it('correlates provider metrics only by response ID even when late or interleaved', () => {
    const logs: LiveLog[] = [
      { kind: 'voice-first-chunk', atMs: 1, text: '', responseId: 'failed', durationMs: 9999, providerId: 'gemini', modelId: 'failed' },
      response('a', 3300, 1), response('b', 4900, 2),
      { kind: 'voice-first-chunk', atMs: 2, text: '', responseId: 'b', durationMs: 500, providerId: 'fish-openrouter', modelId: 'fish-test' },
      { kind: 'voice-generation', atMs: 3, text: '', responseId: 'a', durationMs: 900, providerId: 'gemini', modelId: 'gemini-test' }
    ]
    const metrics = summarizeLiveTimings(logs)
    expect(metrics.rows[0]).toMatchObject({ totalMs: 3300, firstChunkMs: null, generationMs: 900, providerId: 'gemini', modelId: 'gemini-test' })
    expect(metrics.rows[1]).toMatchObject({ totalMs: 4900, firstChunkMs: 500, generationMs: null, providerId: 'fish-openrouter' })
    expect(metrics).toMatchObject({ count: 2, medianMs: 4100, maxMs: 4900 })
    expect(metrics.worst?.turnNumber).toBe(2)
  })
  it('retains a valid total while showing unknown details for old or incomplete logs', () => {
    const metrics = summarizeLiveTimings([{ kind: 'turn-response', text: '', atMs: 1, durationMs: 2000 }, { kind: 'voice-first-chunk', text: '', atMs: 2, durationMs: 10 }])
    expect(metrics.rows[0]).toMatchObject({ totalMs: 2000, breakdown: null, firstChunkMs: null, providerId: null })
  })
  it('excludes invalid totals and does not mistake missing measurements for zero', () => {
    const metrics = summarizeLiveTimings([response('bad', NaN, 1), response('negative', -1, 2), response('zero', 0, 3), response('ok', 100, 4)])
    expect(metrics).toMatchObject({ count: 2, medianMs: 50, maxMs: 100 })
    expect(summarizeLiveTimings([])).toMatchObject({ count: 0, medianMs: null, maxMs: null, worst: null })
  })
  it('does not display an inconsistent breakdown as measured stage durations', () => {
    const metrics = summarizeLiveTimings([{ ...response('a', 3300, 1), breakdown: { beforeQwenMs: 1500, qwenMs: 700, beforeVoiceMs: 300, voiceStartMs: 900 } }])
    expect(metrics.rows[0].breakdown).toBeNull()
  })
})
