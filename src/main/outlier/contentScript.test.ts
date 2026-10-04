import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { expect, it } from 'vitest'

function page(count = 1, href = 'http://localhost/demo') {
  let listener!: (message: Record<string, unknown>, sender: unknown, reply: (value: unknown) => void) => void
  let replacements = 0
  const invalidations: unknown[] = []
  let mutation!: () => void
  let heartbeat!: () => void
  let identity = 0
  const location = { href }
  const events: Record<string, () => void> = {}
  const field = { value: '', disabled: false, readOnly: false, isConnected: true, selectionStart: 0, selectionEnd: 0, scrollHeight: 500, scrollTop: 0, getClientRects: () => [1], scrollIntoView: () => undefined, focus: () => { document.activeElement = field }, setSelectionRange: (start: number, end: number) => { field.selectionStart = start; field.selectionEnd = end } }
  const document = { activeElement: field, visibilityState: 'visible', hasFocus: () => true, querySelectorAll: () => count === 1 ? [replacements ? { ...field } : field] : Array(count).fill(field), addEventListener: () => undefined }
  runInNewContext(readFileSync(new URL('../../../browser-extension/content.js', import.meta.url), 'utf8'), {
    document, location, crypto: { randomUUID: () => 'document-' + (++identity) },
    chrome: { runtime: { onMessage: { addListener: (fn: typeof listener) => { listener = fn } }, sendMessage: async (value: unknown) => { invalidations.push(value) } } },
    MutationObserver: class { constructor(fn: () => void) { mutation = fn } observe() {} }, addEventListener: (name: string, fn: () => void) => { events[name] = fn },
    setInterval: (fn: () => void) => { heartbeat = fn; return 0 as unknown as NodeJS.Timeout }, clearInterval: () => undefined
  })
  const send = (message: Record<string, unknown>): Record<string, unknown> => {
    let value: unknown
    listener(message, {}, (reply) => { value = reply })
    return value as Record<string, unknown>
  }
  return { send, field, invalidations, location, tick: () => heartbeat(), mutate: () => mutation(), event: (name: string) => events[name]?.(), replace: () => { replacements++ } }
}
it('only focuses the unique Rationale, autoscrolls, and never assigns its text', () => {
  const p = page()
  expect(p.send({ action: 'inspect' })).toMatchObject({ value: '' })
  expect(p.send({ action: 'prepare', expected: '', documentId: 'document-1', url: 'http://localhost/demo' })).toMatchObject({ focused: true })
  expect(p.field.value).toBe('')
  expect(p.field.scrollTop).toBe(500)
  p.field.scrollTop = 0
  expect(p.send({ action: 'snapshot', documentId: 'document-1', url: 'http://localhost/demo' })).toMatchObject({ focused: true })
  expect(p.field.scrollTop).toBe(500)
})
it('refuses an ambiguous selector, changed document and replaced element', () => {
  expect(page(2).send({ action: 'inspect' })).toHaveProperty('error')
  const p = page(); p.send({ action: 'inspect' })
  expect(p.send({ action: 'snapshot', documentId: 'different', url: 'http://localhost/demo' })).toHaveProperty('error')
  p.replace()
  expect(p.send({ action: 'snapshot', documentId: 'document-1', url: 'http://localhost/demo' })).toHaveProperty('error')
})
it('refuses to prepare a nonempty or readonly field', () => {
  const p = page(); p.field.value = 'existing'
  expect(p.send({ action: 'prepare', expected: '', documentId: 'document-1', url: 'http://localhost/demo' })).toHaveProperty('error')
  p.field.readOnly = true
  expect(p.send({ action: 'inspect' })).toHaveProperty('error')
})
it('reassociates a replaced textarea with a new document identity', () => {
  const p = page()
  p.send({ action: 'inspect' })
  p.replace()
  expect(p.send({ action: 'snapshot', documentId: 'document-1', url: 'http://localhost/demo' })).toHaveProperty('error')
  expect(p.send({ action: 'associate' })).toMatchObject({ value: '', url: 'http://localhost/demo' })
})
it('invalidates an associated audio destination when its field is replaced without arming typing', () => {
  const p = page(); p.send({ action: 'associate' })
  p.replace(); p.mutate()
  expect(p.invalidations).toContainEqual({ kind: 'invalidated', reason: 'destination', documentId: 'document-2', url: 'http://localhost/demo' })
})
it('associates a meeting page without a Rationale and keeps its audio connection alive', () => {
  const p = page(0, 'https://meet.example.test/interview')
  expect(p.send({ action: 'associate' })).toMatchObject({ documentId: 'document-2', url: 'https://meet.example.test/interview' })
  p.tick()
  expect(p.invalidations).toContainEqual({ kind: 'heartbeat' })
  for (const action of ['inspect', 'prepare', 'snapshot']) {
    expect(p.send({ action, expected: '', documentId: 'document-2', url: 'https://meet.example.test/interview' })).toHaveProperty('error')
  }
  expect(p.field.value).toBe('')
})
it('invalidates a generic association on URL changes even without a Rationale', () => {
  const p = page(0, 'https://meet.example.test/interview')
  p.send({ action: 'associate' })
  p.event('blur')
  expect(p.invalidations).toEqual([])
  p.location.href = 'https://meet.example.test/another-room'
  p.mutate()
  expect(p.invalidations).toContainEqual({ kind: 'invalidated', reason: 'destination', documentId: 'document-2', url: 'https://meet.example.test/interview' })
})
it('invalidates unarmed association on navigation but allows background audio on blur', () => {
  const p = page(); p.send({ action: 'associate' }); p.event('blur')
  expect(p.invalidations).toEqual([])
  p.event('popstate')
  expect(p.invalidations).toHaveLength(1)
})
