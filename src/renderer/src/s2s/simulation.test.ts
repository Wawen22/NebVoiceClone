import { expect, it } from 'vitest'
import { PcmTimeline, SimulatedModel, localSimulationOutputs } from './simulation'
import type { S2SSimulationReply, S2SSimulationRequest } from '../../../shared/s2s'

const voice = (samples: number, value = 2000): Uint8Array => {
  const pcm = new Uint8Array(samples * 2), view = new DataView(pcm.buffer)
  for (let i = 0; i < samples; i++) view.setInt16(i * 2, value, true)
  return pcm
}
const reply: S2SSimulationReply = { text: 'Inizia con una prova.', modelMs: 50, costUsd: 0.001 }
const flush = async (): Promise<void> => { for (let i = 0; i < 12; i++) await Promise.resolve() }

it('offers explicit physical outputs instead of the default or virtual cable route', () => {
  expect(localSimulationOutputs([
    { deviceId: 'default', label: 'System default' }, { deviceId: 'communications', label: 'Default communication' },
    { deviceId: 'cable', label: 'CABLE Input (VB-Audio)' }, { deviceId: 'unknown', label: 'Output 3' },
    { deviceId: 'headphones', label: 'Cuffie Realtek' }
  ]).map((d) => d.deviceId)).toEqual(['headphones'])
})

it('feeds 16kHz PCM only during its scheduled 24kHz playback, including real silence', () => {
  const timeline = new PcmTimeline()
  timeline.schedule(voice(4800), 200)
  expect(timeline.read(200).every((v) => v === 0)).toBe(true)
  const first = timeline.read(300)
  expect(first.length).toBe(3200)
  expect(new DataView(first.buffer).getInt16(100, true)).toBe(2000)
  timeline.schedule(voice(2400, -32768), 500)
  expect(new DataView(timeline.read(400).buffer).getInt16(100, true)).toBe(2000)
  expect(timeline.read(500).every((v) => v === 0)).toBe(true)
  expect(new DataView(timeline.read(600).buffer).getInt16(100, true)).toBe(-32768)
  timeline.clear()
  expect(timeline.read(700).every((v) => v === 0)).toBe(true)
})
it('aligns split PCM chunks and bounds queued audio', () => {
  const timeline = new PcmTimeline()
  timeline.schedule(voice(1200, 1000), 0)
  timeline.schedule(voice(1200, 3000), 50)
  const frame = new DataView(timeline.read(100).buffer)
  expect(frame.getInt16(0, true)).toBe(1000)
  expect(frame.getInt16(2000, true)).toBe(3000)
  expect(() => timeline.schedule(new Uint8Array(1), 200)).toThrow()
  expect(() => timeline.schedule(new Uint8Array(5_760_002), 200)).toThrow()
})
function model() {
  let request: S2SSimulationRequest | null = null, resolve!: (reply: S2SSimulationReply) => void
  const spoken: string[] = []
  const signal = { current: null as AbortSignal | null }
  const simulation = new SimulatedModel('Scenario', {
    reply: (value, abort) => { request = value; signal.current = abort; return new Promise((r) => { resolve = r }) },
    play: async (text, abort) => { abort.throwIfAborted(); spoken.push(text) },
    cost: () => true, state: () => undefined, failed: () => undefined
  })
  return { simulation, spoken, signal, getRequest: () => request, resolve: () => resolve(reply) }
}
it('cancels a late MODEL A reply after Stop and never starts playback', async () => {
  const s = model(); s.simulation.respond('La mia battuta.')
  s.simulation.stop(); expect(s.signal.current?.aborted).toBe(true)
  s.resolve(); await flush()
  expect(s.spoken).toEqual([])
})
it('resumes a paused MODEL A request without duplicating the user turn', async () => {
  const s = model(); s.simulation.respond('La mia battuta.')
  s.simulation.pause(); s.resolve(); await flush()
  s.simulation.resume()
  expect(s.getRequest()?.history).toEqual([{ role: 'user', text: 'La mia battuta.' }])
  s.resolve(); await flush()
  expect(s.spoken).toEqual(['Inizia con una prova.'])
})
it('does not play a reply when its cost exhausts the conversation budget', async () => {
  let played = false
  const simulation = new SimulatedModel('', { reply: async () => reply, play: async () => { played = true }, cost: () => false, state: () => undefined, failed: () => undefined })
  simulation.respond('Ciao'); await flush()
  expect(played).toBe(false)
})
it('replays a completed MODEL A answer after pause without another paid reply or duplicate history', async () => {
  const s = model(); s.simulation.respond('La mia battuta.'); s.resolve(); await flush()
  s.simulation.pause(); s.simulation.resume(); await flush()
  expect(s.spoken).toEqual(['Inizia con una prova.', 'Inizia con una prova.'])
})
it('accounts for an observed paid reply after pause while suppressing its playback', async () => {
  let release!: (value: S2SSimulationReply) => void, observed = 0, played = 0
  const simulation = new SimulatedModel('', {
    reply: () => new Promise((resolve) => { release = resolve }), play: async () => { played++ },
    cost: (reply) => { observed += reply.costUsd!; return true }, state: () => undefined, failed: () => undefined
  })
  simulation.respond('Ciao'); simulation.pause(); release(reply); await flush()
  expect(observed).toBe(0.001)
  expect(played).toBe(0)
})
it('drains every elapsed frame when a 300ms renderer stall delays the simulation ticker', () => {
  const timeline = new PcmTimeline()
  timeline.schedule(voice(9600), 0)
  timeline.begin(0)
  expect(timeline.drain(100)).toHaveLength(1)
  const delayed = timeline.drain(400)
  expect(delayed).toHaveLength(3)
  expect(delayed.every((pcm) => new DataView(pcm.buffer).getInt16(100, true) === 2000)).toBe(true)
})

it('reports obsolete paid replies as discarded even after the model has resumed', async () => {
  const releases: Array<(reply: S2SSimulationReply) => void> = [], accepted: boolean[] = []
  const simulation = new SimulatedModel('', {
    reply: () => new Promise((resolve) => releases.push(resolve)), play: async () => {},
    cost: (_reply, current) => { accepted.push(current); return true }, state: () => {}, failed: () => {}
  })
  simulation.respond('Ciao'); simulation.pause(); simulation.resume()
  releases[0](reply); await flush()
  releases[1](reply); await flush()
  expect(accepted).toEqual([false, true])
})

it('publishes complete MODEL text before playback and signals the end only after playback finishes', async () => {
  const events: string[] = []
  let ended!: () => void
  const simulation = new SimulatedModel('', {
    reply: async () => reply, play: async () => { events.push('playing'); await new Promise<void>((resolve) => { ended = resolve }) },
    ready: (text) => events.push(text), ended: () => events.push('ended'), cost: () => true, state: () => {}, failed: () => {}
  })
  simulation.respond('Ciao'); await flush()
  expect(events).toEqual([reply.text, 'playing'])
  ended(); await flush()
  expect(events.at(-1)).toBe('ended')
})

it('reuses an already generated reply after pause during voice preparation without another paid text request', async () => {
  let calls = 0, release!: () => void
  const played: string[] = []
  const simulation = new SimulatedModel('', {
    reply: async () => { calls++; return reply },
    play: async (text, signal) => {
      played.push(text)
      if (played.length === 1) { await new Promise<void>((resolve) => { release = resolve }); signal.throwIfAborted() }
    }, cost: () => true, state: () => {}, failed: () => {}
  })
  simulation.respond('Ciao'); await flush()
  simulation.pause(); release(); await flush()
  simulation.resume(); await flush()
  expect(calls).toBe(1)
  expect(played).toEqual([reply.text, reply.text])
})
