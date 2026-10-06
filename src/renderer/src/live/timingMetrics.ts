import type { LiveLog } from './controller'
import type { ProviderId } from '../../../shared/contracts'

export interface TimingBreakdown { beforeQwenMs: number; qwenMs: number; beforeVoiceMs: number; voiceStartMs: number }
export interface TurnTiming {
  id: string; turnNumber: number | null; atMs: number; totalMs: number; breakdown: TimingBreakdown | null
  firstChunkMs: number | null; generationMs: number | null; providerId: ProviderId | null; modelId: string | null
}

const validDuration = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0

/** Relative boundaries keep rounded stages additive, without double-counting stream metrics. */
export function responseBreakdown(speechAt: number, qwenAt: number, decisionAt: number, voiceAt: number, playbackAt: number): TimingBreakdown | null {
  const points = [speechAt, qwenAt, decisionAt, voiceAt, playbackAt]
  if (points.some(value => !Number.isFinite(value)) || points.some((value, index) => index > 0 && value < points[index - 1])) return null
  const [qwen, decision, voice, playback] = points.slice(1).map(value => Math.round(value - speechAt))
  return { beforeQwenMs: qwen, qwenMs: decision - qwen, beforeVoiceMs: voice - decision, voiceStartMs: playback - voice }
}

export function summarizeLiveTimings(log: LiveLog[]) {
  const voiceMetrics = new Map<string, { firstChunkMs: number | null; generationMs: number | null; providerId: ProviderId | null; modelId: string | null }>()
  for (const item of log) {
    if (!item.responseId || !['voice-first-chunk', 'voice-generation'].includes(item.kind)) continue
    const metrics = voiceMetrics.get(item.responseId) ?? { firstChunkMs: null, generationMs: null, providerId: null, modelId: null }
    if (validDuration(item.durationMs)) {
      if (item.kind === 'voice-first-chunk') metrics.firstChunkMs = item.durationMs
      else metrics.generationMs = item.durationMs
    }
    if (item.providerId) metrics.providerId = item.providerId
    if (item.modelId) metrics.modelId = item.modelId
    voiceMetrics.set(item.responseId, metrics)
  }
  const rows: TurnTiming[] = []
  for (const [index, item] of log.entries()) {
    if (item.kind !== 'turn-response' || !validDuration(item.durationMs)) continue
    const breakdown = item.breakdown && Object.values(item.breakdown).every(validDuration) && Math.abs(Object.values(item.breakdown).reduce((sum, value) => sum + value, 0) - item.durationMs) <= 1 ? item.breakdown : null
    rows.push({ id: item.responseId ?? `legacy-${index}`, turnNumber: item.turnNumber ?? null, atMs: item.atMs, totalMs: item.durationMs, breakdown,
      ...((item.responseId ? voiceMetrics.get(item.responseId) : undefined) ?? { firstChunkMs: null, generationMs: null, providerId: null, modelId: null }) })
  }
  const values = rows.map(item => item.totalMs).sort((a, b) => a - b)
  const count = values.length
  const medianMs = count ? count % 2 ? values[Math.floor(count / 2)] : (values[count / 2 - 1] + values[count / 2]) / 2 : null
  const worst = rows.reduce<TurnTiming | null>((previous, item) => !previous || item.totalMs > previous.totalMs ? item : previous, null)
  return { rows, count, medianMs, maxMs: worst?.totalMs ?? null, worst }
}
