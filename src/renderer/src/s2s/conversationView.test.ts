import { expect, it } from 'vitest'
import { conversationMessages, sessionLines } from './conversationView'
import { S2SController, type S2SLogEntry } from './controller'

const base = new S2SController({ now: () => 0, changed: () => {}, completed: () => {}, adapt: async () => { throw new Error() }, speak: async () => {} }).snapshot
const logs: S2SLogEntry[] = [
  { atMs: 0, kind: 'proposed', text: '', utteranceId: 1, lineIndex: 0, original: 'Ciao', adapted: 'Ciao' },
  { atMs: 1, kind: 'voice', text: '', utteranceId: 1, responseId: 1, lineIndex: 0, original: 'Ciao', adapted: 'Ciao' },
  { atMs: 2, kind: 'spoken', text: '', utteranceId: 1, lineIndex: 0, adapted: 'Ciao' },
  { atMs: 3, kind: 'simulation-model', text: '', responseId: 1, accepted: true, transcript: 'Testo simulato' },
  { atMs: 4, kind: 'decision', text: '', responseId: 1, accepted: true, transcript: 'Testo realmente ascoltato' },
  { atMs: 5, kind: 'decision', text: '', responseId: 1, accepted: false, transcript: 'Risposta obsoleta' },
  { atMs: 6, kind: 'proposed', text: '', utteranceId: 2, lineIndex: 1, original: 'Limiti?', adapted: 'E per il costo?' }
]

it('shows only started utterances and replaces simulated text with accepted audio transcription', () => {
  expect(conversationMessages({ ...base, log: logs })).toMatchObject([
    { role: 'neb', text: 'Ciao', state: 'spoken' },
    { role: 'model', text: 'Testo realmente ascoltato', state: 'transcribed' }
  ])
})

it('shows adaptation and session progress independently of source script completion flags', () => {
  const snapshot = { ...base, script: [{ id: 'a', text: 'Ciao' }, { id: 'b', text: 'Limiti?' }], lineIndex: 1, total: 2, phase: 'ready' as const, nextText: 'E per il costo?', log: logs }
  expect(sessionLines(snapshot)).toMatchObject([
    { original: 'Ciao', text: 'Ciao', state: 'spoken' },
    { original: 'Limiti?', text: 'E per il costo?', state: 'pending', adapted: true }
  ])
})
