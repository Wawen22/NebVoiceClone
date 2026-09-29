export type RecordingKind = 'reference' | 'consent'
export type VoiceActivityPhase = 'calibrating' | 'waiting' | 'speaking' | 'finished' | 'timeout'
export interface VoiceClipRange { startMs: number; endMs: number }
export interface VoiceActivityUpdate { phase: VoiceActivityPhase; clip?: VoiceClipRange }

export class VoiceActivityDetector {
  private phase: VoiceActivityPhase = 'calibrating'
  private readonly levels: number[] = []
  private noiseFloor = 0.002
  private threshold = 0.008
  private loudFrames = 0
  private candidateAt = 0
  private previousLoudAt = 0
  private lastVoiceAt = 0
  private startAt = 0

  constructor(private readonly kind: RecordingKind) {}

  get clipStartMs(): number { return this.startAt }

  sample(level: number, elapsedMs: number): VoiceActivityUpdate {
    const rms = Number.isFinite(level) ? Math.max(0, level) : 0
    if (this.phase === 'finished' || this.phase === 'timeout') return { phase: this.phase }
    if (this.phase === 'calibrating') {
      this.levels.push(rms)
      if (elapsedMs < 800) return { phase: 'calibrating' }
      const sorted = [...this.levels].sort((a, b) => a - b)
      this.noiseFloor = sorted[Math.floor(sorted.length * 0.6)] || 0.002
      this.threshold = Math.max(0.008, this.noiseFloor * 3.5)
      this.phase = 'waiting'
    }
    if (this.phase === 'waiting') {
      if (elapsedMs >= 120000) {
        this.phase = 'timeout'
        return { phase: 'timeout' }
      }
      if (rms >= this.threshold) {
        if (!this.loudFrames || elapsedMs - this.previousLoudAt > 100) {
          this.candidateAt = elapsedMs
          this.loudFrames = 0
        }
        this.loudFrames++
        this.previousLoudAt = elapsedMs
        if (this.loudFrames >= 3) {
          this.startAt = Math.max(0, this.candidateAt - 300)
          this.lastVoiceAt = elapsedMs
          this.phase = 'speaking'
          return { phase: 'speaking' }
        }
      } else {
        this.loudFrames = 0
        this.noiseFloor = this.noiseFloor * 0.98 + rms * 0.02
        this.threshold = Math.max(0.008, this.noiseFloor * 3.5)
      }
      return { phase: 'waiting' }
    }
    if (rms >= this.threshold * 0.7) this.lastVoiceAt = elapsedMs
    const silenceMs = this.kind === 'reference' ? 2400 : 1800
    if (elapsedMs - this.startAt >= 30000) return this.finish(this.startAt + 30000)
    if (elapsedMs - this.lastVoiceAt >= silenceMs) return this.finish(Math.min(elapsedMs, this.lastVoiceAt + 350))
    return { phase: 'speaking' }
  }

  finishManually(elapsedMs: number): VoiceClipRange | null {
    if (this.phase !== 'speaking') return null
    return this.finish(elapsedMs).clip ?? null
  }

  private finish(endMs: number): VoiceActivityUpdate {
    this.phase = 'finished'
    return { phase: 'finished', clip: { startMs: this.startAt, endMs: Math.max(this.startAt, endMs) } }
  }
}
