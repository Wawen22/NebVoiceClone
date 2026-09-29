import type { GeminiKeySource, GeminiKeyStatus } from './contracts'

export function geminiKeyLabel(source: GeminiKeySource, status: GeminiKeyStatus | null): string {
  if (source === 'environment') return status?.environmentLabel || 'Chiave originale'
  if (source === 'project') return status?.projectLabel || 'NebVoicClone'
  return status?.savedLabel || 'Chiave aggiuntiva'
}
