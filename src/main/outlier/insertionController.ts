import { setTimeout as sleep } from 'node:timers/promises'
import { insertionLocked, parseInsertionRequest, parseLease, parseSnapshot, sameTarget, type BrowserTarget, type InsertionStatus, type InsertionRequest } from '../../shared/outlier'
export interface InsertionDriver { request(route: 'browser' | 'native', action: string, payload: Record<string, unknown>, signal?: AbortSignal): Promise<unknown> }
export class InsertionController {
  status: InsertionStatus
  private operation: { request: InsertionRequest; target: BrowserTarget; offset: number } | null = null
  private abort: AbortController | null = null
  private uncertain = false
  constructor(
    private readonly driver: InsertionDriver, supported: boolean,
    private readonly notify: (status: InsertionStatus) => void,
    private readonly delay: (ms: number, signal: AbortSignal) => Promise<void> = (ms, signal) => sleep(ms, undefined, { signal }),
    private readonly preflight?: (request: InsertionRequest, signal: AbortSignal) => Promise<void>
  ) {
    this.status = { supported, connected: false, stopAvailable: false, phase: 'disconnected', target: null, projectId: null, confirmed: 0, total: 0, message: supported ? 'Collega una scheda S2S tramite l’estensione.' : 'L’inserimento richiede NEB nativo Windows ed Edge.' }
  }
  private update(patch: Partial<InsertionStatus>): void { this.status = { ...this.status, ...patch }; this.notify(this.status) }
  setStopAvailable(available: boolean): void { this.update({ stopAvailable: available }) }
  associate(target: BrowserTarget): void {
    if (insertionLocked(this.status)) this.stop('La destinazione è cambiata. Controlla il testo parziale.')
    this.update({ connected: true, target, phase: 'ready', projectId: null, confirmed: 0, total: 0, message: 'Destinazione collegata. Avvia da NEB quando il Rationale è pronto.' })
  }
  disconnect(): void {
    const active = insertionLocked(this.status)
    this.stop('Collegamento perso. Nessuna ripresa automatica; verifica il campo.')
    this.update({ connected: false, target: null, phase: active ? 'interrupted' : 'disconnected' })
  }
  invalidate(message: string, reason = 'destination'): void {
    if (this.status.phase === 'paused' && reason === 'focus') return
    if (insertionLocked(this.status)) this.stop(message)
  }
  stop(message = 'Interrotto. Il testo già inserito rimane nel browser.'): InsertionStatus {
    this.abort?.abort()
    this.operation = null
    this.update({ phase: 'interrupted', message })
    return this.status
  }
  pause(): InsertionStatus {
    if (!this.abort || !['preparing', 'typing'].includes(this.status.phase)) return this.status
    if (this.uncertain) return this.stop('Pausa durante un carattere non ancora confermato: verifica il campo prima di continuare manualmente.')
    this.abort.abort()
    this.update({ phase: 'paused', message: 'In pausa. Riprendi solo se il testo nel campo è rimasto identico.' })
    return this.status
  }
  async resume(): Promise<InsertionStatus> {
    if (this.status.phase !== 'paused' || !this.operation || this.abort) throw new Error('Nessun inserimento pronto per la ripresa.')
    return this.run()
  }
  async start(value: InsertionRequest): Promise<InsertionStatus> {
    if (this.abort || insertionLocked(this.status)) throw new Error('Un inserimento è già attivo.')
    if (!this.status.supported || !this.status.connected || !this.status.target || !this.status.stopAvailable) throw new Error('Collega Edge e rendi disponibile lo stop globale prima di avviare.')
    const request = parseInsertionRequest(value)
    this.operation = { request, target: { ...this.status.target }, offset: 0 }
    this.update({ projectId: request.projectId, confirmed: 0, total: request.text.length })
    return this.run()
  }
  private async run(): Promise<InsertionStatus> {
    const operation = this.operation!
    const controller = new AbortController()
    this.abort = controller
    const signal = controller.signal
    const request = async (route: 'native' | 'browser', action: string, payload: Record<string, unknown>): Promise<unknown> => {
      signal.throwIfAborted()
      const value = await this.driver.request(route, action, payload, signal)
      signal.throwIfAborted()
      return value
    }
    const check = async (action: string, expected: string): Promise<void> => {
      const snapshot = parseSnapshot(await request('browser', action, { target: operation.target, expected }))
      if (!sameTarget(snapshot.target, operation.target) || !snapshot.focused) throw new Error('Scheda, documento o focus cambiato. Inserimento fermato.')
      if (snapshot.value !== expected || snapshot.selectionStart !== expected.length || snapshot.selectionEnd !== expected.length) throw new Error('Il campo contiene testo o una selezione inattesa. Nessun carattere sarà riscritto.')
    }
    try {
      this.update({ phase: 'preparing', message: 'Verifica della scheda e del campo…' })
      await this.preflight?.(operation.request, signal)
      signal.throwIfAborted()
      await request('native', 'activate', {})
      await check('prepare', operation.request.text.slice(0, operation.offset))
      const lease = parseLease(await request('native', 'probe', { expected: operation.request.text.slice(0, operation.offset) }))
      this.update({ phase: 'typing', message: 'Inserimento in corso · Ctrl+Alt+S stop · Ctrl+Alt+P pausa' })
      while (operation.offset < operation.request.text.length) {
        const prefix = operation.request.text.slice(0, operation.offset)
        await this.delay(60_000 / operation.request.charactersPerMinute, signal)
        signal.throwIfAborted()
        await check('snapshot', prefix)
        const character = String.fromCodePoint(operation.request.text.codePointAt(operation.offset)!)
        this.uncertain = true
        await request('native', 'type', { lease, expected: prefix, text: character })
        await check('snapshot', prefix + character)
        this.uncertain = false
        operation.offset += character.length
        this.update({ confirmed: operation.offset })
      }
      await check('snapshot', operation.request.text)
      this.operation = null
      this.update({ phase: 'completed', message: 'Testo completo verificato. Controlla e invia tu la task.' })
    } catch (error) {
      if (!signal.aborted) {
        this.operation = null
        this.update({ phase: 'error', message: error instanceof Error ? error.message : 'Inserimento non riuscito.' })
      }
    } finally {
      if (this.abort === controller) this.abort = null
      this.uncertain = false
    }
    return this.status
  }
}
