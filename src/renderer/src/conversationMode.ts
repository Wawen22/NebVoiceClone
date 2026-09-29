import type { ConversationModeStatus } from '../../shared/contracts'
import type { AudioOutput } from './audio/AudioEngine'

export interface RoutingStatus {
  routed: boolean
  label: string
  message: string
}

export function routingStatus(outputs: AudioOutput[], selectedDeviceId: string, platform = 'win32'): RoutingStatus {
  const selected = outputs.find((output) => output.deviceId === selectedDeviceId)
  const label = selected?.label ?? (selectedDeviceId === 'default' ? 'System default' : 'Saved device unavailable')
  const linux = platform === 'linux'
  const virtualOutput = linux ? 'NEB_Voice' : 'CABLE Input'
  const browserMicrophone = linux ? 'Monitor of NEB Voice' : 'CABLE Output'
  const routed = linux ? /NEB[ _]Voice/i.test(label) : /CABLE Input/i.test(label)
  const virtualAvailable = outputs.some((output) => linux ? /NEB[ _]Voice/i.test(output.label) : /CABLE Input/i.test(output.label))

  return {
    routed,
    label,
    message: routed
      ? `NEB output selected. Check that Edge uses ${browserMicrophone} as its microphone with a test recording.`
      : !virtualAvailable
        ? `${virtualOutput} not detected. ${linux ? 'Check the virtual audio setup' : 'Check the VB-CABLE installation'} and refresh devices before routing to Edge.`
      : selected
        ? `Playing on ${label}. Select ${virtualOutput} here to send speech to Edge.`
        : selectedDeviceId === 'default'
          ? `System default output is unavailable. Refresh devices, then select ${virtualOutput}.`
          : `Saved output disconnected. Refresh devices, then select ${virtualOutput} to restore Edge routing.`
  }
}

export function conversationShortcutLabel(status: ConversationModeStatus | null): string {
  return status?.globalShortcutAvailable
    ? 'Ctrl+Alt+V · focus NEB from Edge'
    : 'Ctrl+Alt+V unavailable · use the NEB window'
}
