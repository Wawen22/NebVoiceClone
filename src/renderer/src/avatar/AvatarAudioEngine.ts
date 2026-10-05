import type { AudioEngine } from '../audio/AudioEngine'
import type { AvatarSession } from './session'

export class AvatarAudioEngine implements AudioEngine {
  private avatarMode = false
  private avatarStopped = true
  private serial = 0
  private volume = 0.85
  private chunks: Uint8Array[] = []
  private recording: Uint8Array[] = []
  private bytes = 0
  private ended: () => void = () => {}
  private started: () => boolean | void = () => {}
  private failed: (error: Error) => void = () => {}
  constructor(private readonly local: AudioEngine, private readonly avatar: AvatarSession, private readonly retainRecording = true, private readonly keepSession = false) {
    local.onEnded(() => this.ended())
  }

  listOutputs() { return this.local.listOutputs() }
  async load(file: File): Promise<number> { this.stop(); this.recording = []; return this.local.load(file) }
  async loadBytes(bytes: Uint8Array, mime: string): Promise<number> { this.stop(); this.recording = []; return this.local.loadBytes(bytes, mime) }
  async beginStream(deviceId: string): Promise<void> {
    this.local.stop(); this.chunks = []; this.bytes = 0
    const serial = ++this.serial
    this.avatarMode = this.avatar.enabled
    this.avatarStopped = false
    if (this.avatarMode) {
      await this.avatar.begin(this.avatar.faceId, deviceId, this.volume,
        () => serial === this.serial ? this.started() : false,
        () => { if (serial === this.serial) this.ended() },
        (error) => { if (serial === this.serial) this.failed(error) })
    } else await this.local.beginStream(deviceId)
    if (serial !== this.serial) throw new Error('Riproduzione interrotta.')
  }

  appendPcm(pcm: Uint8Array): void {
    if (!(pcm instanceof Uint8Array) || pcm.length % 2 || this.bytes + pcm.length > 48_000 * 180) throw new Error('Audio non valido o troppo lungo.')
    if (this.retainRecording) this.chunks.push(Uint8Array.from(pcm))
    const first = this.bytes === 0; this.bytes += pcm.length
    if (this.avatarMode) this.avatar.append(pcm)
    else { if (first && this.started() === false) throw new Error('Riproduzione annullata.'); this.local.appendPcm(pcm) }
  }

  finishStream(): number {
    const duration = this.avatarMode ? this.avatar.finish() : this.local.finishStream()
    if (this.retainRecording) this.recording = this.chunks
    this.chunks = []; return duration
  }

  async play(deviceId: string): Promise<void> {
    if (this.avatar.enabled) throw new Error('Disattiva Avatar per riprodurre un WAV locale. La voce generata supporta il replay con avatar.')
    return this.local.play(deviceId)
  }
  async replay(deviceId: string): Promise<void> {
    if (!this.avatar.enabled) {
      if (!this.recording.length || !this.avatarMode) return this.local.replay(deviceId)
      const chunks = this.recording
      await this.beginStream(deviceId); chunks.forEach((chunk) => this.appendPcm(chunk)); this.finishStream(); return
    }
    if (!this.recording.length) throw new Error('Genera una frase per riascoltarla con avatar.')
    const chunks = this.recording
    this.stop()
    await this.beginStream(deviceId); chunks.forEach((chunk) => this.appendPcm(chunk)); this.finishStream()
  }

  stop(): void { this.serial++; this.local.stop(); if (this.avatarMode && !this.avatarStopped) { this.avatarStopped = true; if (this.keepSession) this.avatar.cancelTurn(); else this.avatar.disconnect() }; this.chunks = []; this.bytes = 0 }
  setVolume(volume: number): void { this.volume = volume; this.local.setVolume(volume); if (this.avatarMode) this.avatar.setVolume(volume) }
  onEnded(callback: () => void): void { this.ended = callback }
  onStarted(callback: () => boolean | void): void { this.started = callback }
  onError(callback: (error: Error) => void): void { this.failed = callback }
  dispose(): void { this.stop(); this.local.dispose(); this.recording = [] }
}
