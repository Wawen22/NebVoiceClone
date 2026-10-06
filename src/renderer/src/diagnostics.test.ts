import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DiagnosticsPage } from './SecondaryViews'
import { DEFAULT_SETTINGS } from '../../shared/contracts'
import { AvatarSession } from './avatar/session'

describe('session diagnostics', () => {
  it('shows the selected Fish voice and model when Gemini is unavailable', () => {
    const html = renderToStaticMarkup(createElement(DiagnosticsPage, {
      info: { electron: '44', node: '22', platform: 'win32', geminiConfigured: false },
      settings: { ...DEFAULT_SETTINGS, providerId: 'fish-openrouter', fishVoice: { id: 'voice-1', displayName: 'Voce Fish personale', createdAt: '2026-10-06T00:00:00Z' } },
      outputs: [], speech: { ready: true, message: 'Fish pronto' }, browser: null,
      audio: { state: 'inactive', captureId: null, target: null, message: '' }, receiving: false,
      avatar: new AvatarSession(async () => { throw new Error('Not called') }, () => { throw new Error('Not called') }),
      operationBusy: false, onRefresh: async () => {}, onNavigate: () => {}, onOpenLive: () => {}
    }))
    expect(html).toContain('fish-audio/s2.1-pro-free:free')
    expect(html).toContain('Voce Fish personale')
    expect(html).not.toContain('gemini-3.8-flash-tts')
  })
})
