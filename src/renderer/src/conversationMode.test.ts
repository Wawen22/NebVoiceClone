import { describe, expect, it } from 'vitest'
import { conversationShortcutLabel, routingStatus } from './conversationMode'

const cable = { deviceId: 'cable-input', label: 'CABLE Input (VB-Audio Virtual Cable)' }
const pipewire = { deviceId: 'neb-voice', label: 'NEB_Voice' }
const headset = { deviceId: 'headset', label: 'Cuffie (Neb - Jabra Evolve2 65)' }

describe('routingStatus', () => {
  it('recognizes CABLE Input without claiming Edge is verified', () => {
    expect(routingStatus([cable, headset], cable.deviceId)).toEqual({
      routed: true,
      label: cable.label,
      message: 'NEB output selected. Check that Edge uses CABLE Output as its microphone with a test recording.'
    })
  })

  it('recognizes the PipeWire virtual output on Linux', () => {
    expect(routingStatus([pipewire], pipewire.deviceId, 'linux')).toEqual({
      routed: true,
      label: pipewire.label,
      message: 'NEB output selected. Check that Edge uses Monitor of NEB Voice as its microphone with a test recording.'
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
      message: 'Saved output disconnected. Refresh devices, then select CABLE Input to restore Edge routing.'
    })
  })

  it('reports an unavailable system default when the virtual output is present', () => {
    expect(routingStatus([cable], 'default')).toEqual({
      routed: false,
      label: 'System default',
      message: 'System default output is unavailable. Refresh devices, then select CABLE Input.'
    })
  })

  it('explains how to restore missing VB-CABLE instead of suggesting an unavailable device', () => {
    expect(routingStatus([headset], headset.deviceId)).toEqual({
      routed: false,
      label: headset.label,
      message: 'CABLE Input not detected. Check the VB-CABLE installation and refresh devices before routing to Edge.'
    })
  })

  it('reports a missing virtual output on Linux', () => {
    expect(routingStatus([], 'default', 'linux').message).toBe('NEB_Voice not detected. Check the virtual audio setup and refresh devices before routing to Edge.')
  })
})

describe('conversationShortcutLabel', () => {
  it('distinguishes an available global shortcut from an unavailable one', () => {
    expect(conversationShortcutLabel({ enabled: true, globalShortcutAvailable: true })).toBe('Ctrl+Alt+V · focus NEB from Edge')
    expect(conversationShortcutLabel({ enabled: true, globalShortcutAvailable: false })).toBe('Ctrl+Alt+V unavailable · use the NEB window')
  })
})
