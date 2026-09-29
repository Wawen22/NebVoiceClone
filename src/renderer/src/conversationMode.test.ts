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
      message: 'Uscita NEB selezionata. Verifica con una registrazione che Edge usi CABLE Output come microfono.'
    })
  })

  it('recognizes the PipeWire virtual output on Linux', () => {
    expect(routingStatus([pipewire], pipewire.deviceId, 'linux')).toEqual({
      routed: true,
      label: pipewire.label,
      message: 'Uscita NEB selezionata. Verifica con una registrazione che Edge usi Monitor of NEB Voice come microfono.'
    })
  })

  it('warns without blocking when a physical output is selected', () => {
    expect(routingStatus([cable, headset], headset.deviceId)).toEqual({
      routed: false,
      label: headset.label,
      message: 'Audio su Cuffie (Neb - Jabra Evolve2 65). Seleziona CABLE Input per inviare la voce a Edge.'
    })
  })

  it('warns when the saved output is no longer available', () => {
    expect(routingStatus([cable], 'missing-device')).toEqual({
      routed: false,
      label: 'Dispositivo salvato non disponibile',
      message: 'L’uscita salvata è scollegata. Aggiorna i dispositivi, poi seleziona CABLE Input per ripristinare il routing.'
    })
  })

  it('reports an unavailable system default when the virtual output is present', () => {
    expect(routingStatus([cable], 'default')).toEqual({
      routed: false,
      label: 'Predefinito di sistema',
      message: 'L’uscita predefinita non è disponibile. Aggiorna i dispositivi, poi seleziona CABLE Input.'
    })
  })

  it('explains how to restore missing VB-CABLE instead of suggesting an unavailable device', () => {
    expect(routingStatus([headset], headset.deviceId)).toEqual({
      routed: false,
      label: headset.label,
      message: 'CABLE Input non rilevato. Controlla l’installazione di VB-CABLE e aggiorna i dispositivi prima di usare Edge.'
    })
  })

  it('reports a missing virtual output on Linux', () => {
    expect(routingStatus([], 'default', 'linux').message).toBe('NEB_Voice non rilevato. Controlla la configurazione audio virtuale e aggiorna i dispositivi prima di usare Edge.')
  })
})

describe('conversationShortcutLabel', () => {
  it('distinguishes an available global shortcut from an unavailable one', () => {
    expect(conversationShortcutLabel({ enabled: true, globalShortcutAvailable: true })).toBe('Ctrl+Alt+V · torna alla Console')
    expect(conversationShortcutLabel({ enabled: true, globalShortcutAvailable: false })).toBe('Ctrl+Alt+V non disponibile · usa Esci')
  })
})
