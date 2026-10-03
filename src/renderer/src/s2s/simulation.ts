import type { S2SHistoryItem, S2SSimulationReply, S2SSimulationRequest, S2STaskContext } from '../../../shared/s2s'
import type { SimulationStage } from './controller'
import type { AudioOutput } from '../audio/AudioEngine'

export function localSimulationOutputs(outputs: AudioOutput[]): AudioOutput[] {
  return outputs.filter((output) => output.deviceId !== 'default' && output.deviceId !== 'communications' &&
    !/cable|voicemeeter|vb.?audio/i.test(output.label) && !/^Output \d+$/.test(output.label) && output.label.trim())
}

/** The simulator feeds the PCM it schedules for playback, never the user's voice. */
export class PcmTimeline {
  private parts: { pcm: Uint8Array; start: number; end: number }[] = []
  private cursor: number | null = null
  begin(now: number): void { this.cursor = now }
  drain(now: number): Uint8Array[] {
    if (this.cursor === null) this.cursor = now - 100
    const frames: Uint8Array[] = []
    while (this.cursor + 100 <= now) { this.cursor += 100; frames.push(this.read(this.cursor)) }
    return frames
  }
  schedule(pcm: Uint8Array, start: number): void {
    if (!pcm.length || pcm.length % 2 || !Number.isFinite(start) || this.parts.reduce((n, p) => n + p.pcm.length, 0) + pcm.length > 5_760_000) throw new Error('Audio MODEL A simulato non valido o troppo lungo.')
    this.parts.push({ pcm: Uint8Array.from(pcm), start, end: start + pcm.length / 48 })
  }
  read(end: number): Uint8Array {
    const pcm = new Uint8Array(3200), view = new DataView(pcm.buffer)
    const start = end - 100
    this.parts = this.parts.filter((part) => part.end > start)
    for (let i = 0; i < 1600; i++) {
      const at = start + (i + 0.5) / 16
      const part = this.parts.find((p) => at >= p.start && at < p.end)
      if (!part) continue
      // Average adjacent input samples when converting 24kHz to 16kHz.
      const source = new DataView(part.pcm.buffer, part.pcm.byteOffset, part.pcm.byteLength)
      const index = Math.min(part.pcm.length / 2 - 1, Math.floor((at - part.start) * 24))
      const next = Math.min(index + 1, part.pcm.length / 2 - 1)
      view.setInt16(i * 2, Math.round((source.getInt16(index * 2, true) + source.getInt16(next * 2, true)) / 2), true)
    }
    return pcm
  }
  clear(): void { this.parts = []; this.cursor = null }
}

interface SimulationDependencies {
  reply(request: S2SSimulationRequest, signal: AbortSignal): Promise<S2SSimulationReply>
  play(text: string, signal: AbortSignal, onStarted: () => boolean): Promise<void>
  cost(reply: S2SSimulationReply, accepted: boolean): boolean
  state(message: string): void
  failed(message: string): void
  stage?(stage: SimulationStage): void
  ready?(text: string): void
  ended?(): void
}
export class SimulatedModel {
  private history: S2SHistoryItem[] = []
  private pending = false
  private disposed = false
  private serial = 0
  private operation: AbortController | null = null
  private readonly id = crypto.randomUUID()
  private pendingReply: S2SSimulationReply | null = null
  private completedReply: S2SSimulationReply | null = null
  private repeating = false
  constructor(private readonly scenario: string, private readonly deps: SimulationDependencies, private readonly taskContext?: S2STaskContext) {}
  respond(text: string): void {
    if (this.disposed) return
    this.pause()
    this.completedReply = null; this.pendingReply = null; this.repeating = false
    this.history.push({ role: 'user', text })
    this.pending = true
    void this.run()
  }
  resume(): void {
    if (this.disposed || this.operation) return
    if (this.completedReply && (this.repeating || !this.pending)) void this.run(this.completedReply, true)
    else if (this.pending) void this.run(this.pendingReply ?? undefined)
  }
  pause(): void { this.serial++; this.operation?.abort(); this.operation = null }
  stop(): void { this.pause(); this.disposed = true; this.pending = false }
  private async run(cached?: S2SSimulationReply, completedReplay = false): Promise<void> {
    const token = ++this.serial, operation = new AbortController()
    this.operation = operation
    this.repeating = completedReplay; this.pending = true
    this.deps.stage?.(cached ? 'voice' : 'text')
    this.deps.state(cached ? 'Testo MODEL A disponibile · preparo di nuovo la voce…' : 'MODEL A prepara il testo con Qwen…')
    try {
      const reply = cached ?? await this.deps.reply({ requestId: `simulation-${this.id}-${token}`, scenario: this.scenario, history: this.history.slice(-60), taskContext: this.taskContext }, operation.signal)
      // Known costs belong to this session even if Pause/Stop invalidated playback.
      const canContinue = cached ? true : this.deps.cost(reply, token === this.serial && !operation.signal.aborted && !this.disposed)
      if (token !== this.serial || operation.signal.aborted || this.disposed) return
      if (!canContinue) { this.pause(); return }
      operation.signal.throwIfAborted()
      if (!completedReplay) this.pendingReply = reply
      this.deps.ready?.(reply.text)
      this.deps.stage?.('voice')
      this.deps.state('Testo MODEL A pronto · Gemini prepara la voce…')
      await this.deps.play(reply.text, operation.signal, () => {
        if (token !== this.serial || operation.signal.aborted || this.disposed) return false
        this.deps.stage?.('playing')
        this.deps.state('MODEL A simulato parla…')
        return true
      })
      if (token !== this.serial || operation.signal.aborted || this.disposed) return
      if (!completedReplay) { this.history.push({ role: 'assistant', text: reply.text }); this.completedReply = reply }
      this.pending = false; this.pendingReply = null
      this.repeating = false
      this.operation = null
      this.deps.stage?.('idle')
      this.deps.ended?.()
      this.deps.state('MODEL A ha terminato · Qwen ascolta la risposta.')
    } catch (error) {
      if (token === this.serial && !operation.signal.aborted && !this.disposed) {
        this.operation = null
        this.deps.failed(error instanceof Error ? error.message : 'Risposta simulata non riuscita.')
      }
    }
  }
}
