import type { BrowserTarget } from './outlier'

export interface S2SLine { id: string; text: string }
export interface S2SHistoryItem { role: 'user' | 'assistant'; text: string; partial?: boolean }
export interface S2SAdaptRequest {
  requestId: string
  audioPcm: Uint8Array
  nextLine: S2SLine | null
  scenario: string
  history: S2SHistoryItem[]
  remainingCostUsd?: number
}

export function isUnchangedS2SLine(original: string, adapted: string): boolean {
  const normalize = (text: string): string => text.normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
  return normalize(original) === normalize(adapted)
}
export interface S2SDecision {
  action: 'speak' | 'wait' | 'pause' | 'complete'
  transcript: string
  nextText: string
  reason: string
  costUsd: number | null
  /** Observed portion of the cost when the total (e.g. cancelled repair) is unknown. */
  knownCostUsd?: number
  qwenMs: number
}
export interface S2SSimulationRequest { requestId: string; scenario: string; history: S2SHistoryItem[] }
export interface S2SSimulationReply { text: string; modelMs: number; costUsd: number | null }
export interface S2SAudioStatus {
  state: 'inactive' | 'active' | 'error'
  captureId: string | null
  target: BrowserTarget | null
  message: string
}
export type S2SAudioEvent =
  | { type: 'status'; status: S2SAudioStatus }
  | { type: 'pcm'; captureId: string; sequence: number; pcm: Uint8Array }

export interface S2SApi {
  getS2SProviderStatus(): Promise<{ ready: boolean; model: string }>
  adaptS2STurn(request: S2SAdaptRequest): Promise<S2SDecision>
  cancelS2SAdaptation(requestId?: string): Promise<void>
  generateS2SSimulationReply(request: S2SSimulationRequest): Promise<S2SSimulationReply>
  cancelS2SSimulationReply(requestId: string): Promise<void>
  getS2SAudioStatus(): Promise<S2SAudioStatus>
  onS2SAudio(callback: (event: S2SAudioEvent) => void): () => void
  stopS2SAudioCapture(): Promise<void>
}

export function parseS2SSimulationRequest(value: unknown): S2SSimulationRequest {
  if (!value || typeof value !== 'object') throw new Error('Richiesta simulazione non valida.')
  const v = value as S2SSimulationRequest
  if (typeof v.requestId !== 'string' || !v.requestId || v.requestId.length > 100 || typeof v.scenario !== 'string' || v.scenario.length > 4000 ||
      !Array.isArray(v.history) || !v.history.length || v.history.length > 60 || v.history.at(-1)?.role !== 'user' ||
      v.history.some((item) => !item || !['user', 'assistant'].includes(item.role) || typeof item.text !== 'string' || !item.text.trim() || item.text.length > 16000)) throw new Error('Contesto simulazione non valido.')
  return { requestId: v.requestId, scenario: v.scenario, history: v.history.map(({ role, text }) => ({ role, text })) }
}

export const MAX_S2S_AUDIO_BYTES = 16000 * 2 * 120

export function parseS2SAdaptRequest(value: unknown): S2SAdaptRequest {
  if (!value || typeof value !== 'object') throw new Error('Richiesta S2S non valida.')
  const v = value as S2SAdaptRequest
  const validText = (text: unknown, max: number): text is string => typeof text === 'string' && text.length <= max
  if (!validText(v.requestId, 100) || !v.requestId || !validText(v.scenario, 4000) ||
      (v.remainingCostUsd !== undefined && (!Number.isFinite(v.remainingCostUsd) || v.remainingCostUsd <= 0)) ||
      !(v.audioPcm instanceof Uint8Array) || !v.audioPcm.length || v.audioPcm.length % 2 || v.audioPcm.length > MAX_S2S_AUDIO_BYTES ||
      !Array.isArray(v.history) || v.history.length > 60 ||
      v.history.some((item) => !item || !['user', 'assistant'].includes(item.role) || !validText(item.text, 16000) || (item.partial !== undefined && typeof item.partial !== 'boolean')) ||
      (v.nextLine !== null && (!v.nextLine || !validText(v.nextLine.id, 100) || !v.nextLine.id || !validText(v.nextLine.text, 4000) || !v.nextLine.text.trim()))) {
    throw new Error('Audio o contesto S2S non valido (massimo 120 secondi per risposta).')
  }
  return { requestId: v.requestId, scenario: v.scenario, audioPcm: v.audioPcm, nextLine: v.nextLine, history: v.history, remainingCostUsd: v.remainingCostUsd }
}
