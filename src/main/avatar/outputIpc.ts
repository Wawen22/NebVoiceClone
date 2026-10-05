import type { AvatarOutputRelay } from './outputRelay'
type OutputRelay = Pick<AvatarOutputRelay, 'getStatus' | 'setEnabled' | 'getUrl' | 'beginGeneration' | 'publish' | 'clear'>
export function registerAvatarOutputIpc<E>(
  handle: (channel: string, handler: (event: E, value?: unknown) => unknown) => void,
  assertTrusted: (event: E) => void,
  relay: OutputRelay
): void {
  const generation = (value: unknown): string => {
    if (typeof value !== 'string' || !value || value.length > 100) throw new Error('Generazione avatar non valida.')
    return value
  }
  handle('avatarOutput:status', (event) => { assertTrusted(event); return relay.getStatus() })
  handle('avatarOutput:url', (event) => { assertTrusted(event); return relay.getUrl() })
  handle('avatarOutput:begin', (event) => { assertTrusted(event); return relay.beginGeneration() })
  handle('avatarOutput:enabled', (event, value) => {
    assertTrusted(event)
    if (typeof value !== 'boolean') throw new Error('Abilitazione avatar non valida.')
    return relay.setEnabled(value)
  })
  handle('avatarOutput:frame', (event, value) => {
    assertTrusted(event)
    if (!value || typeof value !== 'object') throw new Error('Frame avatar non valido.')
    const frame = value as { generation?: unknown; jpeg?: unknown }
    const id = generation(frame.generation)
    if (!(frame.jpeg instanceof Uint8Array) || frame.jpeg.byteLength > 256 * 1024) throw new Error('Frame avatar non valido.')
    return relay.publish({ generation: id, jpeg: frame.jpeg })
  })
  handle('avatarOutput:clear', (event, value) => { assertTrusted(event); relay.clear(generation(value)) })
}
