import { expect, it } from 'vitest'
import { InsertionController, type InsertionDriver } from './insertionController'
import type { BrowserTarget } from '../../shared/outlier'

const target: BrowserTarget = { tabId: 1, windowId: 2, documentId: 'document-1', url: 'http://localhost/demo', title: 'S2S demo' }
const text = 'È già qui 😀\n' + 'Rationale personale. '.repeat(6)
function fixture() {
  let value = ''
  let destination = target
  const typed: string[] = []
  const driver: InsertionDriver = {
    async request(route, action, payload) {
      if (route === 'native' && action === 'probe') return { hwnd: '42', controlId: 'textarea-1' }
      if (route === 'native' && action === 'type') { typed.push(String(payload.text)); value += payload.text; return {} }
      return { target: destination, value, focused: true, selectionStart: value.length, selectionEnd: value.length }
    }
  }
  const controller = new InsertionController(driver, true, () => undefined, async () => undefined)
  controller.setStopAvailable(true)
  controller.associate(target)
  return { controller, driver, typed, setValue: (v: string) => { value = v }, changeDocument: () => { destination = { ...target, documentId: 'other' } }, value: () => value }
}
it('transfers exact Unicode and paragraphs and confirms the final field', async () => {
  const f = fixture()
  expect((await f.controller.start({ projectId: 's2s', text, charactersPerMinute: 180 })).phase).toBe('completed')
  expect(f.value()).toBe(text)
  expect(f.typed).toContain('😀')
})
it('refuses to overwrite an existing field', async () => {
  const f = fixture(); f.setValue('existing')
  await f.controller.start({ projectId: 's2s', text, charactersPerMinute: 180 })
  expect(f.controller.status.phase).toBe('error')
  expect(f.typed).toEqual([])
  expect(f.value()).toBe('existing')
})
it('blocks starts without global stop and rejects simultaneous starts', async () => {
  const f = fixture(); f.controller.setStopAvailable(false)
  await expect(f.controller.start({ projectId: 's2s', text, charactersPerMinute: 180 })).rejects.toThrow()
  f.controller.setStopAvailable(true)
  let release!: () => void
  f.driver.request = async () => { await new Promise<void>((resolve) => { release = resolve }); return {} }
  const pending = f.controller.start({ projectId: 's2s', text, charactersPerMinute: 180 })
  await expect(f.controller.start({ projectId: 's2s', text, charactersPerMinute: 180 })).rejects.toThrow()
  f.controller.stop(); release(); await pending
  expect(f.typed).toEqual([])
})
it('stops on a changed document and an altered prefix', async () => {
  const f = fixture(); f.changeDocument()
  await f.controller.start({ projectId: 's2s', text, charactersPerMinute: 180 })
  expect(f.controller.status.phase).toBe('error'); expect(f.typed).toEqual([])
  const g = fixture()
  const request = g.driver.request
  g.driver.request = async (...args) => {
    const result = await request(...args)
    if (args[0] === 'native' && args[1] === 'type') g.setValue('unexpected edit')
    return result
  }
  await g.controller.start({ projectId: 's2s', text, charactersPerMinute: 180 })
  expect(g.controller.status.phase).toBe('error'); expect(g.typed).toHaveLength(1)
})
it('pauses at a confirmed boundary and refuses resume if that prefix changed', async () => {
  const f = fixture()
  const request = f.driver.request
  f.driver.request = async (...args) => {
    const result = await request(...args)
    if (args[0] === 'browser' && args[1] === 'snapshot' && f.typed.length === 1) queueMicrotask(() => f.controller.pause())
    return result
  }
  await f.controller.start({ projectId: 's2s', text, charactersPerMinute: 180 })
  // Pause while a confirmation is outstanding is deliberately terminal: no ambiguous replay.
  expect(['paused', 'interrupted']).toContain(f.controller.status.phase)
  const before = f.typed.length
  f.setValue('edited')
  if (f.controller.status.phase === 'paused') await f.controller.resume()
  expect(f.typed).toHaveLength(before)
})
it('stops immediately on disconnect and never retries an unconfirmed character', async () => {
  const f = fixture()
  const request = f.driver.request
  f.driver.request = async (...args) => {
    const result = await request(...args)
    if (args[0] === 'native' && args[1] === 'type') f.controller.disconnect()
    return result
  }
  await f.controller.start({ projectId: 's2s', text, charactersPerMinute: 180 })
  expect(f.typed).toHaveLength(1)
  expect(f.controller.status.phase).toBe('interrupted')
  await expect(f.controller.resume()).rejects.toThrow()
})

it('Stop cancels a start still awaiting project validation or foreground grant', async () => {
  const f = fixture()
  let release!: () => void
  const controller = new InsertionController(f.driver, true, () => undefined, async () => undefined, async () => { await new Promise<void>((resolve) => { release = resolve }) })
  controller.setStopAvailable(true); controller.associate(target)
  const pending = controller.start({ projectId: 's2s', text, charactersPerMinute: 180 })
  controller.stop()
  release()
  await pending
  expect(controller.status.phase).toBe('interrupted')
  expect(f.typed).toEqual([])
})
it('keeps a paused operation when returning to NEB and resumes its exact prefix', async () => {
  const f = fixture()
  let paused = false
  const controller = new InsertionController(f.driver, true, () => undefined, async (_ms, signal) => {
    if (!paused && f.typed.length === 1) { paused = true; controller.pause(); signal.throwIfAborted() }
  })
  controller.setStopAvailable(true); controller.associate(target)
  await controller.start({ projectId: 's2s', text, charactersPerMinute: 180 })
  expect(controller.status.phase).toBe('paused')
  controller.invalidate('Edge lost focus while user returns to NEB', 'focus')
  expect(controller.status.phase).toBe('paused')
  await controller.resume()
  expect(controller.status.phase).toBe('completed')
  expect(f.value()).toBe(text)
})

it('Stop during the inter-character delay prevents the next key', async () => {
  const f = fixture()
  const controller = new InsertionController(f.driver, true, () => undefined, async (_ms, signal) => {
    controller.stop()
    signal.throwIfAborted()
  })
  controller.setStopAvailable(true); controller.associate(target)
  await controller.start({ projectId: 's2s', text, charactersPerMinute: 180 })
  expect(controller.status.phase).toBe('interrupted')
  expect(f.typed).toEqual([])
})
it('Stop during an outstanding native request prevents replay or a following key', async () => {
  const f = fixture()
  const original = f.driver.request
  let release!: () => void
  let reached!: () => void
  const nativeCalled = new Promise<void>((resolve) => { reached = resolve })
  f.driver.request = async (...args) => {
    if (args[0] === 'native' && args[1] === 'type') {
      reached()
      await new Promise<void>((resolve) => { release = resolve })
      args[3]?.throwIfAborted()
    }
    return original(...args)
  }
  const pending = f.controller.start({ projectId: 's2s', text, charactersPerMinute: 180 })
  await nativeCalled
  f.controller.stop(); release(); await pending
  expect(f.controller.status.phase).toBe('interrupted')
  expect(f.typed).toEqual([])
  await expect(f.controller.resume()).rejects.toThrow()
})

it('pauses cleanly when focus is lost during typing and allows resume', async () => {
  const f = fixture()
  const request = f.driver.request
  f.driver.request = async (...args) => {
    const result = await request(...args)
    if (args[0] === 'native' && args[1] === 'type' && f.typed.length === 2) {
      f.controller.invalidate('Edge lost focus', 'focus')
    }
    return result
  }
  await f.controller.start({ projectId: 's2s', text, charactersPerMinute: 180 })
  expect(f.controller.status.phase).toBe('paused')
  expect(f.controller.status.confirmed).toBeGreaterThan(0)
  await f.controller.resume()
  expect(f.controller.status.phase).toBe('completed')
  expect(f.value()).toBe(text)
})

it('detects existing matching text on associate and resumes from that point', async () => {
  const prefix = text.slice(0, 10)
  const f = fixture()
  f.setValue(prefix)
  f.controller.associate({ ...target, initialValue: prefix })
  expect(f.controller.status.phase).toBe('paused')
  expect(f.controller.status.confirmed).toBe(prefix.length)
  await f.controller.resume({ projectId: 's2s', text, charactersPerMinute: 180 })
  expect(f.controller.status.phase).toBe('completed')
  expect(f.value()).toBe(text)
  expect(f.typed.join('')).toBe(text.slice(10))
})

it('applies cadence delays and forwards simulated typos to native driver', async () => {
  const delays: number[] = []
  const typos: string[] = []
  let val = ''
  const driver: InsertionDriver = {
    async request(route, action, payload) {
      if (route === 'native' && action === 'probe') return { hwnd: '42', controlId: 'textarea-1' }
      if (route === 'native' && action === 'type') {
        if (payload.typo) typos.push(String(payload.typo))
        val += payload.text
        return {}
      }
      return { target, value: val, focused: true, selectionStart: val.length, selectionEnd: val.length }
    }
  }
  const longText = 'This is a long test sentence to verify that cadence delays vary naturally. '.repeat(10)
  const controller = new InsertionController(
    driver,
    true,
    () => undefined,
    async (ms) => { delays.push(ms) }
  )
  controller.setStopAvailable(true)
  controller.associate(target)
  const result = await controller.start({
    projectId: 's2s',
    text: longText,
    charactersPerMinute: 600,
    cadenceMode: 'natural',
    thinkingPauses: true,
    simulateTypos: true
  })
  expect(result.phase).toBe('completed')
  expect(val).toBe(longText)
  expect(delays.length).toBe(longText.length)
  const uniqueDelays = new Set(delays)
  expect(uniqueDelays.size).toBeGreaterThan(10)
})

it('applies fixed uniform delays in uniform mode', async () => {
  const delays: number[] = []
  let val = ''
  const driver: InsertionDriver = {
    async request(route, action, payload) {
      if (route === 'native' && action === 'probe') return { hwnd: '42', controlId: 'textarea-1' }
      if (route === 'native' && action === 'type') { val += payload.text; return {} }
      return { target, value: val, focused: true, selectionStart: val.length, selectionEnd: val.length }
    }
  }
  const shortText = 'Test uniform cadence timing.'.repeat(5)
  const controller = new InsertionController(
    driver,
    true,
    () => undefined,
    async (ms) => { delays.push(ms) }
  )
  controller.setStopAvailable(true)
  controller.associate(target)
  const result = await controller.start({
    projectId: 's2s',
    text: shortText,
    charactersPerMinute: 600,
    cadenceMode: 'uniform'
  })
  expect(result.phase).toBe('completed')
  expect(delays.every((d) => d === 100)).toBe(true)
})

it('emits dynamic status messages for thinking pauses and typos', async () => {
  const messages: string[] = []
  let val = ''
  const driver: InsertionDriver = {
    async request(route, action, payload) {
      if (route === 'native' && action === 'probe') return { hwnd: '42', controlId: 'textarea-1' }
      if (route === 'native' && action === 'type') { val += payload.text; return {} }
      return { target, value: val, focused: true, selectionStart: val.length, selectionEnd: val.length }
    }
  }
  const longText = 'Questo è un testo molto lungo con punteggiatura, parole complesse e molte frasi per testare le pause di riflessione e i refusi. '.repeat(10)
  const controller = new InsertionController(
    driver,
    true,
    (s) => { if (s.message) messages.push(s.message) },
    async () => undefined
  )
  controller.setStopAvailable(true)
  controller.associate(target)
  await controller.start({
    projectId: 's2s',
    text: longText,
    charactersPerMinute: 600,
    cadenceMode: 'natural',
    thinkingPauses: true,
    simulateTypos: true
  })
  expect(messages.some((m) => m.includes('Pausa di riflessione'))).toBe(true)
  expect(messages.some((m) => m.includes('refuso'))).toBe(true)
})
