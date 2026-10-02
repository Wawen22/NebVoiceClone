import { MAX_S2S_AUDIO_BYTES, type S2SAdaptRequest, type S2SDecision, type S2SHistoryItem, type S2SLine } from '../../../shared/s2s'

export type S2SPhase = 'idle' | 'preparing-voice' | 'speaking' | 'listening' | 'waiting' | 'adapting' | 'ready' | 'paused' | 'stopped' | 'completed'
export interface S2SOptions { silenceMs: number; responseTimeoutMs: number; maxDurationMs: number; maxTurns: number; maxCostUsd: number }
export const DEFAULT_S2S_OPTIONS: S2SOptions = { silenceMs: 2500, responseTimeoutMs: 30000, maxDurationMs: 20 * 60000, maxTurns: 40, maxCostUsd: 1 }
export interface S2SLogEntry {
  atMs: number; kind: string; text: string; original?: string; adapted?: string; transcript?: string
  qwenMs?: number; firstAudioMs?: number; silenceMs?: number; costUsd?: number | null
}
export interface S2SSnapshot {
  phase: S2SPhase; message: string; lineIndex: number; total: number; spokenTurns: number
  costUsd: number; costKnown: boolean; nextText: string; level: number; log: S2SLogEntry[]
}
export interface S2SDependencies {
  now(): number
  adapt(request: S2SAdaptRequest, signal: AbortSignal): Promise<S2SDecision>
  speak(text: string, signal: AbortSignal, onStarted: () => boolean): Promise<void>
  completed(id: string): void
  changed(snapshot: S2SSnapshot): void
}

export class S2SController {
  snapshot: S2SSnapshot = { phase: 'idle', message: 'Automatico pronto da configurare.', lineIndex: 0, total: 0, spokenTurns: 0, costUsd: 0, costKnown: true, nextText: '', level: 0, log: [] }
  private lines: S2SLine[] = []
  private history: S2SHistoryItem[] = []
  private scenario = ''
  private options = DEFAULT_S2S_OPTIONS
  private startedAt = 0
  private listeningAt = 0
  private lastPacketAt = 0
  private lastPublishAt = 0
  private audioMs = 0
  private lastVoiceMs = -Infinity
  private voiceFrames = 0
  private segmentStartMs = 0
  private voiceVersion = 0
  private analyzedVersion = 0
  private frames: Uint8Array[] = []
  private bytes = 0
  private preRoll: Uint8Array[] = []
  private serial = 0
  private sessionId = 0
  private operation: AbortController | null = null
  private play: { line: S2SLine; text: string; started: boolean; at: number } | null = null
  private proposalAt = 0
  private proposal: S2SDecision | null = null
  private adaptationAt = 0

  constructor(private readonly dependencies: S2SDependencies) {}
  get active(): boolean { return ['preparing-voice', 'speaking', 'listening', 'waiting', 'adapting', 'ready'].includes(this.snapshot.phase) }
  get locked(): boolean { return this.active || this.snapshot.phase === 'paused' }

  start(lines: S2SLine[], scenario: string, options: Partial<S2SOptions> = {}): void {
    if (this.locked) throw new Error('Ferma la sessione precedente prima di avviarne una nuova.')
    const settings = { ...DEFAULT_S2S_OPTIONS, ...options }
    if (!lines.length || lines.length > 100 || lines.some((l) => !l.id || !l.text.trim() || l.text.length > 4000) || scenario.length > 4000 ||
        Object.values(settings).some((v) => !Number.isFinite(v) || v <= 0) || settings.silenceMs < 1500 || settings.silenceMs > 5000 ||
        settings.maxTurns > 100 || !Number.isInteger(settings.maxTurns)) throw new Error('Script o limiti della sessione non validi.')
    this.cancel()
    this.sessionId++
    this.lines = lines.map((line) => ({ ...line }))
    this.scenario = scenario
    this.options = settings
    this.history = []
    this.startedAt = this.dependencies.now()
    this.lastPacketAt = this.startedAt
    this.snapshot = { phase: 'idle', message: '', lineIndex: 0, total: lines.length, spokenTurns: 0, costUsd: 0, costKnown: true, nextText: '', level: 0, log: [] }
    this.resetResponse()
    this.log('session', 'Sessione avviata; obiettivo e ordine dello script conservati.')
    void this.speak(lines[0].text)
  }

  feed(pcm: Uint8Array): void {
    this.lastPacketAt = this.dependencies.now()
    if (!this.active) return
    if (pcm.length !== 3200) { this.pause('Pacchetto audio non valido.'); return }
    this.audioMs += 100
    const view = new DataView(pcm.buffer, pcm.byteOffset, pcm.byteLength)
    let sum = 0
    for (let i = 0; i < pcm.length; i += 2) { const value = view.getInt16(i, true) / 32768; sum += value * value }
    const level = Math.sqrt(sum / 1600)
    this.snapshot.level = level
    const voiced = level >= 0.008
    if (voiced) {
      if (this.audioMs - this.lastVoiceMs > 300) { this.voiceFrames = 0; this.segmentStartMs = this.audioMs - 100 }
      this.voiceFrames++
      this.lastVoiceMs = this.audioMs
      if (!this.frames.length) {
        this.frames = this.preRoll.map((frame) => Uint8Array.from(frame))
        this.bytes = this.frames.reduce((total, frame) => total + frame.length, 0)
      }
      if (this.voiceFrames >= 2) {
        this.voiceVersion++
        if (['adapting', 'ready', 'preparing-voice'].includes(this.snapshot.phase)) {
          this.cancel()
          this.proposal = null
          this.log('resumed', 'Outlier ha ripreso a parlare: proposta precedente scartata.')
          this.setPhase('listening', 'Outlier parla · continuo ad ascoltare.')
        } else if (this.snapshot.phase === 'speaking' && this.audioMs - this.segmentStartMs >= 1200) {
          this.cancel()
          this.listeningAt = this.dependencies.now()
          this.log('interruption', 'Parlato continuativo di Outlier: battuta interrotta, ancora pendente.')
          this.setPhase('listening', 'Outlier ha interrotto NEB · ascolto la risposta.')
        } else if (this.snapshot.phase === 'waiting') {
          this.setPhase('listening', 'Outlier continua · ascolto la risposta.')
        }
      }
    }
    if (this.frames.length || voiced) {
      if (this.bytes + pcm.length > MAX_S2S_AUDIO_BYTES) { this.pause('Risposta oltre 120 secondi: verifica manualmente.'); return }
      this.frames.push(Uint8Array.from(pcm)); this.bytes += pcm.length
    }
    // Short backchannels that finish while NEB is still speaking are not the reply.
    if (this.snapshot.phase === 'speaking' && this.voiceFrames && this.audioMs - this.lastVoiceMs >= 400) {
      this.log('backchannel', 'Breve segnale di ascolto durante la battuta NEB; nessun cambio di turno.')
      this.clearBuffer()
    }
    this.preRoll.push(Uint8Array.from(pcm))
    if (this.preRoll.length > 3) this.preRoll.shift()
    if (this.dependencies.now() - this.lastPublishAt >= 500) this.publish()
  }

  tick(): void {
    if (!this.active) return
    const now = this.dependencies.now()
    if (this.snapshot.costUsd >= this.options.maxCostUsd || !this.snapshot.costKnown) { this.pause('Limite di costo raggiunto o costo non disponibile.'); return }
    if (now - this.startedAt >= this.options.maxDurationMs) { this.pause('Limite di durata della sessione raggiunto.'); return }
    if (now - this.lastPacketAt > 1500) { this.pause('Flusso audio assente: riavvia l’ascolto in Edge.'); return }
    if (this.snapshot.phase === 'adapting' && now - this.adaptationAt > 35000) { this.pause('Qwen non ha risposto entro il tempo previsto.'); return }
    if (['listening', 'waiting'].includes(this.snapshot.phase)) {
      if (this.voiceVersion > this.analyzedVersion && this.audioMs - this.lastVoiceMs >= this.options.silenceMs) {
        void this.adapt()
      } else if (now - this.listeningAt >= this.options.responseTimeoutMs &&
                 (this.voiceVersion === this.analyzedVersion || this.audioMs - this.lastVoiceMs >= this.options.silenceMs)) {
        this.pause('Nessuna risposta conclusa: controlla Outlier prima di riprendere.')
      }
    } else if (this.snapshot.phase === 'ready' && this.proposal && now - this.proposalAt >= 300 && this.audioMs - this.lastVoiceMs >= this.options.silenceMs) {
      const proposal = this.proposal
      this.proposal = null
      void this.speak(proposal.nextText, proposal.transcript)
    }
  }

  pause(message = 'Sessione in pausa.'): void {
    if (!this.locked) return
    this.cancel(); this.proposal = null
    this.log('pause', message)
    this.setPhase('paused', message)
  }
  resume(replay = false): void {
    if (this.snapshot.phase !== 'paused') return
    if (this.dependencies.now() - this.startedAt >= this.options.maxDurationMs || this.snapshot.costUsd >= this.options.maxCostUsd || !this.snapshot.costKnown) {
      this.setPhase('paused', 'Limite raggiunto: ferma la sessione e configura nuovi limiti.'); return
    }
    this.resetResponse()
    this.lastPacketAt = this.dependencies.now()
    this.listeningAt = this.lastPacketAt
    if (replay && this.lines[this.snapshot.lineIndex]) {
      this.log('replay', 'Ripetizione esplicita della battuta ancora pendente.')
      void this.speak(this.lines[this.snapshot.lineIndex].text)
    } else {
      this.log('resume', 'Ripresa dell’ascolto; nessuna battuta ripetuta automaticamente.')
      this.setPhase('listening', 'Ascolto ripreso · attendo una nuova risposta.')
    }
  }
  stop(): void {
    this.cancel(); this.proposal = null
    this.resetResponse()
    if (this.snapshot.phase !== 'idle') { this.log('stop', 'Sessione fermata.'); this.setPhase('stopped', 'Automatico fermato.') }
  }

  private async adapt(): Promise<void> {
    const token = ++this.serial, session = this.sessionId
    const operation = new AbortController()
    this.operation = operation
    this.analyzedVersion = this.voiceVersion
    const pcm = new Uint8Array(this.bytes)
    let offset = 0
    for (const frame of this.frames) { pcm.set(frame, offset); offset += frame.length }
    this.adaptationAt = this.dependencies.now()
    this.setPhase('adapting', 'Qwen ascolta la risposta e adatta la prossima battuta…')
    try {
      const decision = await this.dependencies.adapt({ requestId: `s2s-${session}-${token}`, audioPcm: pcm,
        nextLine: this.lines[this.snapshot.lineIndex] ?? null, scenario: this.scenario, history: this.history.slice(-60) }, operation.signal)
      if (session !== this.sessionId) return
      if (decision.costUsd === null) this.snapshot.costKnown = false
      else this.snapshot.costUsd += decision.costUsd
      this.log('decision', decision.reason, { transcript: decision.transcript, qwenMs: decision.qwenMs, silenceMs: this.options.silenceMs, costUsd: decision.costUsd })
      if (token !== this.serial || operation.signal.aborted) { this.publish(); return }
      this.operation = null
      if (this.snapshot.costUsd >= this.options.maxCostUsd || !this.snapshot.costKnown) {
        this.pause(this.snapshot.costKnown ? 'Limite di costo OpenRouter raggiunto.' : 'OpenRouter non ha riportato il costo: verifica la spesa prima di continuare.'); return
      }
      if (decision.action === 'pause') { this.pause(decision.reason); return }
      if (decision.action === 'wait') {
        this.listeningAt = this.dependencies.now()
        this.setPhase('waiting', 'Risposta incompleta · aspetto che Outlier continui.'); return
      }
      if (decision.action === 'complete') {
        if (this.snapshot.lineIndex < this.lines.length) { this.pause('Qwen ha proposto una fine anticipata.'); return }
        this.history.push({ role: 'assistant', text: decision.transcript })
        this.log('complete', 'Ascoltata la risposta finale; script completato.')
        this.setPhase('completed', 'Conversazione completata · risposta finale ascoltata.'); return
      }
      if (decision.action !== 'speak' || !decision.nextText.trim() || !this.lines[this.snapshot.lineIndex]) { this.pause('Proposta Qwen non valida.'); return }
      const previousUser = [...this.history].reverse().find((item) => item.role === 'user')
      if (previousUser?.partial && decision.nextText.trim().toLocaleLowerCase() === this.lines[this.snapshot.lineIndex].text.trim().toLocaleLowerCase()) {
        this.pause('Qwen propone di ripetere la battuta interrotta: usa Ripeti battuta pendente solo se necessario.'); return
      }
      this.proposal = decision
      this.proposalAt = this.dependencies.now()
      this.snapshot.nextText = decision.nextText
      this.setPhase('ready', 'Battuta adattata · verifico che Outlier resti silenzioso.')
    } catch (error) {
      if (token === this.serial && !operation.signal.aborted) this.pause(error instanceof Error ? error.message : 'Rielaborazione non riuscita.')
    }
  }

  private async speak(text: string, transcript?: string): Promise<void> {
    const line = this.lines[this.snapshot.lineIndex]
    if (!line) return
    if (this.snapshot.spokenTurns >= this.options.maxTurns) { this.setPhase('paused', 'Limite di turni NEB raggiunto.'); return }
    const token = ++this.serial
    const operation = new AbortController()
    this.operation = operation
    const play = { line, text, started: false, at: this.dependencies.now() }
    this.play = play
    this.snapshot.nextText = text
    this.log('proposed', `Battuta ${this.snapshot.lineIndex + 1}`, { original: line.text, adapted: text })
    this.setPhase('preparing-voice', 'Preparo la voce Gemini…')
    try {
      await this.dependencies.speak(text, operation.signal, () => {
        if (token !== this.serial || operation.signal.aborted) return false
        if (this.voiceVersion > this.analyzedVersion && this.audioMs - this.lastVoiceMs < this.options.silenceMs) {
          this.cancel(); this.setPhase('listening', 'Outlier sta parlando · voce NEB annullata.'); return false
        }
        play.started = true
        if (transcript) this.history.push({ role: 'assistant', text: transcript })
        this.snapshot.spokenTurns++
        this.log('voice', 'Primo audio Gemini.', { firstAudioMs: Math.round(this.dependencies.now() - play.at) })
        this.setPhase('speaking', 'NEB parla · ascolto eventuali interruzioni.')
        return true
      })
      if (token !== this.serial || operation.signal.aborted) return
      this.operation = null; this.play = null
      this.history.push({ role: 'user', text })
      this.dependencies.completed(line.id)
      this.snapshot.lineIndex++
      this.log('spoken', 'Battuta pronunciata interamente.', { original: line.text, adapted: text })
      // Preserve a model response that begins just as our playback finishes.
      if (this.audioMs - this.lastVoiceMs > 300) this.resetResponse()
      this.listeningAt = this.dependencies.now()
      this.setPhase('listening', this.snapshot.lineIndex === this.lines.length ? 'Ascolto la risposta finale di Outlier.' : 'Attendo la risposta di Outlier.')
    } catch (error) {
      if (token === this.serial && !operation.signal.aborted) this.pause(error instanceof Error ? error.message : 'Voce non riuscita.')
    }
  }

  private cancel(): void {
    this.serial++
    this.operation?.abort(); this.operation = null
    if (this.play?.started) {
      this.history.push({ role: 'user', text: this.play.text, partial: true })
      this.log('partial', 'Battuta pronunciata solo in parte; non completata.', { original: this.play.line.text, adapted: this.play.text })
    }
    this.play = null
  }
  private clearBuffer(): void { this.frames = []; this.bytes = 0; this.voiceFrames = 0; this.lastVoiceMs = -Infinity }
  private resetResponse(): void { this.clearBuffer(); this.preRoll = []; this.audioMs = 0; this.voiceVersion = 0; this.analyzedVersion = 0 }
  private setPhase(phase: S2SPhase, message: string): void { this.snapshot.phase = phase; this.snapshot.message = message; this.publish() }
  private log(kind: string, text: string, details: Partial<S2SLogEntry> = {}): void {
    this.snapshot.log = [...this.snapshot.log, { atMs: Math.max(0, this.dependencies.now() - this.startedAt), kind, text, ...details }].slice(-500)
  }
  private publish(): void { this.lastPublishAt = this.dependencies.now(); this.dependencies.changed({ ...this.snapshot }) }
}
