import { MAX_S2S_AUDIO_BYTES } from '../../../shared/s2s'
import { parseLiveConfig, type LiveConfig, type LiveDecision, type LiveHistoryItem, type LiveTurnRequest } from '../../../shared/live'

export type LivePhase = 'idle' | 'listening' | 'thinking' | 'ready' | 'preparing-voice' | 'speaking' | 'paused' | 'stopped' | 'completed'
export interface LiveOptions { silenceMs: number; responseTimeoutMs: number; maxDurationMs: number; maxTurns: number; maxCostUsd: number }
export const DEFAULT_LIVE_OPTIONS: LiveOptions = { silenceMs: 2500, responseTimeoutMs: 60000, maxDurationMs: 20 * 60000, maxTurns: 40, maxCostUsd: 1 }
export interface LiveUtterance extends LiveHistoryItem { id: string; atMs: number }
export interface LiveLog { atMs: number; kind: string; text: string; costUsd?: number | null; qwenMs?: number }
export interface LiveSnapshot {
  phase: LivePhase; message: string; turns: number; costUsd: number; costKnown: boolean; level: number; nextText: string
  history: LiveUtterance[]; log: LiveLog[]; startedAt: number
}
interface Dependencies {
  now(): number
  decide(request: LiveTurnRequest, signal: AbortSignal): Promise<LiveDecision>
  speak(text: string, signal: AbortSignal, onStarted: () => boolean): Promise<void>
  changed(snapshot: LiveSnapshot): void
}

/** Owns free turn-taking; browser capture and synthesis are injected. */
export class LiveController {
  snapshot: LiveSnapshot = { phase: 'idle', message: 'Pronto per una conversazione libera.', turns: 0, costUsd: 0, costKnown: true, level: 0, nextText: '', history: [], log: [], startedAt: 0 }
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

  constructor(private readonly dependencies: Dependencies) {}
  get active(): boolean { return ['listening', 'thinking', 'ready', 'preparing-voice', 'speaking'].includes(this.snapshot.phase) }
  get locked(): boolean { return this.active || this.snapshot.phase === 'paused' }

  start(config: LiveConfig, opening: boolean, options: Partial<LiveOptions> = {}): void {
    if (this.locked) throw new Error('Ferma la conversazione precedente prima di avviarne una nuova.')
    const next = { ...DEFAULT_LIVE_OPTIONS, ...options }
    if (typeof opening !== 'boolean' || Object.values(next).some((value) => !Number.isFinite(value) || value <= 0) || next.silenceMs < 1500 || next.silenceMs > 5000 || !Number.isInteger(next.maxTurns) || next.maxTurns > 100) throw new Error('Limiti della conversazione non validi.')
    this.config = structuredClone(parseLiveConfig(config))
    this.options = next
    this.cancel(); this.session++
    const now = this.dependencies.now()
    this.snapshot = { phase: 'idle', message: '', turns: 0, costUsd: 0, costKnown: true, level: 0, nextText: '', history: [], log: [], startedAt: now }
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
      if (this.audioMs - this.lastVoiceMs > 300) { this.voiceFrames = 0; this.segmentStartMs = this.audioMs - 100 }
      this.voiceFrames++
      this.lastVoiceMs = this.audioMs
      if (!this.frames.length) { this.frames = this.preRoll.map((frame) => Uint8Array.from(frame)); this.bytes = this.frames.reduce((n, frame) => n + frame.length, 0) }
      if (this.voiceFrames >= 2) {
        this.voiceVersion++
        if (['thinking', 'ready', 'preparing-voice'].includes(this.snapshot.phase)) {
          this.cancel(); this.log('resumed', 'L’interlocutore parla: risposta precedente scartata.'); this.phase('listening', 'L’interlocutore continua · ascolto.')
        } else if (this.snapshot.phase === 'speaking' && this.audioMs - this.segmentStartMs >= 1200) {
          this.cancel(); this.log('interruption', 'L’interlocutore ha interrotto NEB.'); this.phase('listening', 'Interruzione · ascolto l’interlocutore.')
        }
      }
    }
    if (this.frames.length || voiced) {
      if (this.bytes + pcm.length > MAX_S2S_AUDIO_BYTES) { this.pause('Intervento oltre 120 secondi: prendi il controllo o riprendi l’ascolto.'); return }
      this.frames.push(Uint8Array.from(pcm)); this.bytes += pcm.length
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
    if (this.snapshot.phase === 'thinking' && now - this.phaseAt >= 35000) { this.pause('Qwen non ha risposto entro 35 secondi.'); return }
    if (this.snapshot.phase === 'preparing-voice' && now - this.phaseAt >= 60000) { this.pause('La voce non ha prodotto audio entro 60 secondi.'); return }
    if (this.snapshot.phase === 'listening') {
      if (this.voiceVersion > this.analyzedVersion && this.audioMs - this.lastVoiceMs >= this.options.silenceMs) void this.reason(false)
      else if (now - this.listeningAt >= this.options.responseTimeoutMs && (this.voiceVersion === this.analyzedVersion || this.audioMs - this.lastVoiceMs >= this.options.silenceMs)) this.pause('Nessun intervento concluso: riprendi quando la conversazione è pronta.')
    } else if (this.snapshot.phase === 'ready' && this.proposal && now - this.proposalAt >= 300 && this.audioMs - this.lastVoiceMs >= this.options.silenceMs) {
      const proposal = this.proposal; this.proposal = null; void this.speak(proposal)
    }
  }

  pause(message = 'Conversazione in pausa. Puoi prendere la parola.'): void {
    if (!this.locked) return
    this.cancel(); this.log('pause', message); this.phase('paused', message)
  }
  resume(): void {
    if (this.snapshot.phase !== 'paused' || !this.withinLimits()) return
    this.resetAudio(); this.listeningAt = this.lastPacketAt = this.dependencies.now()
    this.log('resume', 'Ascolto ripreso; nessuna risposta ripetuta automaticamente.'); this.phase('listening', 'Ascolto ripreso.')
  }
  stop(): void {
    this.cancel(); this.resetAudio()
    if (this.snapshot.phase !== 'idle') { this.log('stop', 'Conversazione fermata.'); this.phase('stopped', 'NEB Live fermato.') }
  }

  private get profile() { return this.config.profiles.find((profile) => profile.id === this.config.selectedProfileId)! }
  private withinLimits(): boolean {
    const reason = !this.snapshot.costKnown ? 'Costo OpenRouter non disponibile: ferma la sessione e verifica la spesa.'
      : this.snapshot.costUsd >= this.options.maxCostUsd ? 'Limite di costo OpenRouter raggiunto.'
      : this.snapshot.turns >= this.options.maxTurns && this.snapshot.phase !== 'speaking' ? 'Limite di interventi NEB raggiunto.'
      : this.dependencies.now() - this.snapshot.startedAt >= this.options.maxDurationMs ? 'Limite di durata raggiunto.' : ''
    if (!reason) return true
    this.pause(reason); return false
  }

  private async reason(opening: boolean): Promise<void> {
    const token = ++this.serial, session = this.session
    const operation = new AbortController(); this.operation = operation
    const pcm = new Uint8Array(this.bytes)
    let offset = 0; for (const frame of this.frames) { pcm.set(frame, offset); offset += frame.length }
    this.analyzedVersion = this.voiceVersion
    this.phase('thinking', opening ? 'Preparo una presentazione nel tuo stile…' : 'Qwen ascolta e prepara la risposta…')
    try {
      const result = await this.dependencies.decide({ requestId: `live-${session}-${token}`, profile: { ...this.profile }, background: this.config.background, persona: this.config.persona,
        history: this.snapshot.history.slice(-60).map(({ role, text, partial }) => ({ role, text, ...(partial ? { partial: true } : {}) })), ...(opening ? { opening: true } : { audioPcm: pcm }) }, operation.signal)
      if (session !== this.session) return
      if (result.costUsd === null || !Number.isFinite(result.costUsd) || result.costUsd < 0) this.snapshot.costKnown = false
      else this.snapshot.costUsd += result.costUsd
      const accepted = token === this.serial && !operation.signal.aborted
      this.log(accepted ? 'decision' : 'discarded', result.reason, { costUsd: result.costUsd, qwenMs: result.qwenMs })
      if (!accepted) { if (this.active) this.withinLimits(); this.publish(); return }
      this.operation = null
      if (!this.withinLimits()) return
      if (result.action === 'pause') { this.pause(result.reason); return }
      if (result.action === 'wait') { this.listeningAt = this.dependencies.now(); this.phase('listening', 'Intervento incompleto · continuo ad ascoltare.'); return }
      if (result.action === 'complete') {
        if (result.transcript) this.addHistory('interlocutor', result.transcript)
        this.phase('completed', 'Conversazione conclusa.'); return
      }
      if (result.action !== 'speak' || !result.text.trim() || !opening && !result.transcript.trim()) { this.pause('Risposta Qwen non valida.'); return }
      this.proposal = result; this.proposalAt = this.dependencies.now(); this.snapshot.nextText = result.text
      this.phase('ready', 'Risposta pronta · verifico che l’interlocutore abbia finito.')
    } catch (error) {
      if (token === this.serial && !operation.signal.aborted) this.pause(error instanceof Error ? error.message : 'Elaborazione non riuscita.')
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
      if (token === this.serial && !operation.signal.aborted) this.pause(error instanceof Error ? error.message : 'Generazione della voce non riuscita.')
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
  private resetAudio(): void { this.frames = []; this.bytes = 0; this.preRoll = []; this.audioMs = 0; this.voiceFrames = 0; this.lastVoiceMs = -Infinity; this.voiceVersion = 0; this.analyzedVersion = 0 }
  private phase(phase: LivePhase, message: string): void { this.snapshot.phase = phase; this.snapshot.message = message; this.phaseAt = this.dependencies.now(); this.publish() }
  private log(kind: string, text: string, details: Partial<LiveLog> = {}): void { this.snapshot.log = [...this.snapshot.log, { atMs: Math.max(0, this.dependencies.now() - this.snapshot.startedAt), kind, text, ...details }].slice(-500) }
  private publish(): void { this.lastPublishAt = this.dependencies.now(); this.dependencies.changed({ ...this.snapshot }) }
}
