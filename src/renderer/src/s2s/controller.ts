import { MAX_S2S_AUDIO_BYTES, DEFAULT_S2S_TASK_CONTEXT, parseS2STaskContext, isS2SAdaptiveInstruction, isUnchangedS2SLine, type S2SAdaptRequest, type S2SDecision, type S2SHistoryItem, type S2SLine, type S2STaskContext } from '../../../shared/s2s'

export type SimulationStage = 'idle' | 'text' | 'voice' | 'playing'
export type S2SPhase = 'idle' | 'preparing-voice' | 'speaking' | 'listening' | 'waiting' | 'adapting' | 'ready' | 'paused' | 'stopped' | 'completed'
export interface S2SOptions { silenceMs: number; responseTimeoutMs: number; maxDurationMs: number; maxTurns: number; maxCostUsd: number; anticipateText: boolean }
export const DEFAULT_S2S_OPTIONS: S2SOptions = { silenceMs: 2500, responseTimeoutMs: 30000, maxDurationMs: 20 * 60000, maxTurns: 40, maxCostUsd: 1, anticipateText: true }
export interface S2SLogEntry {
  atMs: number; kind: string; text: string; original?: string; adapted?: string; transcript?: string
  lineIndex?: number; utteranceId?: number; responseId?: number; accepted?: boolean; action?: S2SDecision['action']; transcriptSource?: 'audio' | 'simulation-text'; liveState?: string; preparationLeadMs?: number
  qwenMs?: number; firstAudioMs?: number; silenceMs?: number; costUsd?: number | null
}
export interface S2SSnapshot {
  phase: S2SPhase; message: string; lineIndex: number; total: number; spokenTurns: number
  simulationStage: SimulationStage
  script: S2SLine[]; scenario: string; taskContext: S2STaskContext; liveState: string; preparation: 'idle' | 'rewriting' | 'ready' | 'voice-ready'; costUsd: number; costKnown: boolean; nextText: string; level: number; log: S2SLogEntry[]
}
export interface S2SDependencies {
  now(): number
  adapt(request: S2SAdaptRequest, signal: AbortSignal): Promise<S2SDecision>
  speak(text: string, signal: AbortSignal, onStarted: () => boolean): Promise<void>
  prepareSpeech?(text: string, signal: AbortSignal): Promise<void>
  completed(id: string): void
  changed(snapshot: S2SSnapshot): void
}

export class S2SController {
  snapshot: S2SSnapshot = { simulationStage: 'idle', phase: 'idle', message: 'Automatico pronto da configurare.', lineIndex: 0, total: 0, spokenTurns: 0, costUsd: 0, costKnown: true, nextText: '', level: 0, script: [], scenario: '', taskContext: { ...DEFAULT_S2S_TASK_CONTEXT }, liveState: '', preparation: 'idle', log: [] }
  private lines: S2SLine[] = []
  private history: S2SHistoryItem[] = []
  private scenario = ''
  private taskContext = { ...DEFAULT_S2S_TASK_CONTEXT }
  private preparation: { operation: AbortController; transcript: string; decision: S2SDecision | null; at: number; decidedAt: number; endedAt: number | null } | null = null
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
  private responseId = 0
  private operation: AbortController | null = null
  private play: { line: S2SLine; text: string; started: boolean; at: number; utteranceId: number; lineIndex: number } | null = null
  private proposalAt = 0
  private proposal: S2SDecision | null = null
  private proposalFromText = false
  private adaptationAt = 0
  private simulationStageAt = 0

  constructor(private readonly dependencies: S2SDependencies) {}
  get active(): boolean { return ['preparing-voice', 'speaking', 'listening', 'waiting', 'adapting', 'ready'].includes(this.snapshot.phase) }
  get locked(): boolean { return this.active || this.snapshot.phase === 'paused' }

  start(lines: S2SLine[], scenario: string, options: Partial<S2SOptions> = {}, taskContext?: S2STaskContext): void {
    if (this.locked) throw new Error('Ferma la sessione precedente prima di avviarne una nuova.')
    const settings = { ...DEFAULT_S2S_OPTIONS, ...options }
    const context = parseS2STaskContext(taskContext)
    const { anticipateText, ...limits } = settings
    if (lines[0] && isS2SAdaptiveInstruction(lines[0].text)) throw new Error('La prima battuta deve essere un’apertura da pronunciare, non un’istruzione ADAPT LIVE.')
    if (context.minimumUserTurns && lines.length < context.minimumUserTurns) throw new Error(`La task richiede almeno ${context.minimumUserTurns} turni utente: prepara abbastanza battute prima di avviare.`)
    if (context.minimumUserTurns && settings.maxTurns < context.minimumUserTurns) throw new Error('Il limite di turni NEB è inferiore al minimo richiesto dalla task.')
    if (!lines.length || lines.length > 100 || lines.some((l) => !l.id || !l.text.trim() || l.text.length > 4000) || scenario.length > 4000 ||
        typeof anticipateText !== 'boolean' || Object.values(limits).some((v) => !Number.isFinite(v) || v <= 0) || settings.silenceMs < 1500 || settings.silenceMs > 5000 ||
        settings.maxTurns > 100 || !Number.isInteger(settings.maxTurns)) throw new Error('Script o limiti della sessione non validi.')
    this.cancel()
    this.sessionId++
    this.lines = lines.map((line) => ({ ...line }))
    this.scenario = scenario
    this.taskContext = context
    this.options = settings
    this.history = []
    this.responseId = 0
    this.startedAt = this.dependencies.now()
    this.lastPacketAt = this.startedAt
    this.snapshot = { simulationStage: 'idle', phase: 'idle', message: '', lineIndex: 0, total: lines.length, spokenTurns: 0, costUsd: 0, costKnown: true, nextText: '', level: 0, script: [], scenario, taskContext: { ...DEFAULT_S2S_TASK_CONTEXT }, liveState: '', preparation: 'idle', log: [] }
    this.snapshot.taskContext = { ...context }
    this.snapshot.script = this.lines.map((line) => ({ ...line }))
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
        if (this.preparation?.endedAt !== null && this.preparation?.endedAt !== undefined && this.dependencies.now() - this.preparation.endedAt > 150) {
          this.cancel(); this.log('resumed', 'MODEL A ha ripreso dopo la fine dichiarata: preparazione scartata.')
        }
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

  setSimulationStage(stage: SimulationStage): void {
    if (!this.active) return
    this.snapshot.simulationStage = stage
    this.simulationStageAt = this.dependencies.now()
    if (stage === 'idle') this.listeningAt = this.simulationStageAt
    this.log('simulation-stage', stage === 'text' ? 'MODEL A prepara il testo con Qwen.' : stage === 'voice' ? 'Testo MODEL A pronto · Gemini prepara la voce.' : stage === 'playing' ? 'Primo audio MODEL A · riproduzione avviata.' : 'Riproduzione MODEL A terminata · attendo il silenzio e la verifica Qwen.')
    this.publish()
  }

  tick(): void {
    if (!this.active) return
    const now = this.dependencies.now()
    if (this.snapshot.costUsd >= this.options.maxCostUsd || !this.snapshot.costKnown) { this.pause('Limite di costo raggiunto o costo non disponibile.'); return }
    if (now - this.startedAt >= this.options.maxDurationMs) { this.pause('Limite di durata della sessione raggiunto.'); return }
    if (now - this.lastPacketAt > 1500) { this.pause('Flusso audio assente: riavvia l’ascolto in Edge.'); return }
    if (this.snapshot.phase === 'adapting' && now - this.adaptationAt > 35000) { this.pause('Qwen non ha risposto entro il tempo previsto.'); return }
    const stage = this.snapshot.simulationStage
    if (stage === 'text' || stage === 'voice') {
      if (now - this.simulationStageAt > (stage === 'text' ? 35000 : 60000)) this.pause(stage === 'text' ? 'Qwen non ha generato la risposta MODEL A entro 35 secondi.' : 'Gemini non ha prodotto il primo audio MODEL A entro 60 secondi. Riprendi per riprovare la voce.')
      return
    }
    if (this.preparation) {
      const prepared = this.preparation
      if (now - prepared.at > 35000 && !prepared.decision) { this.pause('Preparazione Qwen oltre il tempo previsto.'); return }
      if (prepared.decision && prepared.endedAt !== null && now - prepared.endedAt >= 300 && this.audioMs - this.lastVoiceMs >= 300) {
        this.preparation = null
        this.analyzedVersion = this.voiceVersion
        this.log('decision', prepared.decision.reason, { transcript: prepared.transcript, transcriptSource: 'simulation-text', responseId: this.responseId, accepted: true, qwenMs: prepared.decision.qwenMs, liveState: prepared.decision.liveState, preparationLeadMs: Math.max(0, prepared.endedAt - prepared.decidedAt) })
        this.acceptDecision(prepared.decision)
        this.proposalFromText = true
        this.proposalAt = Math.min(prepared.decidedAt, now - 300)
      } else if (stage === 'idle' && !this.voiceVersion && now - this.listeningAt >= this.options.responseTimeoutMs) this.pause('Nessun audio MODEL A: controlla la simulazione prima di riprendere.')
      return
    }
    if (stage === 'playing') return
    if (['listening', 'waiting'].includes(this.snapshot.phase)) {
      if (this.voiceVersion > this.analyzedVersion && this.audioMs - this.lastVoiceMs >= this.options.silenceMs) {
        void this.adapt()
      } else if (now - this.listeningAt >= this.options.responseTimeoutMs &&
                 (this.voiceVersion === this.analyzedVersion || this.audioMs - this.lastVoiceMs >= this.options.silenceMs)) {
        this.pause('Nessuna risposta conclusa: controlla Outlier prima di riprendere.')
      }
    } else if (this.snapshot.phase === 'ready' && this.proposal && now - this.proposalAt >= 300 && this.audioMs - this.lastVoiceMs >= (this.proposalFromText ? 300 : this.options.silenceMs)) {
      const proposal = this.proposal
      this.proposal = null
      void this.speak(proposal.nextText, proposal.transcript, this.operation ?? undefined)
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

  recordSimulationReply(reply: { text: string; modelMs: number; costUsd: number | null }, accepted = this.active): boolean {
    if (reply.costUsd === null) this.snapshot.costKnown = false
    else this.snapshot.costUsd += reply.costUsd
    this.log('simulation-model', `MODEL A simulato · risposta generata in ${reply.modelMs} ms.`, { transcript: reply.text, costUsd: reply.costUsd, responseId: this.responseId, accepted: accepted && this.active })
    if (!this.snapshot.costKnown || this.snapshot.costUsd >= this.options.maxCostUsd) {
      if (this.locked) this.pause('Limite di costo simulazione raggiunto o costo non disponibile.')
      else this.publish()
      return false
    }
    this.publish()
    return this.active
  }

  private async adapt(): Promise<void> {
    const token = ++this.serial, session = this.sessionId, responseId = this.responseId
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
        nextLine: this.lines[this.snapshot.lineIndex] ?? null, scenario: this.scenario, history: this.history.slice(-60), remainingCostUsd: this.options.maxCostUsd - this.snapshot.costUsd, taskContext: this.taskContext }, operation.signal)
      if (session !== this.sessionId) return
      if (decision.costUsd === null) { this.snapshot.costKnown = false; this.snapshot.costUsd += decision.knownCostUsd ?? 0 }
      else this.snapshot.costUsd += decision.costUsd
      this.log('decision', decision.reason, { transcript: decision.transcript, qwenMs: decision.qwenMs, silenceMs: this.options.silenceMs, costUsd: decision.costUsd, responseId, action: decision.action, accepted: token === this.serial && !operation.signal.aborted })
      if (token !== this.serial || operation.signal.aborted) { this.publish(); return }
      this.operation = null
      if (this.snapshot.costUsd >= this.options.maxCostUsd || !this.snapshot.costKnown) {
        this.pause(this.snapshot.costKnown ? 'Limite di costo OpenRouter raggiunto.' : 'OpenRouter non ha riportato il costo: verifica la spesa prima di continuare.'); return
      }
      this.acceptDecision(decision)
    } catch (error) {
      if (token === this.serial && !operation.signal.aborted) this.pause(error instanceof Error ? error.message : 'Rielaborazione non riuscita.')
    }
  }

  private acceptDecision(decision: S2SDecision): void {
    this.proposalFromText = false
    this.snapshot.liveState = decision.liveState ?? this.snapshot.liveState
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
    if (isS2SAdaptiveInstruction(decision.nextText) || this.taskContext.adaptationLevel !== 'L0' && isUnchangedS2SLine(this.lines[this.snapshot.lineIndex].text, decision.nextText)) {
      this.pause(previousUser?.partial ? 'Qwen propone di ripetere la battuta interrotta: usa Ripeti battuta pendente solo se necessario.' : 'Qwen ha restituito la battuta originale senza adattarla. Verifica la risposta e lo scenario.'); return
    }
    this.proposal = decision
    this.proposalAt = this.dependencies.now()
    this.snapshot.nextText = decision.nextText
    this.setPhase('ready', 'Battuta adattata · verifico che Outlier resti silenzioso.')
  }

  prepareTranscript(transcript: string): void {
    if (!this.options.anticipateText || !['listening', 'waiting'].includes(this.snapshot.phase) || !transcript.trim() || transcript.length > 16000) return
    if (this.preparation?.transcript === transcript) return
    this.cancel()
    const token = ++this.serial, session = this.sessionId, responseId = this.responseId
    const operation = new AbortController()
    const prepared = { operation, transcript, decision: null as S2SDecision | null, at: this.dependencies.now(), decidedAt: 0, endedAt: null as number | null }
    this.preparation = prepared
    this.operation = operation
    this.snapshot.preparation = 'rewriting'
    this.log('preparation', 'Qwen prepara dal testo MODEL A mentre la risposta viene riprodotta.')
    this.publish()
    void (async () => {
      try {
        const decision = await this.dependencies.adapt({ requestId: `s2s-prepare-${session}-${token}`, transcript, nextLine: this.lines[this.snapshot.lineIndex] ?? null, scenario: this.scenario, history: this.history.slice(-60), taskContext: this.taskContext, remainingCostUsd: this.options.maxCostUsd - this.snapshot.costUsd }, operation.signal)
        if (session !== this.sessionId) return
        if (decision.costUsd === null) { this.snapshot.costKnown = false; this.snapshot.costUsd += decision.knownCostUsd ?? 0 }
        else this.snapshot.costUsd += decision.costUsd
        const accepted = token === this.serial && !operation.signal.aborted && this.preparation === prepared
        this.log('prepared-decision', decision.reason, { transcript, transcriptSource: 'simulation-text', qwenMs: decision.qwenMs, costUsd: decision.costUsd, responseId, accepted })
        if (!accepted) { this.publish(); return }
        if (!this.snapshot.costKnown || this.snapshot.costUsd >= this.options.maxCostUsd) { this.pause('Limite di costo raggiunto o costo non disponibile.'); return }
        prepared.decision = { ...decision, transcript }
        prepared.decidedAt = this.dependencies.now()
        const line = this.lines[this.snapshot.lineIndex]
        if (decision.action === 'speak' && (!line || !decision.nextText.trim() || isS2SAdaptiveInstruction(decision.nextText) || this.taskContext.adaptationLevel !== 'L0' && isUnchangedS2SLine(line.text, decision.nextText))) prepared.decision = { ...decision, transcript, action: 'pause', nextText: '', reason: 'Battuta anticipata non valida o non adattata: verifica scenario e risposta.' }
        this.snapshot.nextText = prepared.decision.nextText
        this.snapshot.preparation = 'ready'
        this.publish()
        if (prepared.decision.action === 'speak' && this.dependencies.prepareSpeech) {
          try {
            await this.dependencies.prepareSpeech(prepared.decision.nextText, operation.signal)
            if (!operation.signal.aborted && token === this.serial) { this.snapshot.preparation = 'voice-ready'; this.log('prepared-voice', 'Audio NEB preparato in silenzio.'); this.publish() }
          } catch (error) {
            if (token === this.serial && !operation.signal.aborted) this.pause(error instanceof Error ? error.message : 'Preparazione voce non riuscita.')
          }
        }
      } catch (error) {
        if (token === this.serial && !operation.signal.aborted) this.pause(error instanceof Error ? error.message : 'Preparazione Qwen non riuscita.')
      }
    })()
  }

  finishTranscriptPlayback(): void {
    if (this.preparation && this.active) { this.preparation.endedAt = this.dependencies.now(); this.publish() }
  }

  private async speak(text: string, transcript?: string, preparedOperation?: AbortController): Promise<void> {
    const line = this.lines[this.snapshot.lineIndex]
    if (!line) return
    if (isS2SAdaptiveInstruction(text)) { this.pause('Questa battuta è un’istruzione da adattare: riprendi l’ascolto per ottenere un testo da pronunciare.'); return }
    if (this.snapshot.spokenTurns >= this.options.maxTurns) { this.setPhase('paused', 'Limite di turni NEB raggiunto.'); return }
    const token = ++this.serial
    const operation = preparedOperation ?? new AbortController()
    this.operation = operation
    const play = { line, text, started: false, at: this.dependencies.now(), utteranceId: token, lineIndex: this.snapshot.lineIndex }
    this.play = play
    this.snapshot.nextText = text
    this.log('proposed', `Battuta ${this.snapshot.lineIndex + 1}`, { original: line.text, adapted: text, lineIndex: play.lineIndex, utteranceId: play.utteranceId })
    this.setPhase('preparing-voice', 'Preparo la voce Gemini…')
    try {
      await this.dependencies.speak(text, operation.signal, () => {
        if (token !== this.serial || operation.signal.aborted) return false
        if (this.voiceVersion > this.analyzedVersion && this.audioMs - this.lastVoiceMs < this.options.silenceMs) {
          this.cancel(); this.setPhase('listening', 'Outlier sta parlando · voce NEB annullata.'); return false
        }
        play.started = true
        this.responseId++
        if (transcript) this.history.push({ role: 'assistant', text: transcript })
        this.snapshot.spokenTurns++
        this.log('voice', 'Primo audio Gemini.', { firstAudioMs: Math.round(this.dependencies.now() - play.at), original: line.text, adapted: text, lineIndex: play.lineIndex, utteranceId: play.utteranceId, responseId: this.responseId })
        this.setPhase('speaking', 'NEB parla · ascolto eventuali interruzioni.')
        return true
      })
      if (token !== this.serial || operation.signal.aborted) return
      this.operation = null; this.play = null
      this.history.push({ role: 'user', text })
      this.dependencies.completed(line.id)
      this.snapshot.lineIndex++
      this.snapshot.nextText = ''
      this.log('spoken', 'Battuta pronunciata interamente.', { original: line.text, adapted: text, lineIndex: play.lineIndex, utteranceId: play.utteranceId })
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
      this.log('partial', 'Battuta pronunciata solo in parte; non completata.', { original: this.play.line.text, adapted: this.play.text, lineIndex: this.play.lineIndex, utteranceId: this.play.utteranceId })
    }
    this.play = null
    this.preparation?.operation.abort(); this.preparation = null
    this.snapshot.preparation = 'idle'
    this.snapshot.nextText = ''
  }
  private clearBuffer(): void { this.frames = []; this.bytes = 0; this.voiceFrames = 0; this.lastVoiceMs = -Infinity }
  private resetResponse(): void { this.clearBuffer(); this.preRoll = []; this.audioMs = 0; this.voiceVersion = 0; this.analyzedVersion = 0 }
  private setPhase(phase: S2SPhase, message: string): void { if (['paused', 'stopped', 'completed'].includes(phase)) this.snapshot.simulationStage = 'idle'; this.snapshot.phase = phase; this.snapshot.message = message; this.publish() }
  private log(kind: string, text: string, details: Partial<S2SLogEntry> = {}): void {
    this.snapshot.log = [...this.snapshot.log, { atMs: Math.max(0, this.dependencies.now() - this.startedAt), kind, text, ...details }].slice(-500)
  }
  private publish(): void { this.lastPublishAt = this.dependencies.now(); this.dependencies.changed({ ...this.snapshot }) }
}
