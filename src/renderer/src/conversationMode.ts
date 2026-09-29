import type { ConversationModeStatus } from '../../shared/contracts'
import type { AudioOutput } from './audio/AudioEngine'

export interface RoutingStatus {
  routed: boolean
  label: string
  message: string
}

export function routingStatus(outputs: AudioOutput[], selectedDeviceId: string, platform = 'win32'): RoutingStatus {
  const selected = outputs.find((output) => output.deviceId === selectedDeviceId)
  const label = selected?.label ?? (selectedDeviceId === 'default' ? 'Predefinito di sistema' : 'Dispositivo salvato non disponibile')
  const linux = platform === 'linux'
  const virtualOutput = linux ? 'NEB_Voice' : 'CABLE Input'
  const browserMicrophone = linux ? 'Monitor of NEB Voice' : 'CABLE Output'
  const routed = linux ? /NEB[ _]Voice/i.test(label) : /CABLE Input/i.test(label)
  const virtualAvailable = outputs.some((output) => linux ? /NEB[ _]Voice/i.test(output.label) : /CABLE Input/i.test(output.label))

  return {
    routed,
    label,
    message: routed
      ? `Uscita NEB selezionata. Verifica con una registrazione che Edge usi ${browserMicrophone} come microfono.`
      : !virtualAvailable
        ? `${virtualOutput} non rilevato. ${linux ? 'Controlla la configurazione audio virtuale' : 'Controlla l’installazione di VB-CABLE'} e aggiorna i dispositivi prima di usare Edge.`
      : selected
        ? `Audio su ${label}. Seleziona ${virtualOutput} per inviare la voce a Edge.`
        : selectedDeviceId === 'default'
          ? `L’uscita predefinita non è disponibile. Aggiorna i dispositivi, poi seleziona ${virtualOutput}.`
          : `L’uscita salvata è scollegata. Aggiorna i dispositivi, poi seleziona ${virtualOutput} per ripristinare il routing.`
  }
}

export function conversationShortcutLabel(status: ConversationModeStatus | null): string {
  return status?.globalShortcutAvailable
    ? 'Ctrl+Alt+V · torna alla Console'
    : 'Ctrl+Alt+V non disponibile · usa Esci'
}
