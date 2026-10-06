import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '../../shared/contracts'
import { buildSessionChecks, sessionReady, type SessionDiagnostics } from './sessionReadiness'

const target = { tabId: 1, windowId: 2, documentId: 'doc', title: 'Conversazione', url: 'https://example.com' }
const ready: SessionDiagnostics = {
  platform: 'win32', settings: { ...DEFAULT_SETTINGS, outputDeviceId: 'cable' },
  outputs: [{ deviceId: 'cable', label: 'CABLE Input' }], speech: { ready: true, message: 'Connesso' },
  connected: true, stopAvailable: true, target,
  audio: { state: 'active', captureId: 'capture', target, message: 'Audio attivo' }, receiving: true,
  reasoning: { ready: true, model: 'qwen/model' }, avatarEnabled: false,
  avatar: { phase: 'off', message: 'Disattivato', connectedAt: null }, avatarConfigured: true,
  output: { enabled: false, available: true, viewers: 0 }, operationBusy: false
}
const check = (data: SessionDiagnostics, id: string, mode: 'console' | 'live' = 'live') => buildSessionChecks(data, mode).find(item => item.id === id)!

describe('session preparation', () => {
  it('allows local Console playback without browser, Qwen or OBS', () => {
    const data = { ...ready, connected: false, receiving: false, reasoning: null, output: null, outputs: [{ deviceId: 'cable', label: 'Cuffie' }] }
    expect(sessionReady(buildSessionChecks(data, 'console'))).toBe(true)
    expect(sessionReady(buildSessionChecks(data, 'live'))).toBe(false)
  })
  it('does not report ready while device or provider status is missing', () => {
    expect(sessionReady(buildSessionChecks({ ...ready, outputs: [] }, 'console'))).toBe(false)
    expect(sessionReady(buildSessionChecks({ ...ready, speech: null }, 'console'))).toBe(false)
    expect(check({ ...ready, reasoning: null }, 'reasoning').state).toBe('pending')
  })
  it('requires fresh audio from the associated browser tab', () => {
    expect(check({ ...ready, receiving: false }, 'capture').state).toBe('blocked')
    expect(check({ ...ready, audio: { ...ready.audio, target: { ...target, documentId: 'other' } } }, 'capture').state).toBe('blocked')
    expect(check({ ...ready, audio: { ...ready.audio, captureId: null } }, 'capture').state).toBe('blocked')
    expect(sessionReady(buildSessionChecks(ready, 'live'))).toBe(true)
  })
  it('blocks a muted output, a missing stop shortcut and a competing operation', () => {
    expect(check({ ...ready, settings: { ...ready.settings, outputVolume: 0 } }, 'volume').state).toBe('blocked')
    expect(check({ ...ready, stopAvailable: false }, 'stop').state).toBe('blocked')
    expect(check({ ...ready, operationBusy: true }, 'operation').state).toBe('blocked')
  })
  it('treats Simli as optional but detects missing configuration when enabled', () => {
    expect(sessionReady(buildSessionChecks({ ...ready, avatarConfigured: false }, 'live'))).toBe(true)
    expect(check({ ...ready, avatarEnabled: true, avatarConfigured: false }, 'avatar').state).toBe('blocked')
    expect(check({ ...ready, avatarEnabled: true }, 'avatar').state).toBe('ready')
    expect(check({ ...ready, avatarEnabled: true, avatar: { ...ready.avatar, phase: 'error' } }, 'avatar').state).toBe('blocked')
  })
  it('never treats an OBS viewer as proof of the remote camera or microphone selection', () => {
    const checks = buildSessionChecks({ ...ready, output: { enabled: true, available: true, viewers: 1 } }, 'live')
    expect(checks.find(item => item.id === 'obs')?.blocking).toBe(false)
    expect(checks.find(item => item.id === 'site')?.state).toBe('manual')
    expect(checks.find(item => item.id === 'camera')?.state).toBe('manual')
    expect(check({ ...ready, output: { enabled: true, available: true, viewers: 0 } }, 'camera').blocking).toBe(false)
  })
})
