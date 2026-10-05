import type { AvatarSessionToken, AvatarSessionLimits } from '../../../shared/avatar'
import { AVATAR_PRESETS, parseAvatarSessionLimits } from '../../../shared/avatar'
import { PcmResampler } from './pcm'

export interface AvatarClient {
  start(): Promise<void>
  stop(): Promise<void>
  on(event: 'speaking' | 'silent' | 'error' | 'startup_error' | 'stop', callback: () => void): void
  sendAudioData(data: Uint8Array): void
  ClearBuffer(): void
}
export type AvatarSnapshot = { phase: 'off' | 'connecting' | 'ready' | 'speaking' | 'error'; message: string; connectedAt: number | null }
type Turn = { started: (() => boolean | void); ended: () => void; error: (error: Error) => void; bytes: number; startAt: number | null; estimatedEnd: number | null; silent: boolean; complete: boolean }

export class AvatarSession {
  enabled = false
  faceId: string = AVATAR_PRESETS[0].id
  snapshot: AvatarSnapshot = { phase: 'off', message: 'Avatar disattivato', connectedAt: null }
  private video: HTMLVideoElement | null = null
  private audio: HTMLAudioElement | null = null
  private client: AvatarClient | null = null
  private epoch = 0
  private pending: Promise<void> | null = null
  private cancelConnect: (() => void) | null = null
  private timer: ReturnType<typeof setTimeout> | null = null
  private drainTimer: ReturnType<typeof setTimeout> | null = null
  private turn: Turn | null = null
  private beginning: object | null = null
  private resampler = new PcmResampler()
  private listeners = new Set<() => void>()
  private limits: AvatarSessionLimits | undefined

  constructor(private readonly token: (faceId: string, limits?: AvatarSessionLimits) => Promise<AvatarSessionToken>, private readonly create: (token: AvatarSessionToken, video: HTMLVideoElement, audio: HTMLAudioElement) => AvatarClient | Promise<AvatarClient>) {}
  configureLive(durationMinutes: number): void {
    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0 || durationMinutes > 59) throw new Error('Avatar continuo: imposta una durata Live tra 1 e 59 minuti.')
    const seconds = Math.max(120, Math.ceil(durationMinutes * 60) + 60)
    const limits = parseAvatarSessionLimits({ maxSessionLength: seconds, maxIdleTime: seconds })
    this.disconnect(); this.limits = limits
  }
  endLive(): void { this.disconnect(); this.limits = undefined }
  attach(video: HTMLVideoElement, audio: HTMLAudioElement): void { this.video = video; this.audio = audio }
  subscribe(listener: () => void): () => void { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  private state(phase: AvatarSnapshot['phase'], message: string, connectedAt = this.snapshot.connectedAt): void {
    this.snapshot = { phase, message, connectedAt }; this.listeners.forEach((listener) => listener())
  }
  setEnabled(enabled: boolean): void { this.enabled = enabled; if (!enabled) this.disconnect(); else this.state('off', 'Avatar attivo · non collegato') }
  setFaceId(faceId: string): void { this.disconnect(); this.faceId = faceId }

  async connect(faceId: string, deviceId: string, volume: number): Promise<void> {
    if (this.pending) return this.pending
    if (this.client && this.snapshot.phase === 'ready') {
      await this.output(deviceId, volume); return
    }
    if (!this.video || !this.audio) throw new Error('Anteprima avatar non disponibile.')
    const epoch = ++this.epoch, video = this.video, audio = this.audio
    this.state('connecting', 'Connessione Simli...', null)
    const cancelled = new Promise<never>((_resolve, reject) => { this.cancelConnect = () => reject(new Error('Connessione avatar interrotta.')) })
    const work = async () => {
      const credentials = await this.token(faceId, this.limits)
      if (epoch !== this.epoch) throw new Error('Connessione avatar interrotta.')
      const client = await this.create(credentials, video, audio)
      if (epoch !== this.epoch) { void client.stop().catch(() => undefined); throw new Error('Connessione avatar interrotta.') }
      this.client = client
      for (const event of ['error', 'startup_error', 'stop'] as const) client.on(event, () => {
        if (epoch === this.epoch) this.fail(new Error('Simli non disponibile: connessione chiusa o minuti esauriti.'))
      })
      client.on('speaking', () => { if (epoch === this.epoch) this.speaking() })
      client.on('silent', () => { if (epoch === this.epoch && this.turn) { this.turn.silent = true; this.checkEnd() } })
      await this.output(deviceId, volume)
      await client.start()
      if (epoch !== this.epoch) { void client.stop().catch(() => undefined); throw new Error('Connessione avatar interrotta.') }
      await Promise.all([video.play(), audio.play()])
      if (epoch !== this.epoch) throw new Error('Connessione avatar interrotta.')
      this.state('ready', 'Avatar pronto', Date.now())
    }
    this.timer = setTimeout(() => { if (epoch === this.epoch) this.fail(new Error('Simli non disponibile: connessione scaduta.')) }, 20000)
    const pending = Promise.race([work(), cancelled])
    this.pending = pending
    try { await pending } catch (error) {
      if (epoch === this.epoch) this.fail(error instanceof Error ? error : new Error('Simli non disponibile: connessione fallita.'))
      throw error instanceof Error ? error : new Error('Simli non disponibile: connessione fallita.')
    } finally {
      if (this.pending === pending) { this.pending = null; this.cancelConnect = null; this.clearTimers() }
    }
  }

  private async output(deviceId: string, volume: number): Promise<void> {
    if (!this.audio || !('setSinkId' in this.audio)) throw new Error('Uscita audio avatar non disponibile.')
    this.audio.muted = true; this.audio.volume = Math.min(1, Math.max(0, volume))
    await this.audio.setSinkId(deviceId)
  }

  async begin(faceId: string, deviceId: string, volume: number, started: Turn['started'], ended: Turn['ended'], error: Turn['error']): Promise<void> {
    if (this.turn || this.beginning) throw new Error('Avatar gia in riproduzione.')
    const reservation = {}; this.beginning = reservation
    try {
      await this.connect(faceId, deviceId, volume)
      if (this.beginning !== reservation || !this.client || this.snapshot.phase !== 'ready') throw new Error('Avatar non disponibile.')
      this.resampler.reset()
      this.turn = { started, ended, error, bytes: 0, startAt: null, estimatedEnd: null, silent: false, complete: false }
    } finally { if (this.beginning === reservation) this.beginning = null }
  }

  append(pcm: Uint8Array): void {
    const turn = this.turn
    if (!turn || !this.client) throw new Error('Simli non disponibile: riproduzione interrotta.')
    if (turn.complete || turn.bytes + pcm.length > 48_000 * 110) throw new Error('Risposta troppo lunga per la sessione avatar Free.')
    const converted = this.resampler.push(pcm)
    turn.bytes += pcm.length
    turn.silent = false
    if (turn.startAt !== null) turn.estimatedEnd = Math.max(turn.estimatedEnd ?? turn.startAt, Date.now()) + pcm.length / 48
    if (converted.length) this.client.sendAudioData(converted)
    if (turn.bytes === pcm.length) this.timer = setTimeout(() => { if (this.turn === turn && turn.startAt === null) this.fail(new Error('Simli non disponibile: la voce non e arrivata.')) }, 15000)
  }

  private speaking(): void {
    const turn = this.turn
    if (!turn || !turn.bytes) return
    turn.silent = false
    if (this.drainTimer) clearTimeout(this.drainTimer)
    if (turn.startAt === null) {
      try {
        if (turn.started() === false) {
          if (this.turn === turn) { this.cancelTurn(); turn.error(new Error('Riproduzione avatar annullata.')) }
          return
        }
      }
      catch { this.fail(new Error('Riproduzione avatar annullata.')); return }
      turn.startAt = Date.now()
      turn.estimatedEnd = turn.startAt + turn.bytes / 48
      if (this.timer) clearTimeout(this.timer)
      this.timer = setTimeout(() => this.fail(new Error('Simli non disponibile: riproduzione scaduta.')), 115000)
    }
    if (this.audio) this.audio.muted = false
    this.state('speaking', 'NEB sta parlando')
  }

  finish(): number {
    const turn = this.turn
    if (!turn?.bytes) throw new Error('Nessun audio avatar ricevuto.')
    turn.complete = true; this.checkEnd(); return turn.bytes / 48000
  }

  private checkEnd(): void {
    const turn = this.turn
    if (!turn || !turn.complete || !turn.silent || turn.startAt === null) return
    if (this.drainTimer) clearTimeout(this.drainTimer)
    // Server silence can precede the final frame in the receiver's jitter buffer.
    const delay = Math.max(300, (turn.estimatedEnd ?? turn.startAt) - Date.now() + 300)
    this.drainTimer = setTimeout(() => {
      if (this.turn !== turn || !turn.silent) return
      this.turn = null; this.clearTimers()
      if (this.audio) this.audio.muted = true
      this.state('ready', 'Avatar pronto'); turn.ended()
    }, delay)
  }

  setVolume(volume: number): void { if (this.audio) this.audio.volume = Math.min(1, Math.max(0, volume)) }
  cancelTurn(): void {
    if (this.pending || this.beginning) { this.disconnect(); return }
    this.turn = null; this.clearTimers()
    if (this.audio) this.audio.muted = true
    if (this.client) {
      try { this.client.ClearBuffer() } catch { this.fail(new Error('Simli non disponibile: impossibile interrompere la voce.')); return }
      this.state('ready', 'Avatar pronto')
    }
  }
  private fail(error: Error): void {
    const turn = this.turn
    this.disconnect(false)
    this.state('error', error.message, null)
    turn?.error(error)
  }
  private clearTimers(): void { if (this.timer) clearTimeout(this.timer); if (this.drainTimer) clearTimeout(this.drainTimer); this.timer = null; this.drainTimer = null }
  disconnect(notify = true): void {
    const interrupted = this.turn
    this.epoch++; this.clearTimers(); this.cancelConnect?.(); this.cancelConnect = null; this.pending = null; this.turn = null; this.beginning = null
    const client = this.client; this.client = null
    if (this.audio) { this.audio.muted = true; this.audio.pause(); this.audio.srcObject = null }
    if (this.video) { this.video.pause(); this.video.srcObject = null }
    if (client) { try { client.ClearBuffer() } catch { /* A closed socket has no pending audio. */ } void client.stop().catch(() => undefined) }
    this.state('off', this.enabled ? 'Avatar attivo · non collegato' : 'Avatar disattivato', null)
    if (notify) interrupted?.error(new Error('Riproduzione avatar interrotta.'))
  }
}
