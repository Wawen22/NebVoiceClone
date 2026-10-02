import type { BrowserTarget } from './outlier'

export interface S2SLine { id: string; text: string }
export interface S2SHistoryItem { role: 'user' | 'assistant'; text: string; partial?: boolean }
export interface S2SAdaptRequest {
  requestId: string
  audioPcm: Uint8Array
  nextLine: S2SLine | null
  scenario: string
  history: S2SHistoryItem[]
}
export interface S2SDecision {
  action: 'speak' | 'wait' | 'pause' | 'complete'
  transcript: string
  nextText: string
  reason: string
  costUsd: number | null
  qwenMs: number
}
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
  getS2SAudioStatus(): Promise<S2SAudioStatus>
  onS2SAudio(callback: (event: S2SAudioEvent) => void): () => void
  stopS2SAudioCapture(): Promise<void>
}

export const MAX_S2S_AUDIO_BYTES = 16000 * 2 * 120

export function parseS2SAdaptRequest(value: unknown): S2SAdaptRequest {
  if (!value || typeof value !== 'object') throw new Error('Richiesta S2S non valida.')
  const v = value as S2SAdaptRequest
  const validText = (text: unknown, max: number): text is string => typeof text === 'string' && text.length <= max
  if (!validText(v.requestId, 100) || !v.requestId || !validText(v.scenario, 4000) ||
      !(v.audioPcm instanceof Uint8Array) || !v.audioPcm.length || v.audioPcm.length % 2 || v.audioPcm.length > MAX_S2S_AUDIO_BYTES ||
      !Array.isArray(v.history) || v.history.length > 60 ||
      v.history.some((item) => !item || !['user', 'assistant'].includes(item.role) || !validText(item.text, 16000) || (item.partial !== undefined && typeof item.partial !== 'boolean')) ||
      (v.nextLine !== null && (!v.nextLine || !validText(v.nextLine.id, 100) || !v.nextLine.id || !validText(v.nextLine.text, 4000) || !v.nextLine.text.trim()))) {
    throw new Error('Audio o contesto S2S non valido (massimo 120 secondi per risposta).')
  }
  return { requestId: v.requestId, scenario: v.scenario, audioPcm: v.audioPcm, nextLine: v.nextLine, history: v.history }
}
