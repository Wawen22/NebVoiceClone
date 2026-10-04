import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { expect, it } from 'vitest'

function worker(captureStream: () => Promise<string> = async () => 'stream-1') {
  let listener: any, nativeListener: any, updated: any, disconnected: any
  const posted: any[] = [], runtimeMessages: any[] = []
  const target = { tabId: 1, windowId: 2, documentId: 'doc', url: 'https://example.test/s2s', title: 'S2S' }
  const chrome = {
    runtime: {
      id: 'test', getURL: (path: string) => 'chrome-extension://test/' + path,
      getContexts: async () => [], sendMessage: async (m: any) => { runtimeMessages.push(m); return { ok: true } },
      connectNative: () => ({ postMessage: (m: any) => {
        posted.push(m)
        if (m.kind === 'associated') void nativeListener({ kind: 'browser', action: 'associated', requestId: m.requestId, payload: { target: m.target } })
      }, onMessage: { addListener: (fn: any) => nativeListener = fn }, onDisconnect: { addListener: (fn: any) => disconnected = fn } }),
      onMessage: { addListener: (fn: any) => listener = fn }
    },
    offscreen: { createDocument: async () => undefined },
    tabCapture: { getMediaStreamId: captureStream },
    scripting: { executeScript: async () => undefined },
    tabs: { query: async () => [{ id: 1, windowId: 2, url: target.url, title: 'S2S' }],
      get: async () => ({ id: 1, windowId: 2, url: target.url, active: true }),
      sendMessage: async () => ({ documentId: 'doc', url: target.url }),
      onRemoved: { addListener: () => undefined }, onUpdated: { addListener: (fn: any) => updated = fn } },
    windows: { get: async () => ({ focused: false }) }
  }
  runInNewContext(readFileSync('browser-extension/background.js', 'utf8'), { chrome, crypto: { randomUUID: () => 'capture-1' }, setTimeout, clearTimeout, Date })
  const message = (value: any, sender = { url: 'chrome-extension://test/popup.html' }): Promise<any> => new Promise((resolve) => {
    if (listener(value, sender, resolve) !== true) resolve(undefined)
  })
  return { message, posted, runtimeMessages, target, native: (m: any) => nativeListener(m), navigate: () => updated(1, { status: 'loading' }), disconnect: () => disconnected() }
}

it('starts capture only from the extension popup and forwards only the offscreen source', async () => {
  const w = worker()
  await w.message({ kind: 'associate' })
  expect((await w.message({ kind: 'audio-start' })).ok).toBe(true)
  const capture = w.runtimeMessages.find((m) => m.action === 'audio-start')
  expect(capture.streamId).toBe('stream-1')
  await w.message({ kind: 'audio-frame', captureId: 'capture-1', state: 'active' }, { url: 'https://example.test/s2s' })
  expect(w.posted.filter((m) => m.kind === 's2sAudio')).toHaveLength(0)
  await w.message({ kind: 'audio-frame', captureId: 'capture-1', state: 'active' }, { url: 'chrome-extension://test/offscreen.html' })
  expect(w.posted.at(-1).target.tabId).toBe(1)
})

it('refuses association and capture requests from other extension pages or web tabs', async () => {
  const w = worker()
  for (const sender of [{ url: 'chrome-extension://test/offscreen.html' }, { url: 'https://meet.example.test/interview', tab: { id: 1 } }]) {
    expect(await w.message({ kind: 'associate' }, sender)).toBeUndefined()
    expect(await w.message({ kind: 'audio-start' }, sender)).toBeUndefined()
  }
  expect(w.posted).toHaveLength(0)
  expect(w.runtimeMessages).toHaveLength(0)
})

it('allows NEB to stop audio without bringing Edge to the foreground', async () => {
  const w = worker()
  await w.message({ kind: 'associate' }); await w.message({ kind: 'audio-start' })
  await w.native({ kind: 'browser', action: 'audio-stop', requestId: 'stop', payload: {}, deadline: Date.now() + 2000 })
  expect(w.runtimeMessages.at(-1).action).toBe('audio-stop')
  expect(w.posted.at(-1)).toMatchObject({ kind: 'reply', requestId: 'stop', result: { stopped: true } })
})

it('stops capture on navigation and ignores late audio from the obsolete document', async () => {
  const w = worker()
  await w.message({ kind: 'associate' }); await w.message({ kind: 'audio-start' })
  w.navigate()
  await w.message({ kind: 'audio-frame', captureId: 'capture-1', state: 'pcm', pcm: 'old', sequence: 0 }, { url: 'chrome-extension://test/offscreen.html' })
  expect(w.runtimeMessages.at(-1).action).toBe('audio-stop')
  expect(w.posted.filter((m) => m.kind === 's2sAudio' && m.state === 'pcm')).toHaveLength(0)
})
it('does not start a capture after Stop while the stream ID is still being obtained', async () => {
  let resolve!: (id: string) => void
  let entered!: () => void
  const obtaining = new Promise<void>((ready) => { entered = ready })
  const w = worker(() => { entered(); return new Promise<string>((ready) => { resolve = ready }) })
  await w.message({ kind: 'associate' })
  const starting = w.message({ kind: 'audio-start' })
  await obtaining
  await w.message({ kind: 'audio-stop' })
  resolve('obsolete-stream')
  expect((await starting).error).toBeTruthy()
  expect(w.runtimeMessages.filter((m) => m.action === 'audio-start')).toHaveLength(0)
})
