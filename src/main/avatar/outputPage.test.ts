import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'
import { createAvatarOutputPage } from './outputPage'

function fixture() {
  const assigned: string[] = []
  const image = { style: { visibility: 'hidden' }, onload: () => {}, onerror: () => {}, removeAttribute: () => {} }
  Object.defineProperty(image, 'src', { set: (value: string) => assigned.push(value) })
  let events: { onmessage: (event: { data: string }) => void; onerror: () => void }
  class EventSource {
    onmessage = (_event: { data: string }) => {}
    onerror = () => {}
    close() {}
    constructor() { events = this }
  }
  const script = createAvatarOutputPage().match(/<script>([\s\S]*?)<\/script>/)![1]
  runInNewContext(script, { document: { querySelector: () => image }, URLSearchParams, location: { search: '' }, crypto: { randomUUID: () => 'viewer' }, EventSource, setInterval: () => {}, addEventListener: () => {}, Date })
  return { image, assigned, send: (active: boolean, jpeg?: string) => events.onmessage({ data: JSON.stringify({ active, jpeg }) }), disconnect: () => events.onerror() }
}

describe('avatar output page decoding', () => {
  it('finishes decoding before replacing the source and keeps only the latest pending frame', () => {
    const f = fixture()
    f.send(true, 'first'); f.send(true, 'second'); f.send(true, 'latest')
    expect(f.assigned).toEqual(['data:image/jpeg;base64,first'])
    f.image.onload()
    expect(f.assigned).toEqual(['data:image/jpeg;base64,first', 'data:image/jpeg;base64,latest'])
  })
  it('discards pending images on inactive state or disconnect', () => {
    for (const disconnect of [false, true]) {
      const f = fixture(); f.send(true, 'first'); f.send(true, 'pending')
      if (disconnect) f.disconnect(); else f.send(false)
      f.image.onload()
      expect(f.assigned).toHaveLength(1)
      expect(f.image.style.visibility).toBe('hidden')
      f.send(true, 'new'); expect(f.assigned.at(-1)).toBe('data:image/jpeg;base64,new')
    }
  })
  it('recovers from an image decoding error using the latest pending frame', () => {
    const f = fixture(); f.send(true, 'bad'); f.send(true, 'new')
    expect(f.assigned).toEqual(['data:image/jpeg;base64,bad'])
    f.image.onerror()
    expect(f.assigned).toEqual(['data:image/jpeg;base64,bad', 'data:image/jpeg;base64,new'])
  })
})
