import type { ConversationModeStatus } from '../../shared/contracts'
import type { AudioOutput } from './audio/AudioEngine'

export interface RoutingStatus {
  routed: boolean
  label: string
  message: string
}

export function routingStatus(outputs: AudioOutput[], selectedDeviceId: string): RoutingStatus {
  const selected = outputs.find((output) => output.deviceId === selectedDeviceId)
  const label = selected?.label ?? (selectedDeviceId === 'default' ? 'System default' : 'Saved device unavailable')
  const routed = /CABLE Input/i.test(label)

  return {
    routed,
    label,
    message: routed
      ? 'Browser routing ready: use CABLE Output as the microphone in Edge.'
      : selected
        ? `Playing on ${label}. Select CABLE Input here to send speech to Edge.`
        : `${label}. Select CABLE Input here to send speech to Edge.`
  }
}

export function conversationShortcutLabel(status: ConversationModeStatus | null): string {
  return status?.globalShortcutAvailable
    ? 'Ctrl+Alt+V · focus NEB from Edge'
    : 'Ctrl+Alt+V unavailable · use the NEB window'
}
