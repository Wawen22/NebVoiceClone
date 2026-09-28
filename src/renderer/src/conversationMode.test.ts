import { describe, expect, it } from 'vitest'
import { conversationShortcutLabel, routingStatus } from './conversationMode'

const cable = { deviceId: 'cable-input', label: 'CABLE Input (VB-Audio Virtual Cable)' }
const pipewire = { deviceId: 'neb-voice', label: 'NEB_Voice' }
const headset = { deviceId: 'headset', label: 'Cuffie (Neb - Jabra Evolve2 65)' }

describe('routingStatus', () => {
  it('recognizes CABLE Input as browser-ready routing', () => {
    expect(routingStatus([cable, headset], cable.deviceId)).toEqual({
      routed: true,
      label: cable.label,
      message: 'Browser routing ready: use CABLE Output as the microphone in Edge.'
    })
  })

  it('recognizes the PipeWire virtual output on Linux', () => {
    expect(routingStatus([pipewire], pipewire.deviceId, 'linux')).toEqual({
      routed: true,
      label: pipewire.label,
      message: 'Browser routing ready: use Monitor of NEB Voice as the microphone in Edge.'
    })
  })

  it('warns without blocking when a physical output is selected', () => {
    expect(routingStatus([cable, headset], headset.deviceId)).toEqual({
      routed: false,
      label: headset.label,
      message: 'Playing on Cuffie (Neb - Jabra Evolve2 65). Select CABLE Input here to send speech to Edge.'
    })
  })

  it('warns when the saved output is no longer available', () => {
    expect(routingStatus([cable], 'missing-device')).toEqual({
      routed: false,
      label: 'Saved device unavailable',
      message: 'Saved device unavailable. Select CABLE Input here to send speech to Edge.'
    })
  })
})

describe('conversationShortcutLabel', () => {
  it('distinguishes an available global shortcut from an unavailable one', () => {
    expect(conversationShortcutLabel({ enabled: true, globalShortcutAvailable: true })).toBe('Ctrl+Alt+V · focus NEB from Edge')
    expect(conversationShortcutLabel({ enabled: true, globalShortcutAvailable: false })).toBe('Ctrl+Alt+V unavailable · use the NEB window')
  })
})
