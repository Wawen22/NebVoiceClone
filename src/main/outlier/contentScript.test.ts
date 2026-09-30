import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { expect, it } from 'vitest'

function page(count = 1) {
  let listener!: (message: Record<string, unknown>, sender: unknown, reply: (value: unknown) => void) => void
  let replacements = 0
  const field = { value: '', disabled: false, readOnly: false, isConnected: true, selectionStart: 0, selectionEnd: 0, scrollHeight: 500, scrollTop: 0, getClientRects: () => [1], scrollIntoView: () => undefined, focus: () => { document.activeElement = field }, setSelectionRange: (start: number, end: number) => { field.selectionStart = start; field.selectionEnd = end } }
  const document = { activeElement: field, visibilityState: 'visible', hasFocus: () => true, querySelectorAll: () => count === 1 ? [replacements ? { ...field } : field] : Array(count).fill(field), addEventListener: () => undefined }
  runInNewContext(readFileSync(new URL('../../../browser-extension/content.js', import.meta.url), 'utf8'), {
    document, location: { href: 'http://localhost/demo' }, crypto: { randomUUID: () => 'document-1' },
    chrome: { runtime: { onMessage: { addListener: (fn: typeof listener) => { listener = fn } }, sendMessage: async () => undefined } },
    MutationObserver: class { observe() {} }, addEventListener: () => undefined
  })
  const send = (message: Record<string, unknown>): Record<string, unknown> => {
    let value: unknown
    listener(message, {}, (reply) => { value = reply })
    return value as Record<string, unknown>
  }
  return { send, field, replace: () => { replacements++ } }
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
