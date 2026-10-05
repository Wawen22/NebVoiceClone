import { describe, expect, it } from 'vitest'
import { LiveController } from './controller'
import type { LiveConfig, LiveDecision, LiveTurnRequest } from '../../../shared/live'
import type { LiveMaterial } from '../../../shared/liveMaterials'

const config: LiveConfig = { schemaVersion: 1, background: 'Esperienza documentata', persona: 'Diretto e naturale', selectedProfileId: 'interview', profiles: [{ id: 'interview', name: 'Colloquio', context: 'Sviluppo', language: 'it', tone: 'professional' }] }
const decision = (text = 'Partirei dal problema concreto.'): LiveDecision => ({ action: 'speak', transcript: 'Come affronti il debugging?', text, reason: 'Domanda completa', costUsd: 0.01, qwenMs: 100 })
const material: LiveMaterial = { id: 'code', name: 'Code', kind: 'text', text: 'const n = 1;', addedAt: 1 }
const frame = (voice = false): Uint8Array => {
  const pcm = new Uint8Array(3200)
  if (voice) { const view = new DataView(pcm.buffer); for (let i = 0; i < pcm.length; i += 2) view.setInt16(i, 3000, true) }
  return pcm
}
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (error: unknown) => void; const promise = new Promise<T>((r, j) => { resolve = r; reject = j }); return { promise, resolve, reject } }
function setup() {
  let now = 0
  const requests: LiveTurnRequest[] = [], signals: AbortSignal[] = []
  const replies: ReturnType<typeof deferred<LiveDecision>>[] = []
  const plays: { text: string; signal: AbortSignal; start: () => boolean; done: ReturnType<typeof deferred<void>> }[] = []
  const controller = new LiveController({ now: () => now, changed: () => undefined,
    decide: (request, signal) => { requests.push(request); signals.push(signal); const next = deferred<LiveDecision>(); replies.push(next); return next.promise },
    speak: (text, signal, start) => { const done = deferred<void>(); plays.push({ text, signal, start, done }); return done.promise }
  })
  const feed = (count: number, voice = false) => { for (let i = 0; i < count; i++) { now += 100; controller.feed(frame(voice)); controller.tick() } }
  return { controller, requests, signals, replies, plays, feed, jump: (ms: number) => { now += ms }, advance: (ms: number) => { now += ms; controller.tick() } }
}
const settle = async () => { for (let i = 0; i < 5; i++) await Promise.resolve() }

describe('NEB Live free conversation', () => {
  it('starts reasoning after 1.5 seconds of observed silence by default', () => {
    const h = setup(); h.controller.start(config, false); h.feed(10, true); h.feed(14)
    expect(h.requests).toHaveLength(0)
    h.feed(1)
    expect(h.requests).toHaveLength(1)
  })
  it('records wall-clock time from last observed speech to first playback, not only synthesis', async () => {
    const h = setup(); h.controller.start(config, false, { silenceMs: 1500 }); h.feed(10, true); h.jump(700); h.feed(15)
    h.replies[0].resolve(decision()); await settle(); h.feed(3); h.feed(8)
    expect(h.plays[0].start()).toBe(true)
    expect(h.controller.snapshot.log.find(item => item.kind === 'turn-response')).toMatchObject({ durationMs: 3300 })
    expect(h.controller.snapshot.log.find(item => item.kind === 'voice-start')).toMatchObject({ durationMs: 800 })
  })
  it('never records response latency for an opening or cancelled playback', async () => {
    const opening = setup(); opening.controller.start(config, true)
    opening.replies[0].resolve({ ...decision(), transcript: '' }); await settle(); opening.feed(3); opening.plays[0].start()
    expect(opening.controller.snapshot.log.some(item => item.kind === 'turn-response')).toBe(false)
    const stopped = setup(); stopped.controller.start(config, false, { silenceMs: 1500 }); stopped.feed(10, true); stopped.feed(15)
    stopped.replies[0].resolve(decision()); await settle(); stopped.feed(3); stopped.controller.stop()
    expect(stopped.plays[0].start()).toBe(false)
    expect(stopped.controller.snapshot.log.some(item => item.kind === 'turn-response')).toBe(false)
  })
  it('records preparation and first-audible latency without mixing it with Qwen time', async () => {
    const h = setup(); h.controller.start(config, false); h.feed(10, true); h.feed(25)
    h.replies[0].resolve(decision()); await settle(); h.feed(3)
    h.feed(8); h.plays[0].start()
    expect(h.controller.snapshot.log.find((item) => item.kind === 'voice-start')).toMatchObject({ durationMs: 800 })
    expect(h.controller.snapshot.log.find((item) => item.kind === 'decision')?.qwenMs).toBe(100)
    expect(h.controller.snapshot.log.some((item) => item.kind === 'reasoning-start')).toBe(true)
  })
  it('publishes and updates the unanswered transcript before voice, without duplicating the request or chat', async () => {
    const h = setup(); h.controller.start(config, false); h.feed(10, true); h.feed(25)
    h.replies[0].resolve({ ...decision(), action: 'wait', text: '', transcript: 'How do you' }); await settle()
    expect(h.controller.snapshot.history[0].text).toBe('How do you')
    const id = h.controller.snapshot.history[0].id
    h.feed(8, true); h.feed(25)
    expect(h.requests[1].history).toEqual([])
    h.replies[1].resolve({ ...decision(), transcript: 'How do you debug this?' }); await settle(); h.feed(3)
    expect(h.controller.snapshot.phase).toBe('preparing-voice')
    expect(h.controller.snapshot.history).toHaveLength(1)
    expect(h.controller.snapshot.history[0]).toMatchObject({ id, text: 'How do you debug this?' })
    h.plays[0].start(); expect(h.controller.snapshot.history.map((item) => item.role)).toEqual(['interlocutor', 'neb'])
  })

  it('stays listening during several minutes spent reading code', () => {
    const h = setup(); h.controller.start(config, false); h.feed(1800)
    expect(h.controller.snapshot.phase).toBe('listening')
    expect(h.requests).toEqual([])
  })

  it('tolerates a short packet delivery gap without inventing end-of-turn silence', () => {
    const h = setup(); h.controller.start(config, false); h.feed(10, true); h.advance(2200)
    expect(h.controller.snapshot.phase).toBe('listening'); expect(h.requests).toHaveLength(0)
    h.feed(10, true); h.feed(25)
    expect(h.requests).toHaveLength(1)
    expect(h.requests[0].audioPcm!.length).toBeGreaterThan(20 * 3200)
  })

  it('retries voice initialization once without a second Qwen call or duplicate transcript', async () => {
    const h = setup(); h.controller.start(config, false); h.feed(10, true); h.feed(25)
    h.replies[0].resolve(decision()); await settle(); h.feed(3)
    h.plays[0].done.reject(new Error('Gemini temporary failure')); await settle()
    expect(h.controller.snapshot.phase).toBe('ready')
    expect(h.plays[0].signal.aborted).toBe(true)
    expect(h.plays[0].start()).toBe(false)
    h.feed(18)
    expect(h.plays).toHaveLength(2); expect(h.requests).toHaveLength(1)
    expect(h.plays[1].text).toBe(h.plays[0].text)
    h.plays[1].start(); h.plays[1].done.resolve(); await settle()
    expect(h.controller.snapshot.phase).toBe('listening')
    expect(h.controller.snapshot.turns).toBe(1)
    expect(h.controller.snapshot.history).toHaveLength(2)
  })

  it('bounds voice failures, preserves the question, and lets Stop cancel a queued recovery', async () => {
    const h = setup(); h.controller.start(config, false); h.feed(10, true); h.feed(25)
    h.replies[0].resolve(decision()); await settle(); h.feed(3)
    h.plays[0].done.reject(new Error('Temporary failure')); await settle(); h.feed(18)
    h.plays[1].done.reject(new Error('Still unavailable')); await settle(); h.feed(30)
    expect(h.plays).toHaveLength(2); expect(h.controller.snapshot.phase).toBe('paused')
    expect(h.controller.snapshot.history).toHaveLength(1)
    h.controller.resume(); h.controller.respondNow()
    expect(h.requests[1].audioPcm).toEqual(h.requests[0].audioPcm)
    h.replies[1].resolve(decision()); await settle(); h.feed(3)
    h.plays[2].done.reject(new Error('Temporary failure')); await settle()
    h.controller.stop(); h.feed(30)
    expect(h.plays).toHaveLength(3); expect(h.controller.snapshot.phase).toBe('stopped')
  })

  it('recovers a pre-audio voice timeout once and suppresses its obsolete stream', async () => {
    const h = setup(); h.controller.start(config, false); h.feed(10, true); h.feed(25)
    h.replies[0].resolve(decision()); await settle(); h.feed(3); h.feed(600)
    expect(h.controller.snapshot.phase).toBe('ready')
    expect(h.plays[0].signal.aborted).toBe(true); expect(h.plays[0].start()).toBe(false)
    h.feed(18); expect(h.plays).toHaveLength(2)
    h.feed(600); expect(h.controller.snapshot.phase).toBe('paused')
  })

  it('returns to listening after a partially spoken provider failure and never replays it', async () => {
    const h = setup(); h.controller.start(config, false); h.feed(10, true); h.feed(25)
    h.replies[0].resolve(decision()); await settle(); h.feed(3); h.plays[0].start()
    h.plays[0].done.reject(new Error('Gemini stream ended unexpectedly')); await settle(); h.feed(50)
    expect(h.controller.snapshot.phase).toBe('listening'); expect(h.plays).toHaveLength(1)
    expect(h.controller.snapshot.history.at(-1)?.partial).toBe(true)
    h.feed(10, true); h.feed(25)
    expect(h.requests[1].history.at(-1)?.partial).toBe(true)
  })

  it('does not interrupt playing voice on sparse noise bursts', async () => {
    const h = setup(); h.controller.start(config, true)
    h.replies[0].resolve({ ...decision(), transcript: '' }); await settle(); h.feed(3); h.plays[0].start()
    for (let i = 0; i < 5; i++) { h.feed(1, true); h.feed(2) }
    expect(h.controller.snapshot.phase).toBe('speaking')
    expect(h.plays[0].signal.aborted).toBe(false)
    h.feed(12, true)
    expect(h.controller.snapshot.phase).toBe('listening'); expect(h.plays[0].signal.aborted).toBe(true)
  })

  it('completes sixty turns over half an hour with bounded recovery, unique transcripts and no unsolicited pauses', async () => {
    const h = setup(); h.controller.start({ ...config, limits: { durationMinutes: 45, maxTurns: 100, maxCostUsd: 5 } }, false)
    for (let i = 0; i < 60; i++) {
      h.feed(210); h.feed(50, true); h.feed(25)
      h.replies[i].resolve({ ...decision(`Answer ${i}`), transcript: `Question ${i}` }); await settle(); h.feed(3)
      if (i % 10 === 0) { h.plays.at(-1)!.done.reject(new Error('Transient voice failure')); await settle(); h.feed(18) }
      const play = h.plays.at(-1)!; expect(play.start()).toBe(true)
      h.feed(20); play.done.resolve(); await settle()
      expect(h.controller.snapshot.phase).toBe('listening')
    }
    expect(h.controller.snapshot.turns).toBe(60)
    expect(h.controller.snapshot.history).toHaveLength(120)
    expect(new Set(h.controller.snapshot.history.map((item) => item.id)).size).toBe(120)
    expect(h.controller.snapshot.log.filter((item) => item.kind === 'pause')).toHaveLength(0)
    expect(h.controller.snapshot.log.at(-1)!.atMs).toBeGreaterThan(30 * 60000)
  })

  it.each(['', 'Come affronti il debugging?'])('keeps unanswered audio for a manual retry before automatic recovery: %j', async (transcript) => {
    const h = setup(); h.controller.start(config, false); h.feed(10, true); h.feed(25)
    const originalAudio = h.requests[0].audioPcm
    h.replies[0].resolve({ action: 'wait', transcript, text: '', reason: 'Correzione incompleta', costUsd: null, knownCostUsd: 0.004, repairAttempted: true, retryable: true, qwenMs: 200 })
    await settle(); h.feed(20)
    expect(h.controller.snapshot.phase).toBe('listening')
    expect(h.controller.snapshot.history).toHaveLength(transcript ? 1 : 0)
    expect(h.controller.snapshot.costUsd).toBe(0.004)
    expect(h.controller.snapshot.costKnown).toBe(false)
    expect(h.requests).toHaveLength(1)
    expect(h.controller.canRespond).toBe(true)
    h.controller.respondNow()
    expect(h.requests[1].audioPcm).toEqual(originalAudio)
    h.replies[1].resolve(decision()); await settle(); h.feed(3)
    expect(h.plays[0].start()).toBe(true)
    expect(h.controller.snapshot.turns).toBe(1)
  })

  it('automatically retries an incomplete decision at end of turn once and never loops on the same question', async () => {
    const h = setup(); h.controller.start(config, false); h.feed(10, true); h.feed(25)
    const incomplete: LiveDecision = { action: 'wait', transcript: '', text: '', reason: 'Correzione incompleta', costUsd: 0.004, repairAttempted: true, retryable: true, qwenMs: 200 }
    h.replies[0].resolve(incomplete); await settle(); h.feed(80)
    expect(h.requests).toHaveLength(2)
    expect(h.requests[1].endOfTurn).toBe(true)
    expect(h.requests[1].audioPcm).toEqual(h.requests[0].audioPcm)
    h.replies[1].resolve(incomplete); await settle(); h.feed(200)
    expect(h.requests).toHaveLength(2)
    expect(h.controller.snapshot.phase).toBe('listening')
    expect(h.controller.canRespond).toBe(true)
    expect(h.controller.snapshot.history).toHaveLength(0)
    h.feed(8, true); h.feed(25)
    h.replies[2].resolve(incomplete); await settle(); h.feed(80)
    expect(h.requests).toHaveLength(4)
    expect(h.requests[3].endOfTurn).toBe(true)
  })

  it('lets new speech resume normal turn detection after an incomplete repaired decision', async () => {
    const h = setup(); h.controller.start(config, false); h.feed(10, true); h.feed(25)
    h.replies[0].resolve({ action: 'wait', transcript: '', text: '', reason: 'Correzione incompleta', costUsd: 0.004, repairAttempted: true, retryable: true, qwenMs: 200 })
    await settle(); h.feed(8, true); h.feed(25)
    expect(h.requests).toHaveLength(2)
    expect(h.requests[1].audioPcm!.length).toBeGreaterThan(h.requests[0].audioPcm!.length)
    expect(h.controller.snapshot.phase).toBe('thinking')
  })

  it('keeps preloaded materials through Start and clears them with New conversation', () => {
    const h = setup(); h.controller.addMaterial(material); h.controller.start(config, false)
    h.feed(4, true); h.feed(25)
    expect(h.requests[0].materials).toEqual([material])
    h.controller.stop(); expect(h.controller.snapshot.materials).toHaveLength(1)
    h.controller.reset(); expect(h.controller.snapshot.materials).toHaveLength(0)
  })

  it('reasons again with updated material without pausing or losing a pending question', async () => {
    const h = setup(); h.controller.start(config, false); h.feed(10, true); h.feed(25)
    const bytes = h.requests[0].audioPcm!.length
    h.controller.addMaterial(material)
    expect(h.signals[0].aborted).toBe(true)
    expect(h.controller.snapshot.phase).toBe('listening')
    h.feed(1)
    expect(h.requests).toHaveLength(2)
    expect(h.requests[1].materials).toEqual([material])
    expect(h.requests[1].audioPcm!.length).toBe(bytes)
    h.replies[0].resolve(decision('Old response')); await settle()
    expect(h.plays).toHaveLength(0)
    h.replies[1].resolve(decision('Updated response')); await settle(); h.feed(3)
    expect(h.plays[0].text).toBe('Updated response')
  })

  it('suppresses an obsolete voice before playback while preserving the acquired question', async () => {
    const h = setup(); h.controller.start(config, false); h.feed(10, true); h.feed(25)
    h.replies[0].resolve(decision()); await settle(); h.feed(3)
    h.controller.addMaterial(material)
    expect(h.plays[0].signal.aborted).toBe(true)
    expect(h.plays[0].start()).toBe(false)
    h.plays[0].done.resolve(); await settle(); h.feed(1)
    expect(h.requests[1].materials).toEqual([material])
    expect(h.controller.snapshot.turns).toBe(0)
    expect(h.controller.snapshot.history.map((item) => item.role)).toEqual(['interlocutor'])
  })

  it('lets active speech finish and then analyzes newly added material against the last question', async () => {
    const h = setup(); h.controller.start(config, false); h.feed(10, true); h.feed(25)
    h.replies[0].resolve(decision()); await settle(); h.feed(3); h.plays[0].start()
    h.controller.addMaterial(material)
    expect(h.plays[0].signal.aborted).toBe(false)
    expect(h.controller.snapshot.phase).toBe('speaking')
    h.plays[0].done.resolve(); await settle()
    expect(h.controller.canRespond).toBe(true)
    h.controller.respondNow()
    expect(h.requests[1].visualOnly).toBe(true)
    expect(h.requests[1].audioPcm).toBeUndefined()
    expect(h.requests[1].history[0].text).toBe('Come affronti il debugging?')
    h.replies[1].resolve({ ...decision('Il frammento ha un errore.'), transcript: '' }); await settle(); h.feed(3)
    expect(h.plays[1].start()).toBe(true)
    expect(h.controller.snapshot.history.filter((item) => item.role === 'interlocutor')).toHaveLength(1)
  })

  it('removes obsolete material from the next request and validates limits before changing context', () => {
    const h = setup(); h.controller.addMaterial(material)
    expect(() => h.controller.addMaterial(material)).toThrow('duplicato')
    h.controller.removeMaterial(material.id); h.controller.start(config, false); h.feed(10, true); h.feed(25)
    expect(h.requests[0].materials).toBeUndefined()
  })

  it('does not overflow a long question with silence while waiting for reasoning or voice', async () => {
    const h = setup(); h.controller.start(config, false)
    h.feed(1150, true); h.feed(25)
    expect(h.controller.snapshot.phase).toBe('thinking')
    h.feed(300)
    expect(h.controller.snapshot.phase).toBe('thinking')
    h.replies[0].resolve(decision()); await settle(); h.feed(3)
    expect(h.plays).toHaveLength(1)
    h.feed(400)
    expect(h.controller.snapshot.phase).toBe('preparing-voice')
    expect(h.plays[0].start()).toBe(true)
  })

  it('lets a slow decision for a long question complete after the old 35 second timeout', async () => {
    const h = setup(); h.controller.start(config, false)
    h.feed(600, true); h.feed(25); h.feed(360)
    expect(h.controller.snapshot.phase).toBe('thinking')
    h.replies[0].resolve(decision()); await settle(); h.feed(3)
    expect(h.plays[0].start()).toBe(true)
  })

  it('rechecks a wait decision once after continued silence, without waiting for new speech', async () => {
    const h = setup(); h.controller.start(config, false)
    h.feed(100, true); h.feed(25)
    h.replies[0].resolve({ ...decision(), action: 'wait', text: '' }); await settle()
    h.feed(80)
    expect(h.requests).toHaveLength(2)
    expect(h.requests[1].endOfTurn).toBe(true)
    expect(h.requests[1].audioPcm!.length).toBe(h.requests[0].audioPcm!.length)
    h.replies[1].resolve({ ...decision(), action: 'wait', text: '' }); await settle()
    h.feed(100); expect(h.requests).toHaveLength(2)
  })

  it('records a three minute interviewer turn and responds when it ends', async () => {
    const h = setup(); h.controller.start(config, false)
    h.feed(1800, true); h.feed(25)
    expect(h.requests).toHaveLength(1)
    expect(h.requests[0].audioPcm!.length).toBe(1800 * 3200)
    h.replies[0].resolve(decision()); await settle(); h.feed(3)
    expect(h.plays[0].start()).toBe(true)
  })

  it('manual response reuses the buffered question and cannot overlap another decision', async () => {
    const h = setup(); h.controller.start(config, false)
    expect(h.controller.canRespond).toBe(false)
    h.controller.respondNow(); expect(h.requests).toHaveLength(0)
    h.feed(10, true); h.feed(3)
    expect(h.controller.canRespond).toBe(true)
    h.controller.respondNow(); h.controller.respondNow()
    expect(h.requests).toHaveLength(1)
    expect(h.requests[0].endOfTurn).toBe(true)
    h.replies[0].resolve(decision()); await settle(); h.feed(22)
    expect(h.plays[0].start()).toBe(true)
  })

  it('retains an unanswered question across provider timeout and retries once without pausing', async () => {
    const h = setup(); h.controller.start(config, false)
    h.feed(100, true); h.feed(25)
    const first = h.requests[0].audioPcm!
    h.feed(410)
    expect(h.controller.snapshot.phase).toBe('listening')
    expect(h.signals[0].aborted).toBe(true)
    h.feed(50)
    expect(h.requests).toHaveLength(2)
    expect(h.requests[1].endOfTurn).toBe(true)
    expect(h.requests[1].audioPcm!.length).toBe(first.length)
    expect(h.requests[1].audioPcm!.every((byte, index) => byte === first[index])).toBe(true)
    h.replies[1].resolve(decision()); await settle(); h.feed(3)
    expect(h.plays[0].start()).toBe(true)
  })

  it('does not repeatedly analyze silence when Qwen found no actual speech', async () => {
    const h = setup(); h.controller.start(config, false)
    h.feed(5, true); h.feed(25)
    h.replies[0].resolve({ ...decision(), action: 'wait', text: '', transcript: '' }); await settle()
    h.feed(100)
    expect(h.requests).toHaveLength(1)
    expect(h.controller.canRespond).toBe(false)
  })

  it('listens first and generates a free response without any prepared line', async () => {
    const h = setup(); h.controller.start(config, false)
    expect(h.requests).toHaveLength(0)
    h.feed(8, true); h.feed(25)
    expect(h.requests).toHaveLength(1)
    expect(h.requests[0].audioPcm?.length).toBeGreaterThan(3200)
    expect(h.requests[0].profile.context).toBe('Sviluppo')
    h.replies[0].resolve(decision()); await settle(); h.feed(3)
    expect(h.plays).toHaveLength(1)
    expect(h.controller.snapshot.history.map((item) => item.role)).toEqual(['interlocutor'])
    expect(h.plays[0].start()).toBe(true)
    expect(h.controller.snapshot.history.map((item) => item.role)).toEqual(['interlocutor', 'neb'])
    h.plays[0].done.resolve(); await settle()
    expect(h.controller.snapshot.phase).toBe('listening')
    h.feed(4, true); h.feed(25)
    expect(h.requests[1].history).toHaveLength(2)
  })

  it('generates an opening and yields if the interlocutor starts talking', async () => {
    const h = setup(); h.controller.start(config, true)
    expect(h.requests[0].opening).toBe(true)
    h.feed(2, true)
    expect(h.signals[0].aborted).toBe(true)
    h.replies[0].resolve({ ...decision(), transcript: '' }); await settle(); h.feed(25)
    expect(h.plays).toHaveLength(0)
    expect(h.controller.snapshot.costUsd).toBe(0.01)
    expect(h.requests[1].opening).not.toBe(true)
  })

  it('retains incomplete audio but does not repeatedly analyze silence', async () => {
    const h = setup(); h.controller.start(config, false); h.feed(4, true); h.feed(25)
    const previousBytes = h.requests[0].audioPcm!.length
    h.replies[0].resolve({ ...decision(), action: 'wait', text: '', transcript: 'Ehm, io...' }); await settle()
    h.feed(30); expect(h.requests).toHaveLength(1)
    h.feed(5, true); h.feed(25)
    expect(h.requests[1].audioPcm!.length).toBeGreaterThan(previousBytes)
    expect(h.controller.snapshot.history).toHaveLength(1)
  })

  it('invalidates a pending response when speech resumes', async () => {
    const h = setup(); h.controller.start(config, false); h.feed(4, true); h.feed(25)
    h.feed(2, true); expect(h.signals[0].aborted).toBe(true)
    h.replies[0].resolve(decision()); await settle(); h.feed(25)
    expect(h.plays).toHaveLength(0)
    expect(h.requests).toHaveLength(2)
  })

  it('marks interrupted speech partial and preserves it in the next reasoning context', async () => {
    const h = setup(); h.controller.start(config, false); h.feed(4, true); h.feed(25)
    h.replies[0].resolve(decision()); await settle(); h.feed(3); h.plays[0].start()
    h.feed(12, true)
    expect(h.plays[0].signal.aborted).toBe(true)
    expect(h.controller.snapshot.history.at(-1)?.partial).toBe(true)
    expect(h.controller.snapshot.phase).toBe('listening')
    h.plays[0].done.resolve(); await settle(); h.feed(25)
    expect(h.requests[1].history.at(-1)?.partial).toBe(true)
  })

  it('ignores short backchannels while NEB speaks', async () => {
    const h = setup(); h.controller.start(config, false); h.feed(4, true); h.feed(25)
    h.replies[0].resolve(decision()); await settle(); h.feed(3); h.plays[0].start()
    h.feed(3, true); h.feed(5)
    expect(h.plays[0].signal.aborted).toBe(false)
    h.plays[0].done.resolve(); await settle(); h.feed(30)
    expect(h.requests).toHaveLength(1)
  })

  it('stop suppresses late reasoning and late playback callbacks while retaining observed cost', async () => {
    const h = setup(); h.controller.start(config, true); h.controller.stop()
    h.replies[0].resolve({ ...decision(), transcript: '' }); await settle(); h.feed(40)
    expect(h.controller.snapshot.phase).toBe('stopped'); expect(h.plays).toHaveLength(0)
    expect(h.controller.snapshot.costUsd).toBe(0.01)
    const second = setup(); second.controller.start(config, true)
    second.replies[0].resolve({ ...decision(), transcript: '' }); await settle(); second.feed(3)
    second.controller.stop(); expect(second.plays[0].start()).toBe(false)
    second.plays[0].done.resolve(); await settle(); expect(second.controller.snapshot.history).toHaveLength(0)
  })

  it('pause and resume never replay an interrupted response', async () => {
    const h = setup(); h.controller.start(config, true)
    h.replies[0].resolve({ ...decision(), transcript: '' }); await settle(); h.feed(3); h.plays[0].start()
    h.controller.pause(); h.controller.resume(); h.feed(30)
    expect(h.plays).toHaveLength(1); expect(h.controller.snapshot.phase).toBe('listening')
    expect(h.controller.snapshot.history[0].partial).toBe(true)
  })

  it('pauses on packet loss instead of interpreting missing audio as silence', () => {
    const h = setup(); h.controller.start(config, false); h.feed(5, true); h.advance(5100)
    expect(h.controller.snapshot.phase).toBe('paused'); expect(h.requests).toHaveLength(0)
  })

  it('plays valid decisions with missing cost, marks accounting partial and permits pause/resume', async () => {
    const h = setup(); h.controller.start(config, true)
    h.replies[0].resolve({ ...decision(), transcript: '', costUsd: null }); await settle()
    expect(h.controller.snapshot.phase).toBe('ready'); expect(h.controller.snapshot.costKnown).toBe(false)
    expect(h.controller.snapshot.costUsd).toBe(0)
    expect(h.controller.snapshot.log.some((event) => event.kind === 'accounting')).toBe(true)
    h.feed(3); expect(h.plays[0].start()).toBe(true)
    h.plays[0].done.resolve(); await settle()
    h.controller.pause(); h.controller.resume()
    expect(h.controller.snapshot.phase).toBe('listening')
    h.feed(4, true); h.feed(25)
    h.replies[1].resolve(decision()); await settle()
    expect(h.controller.snapshot.costUsd).toBe(0.01)
    expect(h.controller.snapshot.costKnown).toBe(false)
  })

  it('keeps provider failure visible and allows recovery when no cost was reported', async () => {
    const h = setup(); h.controller.start(config, true)
    h.replies[0].resolve({ ...decision(), action: 'pause', text: '', transcript: '', reason: 'Qwen timeout (35 secondi).', costUsd: null }); await settle()
    expect(h.controller.snapshot.phase).toBe('paused')
    expect(h.controller.snapshot.message).toBe('Qwen timeout (35 secondi).')
    h.controller.resume(); expect(h.controller.snapshot.phase).toBe('listening')
    expect(h.plays).toHaveLength(0)
  })

  it('still enforces observed budget when some other requests have unknown cost', async () => {
    const h = setup(); h.controller.start(config, true, { maxCostUsd: 0.005 })
    h.replies[0].resolve({ ...decision(), action: 'pause', text: '', transcript: '', costUsd: null }); await settle()
    h.controller.resume(); h.feed(4, true); h.feed(25)
    h.replies[1].resolve(decision()); await settle()
    expect(h.controller.snapshot.phase).toBe('paused')
    expect(h.controller.snapshot.message).toContain('Limite di costo')
    h.controller.resume(); expect(h.controller.snapshot.phase).toBe('paused')
  })

  it('honors cost, turn and session duration limits', async () => {
    const h = setup(); h.controller.start(config, true, { maxCostUsd: 0.005 })
    h.replies[0].resolve({ ...decision(), transcript: '' }); await settle(); expect(h.plays).toHaveLength(0)
    const turns = setup(); turns.controller.start(config, true, { maxTurns: 1 })
    turns.replies[0].resolve({ ...decision(), transcript: '' }); await settle(); turns.feed(3); turns.plays[0].start(); turns.plays[0].done.resolve(); await settle()
    expect(turns.controller.snapshot.phase).toBe('paused')
    const duration = setup(); duration.controller.start(config, false, { maxDurationMs: 500 }); duration.feed(5)
    expect(duration.controller.snapshot.phase).toBe('paused')
  })

  it('allows the final permitted turn to finish before enforcing the turn limit', async () => {
    const h = setup(); h.controller.start(config, true, { maxTurns: 1 })
    h.replies[0].resolve({ ...decision(), transcript: '' }); await settle(); h.feed(3); h.plays[0].start()
    h.feed(10)
    expect(h.controller.snapshot.phase).toBe('speaking')
    expect(h.plays[0].signal.aborted).toBe(false)
    h.plays[0].done.resolve(); await settle()
    expect(h.controller.snapshot.phase).toBe('paused')
    expect(h.controller.snapshot.history[0].partial).not.toBe(true)
  })

  it('freezes the session profile and rejects invalid session limits', () => {
    const h = setup(); const copy = structuredClone(config); h.controller.start(copy, true); copy.profiles[0].context = 'Mutated'
    expect(h.requests[0].profile.context).toBe('Sviluppo')
    expect(() => setup().controller.start(config, false, { silenceMs: Number.NaN })).toThrow()
  })

  it('new conversation clears history and costs and ignores a late response from the previous session', async () => {
    const h = setup(); h.controller.start(config, true)
    h.controller.reset()
    expect(h.signals[0].aborted).toBe(true)
    expect(h.controller.locked).toBe(false)
    expect(h.controller.snapshot).toMatchObject({ phase: 'idle', history: [], log: [], turns: 0, costUsd: 0, level: 0, startedAt: 0 })
    h.controller.start(config, true)
    expect(h.requests[1].history).toEqual([])
    h.replies[0].resolve({ ...decision('Vecchia risposta.'), transcript: '' }); await settle()
    expect(h.controller.snapshot.costUsd).toBe(0)
    expect(h.controller.snapshot.log.map((item) => item.kind)).toEqual(['session', 'reasoning-start'])
    expect(h.controller.snapshot.phase).toBe('thinking')
    h.replies[1].resolve({ ...decision('Nuova risposta.'), transcript: '' }); await settle(); h.feed(3)
    expect(h.plays.map((play) => play.text)).toEqual(['Nuova risposta.'])
  })

  it('new conversation stops playback and an obsolete playback callback cannot repopulate the transcript', async () => {
    const h = setup(); h.controller.start(config, true)
    h.replies[0].resolve({ ...decision(), transcript: '' }); await settle(); h.feed(3); h.plays[0].start()
    expect(h.controller.snapshot.history).toHaveLength(1)
    h.controller.reset()
    expect(h.plays[0].signal.aborted).toBe(true)
    expect(h.plays[0].start()).toBe(false)
    h.plays[0].done.resolve(); await settle()
    expect(h.controller.snapshot).toMatchObject({ phase: 'idle', history: [], log: [], turns: 0, nextText: '' })
  })

  it('sends the complete speech with only 300ms of trailing silence to Qwen', () => {
    const h = setup(); h.controller.start(config, false)
    h.feed(4, true); h.feed(25)
    const audio = h.requests[0].audioPcm!
    expect(audio.length).toBe(7 * 3200)
    expect(audio.slice(0, 4 * 3200).some((byte) => byte !== 0)).toBe(true)
    expect(audio.slice(4 * 3200).every((byte) => byte === 0)).toBe(true)
  })

  it('uses the selected silence duration and still invalidates a rapid response when speech resumes', async () => {
    const h = setup(); h.controller.start(config, false, { silenceMs: 1500 })
    h.feed(4, true); h.feed(14)
    expect(h.requests).toHaveLength(0)
    h.feed(1)
    expect(h.requests).toHaveLength(1)
    h.feed(2, true)
    expect(h.signals[0].aborted).toBe(true)
    h.replies[0].resolve(decision()); await settle()
    expect(h.plays).toHaveLength(0)
  })

  it('keeps a 30 minute interview active with saved 45 minute limits and pauses at the selected duration', () => {
    const h = setup()
    h.controller.start({ ...config, limits: { durationMinutes: 45, maxTurns: 100, maxCostUsd: 1 } }, false, { responseTimeoutMs: 60 * 60000 })
    h.jump(30 * 60000); h.feed(1)
    expect(h.controller.snapshot.phase).toBe('listening')
    expect(h.controller.limits).toEqual({ durationMinutes: 45, maxTurns: 100, maxCostUsd: 1 })
    h.jump(15 * 60000); h.feed(1)
    expect(h.controller.snapshot.phase).toBe('paused')
    expect(h.controller.snapshot.message).toContain('Limite di durata')
  })

  it('extends a reached turn limit while paused without clearing history or replaying the last answer', async () => {
    const h = setup(); h.controller.start(config, true, { maxTurns: 1 })
    h.replies[0].resolve({ ...decision(), transcript: '' }); await settle(); h.feed(3); h.plays[0].start(); h.plays[0].done.resolve(); await settle()
    const history = [...h.controller.snapshot.history]
    expect(h.controller.snapshot.phase).toBe('paused')
    h.controller.updateLimits({ durationMinutes: 45, maxTurns: 100, maxCostUsd: 1 })
    h.controller.resume(); h.feed(5)
    expect(h.controller.snapshot.phase).toBe('listening')
    expect(h.controller.snapshot.history).toEqual(history)
    expect(h.controller.snapshot.turns).toBe(1)
    expect(h.controller.snapshot.costUsd).toBe(0.01)
    expect(h.plays).toHaveLength(1)
  })

  it('extends an expired duration without restarting its clock and requires pause to edit limits', () => {
    const h = setup(); h.controller.start(config, false, { responseTimeoutMs: 60 * 60000 })
    expect(() => h.controller.updateLimits({ durationMinutes: 45, maxTurns: 100, maxCostUsd: 1 })).toThrow('pausa')
    h.jump(21 * 60000); h.feed(1)
    expect(h.controller.snapshot.phase).toBe('paused')
    h.controller.updateLimits({ durationMinutes: 45, maxTurns: 100, maxCostUsd: 1 }); h.controller.resume()
    expect(h.controller.snapshot.phase).toBe('listening')
    expect(h.controller.snapshot.startedAt).toBe(0)
    h.jump(24 * 60000); h.feed(1)
    expect(h.controller.snapshot.phase).toBe('paused')
  })
})
