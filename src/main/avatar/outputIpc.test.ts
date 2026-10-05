import { describe, expect, it } from 'vitest'
import { registerAvatarOutputIpc } from './outputIpc'

describe('avatar output IPC', () => {
  function setup() {
    const handlers = new Map<string, (event: unknown, value?: unknown) => unknown>()
    let enabled = false
    const relay = { getStatus: () => ({ enabled, available: false, viewers: 0, error: 'Porta occupata' }), setEnabled: (value: boolean) => { enabled = value; return relay.getStatus() }, getUrl: () => 'secret-url', beginGeneration: () => 'generation', publish: () => true, clear: () => undefined }
    registerAvatarOutputIpc((channel, handler) => handlers.set(channel, handler), (event) => { if (event !== 'trusted') throw new Error('Untrusted window.') }, relay)
    return handlers
  }
  it('rejects every channel from untrusted frames and keeps status secret-free', () => {
    const handlers = setup(); expect(handlers.size).toBe(6)
    for (const handler of handlers.values()) expect(() => handler('foreign')).toThrow('Untrusted window.')
    expect(handlers.get('avatarOutput:status')!('trusted')).toEqual({ enabled: false, available: false, viewers: 0, error: 'Porta occupata' })
  })
  it('validates enablement and frame payloads before using the relay', () => {
    const handlers = setup()
    expect(() => handlers.get('avatarOutput:enabled')!('trusted', 'true')).toThrow()
    for (const value of [null, {}, { generation: '', jpeg: new Uint8Array(8) }, { generation: 'g', jpeg: new Uint8Array(256 * 1024 + 1) }]) expect(() => handlers.get('avatarOutput:frame')!('trusted', value)).toThrow()
    expect(() => handlers.get('avatarOutput:clear')!('trusted', 5)).toThrow()
    expect(handlers.get('avatarOutput:enabled')!('trusted', true)).toMatchObject({ enabled: true })
  })
})
