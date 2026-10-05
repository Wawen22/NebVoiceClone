import { afterEach, expect, it, vi } from 'vitest'
import { AvatarAudioEngine } from './AvatarAudioEngine'
import { AvatarSession, type AvatarClient } from './session'
import type { AudioEngine } from '../audio/AudioEngine'

afterEach(() => vi.useRealTimers())
it('plays received avatar audio exclusively and retains generated speech for avatar replay', async () => {
  vi.useFakeTimers()
  const events = new Map<string, () => void>()
  const client: AvatarClient = { start: async () => {}, stop: async () => {}, ClearBuffer() {}, sendAudioData: vi.fn(), on: (event, callback) => { events.set(event, callback) } }
  const session = new AvatarSession(async () => ({ sessionToken: 'temporary', iceServers: [] }), () => client)
  session.attach({ pause() {}, play: async () => {} } as unknown as HTMLVideoElement, { pause() {}, play: async () => {}, setSinkId: async () => {}, muted: true } as unknown as HTMLAudioElement)
  session.setEnabled(true)
  const local = { beginStream: vi.fn(), appendPcm: vi.fn(), finishStream: vi.fn(), stop: vi.fn(), setVolume() {}, onEnded() {}, dispose() {} } as unknown as AudioEngine
  const engine = new AvatarAudioEngine(local, session), started = vi.fn(), ended = vi.fn()
  engine.onStarted(started); engine.onEnded(ended)
  await engine.beginStream('default'); engine.appendPcm(new Uint8Array(4800)); expect(engine.finishStream()).toBe(0.1)
  expect(local.beginStream).not.toHaveBeenCalled(); expect(local.appendPcm).not.toHaveBeenCalled()
  events.get('speaking')!(); events.get('silent')!(); await vi.advanceTimersByTimeAsync(1000)
  expect(started).toHaveBeenCalledOnce(); expect(ended).toHaveBeenCalledOnce()
  await engine.replay('default')
  expect(client.sendAudioData).toHaveBeenCalledTimes(2)
  await engine.replay('default')
  expect(client.sendAudioData).toHaveBeenCalledTimes(3)
  engine.stop()
})
it('delegates to the existing audio engine when avatar is disabled', async () => {
  const session = new AvatarSession(async () => { throw new Error('Must not call Simli') }, vi.fn())
  const local = { beginStream: vi.fn(async () => {}), appendPcm: vi.fn(), finishStream: () => 1, stop() {}, onEnded() {} } as unknown as AudioEngine
  const engine = new AvatarAudioEngine(local, session)
  await engine.beginStream('cable'); engine.appendPcm(new Uint8Array(48000)); expect(engine.finishStream()).toBe(1)
  expect(local.beginStream).toHaveBeenCalledWith('cable'); expect(local.appendPcm).toHaveBeenCalledOnce()
})
