import { setTimeout as sleep } from 'node:timers/promises'
import {
  insertionLocked,
  parseInsertionRequest,
  parseLease,
  parseSnapshot,
  sameTarget,
  type BrowserTarget,
  type InsertionStatus,
  type InsertionRequest
} from '../../shared/outlier'
import { CadencePlanner } from './cadence'

export interface InsertionDriver {
  request(route: 'browser' | 'native', action: string, payload: Record<string, unknown>, signal?: AbortSignal): Promise<unknown>
}

export class InsertionController {
  status: InsertionStatus
  private operation: { request: InsertionRequest; target: BrowserTarget; offset: number } | null = null
  private lastRequest: InsertionRequest | null = null
  private abort: AbortController | null = null
  private uncertain = false

  constructor(
    private readonly driver: InsertionDriver,
    supported: boolean,
    private readonly notify: (status: InsertionStatus) => void,
    private readonly delay: (ms: number, signal: AbortSignal) => Promise<void> = (ms, signal) => sleep(ms, undefined, { signal }),
    private readonly preflight?: (request: InsertionRequest, signal: AbortSignal) => Promise<void>
  ) {
    this.status = {
      supported,
      connected: false,
      stopAvailable: false,
      phase: 'disconnected',
      target: null,
      projectId: null,
      confirmed: 0,
      total: 0,
      message: supported
        ? 'Collega una scheda S2S tramite l’estensione.'
        : 'L’inserimento richiede NEB nativo Windows ed Edge.'
    }
  }

  private update(patch: Partial<InsertionStatus>): void {
    this.status = { ...this.status, ...patch }
    this.notify(this.status)
  }

  setStopAvailable(available: boolean): void {
    this.update({ stopAvailable: available })
  }

  associate(target: BrowserTarget): void {
    if (this.status.phase === 'typing') {
      this.pause('La destinazione è cambiata durante l’inserimento.')
    }
    const initialText = typeof target.initialValue === 'string'
      ? target.initialValue.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
      : ''
    const hasInitialText = initialText.length > 0
    this.update({
      connected: true,
      target,
      phase: hasInitialText ? 'paused' : 'ready',
      projectId: this.operation?.request.projectId ?? this.lastRequest?.projectId ?? null,
      confirmed: hasInitialText ? initialText.length : 0,
      total: this.operation?.request.text.length ?? this.lastRequest?.text.length ?? (hasInitialText ? initialText.length : 0),
      message: hasInitialText
        ? `Trovato testo parziale nel campo (${initialText.length} caratteri). Clicca su Riprendi per continuare.`
        : 'Destinazione collegata. Avvia da NEB quando il Rationale è pronto.'
    })
  }

  disconnect(): void {
    const active = insertionLocked(this.status)
    this.stop('Collegamento perso. Nessuna ripresa automatica; verifica il campo.')
    this.update({ connected: false, target: null, phase: active ? 'interrupted' : 'disconnected' })
  }

  invalidate(message: string, reason = 'destination'): void {
    if (this.status.phase === 'paused' && reason === 'focus') return
    if (reason === 'focus') {
      if (['preparing', 'typing'].includes(this.status.phase)) {
        this.pause('Inserimento in pausa per perdita di focus. Clicca su Riprendi per continuare.')
      }
      return
    }
    if (insertionLocked(this.status)) this.stop(message)
  }

  stop(message = 'Interrotto. Il testo già inserito rimane nel browser.'): InsertionStatus {
    this.abort?.abort()
    this.abort = null
    this.operation = null
    this.update({ phase: 'interrupted', message })
    return this.status
  }

  pause(message = 'In pausa. Clicca su Riprendi quando il Rationale è pronto.'): InsertionStatus {
    if (this.status.phase === 'paused') return this.status
    if (!this.abort && !['preparing', 'typing'].includes(this.status.phase)) return this.status
    this.abort?.abort()
    this.abort = null
    this.update({ phase: 'paused', message })
    return this.status
  }

  async resume(request?: InsertionRequest): Promise<InsertionStatus> {
    if (this.status.phase !== 'paused' || this.abort) throw new Error('Nessun inserimento pronto per la ripresa.')
    if (!this.status.connected || !this.status.target || !this.status.stopAvailable) {
      throw new Error('Collega Edge e rendi disponibile lo stop globale prima di riprendere.')
    }
    const req = request ? parseInsertionRequest(request) : (this.operation?.request ?? this.lastRequest)
    if (!req) throw new Error('Nessun Rationale fornito per riprendere.')
    this.lastRequest = req
    if (!this.operation) {
      this.operation = {
        request: req,
        target: { ...this.status.target },
        offset: this.status.confirmed
      }
    } else {
      this.operation.request = req
      this.operation.target = { ...this.status.target }
    }
    this.update({
      phase: 'preparing',
      projectId: req.projectId,
      total: req.text.length,
      confirmed: this.operation.offset
    })
    return this.run()
  }

  async start(value: InsertionRequest): Promise<InsertionStatus> {
    if (this.abort || insertionLocked(this.status)) throw new Error('Un inserimento è già attivo.')
    if (!this.status.supported || !this.status.connected || !this.status.target || !this.status.stopAvailable) {
      throw new Error('Collega Edge e rendi disponibile lo stop globale prima di avviare.')
    }
    const request = parseInsertionRequest(value)
    this.lastRequest = request
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

    const check = async (action: string, expected: string): Promise<boolean> => {
      signal.throwIfAborted()
      const snapshot = parseSnapshot(await request('browser', action, { target: operation.target, expected }))
      if (!sameTarget(snapshot.target, operation.target)) {
        throw new Error('Scheda, documento o destinazione cambiata. Inserimento fermato.')
      }
      const val = snapshot.value.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
      const exp = expected.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
      if (val !== exp || snapshot.selectionStart !== exp.length || snapshot.selectionEnd !== exp.length) {
        throw new Error('Il campo contiene testo o una selezione inattesa. Nessun carattere sarà riscritto.')
      }
      if (!snapshot.focused) {
        this.pause('Inserimento in pausa per perdita di focus. Clicca su Riprendi per continuare.')
        return false
      }
      return true
    }

    try {
      this.update({ phase: 'preparing', message: 'Verifica della scheda e del campo…' })
      await this.preflight?.(operation.request, signal)
      signal.throwIfAborted()
      await request('native', 'activate', {})
      signal.throwIfAborted()

      const snapshotRaw = await request('browser', 'inspect', { target: operation.target }).catch(() => request('browser', 'snapshot', { target: operation.target, expected: '' }))
      const inspection = parseSnapshot(snapshotRaw)
      const fieldVal = inspection.value.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
      const targetText = operation.request.text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

      if (fieldVal.length > 0) {
        if (!targetText.startsWith(fieldVal)) {
          throw new Error('Il campo contiene testo che non corrisponde al Rationale atteso. Non verrà sovrascritto.')
        }
        operation.offset = fieldVal.length
      } else {
        operation.offset = 0
      }
      this.update({ confirmed: operation.offset, total: targetText.length })

      const expected = targetText.slice(0, operation.offset)
      if (!await check('prepare', expected)) return this.status
      const lease = parseLease(await request('native', 'probe', { expected }))
      const planner = new CadencePlanner(operation.request)
      this.update({ phase: 'typing', message: 'Inserimento in corso · Ctrl+Alt+S stop · Ctrl+Alt+P pausa' })
      let prevChar: string | null = operation.offset > 0 ? targetText[operation.offset - 1] : null
      while (operation.offset < targetText.length) {
        const prefix = targetText.slice(0, operation.offset)
        const character = String.fromCodePoint(targetText.codePointAt(operation.offset)!)
        const plan = planner.planNext(character, prevChar)
        if (plan.isThinkingPause) {
          this.update({ message: 'Pausa di riflessione in corso… · Ctrl+Alt+S stop' })
        }
        await this.delay(plan.delayMs, signal)
        signal.throwIfAborted()
        if (!await check('snapshot', prefix)) return this.status
        if (plan.typo) {
          this.update({ message: 'Simulazione e correzione refuso… · Ctrl+Alt+S stop' })
        } else if (plan.isThinkingPause) {
          this.update({ message: 'Inserimento in corso · Ctrl+Alt+S stop · Ctrl+Alt+P pausa' })
        }
        this.uncertain = true
        await request('native', 'type', {
          lease,
          expected: prefix,
          text: character,
          ...(plan.typo ? { typo: plan.typo } : {})
        })
        this.uncertain = false
        if (plan.typo) {
          this.update({ message: 'Inserimento in corso · Ctrl+Alt+S stop · Ctrl+Alt+P pausa' })
        }
        operation.offset += character.length
        prevChar = character
        this.update({ confirmed: operation.offset })
        if (!await check('snapshot', prefix + character)) return this.status
      }
      this.operation = null
      this.update({ phase: 'completed', message: 'Testo completo verificato. Controlla e invia tu la task.' })
    } catch (error) {
      if (!signal.aborted) {
        const msg = error instanceof Error ? error.message : String(error)
        const isFocus = /focus|primo piano/i.test(msg)
        if (isFocus) {
          this.pause('Inserimento in pausa per perdita di focus. Clicca su Riprendi per continuare.')
        } else {
          this.operation = null
          this.update({ phase: 'error', message: msg || 'Inserimento non riuscito.' })
        }
      }
    } finally {
      if (this.abort === controller) this.abort = null
      this.uncertain = false
    }
    return this.status
  }
}
