import { DEFAULT_LIVE_LIMITS, MAX_LIVE_AUDIO_BYTES, liveReasoningTimeoutMs, parseLiveConfig, parseLiveLimits, type LiveLimits, type LiveConfig, type LiveDecision, type LiveHistoryItem, type LiveTurnRequest } from '../../../shared/live'
import { parseLiveMaterials, type LiveMaterial } from '../../../shared/liveMaterials'

export type LivePhase = 'idle' | 'listening' | 'thinking' | 'ready' | 'preparing-voice' | 'speaking' | 'paused' | 'stopped' | 'completed'
export interface LiveOptions { silenceMs: number; responseTimeoutMs: number; maxDurationMs: number; maxTurns: number; maxCostUsd: number }
export const DEFAULT_LIVE_OPTIONS: LiveOptions = { silenceMs: 2500, responseTimeoutMs: 60000, maxDurationMs: DEFAULT_LIVE_LIMITS.durationMinutes * 60000, maxTurns: DEFAULT_LIVE_LIMITS.maxTurns, maxCostUsd: DEFAULT_LIVE_LIMITS.maxCostUsd }
export interface LiveUtterance extends LiveHistoryItem { id: string; atMs: number }
export interface LiveLog { atMs: number; kind: string; text: string; costUsd?: number | null; qwenMs?: number }
export interface LiveSnapshot {
  phase: LivePhase; message: string; turns: number; costUsd: number; costKnown: boolean; level: number; nextText: string
  history: LiveUtterance[]; log: LiveLog[]; startedAt: number
  materials: LiveMaterial[]
}
interface Dependencies {
  now(): number
  decide(request: LiveTurnRequest, signal: AbortSignal): Promise<LiveDecision>
  speak(text: string, signal: AbortSignal, onStarted: () => boolean): Promise<void>
  changed(snapshot: LiveSnapshot): void
}

/** Owns free turn-taking; browser capture and synthesis are injected. */
export class LiveController {
  snapshot: LiveSnapshot = { phase: 'idle', message: 'Pronto per una conversazione libera.', turns: 0, costUsd: 0, costKnown: true, level: 0, nextText: '', history: [], log: [], startedAt: 0, materials: [] }
  private config!: LiveConfig
  private options = DEFAULT_LIVE_OPTIONS
  private session = 0
  private serial = 0
  private operation: AbortController | null = null
  private playing: LiveUtterance | null = null
  private proposal: LiveDecision | null = null
  private proposalAt = 0
  private phaseAt = 0
  private listeningAt = 0
  private lastPacketAt = 0
  private lastPublishAt = 0
  private frames: Uint8Array[] = []
  private bytes = 0
  private preRoll: Uint8Array[] = []
  private audioMs = 0
  private lastVoiceMs = -Infinity
  private segmentStartMs = 0
  private voiceFrames = 0
  private voiceVersion = 0
  private analyzedVersion = 0
  private trailingFrames = 0
  private reasoningTimeoutMs = liveReasoningTimeoutMs()
  private waitingAt: number | null = null
  private waitRechecked = false
  private retryableAudio = false

  constructor(private readonly dependencies: Dependencies) {}
  get active(): boolean { return ['listening', 'thinking', 'ready', 'preparing-voice', 'speaking'].includes(this.snapshot.phase) }
  get locked(): boolean { return this.active || this.snapshot.phase === 'paused' }
  get limits(): LiveLimits { return { durationMinutes: this.options.maxDurationMs / 60000, maxTurns: this.options.maxTurns, maxCostUsd: this.options.maxCostUsd } }
  get canRespond(): boolean { return this.snapshot.phase === 'listening' && (this.voiceVersion > 0 && this.bytes > 0 || this.snapshot.materials.length > 0) && this.audioMs - this.lastVoiceMs >= 300 }

  respondNow(): void {
    if (this.canRespond && this.withinLimits()) { this.log('manual-response', 'Risposta richiesta dall’utente.'); void this.reason(false, true, !(this.voiceVersion > 0 && this.bytes > 0)) }
  }

  addMaterial(value: LiveMaterial): void { this.setMaterials([...this.snapshot.materials, value]) }
  removeMaterial(id: string): void { this.setMaterials(this.snapshot.materials.filter((item) => item.id !== id)) }
  private setMaterials(value: LiveMaterial[]): void {
    this.snapshot.materials = parseLiveMaterials(value)
    this.log('materials', `Contesto aggiornato · ${this.snapshot.materials.length} allegati.`)
    if (['thinking', 'ready', 'preparing-voice'].includes(this.snapshot.phase)) {
      // No speech has started: replace the obsolete proposal without pausing capture.
      this.cancel()
      const hasQuestion = this.voiceVersion > 0 && this.bytes > 0
      this.analyzedVersion = hasQuestion ? Math.max(0, this.voiceVersion - 1) : this.voiceVersion
      this.phase('listening', 'Contesto aggiornato · rielaboro la domanda acquisita.')
      if (!hasQuestion && this.snapshot.materials.length) void this.reason(false, true, true)
    } else this.publish() // Speech already playing finishes; new context joins the next turn.
  }

  start(config: LiveConfig, opening: boolean, options: Partial<LiveOptions> = {}): void {
    if (this.locked) throw new Error('Ferma la conversazione precedente prima di avviarne una nuova.')
    const parsed = parseLiveConfig(config)
    const limits = parsed.limits ?? DEFAULT_LIVE_LIMITS
    const next = { ...DEFAULT_LIVE_OPTIONS, maxDurationMs: limits.durationMinutes * 60000, maxTurns: limits.maxTurns, maxCostUsd: limits.maxCostUsd, ...options }
    if (typeof opening !== 'boolean' || Object.values(next).some((value) => !Number.isFinite(value) || value <= 0) || next.silenceMs < 1500 || next.silenceMs > 5000 || !Number.isInteger(next.maxTurns) || next.maxTurns > 500) throw new Error('Limiti della conversazione non validi.')
    this.config = structuredClone(parsed)
    this.options = next
    this.cancel(); this.session++
    const now = this.dependencies.now()
    this.snapshot = { phase: 'idle', message: '', turns: 0, costUsd: 0, costKnown: true, level: 0, nextText: '', history: [], log: [], startedAt: now, materials: this.snapshot.materials }
    this.lastPacketAt = this.listeningAt = now
    this.resetAudio()
    this.log('session', `Conversazione avviata · ${this.profile.name}.`)
    this.phase('listening', 'Ascolto l’interlocutore.')
    if (opening) void this.reason(true)
  }

  feed(pcm: Uint8Array): void {
    this.lastPacketAt = this.dependencies.now()
    if (!this.active) return
    if (!(pcm instanceof Uint8Array) || pcm.length !== 3200) { this.pause('Pacchetto audio non valido.'); return }
    const view = new DataView(pcm.buffer, pcm.byteOffset, pcm.byteLength)
    let sum = 0
    for (let i = 0; i < pcm.length; i += 2) { const value = view.getInt16(i, true) / 32768; sum += value * value }
    this.snapshot.level = Math.sqrt(sum / 1600)
    this.audioMs += 100
    const voiced = this.snapshot.level >= 0.008
    if (voiced) {
      this.trailingFrames = 0
      if (this.audioMs - this.lastVoiceMs > 300) { this.voiceFrames = 0; this.segmentStartMs = this.audioMs - 100 }
      this.voiceFrames++
      this.lastVoiceMs = this.audioMs
      if (!this.frames.length) { this.frames = this.preRoll.map((frame) => Uint8Array.from(frame)); this.bytes = this.frames.reduce((n, frame) => n + frame.length, 0) }
      if (this.voiceFrames >= 2) {
        this.waitingAt = null; this.waitRechecked = false
        this.voiceVersion++
        if (['thinking', 'ready', 'preparing-voice'].includes(this.snapshot.phase)) {
          this.cancel(); this.log('resumed', 'L’interlocutore parla: risposta precedente scartata.'); this.phase('listening', 'L’interlocutore continua · ascolto.')
        } else if (this.snapshot.phase === 'speaking' && this.audioMs - this.segmentStartMs >= 1200) {
          this.cancel(); this.log('interruption', 'L’interlocutore ha interrotto NEB.'); this.phase('listening', 'Interruzione · ascolto l’interlocutore.')
        }
      }
    }
    // Retain internal pauses, but never accumulate the silence spent waiting for Qwen/Gemini.
    if ((this.frames.length || voiced) && (voiced || this.trailingFrames < Math.ceil(this.options.silenceMs / 100))) {
      if (this.bytes + pcm.length > MAX_LIVE_AUDIO_BYTES) {
        if (voiced) { this.pause('Intervento oltre 3 minuti: prendi il controllo o riprendi l’ascolto.'); return }
      } else {
        this.frames.push(Uint8Array.from(pcm)); this.bytes += pcm.length
        if (!voiced) this.trailingFrames++
      }
    }
    if (this.snapshot.phase === 'speaking' && this.voiceFrames && this.audioMs - this.lastVoiceMs >= 400) this.resetAudio()
    this.preRoll.push(Uint8Array.from(pcm)); if (this.preRoll.length > 3) this.preRoll.shift()
    if (this.dependencies.now() - this.lastPublishAt >= 500) this.publish()
  }

  tick(): void {
    if (!this.active) return
    const now = this.dependencies.now()
    if (!this.withinLimits()) return
    if (now - this.lastPacketAt > 1500) { this.pause('Flusso audio assente: riavvia l’ascolto della scheda.'); return }
    if (this.snapshot.phase === 'thinking' && now - this.phaseAt >= this.reasoningTimeoutMs) { this.pause(`Qwen non ha risposto entro ${this.reasoningTimeoutMs / 1000} secondi. La domanda è conservata: riprendi e premi Rispondi ora.`, true); return }
    if (this.snapshot.phase === 'preparing-voice' && now - this.phaseAt >= 60000) { this.pause('La voce non ha prodotto audio entro 60 secondi.', true); return }
    if (this.snapshot.phase === 'listening') {
      if (this.voiceVersion > this.analyzedVersion && this.audioMs - this.lastVoiceMs >= this.options.silenceMs) void this.reason(false)
      else if (this.waitingAt !== null && !this.waitRechecked && now - this.waitingAt >= 5000 && this.audioMs - this.lastVoiceMs >= 8000) {
        this.log('end-of-turn', 'Silenzio prolungato: rivaluto la domanda senza attendere nuovo audio.'); void this.reason(false, true)
      }
      else if (now - this.listeningAt >= this.options.responseTimeoutMs && (this.voiceVersion === this.analyzedVersion || this.audioMs - this.lastVoiceMs >= this.options.silenceMs)) this.pause('Nessun intervento concluso: riprendi quando la conversazione è pronta.', this.canRespond)
    } else if (this.snapshot.phase === 'ready' && this.proposal && now - this.proposalAt >= 300 && this.audioMs - this.lastVoiceMs >= this.options.silenceMs) {
      const proposal = this.proposal; this.proposal = null; void this.speak(proposal)
    }
  }

  pause(message = 'Conversazione in pausa. Puoi prendere la parola.', retainAudio = false): void {
    if (!this.locked) return
    this.retryableAudio = retainAudio && this.bytes > 0 && this.voiceVersion > 0
    this.cancel(); this.log('pause', message); this.phase('paused', message)
  }
  resume(): void {
    if (this.snapshot.phase !== 'paused' || !this.withinLimits()) return
    if (!this.retryableAudio) this.resetAudio()
    else { this.analyzedVersion = this.voiceVersion; this.waitingAt = null; this.waitRechecked = true; this.retryableAudio = false }
    this.listeningAt = this.lastPacketAt = this.dependencies.now()
    this.log('resume', 'Ascolto ripreso; nessuna risposta ripetuta automaticamente.'); this.phase('listening', 'Ascolto ripreso.')
  }
  updateLimits(value: LiveLimits): void {
    if (this.snapshot.phase !== 'paused') throw new Error('Metti in pausa la conversazione prima di cambiarne i limiti.')
    const limits = parseLiveLimits(value)
    this.options = { ...this.options, maxDurationMs: limits.durationMinutes * 60000, maxTurns: limits.maxTurns, maxCostUsd: limits.maxCostUsd }
    this.log('limits', `Limiti aggiornati: ${limits.durationMinutes} minuti, ${limits.maxTurns} turni, $${limits.maxCostUsd} OpenRouter.`)
    this.publish()
  }
  stop(): void {
    this.cancel(); this.resetAudio()
    if (this.snapshot.phase !== 'idle') { this.log('stop', 'Conversazione fermata.'); this.phase('stopped', 'NEB Live fermato.') }
  }
  reset(): void {
    this.cancel(); this.session++; this.resetAudio()
    this.snapshot = { phase: 'idle', message: 'Nuova conversazione pronta.', turns: 0, costUsd: 0, costKnown: true, level: 0, nextText: '', history: [], log: [], startedAt: 0, materials: [] }
    this.publish()
  }

  private get profile() { return this.config.profiles.find((profile) => profile.id === this.config.selectedProfileId)! }
  private withinLimits(): boolean {
    const reason = this.snapshot.costUsd >= this.options.maxCostUsd ? 'Limite di costo OpenRouter raggiunto. Aumentalo in Configura → Dettagli, salva e riprendi.'
      : this.snapshot.turns >= this.options.maxTurns && this.snapshot.phase !== 'speaking' ? 'Limite di interventi NEB raggiunto. Aumentalo in Configura → Dettagli, salva e riprendi.'
      : this.dependencies.now() - this.snapshot.startedAt >= this.options.maxDurationMs ? 'Limite di durata raggiunto. Aumentalo in Configura → Dettagli, salva e riprendi.' : ''
    if (!reason) return true
    this.pause(reason); return false
  }

  private async reason(opening: boolean, endOfTurn = false, visualOnly = false): Promise<void> {
    const token = ++this.serial, session = this.session
    const operation = new AbortController(); this.operation = operation
    // End-of-turn silence is useful locally, but only a short tail is needed by Qwen.
    const silentFrames = Math.max(0, this.trailingFrames - 3)
    const pcm = new Uint8Array(Math.max(0, this.bytes - silentFrames * 3200))
    let offset = 0
    for (const frame of this.frames) {
      if (offset >= pcm.length) break
      pcm.set(frame.subarray(0, pcm.length - offset), offset); offset += frame.length
    }
    this.analyzedVersion = this.voiceVersion
    this.waitingAt = null
    if (endOfTurn) this.waitRechecked = true
    this.reasoningTimeoutMs = Math.max(liveReasoningTimeoutMs(opening || visualOnly ? 0 : pcm.length), this.snapshot.materials.some((item) => item.kind === 'image') ? 60000 : 0)
    this.phase('thinking', opening ? 'Preparo una presentazione nel tuo stile…' : visualOnly ? 'Qwen analizza gli allegati e l’ultima domanda…' : `Domanda acquisita · ${(pcm.length / 32000).toFixed(1)} s. Qwen prepara la risposta…`)
    try {
      const result = await this.dependencies.decide({ requestId: `live-${session}-${token}`, profile: { ...this.profile }, background: this.config.background, persona: this.config.persona,
        history: this.snapshot.history.slice(-60).map(({ role, text, partial }) => ({ role, text, ...(partial ? { partial: true } : {}) })), ...(opening ? { opening: true } : visualOnly ? { visualOnly: true } : { audioPcm: pcm }), ...(endOfTurn ? { endOfTurn: true } : {}), ...(this.snapshot.materials.length ? { materials: [...this.snapshot.materials] } : {}) }, operation.signal)
      if (session !== this.session) return
      if (result.costUsd === null || !Number.isFinite(result.costUsd) || result.costUsd < 0) {
        if (this.snapshot.costKnown) this.log('accounting', 'Costo OpenRouter parziale: alcuni importi non sono disponibili. Il budget controlla soltanto i costi ricevuti.')
        this.snapshot.costKnown = false
      }
      else this.snapshot.costUsd += result.costUsd
      const accepted = token === this.serial && !operation.signal.aborted
      this.log(accepted ? 'decision' : 'discarded', result.reason, { costUsd: result.costUsd, qwenMs: result.qwenMs })
      if (!accepted) { if (this.active) this.withinLimits(); this.publish(); return }
      this.operation = null
      if (!this.withinLimits()) return
      if (result.action === 'pause') { this.pause(result.reason, true); return }
      if (result.action === 'wait') {
        this.listeningAt = this.dependencies.now()
        if (result.transcript.trim()) this.waitingAt = this.dependencies.now()
        else this.resetAudio() // No speech was recognized: do not re-upload noise or laughter.
        this.phase('listening', endOfTurn ? 'Qwen attende ancora: puoi premere Rispondi ora o continuare la domanda.' : 'Intervento incompleto · ascolto; rivaluto se il silenzio continua.')
        return
      }
      if (result.action === 'complete') {
        if (result.transcript) this.addHistory('interlocutor', result.transcript)
        this.phase('completed', 'Conversazione conclusa.'); return
      }
      if (result.action !== 'speak' || !result.text.trim() || !opening && !visualOnly && !result.transcript.trim()) { this.pause('Risposta Qwen non valida.'); return }
      this.proposal = result; this.proposalAt = this.dependencies.now(); this.snapshot.nextText = result.text
      this.phase('ready', 'Risposta pronta · verifico che l’interlocutore abbia finito.')
    } catch (error) {
      if (token === this.serial && !operation.signal.aborted) this.pause(error instanceof Error ? error.message : 'Elaborazione non riuscita.', true)
    }
  }

  private async speak(decision: LiveDecision): Promise<void> {
    if (!this.withinLimits()) return
    const token = ++this.serial
    const operation = new AbortController(); this.operation = operation
    this.snapshot.nextText = decision.text
    this.phase('preparing-voice', 'Preparo la tua voce…')
    try {
      await this.dependencies.speak(decision.text, operation.signal, () => {
        if (token !== this.serial || operation.signal.aborted || !this.active) return false
        if (this.audioMs - this.lastVoiceMs < this.options.silenceMs) { this.cancel(); this.phase('listening', 'L’interlocutore sta parlando · attendo.'); return false }
        if (decision.transcript) this.addHistory('interlocutor', decision.transcript)
        this.playing = this.addHistory('neb', decision.text)
        this.snapshot.turns++
        this.resetAudio()
        this.phase('speaking', 'NEB parla · ascolto eventuali interruzioni.')
        return true
      })
      if (token !== this.serial || operation.signal.aborted) return
      this.playing = null; this.operation = null; this.snapshot.nextText = ''
      if (this.audioMs - this.lastVoiceMs > 300) this.resetAudio()
      this.listeningAt = this.dependencies.now()
      this.phase('listening', 'Ascolto l’interlocutore.')
      this.withinLimits()
    } catch (error) {
      if (token === this.serial && !operation.signal.aborted) this.pause(error instanceof Error ? error.message : 'Generazione della voce non riuscita.', this.snapshot.phase === 'preparing-voice')
    }
  }

  private addHistory(role: LiveHistoryItem['role'], text: string): LiveUtterance {
    const item: LiveUtterance = { id: `live-${this.session}-${this.serial}-${this.snapshot.history.length}`, atMs: Math.max(0, this.dependencies.now() - this.snapshot.startedAt), role, text }
    this.snapshot.history = [...this.snapshot.history, item].slice(-200)
    return item
  }
  private cancel(): void {
    this.serial++; this.operation?.abort(); this.operation = null
    if (this.playing) { this.snapshot.history = this.snapshot.history.map((item) => item.id === this.playing?.id ? { ...item, partial: true } : item); this.log('partial', 'Intervento NEB interrotto; testo pronunciato solo in parte.'); this.playing = null }
    this.proposal = null; this.snapshot.nextText = ''
  }
  private resetAudio(): void { this.frames = []; this.bytes = 0; this.preRoll = []; this.audioMs = 0; this.voiceFrames = 0; this.lastVoiceMs = -Infinity; this.voiceVersion = 0; this.analyzedVersion = 0; this.trailingFrames = 0; this.waitingAt = null; this.waitRechecked = false; this.retryableAudio = false }
  private phase(phase: LivePhase, message: string): void { this.snapshot.phase = phase; this.snapshot.message = message; this.phaseAt = this.dependencies.now(); this.publish() }
  private log(kind: string, text: string, details: Partial<LiveLog> = {}): void { this.snapshot.log = [...this.snapshot.log, { atMs: Math.max(0, this.dependencies.now() - this.snapshot.startedAt), kind, text, ...details }].slice(-500) }
  private publish(): void { this.lastPublishAt = this.dependencies.now(); this.dependencies.changed({ ...this.snapshot }) }
}
