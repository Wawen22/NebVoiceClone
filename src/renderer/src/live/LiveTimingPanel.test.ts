import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { LiveTimingPanel } from './LiveTimingPanel'

it('keeps unknown stream timing distinct from a measured zero and explains the scope', () => {
  const html = renderToStaticMarkup(createElement(LiveTimingPanel, { log: [{ kind: 'turn-response', text: '', atMs: 1000, durationMs: 3300, turnNumber: 1,
    breakdown: { beforeQwenMs: 1500, qwenMs: 0, beforeVoiceMs: 300, voiceStartMs: 1500 } }] }))
  expect(html).toContain('3,30 s')
  expect(html).toContain('0,00 s')
  expect(html).toContain('Non disponibile')
  expect(html).toContain('non sono misurati')
})
