import { expect, it } from 'vitest'
import { assertS2STarget } from './sessionTarget'
const target = { tabId: 1, windowId: 2, documentId: 'doc-1', url: 'https://example.test/s2s', title: 'S2S' }
it('permits capture restart on the original destination but rejects another tab or document', () => {
  expect(() => assertS2STarget(target, { ...target, title: 'Title changed' })).not.toThrow()
  for (const changed of [{ tabId: 99 }, { documentId: 'doc-2' }, { url: 'https://example.test/other' }, { windowId: 99 }]) {
    expect(() => assertS2STarget(target, { ...target, ...changed })).toThrow('nuova sessione')
  }
  expect(() => assertS2STarget(target, null)).toThrow()
})
