import { afterEach, expect, it, vi } from 'vitest'
import { AvatarSession, type AvatarClient } from './session'

afterEach(() => vi.useRealTimers())
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve() }
function fixture() {
  const events = new Map<string, () => void>()
  const client: AvatarClient = { start: vi.fn(async () => {}), stop: vi.fn(async () => {}), sendAudioData: vi.fn(), ClearBuffer: vi.fn(), on: (name, callback) => { events.set(name, callback) } }
  const audio = { muted: false, volume: 1, pause: vi.fn(), play: vi.fn(async () => {}), srcObject: {}, setSinkId: vi.fn(async () => {}) } as unknown as HTMLAudioElement
  const video = { muted: true, pause: vi.fn(), play: vi.fn(async () => {}), srcObject: {} } as unknown as HTMLVideoElement
  const session = new AvatarSession(async () => ({ sessionToken: 'temporary', iceServers: [] }), () => client)
  session.attach(video, audio)
  return { session, client, audio, emit: (name: string) => events.get(name)?.() }
}
it('waits for received speaking and final silence, never finishing on a mid-turn pause', async () => {
  vi.useFakeTimers(); const f = fixture(), started = vi.fn(), ended = vi.fn(), error = vi.fn()
  await f.session.begin('face', 'cable', 0.5, started, ended, error)
  f.session.append(new Uint8Array(48000)); expect(started).not.toHaveBeenCalled()
  f.emit('speaking'); expect(started).toHaveBeenCalledOnce()
  f.emit('silent'); await vi.advanceTimersByTimeAsync(1500); expect(ended).not.toHaveBeenCalled()
  f.session.append(new Uint8Array(48000)); f.session.finish()
  f.emit('speaking'); f.emit('silent')
  await vi.advanceTimersByTimeAsync(2250)
  expect(ended).toHaveBeenCalledOnce(); expect(error).not.toHaveBeenCalled()
  expect(f.audio.setSinkId).toHaveBeenCalledWith('cable')
})
it('invalidates token requests when Stop arrives before connect', async () => {
  let release!: (value: { sessionToken: string; iceServers: RTCIceServer[] }) => void
  const create = vi.fn()
  const session = new AvatarSession(() => new Promise((resolve) => { release = resolve }), create)
  session.attach({ pause() {}, srcObject: null } as HTMLVideoElement, { pause() {}, srcObject: null } as HTMLAudioElement)
  const pending = session.connect('face', 'default', 1), rejected = expect(pending).rejects.toThrow()
  session.disconnect(); release({ sessionToken: 'late', iceServers: [] }); await rejected; await flush()
  expect(create).not.toHaveBeenCalled()
})
it('ignores obsolete SDK events after disconnect and reports loss during playback', async () => {
  const f = fixture(), started = vi.fn(), ended = vi.fn(), error = vi.fn()
  await f.session.begin('face', 'default', 1, started, ended, error)
  f.session.append(new Uint8Array(480)); f.emit('error')
  expect(error).toHaveBeenCalledOnce(); expect(f.client.stop).toHaveBeenCalled()
  f.emit('speaking'); f.emit('silent'); expect(started).not.toHaveBeenCalled(); expect(ended).not.toHaveBeenCalled()
})
it('fails a stalled utterance instead of hanging the Live controller', async () => {
  vi.useFakeTimers(); const f = fixture(), error = vi.fn()
  await f.session.begin('face', 'default', 1, vi.fn(), vi.fn(), error)
  f.session.append(new Uint8Array(480)); f.session.finish()
  await vi.advanceTimersByTimeAsync(16000)
  expect(error).toHaveBeenCalledOnce()
})
it('rejects a concurrent begin while the first connection is pending', async () => {
  const f = fixture()
  const first = f.session.begin('face', 'default', 1, vi.fn(), vi.fn(), vi.fn())
  await expect(f.session.begin('face', 'default', 1, vi.fn(), vi.fn(), vi.fn())).rejects.toThrow('gia')
  await first
  f.session.disconnect()
})
it('drains late chunks after a mid-turn pause before ending', async () => {
  vi.useFakeTimers(); const f = fixture(), ended = vi.fn()
  await f.session.begin('face', 'default', 1, vi.fn(), ended, vi.fn())
  f.session.append(new Uint8Array(48000)); f.emit('speaking'); f.emit('silent')
  await vi.advanceTimersByTimeAsync(3000)
  f.session.append(new Uint8Array(48000)); f.session.finish(); f.emit('silent')
  await vi.advanceTimersByTimeAsync(500)
  expect(ended).not.toHaveBeenCalled()
  await vi.advanceTimersByTimeAsync(1000)
  expect(ended).toHaveBeenCalledOnce()
  f.session.disconnect()
})
it('reports an external disconnect to the active playback owner', async () => {
  const f = fixture(), error = vi.fn()
  await f.session.begin('face', 'default', 1, vi.fn(), vi.fn(), error)
  f.session.append(new Uint8Array(480)); f.session.disconnect()
  expect(error).toHaveBeenCalledOnce()
})
