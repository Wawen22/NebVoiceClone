import { isUnchangedS2SLine } from '../../../shared/s2s'
import type { S2SSnapshot } from './controller'

export interface ConversationMessage {
  id: string; role: 'neb' | 'model'; text: string; original?: string; atMs: number
  state: 'speaking' | 'spoken' | 'partial' | 'simulated' | 'transcribed' | 'text'
}

export function conversationMessages(snapshot: S2SSnapshot): ConversationMessage[] {
  const messages = new Map<string, ConversationMessage>()
  for (const entry of snapshot.log) {
    if (entry.kind === 'voice' && entry.utteranceId !== undefined && entry.adapted) {
      const id = `neb-${entry.utteranceId}`
      messages.set(id, { id, role: 'neb', text: entry.adapted, original: entry.original, atMs: entry.atMs, state: 'speaking' })
    } else if (['spoken', 'partial'].includes(entry.kind) && entry.utteranceId !== undefined) {
      const message = messages.get(`neb-${entry.utteranceId}`)
      if (message) message.state = entry.kind === 'spoken' ? 'spoken' : 'partial'
    } else if (['simulation-model', 'decision'].includes(entry.kind) && entry.accepted && entry.transcript && entry.responseId !== undefined) {
      const id = `model-${entry.responseId}`, previous = messages.get(id)
      // A late simulated text must never overwrite an accepted audio transcription.
      if (entry.kind === 'simulation-model' && ['transcribed', 'text'].includes(previous?.state ?? '')) continue
      messages.set(id, { id, role: 'model', text: entry.transcript, atMs: previous?.atMs ?? entry.atMs, state: entry.kind === 'decision' ? entry.transcriptSource === 'simulation-text' ? 'text' : 'transcribed' : 'simulated' })
    }
  }
  return [...messages.values()]
}

export function sessionLines(snapshot: S2SSnapshot) {
  return snapshot.script.map((line, index) => {
    const last = [...snapshot.log].reverse().find((entry) => entry.lineIndex === index && entry.kind === 'voice')
    const current = index === snapshot.lineIndex && snapshot.nextText
    const text = current || last?.adapted || line.text
    return { id: line.id, original: line.text, text, adapted: !isUnchangedS2SLine(line.text, text), state: index < snapshot.lineIndex ? 'spoken' : last && snapshot.phase === 'paused' && index === snapshot.lineIndex ? 'partial' : 'pending' }
  })
}
