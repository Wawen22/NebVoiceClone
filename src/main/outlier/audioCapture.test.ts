import { expect, it } from 'vitest'
import { AudioCaptureRelay } from './audioCapture'
import type { S2SAudioEvent } from '../../shared/s2s'

const target = { tabId: 1, windowId: 2, documentId: 'doc', url: 'https://example.test/s2s', title: 'S2S' }
const start = { kind: 's2sAudio', state: 'active', captureId: 'capture-1', target }
const chunk = { kind: 's2sAudio', state: 'pcm', captureId: 'capture-1', target, sequence: 0, pcm: Buffer.alloc(3200).toString('base64') }

it('forwards authenticated audio only for the associated destination', () => {
  const events: S2SAudioEvent[] = []
  const relay = new AudioCaptureRelay((event) => events.push(event))
  relay.receive(start, target)
  relay.receive(chunk, target)
  const last = events.at(-1)
  expect(last?.type).toBe('pcm')
  if (last?.type === 'pcm') expect(last.pcm.length).toBe(3200)
  relay.receive({ ...chunk, sequence: 1, target: { ...target, tabId: 99 } }, target)
  expect(relay.status.state).toBe('error')
  expect(events.filter((e) => e.type === 'pcm')).toHaveLength(1)
})

it('fails on sequence gaps instead of interpreting missing audio as silence', () => {
  const relay = new AudioCaptureRelay(() => undefined)
  relay.receive(start, target); relay.receive(chunk, target)
  relay.receive({ ...chunk, sequence: 2 }, target)
  expect(relay.status.state).toBe('error')
})

it('rejects oversized malformed PCM and ignores packets from an old capture', () => {
  const events: S2SAudioEvent[] = []
  const relay = new AudioCaptureRelay((event) => events.push(event))
  relay.receive(start, target)
  relay.receive({ ...chunk, captureId: 'old' }, target)
  expect(relay.status.state).toBe('active')
  expect(events.filter((e) => e.type === 'pcm')).toHaveLength(0)
  relay.receive({ ...chunk, pcm: '!' }, target)
  expect(relay.status.state).toBe('error')
  relay.receive(start, target)
  relay.receive({ ...chunk, pcm: Buffer.alloc(6400).toString('base64') }, target)
  expect(relay.status.state).toBe('error')
})

it('clears destination on disconnect and prevents late chunks from reviving capture', () => {
  const relay = new AudioCaptureRelay(() => undefined)
  relay.receive(start, target); relay.disconnect('Scheda chiusa')
  relay.receive(chunk, null)
  expect(relay.status.state).toBe('inactive')
  expect(relay.status.target).toBeNull()
})
