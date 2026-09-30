import { expect, it, vi } from 'vitest'
import { createConnection, type Socket } from 'node:net'
import { once } from 'node:events'
import { FrameDecoder, NativeBridge, encodeFrame } from './bridge'

it('decodes partial and consecutive UTF-8 Native Messaging frames', () => {
  const decoder = new FrameDecoder()
  const packet = Buffer.concat([encodeFrame({ text: 'È 😀' }), encodeFrame({ answer: 2 })])
  expect(decoder.push(packet.subarray(0, 2))).toEqual([])
  expect(decoder.push(packet.subarray(2))).toEqual([{ text: 'È 😀' }, { answer: 2 }])
})
it('rejects oversized frames and malformed JSON before passing messages', () => {
  const decoder = new FrameDecoder()
  const header = Buffer.alloc(4); header.writeUInt32LE(1024 * 1024 + 1)
  expect(() => decoder.push(header)).toThrow()
  expect(() => new FrameDecoder().push(Buffer.from([1, 0, 0, 0, 123]))).toThrow()
})

const windowsTest = it.runIf(process.platform === 'win32')
const extensionId = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const origin = 'chrome-extension://' + extensionId + '/'
const target = { tabId: 1, windowId: 2, documentId: 'document-1', url: 'http://localhost/demo', title: 'Demo' }
async function connect(bridge: NativeBridge): Promise<Socket> {
  const socket = createConnection('\\\\.\\pipe\\' + bridge.pipeName)
  await once(socket, 'connect')
  return socket
}
async function authenticated(bridge: NativeBridge): Promise<Socket> {
  const socket = await connect(bridge)
  const associated = once(socket, 'data')
  socket.write(encodeFrame({ kind: 'hello', version: 1, origin, token: bridge.token, processId: 42 }))
  socket.write(encodeFrame({ kind: 'associated', target }))
  // A request is sent from the association callback, proving the hello was processed.
  await associated
  return socket
}
windowsTest('rejects wrong credentials and origin and keeps the authenticated connection when another client joins', async () => {
  const associated = vi.fn()
  const disconnected = vi.fn()
  const bridge = new NativeBridge((value) => {
    associated(value)
    void bridge.request('native', 'probe', {}).catch(() => undefined)
  }, disconnected, () => undefined)
  bridge.setExtensionId(extensionId); await bridge.listen()
  let accepted: Socket | undefined
  try {
    for (const hello of [
      { origin, token: 'b'.repeat(64) },
      { origin: 'chrome-extension://' + 'b'.repeat(32) + '/', token: bridge.token }
    ]) {
      const rejected = await connect(bridge)
      const closed = once(rejected, 'close')
      rejected.write(encodeFrame({ kind: 'hello', version: 1, ...hello }))
      await closed
      expect(associated).not.toHaveBeenCalled()
    }
    accepted = await authenticated(bridge)
    expect(associated).toHaveBeenCalledWith(target)
    expect(bridge.hostProcessId).toBe(42)
    const duplicate = await connect(bridge)
    const closed = once(duplicate, 'close')
    duplicate.write(encodeFrame({ kind: 'hello', version: 1, origin, token: bridge.token }))
    await closed
    expect(accepted.destroyed).toBe(false)
    expect(disconnected).not.toHaveBeenCalled()
  } finally { accepted?.destroy(); bridge.close() }
})
windowsTest('correlates replies, ignores an obsolete reply and disconnects when an outstanding request is aborted', async () => {
  let client: Socket | undefined
  let acknowledge!: () => void
  const ready = new Promise<void>((resolve) => { acknowledge = resolve })
  const bridge = new NativeBridge(() => acknowledge(), () => undefined, () => undefined)
  bridge.setExtensionId(extensionId); await bridge.listen()
  try {
    client = await connect(bridge)
    client.write(encodeFrame({ kind: 'hello', version: 1, origin, token: bridge.token, processId: 42 }))
    client.write(encodeFrame({ kind: 'associated', target }))
    await ready
    const incoming = once(client, 'data')
    const first = bridge.request('native', 'probe', {})
    const [chunk] = await incoming
    const command = new FrameDecoder().push(chunk as Buffer)[0] as { requestId: string }
    client.write(encodeFrame({ kind: 'reply', requestId: command.requestId, result: { hwnd: '42' } }))
    await expect(first).resolves.toEqual({ hwnd: '42' })
    const nextIncoming = once(client, 'data')
    const signal = new AbortController()
    const pending = bridge.request('native', 'type', { text: 'È' }, signal.signal)
    const rejected = expect(pending).rejects.toThrow('interrotto')
    await nextIncoming
    client.write(encodeFrame({ kind: 'reply', requestId: command.requestId, result: 'obsolete' }))
    signal.abort()
    await rejected
    const closed = once(client, 'close')
    await closed
    await expect(bridge.request('native', 'type', { text: 'x' })).rejects.toThrow('non disponibile')
  } finally { client?.destroy(); bridge.close() }
})
windowsTest('times out an unconfirmed command and closes its transport', async () => {
  let client: Socket | undefined
  let acknowledge!: () => void
  const ready = new Promise<void>((resolve) => { acknowledge = resolve })
  const bridge = new NativeBridge(() => acknowledge(), () => undefined, () => undefined)
  bridge.setExtensionId(extensionId); await bridge.listen()
  try {
    client = await connect(bridge)
    client.write(encodeFrame({ kind: 'hello', version: 1, origin, token: bridge.token }))
    client.write(encodeFrame({ kind: 'associated', target }))
    await ready
    vi.useFakeTimers()
    const pending = bridge.request('native', 'type', { text: 'x' })
    const rejected = expect(pending).rejects.toThrow('Timeout')
    await vi.advanceTimersByTimeAsync(3001)
    await rejected
    vi.useRealTimers()
    await expect(bridge.request('native', 'probe', {})).rejects.toThrow('non disponibile')
  } finally { vi.useRealTimers(); client?.destroy(); bridge.close() }
})
