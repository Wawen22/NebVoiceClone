import { object, type BrowserTarget } from '../../shared/outlier'
import type { S2SAudioEvent, S2SAudioStatus } from '../../shared/s2s'

export class AudioCaptureRelay {
  status: S2SAudioStatus = { state: 'inactive', captureId: null, target: null, message: 'Avvia Ascolta questa scheda dal popup NEB in Edge.' }
  private sequence = 0
  constructor(private readonly emit: (event: S2SAudioEvent) => void) {}
  disconnect(message: string): void { this.setStatus({ state: 'inactive', captureId: null, target: null, message }) }
  private setStatus(status: S2SAudioStatus): void { this.status = status; this.emit({ type: 'status', status }) }
  receive(raw: unknown, target: BrowserTarget | null): void {
    try {
      const v = object(raw)
      if (typeof v.captureId !== 'string' || !/^[a-zA-Z0-9-]{1,100}$/.test(v.captureId)) throw new Error('Sessione audio non valida.')
      if (v.state !== 'active' && v.captureId !== this.status.captureId) return
      const destination = object(v.target)
      if (!target || ['tabId', 'windowId', 'documentId', 'url'].some((key) => destination[key] !== target[key as keyof BrowserTarget])) throw new Error('Destinazione audio cambiata.')
      if (v.state === 'active') {
        this.sequence = 0
        this.setStatus({ state: 'active', captureId: v.captureId, target, message: 'Ascolto della scheda Edge attivo.' })
      } else if (v.state === 'stopped' || v.state === 'error') {
        this.setStatus({ state: v.state === 'error' ? 'error' : 'inactive', captureId: null, target: null, message: typeof v.message === 'string' ? v.message.slice(0, 500) : 'Ascolto terminato.' })
      } else if (v.state === 'pcm' && this.status.state === 'active') {
        if (v.sequence !== this.sequence || typeof v.pcm !== 'string' || v.pcm.length !== 4268 || !/^[A-Za-z0-9+/]+={0,2}$/.test(v.pcm)) throw new Error('Flusso audio incompleto o non valido. Riavvia l’ascolto in Edge.')
        const pcm = Buffer.from(v.pcm, 'base64')
        if (pcm.length !== 3200 || pcm.toString('base64') !== v.pcm) throw new Error('Campioni audio non validi.')
        this.sequence++
        this.emit({ type: 'pcm', captureId: v.captureId, sequence: v.sequence as number, pcm: Uint8Array.from(pcm) })
      } else throw new Error('Evento audio non valido.')
    } catch (error) {
      this.setStatus({ state: 'error', captureId: null, target: null, message: error instanceof Error ? error.message : 'Audio non disponibile.' })
    }
  }
}
