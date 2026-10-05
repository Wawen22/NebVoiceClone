import type { AvatarOutputApi } from '../../../shared/avatarOutput'
import { AVATAR_OUTPUT_MAX_DIMENSION, AVATAR_OUTPUT_MAX_FPS } from '../../../shared/avatarOutput'

export class AvatarOutputPublisher {
  private active = false
  private enabled = false
  private viewers = 0
  private disposed = false
  private busy = false
  private polling = false
  private epoch = 0
  private generation = ''
  private rejected = 0
  private lastDecoded = -1
  private canvas: HTMLCanvasElement
  private captureTimer: ReturnType<typeof setInterval> | null = null
  private statusTimer: ReturnType<typeof setInterval> | null = null
  constructor(private readonly api: AvatarOutputApi, private readonly video: HTMLVideoElement) { this.canvas = document.createElement('canvas') }
  start(): void {
    if (this.captureTimer || this.disposed) return
    void this.poll()
    this.statusTimer = setInterval(() => void this.poll(), 500)
    // Keep capture slightly below the maximum output rate.
    this.captureTimer = setInterval(() => void this.capture(), Math.ceil(1000 / AVATAR_OUTPUT_MAX_FPS) + 2)
  }
  setActive(active: boolean): void { if (this.active === active) return; this.active = active; this.invalidate() }
  private invalidate(): void {
    this.epoch++
    const generation = this.generation; this.generation = ''; this.rejected = 0
    if (generation) void this.api.clearAvatarOutput(generation).catch(() => undefined)
  }
  private async poll(): Promise<void> {
    if (this.polling || this.disposed) return
    this.polling = true
    try {
      const status = await this.api.getAvatarOutputStatus()
      if (this.disposed) return
      const enabled = status.enabled && status.available
      if (this.enabled !== enabled) { this.enabled = enabled; this.invalidate() }
      this.viewers = status.viewers
    } catch { this.enabled = false; this.invalidate() }
    finally { this.polling = false }
  }
  private async capture(): Promise<void> {
    if (this.busy || this.disposed || !this.active || !this.enabled || !this.viewers || this.video.readyState < 2 || !this.video.videoWidth || !this.video.videoHeight) return
    if (this.video.getVideoPlaybackQuality) {
      const decoded = this.video.getVideoPlaybackQuality().totalVideoFrames
      if (decoded === this.lastDecoded) return
      this.lastDecoded = decoded
    }
    this.busy = true
    const epoch = this.epoch
    try {
      if (!this.generation) {
        const generation = await this.api.beginAvatarOutput()
        if (this.disposed || this.epoch !== epoch) { await this.api.clearAvatarOutput(generation); return }
        this.generation = generation
      }
      const scale = Math.min(1, AVATAR_OUTPUT_MAX_DIMENSION / Math.max(this.video.videoWidth, this.video.videoHeight))
      const width = Math.max(1, Math.round(this.video.videoWidth * scale)), height = Math.max(1, Math.round(this.video.videoHeight * scale))
      if (this.canvas.width !== width) this.canvas.width = width
      if (this.canvas.height !== height) this.canvas.height = height
      this.canvas.getContext('2d')?.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height)
      const blob = await new Promise<Blob | null>((resolve) => this.canvas.toBlob(resolve, 'image/jpeg', 0.85))
      if (!blob || blob.size > 256 * 1024 || this.disposed || epoch !== this.epoch) return
      const jpeg = new Uint8Array(await blob.arrayBuffer())
      if (this.disposed || epoch !== this.epoch) return
      const accepted = await this.api.publishAvatarOutputFrame({ generation: this.generation, jpeg })
      if (epoch === this.epoch) {
        this.rejected = accepted ? 0 : this.rejected + 1
        if (this.rejected >= 2) this.invalidate()
      }
    } catch { if (epoch === this.epoch) this.invalidate() }
    finally { this.busy = false }
  }
  dispose(): void {
    if (this.disposed) return
    this.disposed = true; this.invalidate()
    if (this.captureTimer) clearInterval(this.captureTimer)
    if (this.statusTimer) clearInterval(this.statusTimer)
    this.canvas.width = 0; this.canvas.height = 0
  }
}
