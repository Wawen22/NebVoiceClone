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

  return {
    routed,
    label,
    message: routed
      ? `Browser routing ready: use ${browserMicrophone} as the microphone in Edge.`
      : selected
        ? `Playing on ${label}. Select ${virtualOutput} here to send speech to Edge.`
        : `${label}. Select ${virtualOutput} here to send speech to Edge.`
  }
}

export function conversationShortcutLabel(status: ConversationModeStatus | null): string {
  return status?.globalShortcutAvailable
    ? 'Ctrl+Alt+V · focus NEB from Edge'
    : 'Ctrl+Alt+V unavailable · use the NEB window'
}
