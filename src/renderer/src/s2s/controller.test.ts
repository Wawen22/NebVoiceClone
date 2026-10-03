import { expect, it } from 'vitest'
import { S2SController } from './controller'
import type { S2SAdaptRequest, S2SDecision } from '../../../shared/s2s'

const decision: S2SDecision = { action: 'speak', transcript: 'La soluzione è economica.', nextText: 'E quali limiti ha?', reason: 'Risposta conclusa', costUsd: 0.002, qwenMs: 100 }
const flush = async (): Promise<void> => { for (let i = 0; i < 8; i++) await Promise.resolve() }

function session(options = {}) {
  let now = 1000
  const spoken: string[] = [], done: string[] = []
  const requests: Array<{ request: S2SAdaptRequest; signal: AbortSignal; resolve: (d: S2SDecision) => void }> = []
  const plays: Array<{ signal: AbortSignal; resolve: () => void }> = []
  const controller = new S2SController({
    now: () => now, changed: () => undefined, completed: (id) => done.push(id),
    adapt: (request, signal) => new Promise((resolve) => requests.push({ request, signal, resolve })),
    speak: (text, signal, onStarted) => {
      if (!onStarted()) return Promise.reject(new Error('cancelled'))
      spoken.push(text)
      return new Promise((resolve) => plays.push({ signal, resolve }))
    }
  })
  const feed = (voice: boolean, frames = 1): void => {
    for (let f = 0; f < frames; f++) {
      now += 100
      const pcm = new Uint8Array(3200)
      if (voice) { const view = new DataView(pcm.buffer); for (let i = 0; i < 1600; i++) view.setInt16(i * 2, 2000, true) }
      controller.feed(pcm); controller.tick()
    }
  }
  const advance = (ms: number): void => { now += ms; controller.tick() }
  controller.start([{ id: '1', text: 'Descrivi la soluzione.' }, { id: '2', text: 'Quali limiti ha?' }], 'Scenario', options)
  return { controller, spoken, done, requests, plays, feed, advance }
}

it('waits for actual playback completion and 2500ms of received silence before adapting', async () => {
  const s = session()
  expect(s.done).toEqual([])
  s.plays[0].resolve(); await flush()
  expect(s.done).toEqual(['1'])
  s.feed(true, 3); s.feed(false, 24)
  expect(s.requests).toHaveLength(0)
  s.feed(false)
  expect(s.requests).toHaveLength(1)
  expect(s.requests[0].request.nextLine?.id).toBe('2')
  s.requests[0].resolve(decision); await flush(); s.feed(false, 4)
  expect(s.spoken).toEqual(['Descrivi la soluzione.', 'E quali limiti ha?'])
})

it('does not advance for filler-only or incomplete responses', async () => {
  const s = session(); s.plays[0].resolve(); await flush()
  s.feed(true, 2); s.feed(false, 25)
  s.requests[0].resolve({ ...decision, action: 'wait', nextText: '', transcript: 'Ehm…', reason: 'Incompleta' }); await flush()
  s.feed(false, 30)
  expect(s.requests).toHaveLength(1)
  expect(s.spoken).toHaveLength(1)
  s.feed(true, 3); s.feed(false, 25)
  expect(s.requests).toHaveLength(2)
})

it('invalidates a Qwen proposal when Outlier starts speaking again', async () => {
  const s = session(); s.plays[0].resolve(); await flush()
  s.feed(true, 3); s.feed(false, 25)
  s.feed(true, 2)
  expect(s.requests[0].signal.aborted).toBe(true)
  s.requests[0].resolve(decision); await flush()
  expect(s.spoken).toHaveLength(1)
  s.feed(false, 25)
  expect(s.requests).toHaveLength(2)
  expect(s.requests[1].request.audioPcm!.length).toBeGreaterThan(s.requests[0].request.audioPcm!.length)
})

it('prevents a late API result from restarting voice after Stop', async () => {
  const s = session(); s.plays[0].resolve(); await flush()
  s.feed(true, 3); s.feed(false, 25)
  s.controller.stop()
  s.requests[0].resolve(decision); await flush(); s.feed(false, 4)
  expect(s.spoken).toHaveLength(1)
  expect(s.controller.snapshot.phase).toBe('stopped')
})

it('allows a brief backchannel during NEB voice but interrupts sustained Outlier speech', async () => {
  const s = session()
  s.feed(true, 3); s.feed(false, 5)
  expect(s.plays[0].signal.aborted).toBe(false)
  s.feed(true, 12)
  expect(s.plays[0].signal.aborted).toBe(true)
  expect(s.done).toEqual([])
  s.plays[0].resolve(); await flush()
  s.feed(false, 25)
  expect(s.requests[0].request.nextLine?.id).toBe('1')
  expect(s.requests[0].request.history[0].partial).toBe(true)
})

it('pauses on missing PCM instead of inventing a silent end of turn', async () => {
  const s = session(); s.plays[0].resolve(); await flush()
  s.feed(true, 3); s.advance(1600)
  expect(s.controller.snapshot.phase).toBe('paused')
  expect(s.requests).toHaveLength(0)
})

it('listens to the final response and completes without synthesizing another line', async () => {
  const s = session(); s.plays[0].resolve(); await flush()
  s.feed(true, 3); s.feed(false, 25)
  s.requests[0].resolve(decision); await flush(); s.feed(false, 4)
  s.plays[1].resolve(); await flush()
  expect(s.controller.snapshot.phase).toBe('listening')
  s.feed(true, 3); s.feed(false, 25)
  expect(s.requests[1].request.nextLine).toBeNull()
  s.requests[1].resolve({ ...decision, action: 'complete', nextText: '' }); await flush()
  expect(s.controller.snapshot.phase).toBe('completed')
  expect(s.spoken).toHaveLength(2)
})

it('pauses when spending exceeds the limit, including the just-finished request', async () => {
  const s = session({ maxCostUsd: 0.001 }); s.plays[0].resolve(); await flush()
  s.feed(true, 3); s.feed(false, 25); s.requests[0].resolve(decision); await flush()
  expect(s.controller.snapshot.phase).toBe('paused')
  expect(s.spoken).toHaveLength(1)
})

it('pauses without a response and requires explicit replay after a partial user turn', async () => {
  const s = session(); s.controller.pause('Pausa manuale')
  s.plays[0].resolve(); await flush()
  s.controller.resume()
  s.feed(false, 300)
  expect(s.controller.snapshot.phase).toBe('paused')
  expect(s.spoken).toHaveLength(1)
  expect(s.done).toEqual([])
  s.controller.resume(true)
  expect(s.spoken).toHaveLength(2)
})

it('enforces the user-turn and session-duration limits', async () => {
  const s = session({ maxTurns: 1 }); s.plays[0].resolve(); await flush()
  s.feed(true, 3); s.feed(false, 25); s.requests[0].resolve(decision); await flush(); s.feed(false, 4)
  expect(s.spoken).toHaveLength(1)
  expect(s.controller.snapshot.phase).toBe('paused')
  const duration = session({ maxDurationMs: 60000 })
  duration.advance(60001)
  expect(duration.controller.snapshot.phase).toBe('paused')
})

it('does not commit an obsolete transcript to context before a proposal is spoken', async () => {
  const s = session(); s.plays[0].resolve(); await flush()
  s.feed(true, 3); s.feed(false, 25)
  s.requests[0].resolve(decision); await flush()
  s.feed(true, 2); s.feed(false, 25)
  expect(s.requests[1].request.history).toEqual([{ role: 'user', text: 'Descrivi la soluzione.' }])
})

it('stops additional API requests when a cancelled request used the remaining budget', async () => {
  const s = session({ maxCostUsd: 0.001 }); s.plays[0].resolve(); await flush()
  s.feed(true, 3); s.feed(false, 25); s.feed(true, 2)
  s.requests[0].resolve(decision); await flush(); s.feed(false, 25)
  expect(s.requests).toHaveLength(1)
  expect(s.controller.snapshot.phase).toBe('paused')
})
it('requires explicit replay when Qwen proposes the identical whole original line after interruption', async () => {
  const s = session(); s.feed(true, 12); s.feed(false, 25)
  s.requests[0].resolve({ ...decision, nextText: 'Descrivi la soluzione.' }); await flush(); s.feed(false, 4)
  expect(s.spoken).toHaveLength(1)
  expect(s.controller.snapshot.phase).toBe('paused')
})
it('counts MODEL A simulation replies in the shared OpenRouter budget', async () => {
  const s = session({ maxCostUsd: 0.001 })
  s.plays[0].resolve(); await flush()
  expect(s.controller.recordSimulationReply({ text: 'Risposta simulata.', modelMs: 30, costUsd: 0.001 })).toBe(false)
  expect(s.controller.snapshot.phase).toBe('paused')
  expect(s.controller.snapshot.costUsd).toBe(0.001)
})
it('records late simulation cost during pause and refuses resume when the observed budget is exhausted', () => {
  const s = session({ maxCostUsd: 0.001 }); s.controller.pause()
  s.controller.recordSimulationReply({ text: 'Risposta tardiva.', modelMs: 100, costUsd: 0.001 })
  expect(s.controller.snapshot.costUsd).toBe(0.001)
  s.controller.resume()
  expect(s.controller.snapshot.phase).toBe('paused')
})

it('clears the spoken preview while listening and exposes the frozen session script', async () => {
  const s = session()
  expect(s.controller.snapshot.script.map((line) => line.id)).toEqual(['1', '2'])
  s.plays[0].resolve(); await flush()
  expect(s.controller.snapshot.nextText).toBe('')
  expect(s.controller.snapshot.log.find((entry) => entry.kind === 'voice')).toMatchObject({ lineIndex: 0, adapted: 'Descrivi la soluzione.' })
  s.feed(true, 3); s.feed(false, 25)
  expect(s.requests[0].request.remainingCostUsd).toBe(1)
})

it('refuses unchanged proposals even if a provider bypasses the repair guard', async () => {
  const s = session(); s.plays[0].resolve(); await flush()
  s.feed(true, 3); s.feed(false, 25)
  s.requests[0].resolve({ ...decision, nextText: 'QUALI LIMITI HA!' }); await flush(); s.feed(false, 4)
  expect(s.controller.snapshot.phase).toBe('paused')
  expect(s.spoken).toHaveLength(1)
})

it('marks late decisions as discarded so they cannot appear as accepted transcript', async () => {
  const s = session(); s.plays[0].resolve(); await flush()
  s.feed(true, 3); s.feed(false, 25); s.controller.stop()
  s.requests[0].resolve(decision); await flush()
  expect(s.controller.snapshot.log.find((entry) => entry.kind === 'decision')?.accepted).toBe(false)
})

it('accounts for the known initial charge when a cancelled repair has uncertain total cost', async () => {
  const s = session(); s.plays[0].resolve(); await flush()
  s.feed(true, 3); s.feed(false, 25); s.controller.pause(); s.controller.resume()
  s.requests[0].resolve({ ...decision, action: 'pause', nextText: '', costUsd: null, knownCostUsd: 0.001 }); await flush(); s.feed(false)
  expect(s.controller.snapshot.costUsd).toBe(0.001)
  expect(s.controller.snapshot.costKnown).toBe(false)
  expect(s.controller.snapshot.phase).toBe('paused')
})

it('prepares from MODEL text during speech but waits for actual playback completion before using it', async () => {
  const s = session(); s.plays[0].resolve(); await flush()
  s.controller.prepareTranscript('La soluzione è economica.')
  expect(s.requests[0].request.transcript).toBe('La soluzione è economica.')
  expect(s.requests[0].request.audioPcm).toBeUndefined()
  s.requests[0].resolve(decision); await flush()
  expect(s.controller.snapshot.nextText).toBe('E quali limiti ha?')
  s.feed(true, 30); s.feed(false, 30)
  expect(s.spoken).toHaveLength(1)
  s.controller.finishTranscriptPlayback(); s.feed(false, 4)
  expect(s.spoken).toHaveLength(2)
  expect(s.requests).toHaveLength(1)
})

it('discards prepared text when stopped and still counts its late cost', async () => {
  const s = session(); s.plays[0].resolve(); await flush()
  s.controller.prepareTranscript('Risposta completa.')
  s.controller.stop(); s.requests[0].resolve(decision); await flush()
  s.controller.finishTranscriptPlayback(); s.feed(false, 40)
  expect(s.spoken).toHaveLength(1)
  expect(s.controller.snapshot.costUsd).toBe(0.002)
})

it('refuses an adaptive instruction as opener rather than reading the plan aloud', () => {
  const s = session(); s.controller.stop()
  expect(() => s.controller.start([{ id: 'x', text: '[ADAPT LIVE — react to MODEL A]' }], '')).toThrow()
})

it('freezes task context and refuses a script with too few required user turns', () => {
  const s = session(); s.controller.stop()
  const context = { scenarioType: 'IQ', skillsTested: 'Metodo socratico', adaptationLevel: 'L1' as const, minimumUserTurns: 3, material: 'Brano preparato' }
  expect(() => s.controller.start([{ id: 'a', text: 'Ciao' }], 'What to do', {}, context)).toThrow(/almeno 3 turni/)
  const lines = ['Ciao', 'Domanda', 'Conclusione'].map((text, id) => ({ id: String(id), text }))
  s.controller.start(lines, 'What to do', {}, context)
  context.skillsTested = 'Modificato dopo avvio'
  expect(s.controller.snapshot.taskContext.skillsTested).toBe('Metodo socratico')
  expect(s.controller.snapshot.scenario).toBe('What to do')
})

it('does not declare completion from the final text before the last MODEL audio finishes', async () => {
  const s = session(); s.plays[0].resolve(); await flush()
  s.controller.prepareTranscript('Prima risposta.'); s.requests[0].resolve(decision); await flush()
  s.feed(true, 3); s.controller.finishTranscriptPlayback(); s.feed(false, 4)
  s.plays[1].resolve(); await flush()
  s.controller.prepareTranscript('Risposta finale.'); s.requests[1].resolve({ ...decision, action: 'complete', nextText: '' }); await flush()
  s.feed(true, 3); s.feed(false, 30)
  expect(s.controller.snapshot.phase).toBe('listening')
  s.controller.finishTranscriptPlayback(); s.feed(false, 4)
  expect(s.controller.snapshot.phase).toBe('completed')
})

it('falls back to the audio route when anticipatory preparation is disabled', async () => {
  const s = session({ anticipateText: false }); s.plays[0].resolve(); await flush()
  s.controller.prepareTranscript('Testo disponibile.'); s.controller.finishTranscriptPlayback()
  expect(s.requests).toHaveLength(0)
  s.feed(true, 3); s.feed(false, 25)
  expect(s.requests[0].request.audioPcm?.length).toBeGreaterThan(0)
})

it('never reads a pending adaptive instruction when explicitly replaying after pause', async () => {
  const s = session(); s.controller.stop()
  s.controller.start([{ id: 'open', text: 'Ciao.' }, { id: 'plan', text: '[ADAPT LIVE — ask for a hint]' }], '')
  s.plays[1].resolve(); await flush()
  s.controller.pause(); s.controller.resume(true)
  expect(s.spoken).toEqual(['Descrivi la soluzione.', 'Ciao.'])
  expect(s.controller.snapshot.phase).toBe('paused')
})
