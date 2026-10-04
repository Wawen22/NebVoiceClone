import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { runInNewContext } from 'node:vm'
import { afterEach, expect, it, vi } from 'vitest'

type Packet = { kind: string; requestId?: string; target?: Record<string, unknown>; [key: string]: unknown }
function event<T extends (...args: never[]) => unknown>() {
  let listener: T
  return { addListener: (callback: T) => { listener = callback }, emit: (...args: Parameters<T>) => listener(...args) }
}
function connector() {
  const tab = { id: 1, windowId: 2, url: 'https://chatgpt.com/c/test', title: 'Saluto informale' }
  const incoming = event<(message: Packet) => Promise<void>>()
  const disconnected = event<() => void>()
  const onMessage = event<(message: Packet, sender: { url: string; tab?: { id: number } }, reply: (value: Record<string, unknown>) => void) => unknown>()
  const onUpdated = event<(id: number, change: { status: string }) => void>()
  const postMessage = vi.fn<(message: Packet) => void>()
  const chrome = {
    runtime: {
      onMessage, lastError: undefined as { message: string } | undefined,
      getURL: (path: string) => 'chrome-extension://test/' + path,
      connectNative: () => ({ onMessage: incoming, onDisconnect: disconnected, postMessage }),
      getContexts: async () => [{ contextType: 'OFFSCREEN_DOCUMENT' }],
      sendMessage: vi.fn(async () => ({ ok: true }))
    },
    tabs: { query: async () => [tab], sendMessage: async () => ({ documentId: 'document-1', url: tab.url }), onRemoved: event<(id: number) => void>(), onUpdated },
    scripting: { executeScript: async () => undefined },
    tabCapture: { getMediaStreamId: vi.fn(async () => 'stream-id') }
  }
  runInNewContext(readFileSync('browser-extension/background.js', 'utf8'), { chrome, crypto: { randomUUID }, setTimeout, clearTimeout })
  const send = (kind: string) => new Promise<Record<string, unknown>>((resolve) => {
    onMessage.emit({ kind }, { url: chrome.runtime.getURL('popup.html') }, resolve)
  })
  const associate = async () => {
    const reply = send('associate')
    await vi.waitFor(() => expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({ kind: 'associated' })))
    const packet = postMessage.mock.calls.find(([value]) => value.kind === 'associated')![0]
    return { reply, packet }
  }
  const confirm = (packet: Packet, target = packet.target) => incoming.emit({ kind: 'browser', action: 'associated', requestId: packet.requestId, payload: { target } })
  return { send, associate, confirm, chrome, disconnected, postMessage, onUpdated }
}
afterEach(() => vi.useRealTimers())

it('waits for NEB confirmation and reports connected separately from audio capture', async () => {
  const browser = connector()
  const { reply, packet } = await browser.associate()
  const replied = vi.fn()
  void reply.then(replied)
  expect(await browser.send('audio-status')).toMatchObject({ active: false, connected: false })
  expect(await browser.send('audio-start')).toMatchObject({ error: expect.stringContaining('Attendi la conferma') })
  expect(replied).not.toHaveBeenCalled()
  await browser.confirm(packet)
  expect(await reply).toEqual({ ok: true, title: 'Saluto informale' })
  expect(await browser.send('audio-status')).toMatchObject({ active: false, connected: true, title: 'Saluto informale' })
  expect(await browser.send('audio-start')).toEqual({ ok: true })
  expect(browser.chrome.tabCapture.getMediaStreamId).toHaveBeenCalledWith({ targetTabId: 1 })
  expect(await browser.send('audio-status')).toMatchObject({ active: true, connected: true })
})

it('reports native disconnection instead of a false association success and clears the error on reconnect', async () => {
  const browser = connector()
  const { reply } = await browser.associate()
  browser.chrome.runtime.lastError = { message: 'Native host has exited.' }
  browser.disconnected.emit()
  expect(await reply).toMatchObject({ error: expect.stringContaining('Native host has exited.') })
  expect(await browser.send('audio-start')).toMatchObject({ error: expect.stringContaining('Collegamento a NEB interrotto') })
  expect(await browser.send('audio-status')).toMatchObject({ connected: false, active: false, error: expect.stringContaining('Native host has exited.') })
  browser.postMessage.mockClear()
  const again = await browser.associate()
  await browser.confirm(again.packet)
  expect(await again.reply).toMatchObject({ ok: true })
  expect(await browser.send('audio-status')).toMatchObject({ connected: true, error: null })
})

it('times out when NEB does not confirm and never enables capture from an unconfirmed association', async () => {
  vi.useFakeTimers()
  const browser = connector()
  const { reply } = await browser.associate()
  await vi.advanceTimersByTimeAsync(5000)
  expect(await reply).toMatchObject({ error: expect.stringContaining('NEB non ha confermato') })
  expect(await browser.send('audio-status')).toMatchObject({ connected: false })
  expect(await browser.send('audio-start')).toMatchObject({ error: expect.stringContaining('NEB non ha confermato') })
  expect(browser.chrome.tabCapture.getMediaStreamId).not.toHaveBeenCalled()
})

it('rejects confirmation for another destination and stops a pending association on navigation', async () => {
  const browser = connector()
  const { reply, packet } = await browser.associate()
  await browser.confirm(packet, { ...packet.target, documentId: 'other-document' })
  expect(await reply).toMatchObject({ error: expect.stringContaining('scheda diversa') })
  expect(await browser.send('audio-status')).toMatchObject({ connected: false })
  browser.postMessage.mockClear()
  const again = await browser.associate()
  browser.onUpdated.emit(1, { status: 'loading' })
  expect(await again.reply).toMatchObject({ error: expect.stringContaining('pagina è cambiata') })
  await browser.confirm(again.packet)
  expect(await browser.send('audio-status')).toMatchObject({ connected: false })
})

it('keeps one pending association when the popup is clicked repeatedly', async () => {
  const browser = connector()
  const { reply, packet } = await browser.associate()
  expect(await browser.send('associate')).toMatchObject({ error: expect.stringContaining('Collegamento in corso') })
  expect(await browser.send('associate')).toMatchObject({ error: expect.stringContaining('Collegamento in corso') })
  expect(browser.postMessage).toHaveBeenCalledTimes(1)
  await browser.confirm(packet)
  expect(await reply).toMatchObject({ ok: true })
})
