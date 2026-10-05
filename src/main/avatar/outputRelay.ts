import { createServer, type Server, type ServerResponse } from 'node:http'
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { AvatarOutputFrame, AvatarOutputStatus } from '../../shared/avatarOutput'
import { AVATAR_OUTPUT_MAX_FPS } from '../../shared/avatarOutput'
import { createAvatarOutputPage } from './outputPage'

interface Viewer { video?: ServerResponse; events?: ServerResponse; touched: number }
export class AvatarOutputRelay {
  private server: Server | null = null
  private timer: ReturnType<typeof setInterval> | null = null
  private token = ''
  private enabled = false
  private available = false
  private error: string | undefined
  private port: number
  private generation = ''
  private frame: Buffer | null = null
  private lastFrame = -Infinity
  private frameTimes: number[] = []
  private viewers = new Map<string, Viewer>()
  private readonly now: () => number
  constructor(private readonly options: { userData: string; port?: number; now?: () => number }) {
    this.port = options.port ?? 17890; this.now = options.now ?? Date.now
  }
  private save(): void {
    mkdirSync(this.options.userData, { recursive: true })
    writeFileSync(join(this.options.userData, 'avatar-output.json'), JSON.stringify({ token: this.token, enabled: this.enabled, port: this.port }), { mode: 0o600 })
  }
  async start(): Promise<void> {
    if (this.server) return
    try {
      const path = join(this.options.userData, 'avatar-output.json')
      if (existsSync(path)) {
        if (readFileSync(path).length > 4096) throw new Error('Configurazione non valida.')
        const value = JSON.parse(readFileSync(path, 'utf8')) as { token?: unknown; enabled?: unknown; port?: unknown }
        if (typeof value.token !== 'string' || !/^[a-f0-9]{64}$/.test(value.token)) throw new Error('Configurazione non valida.')
        this.token = value.token; this.enabled = value.enabled === true
        if (this.options.port === undefined && Number.isInteger(value.port) && Number(value.port) > 0 && Number(value.port) <= 65535) this.port = Number(value.port)
      } else this.token = randomBytes(32).toString('hex')
      const server = createServer((req, res) => {
        res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff')
        const reject = (status: number): void => { res.writeHead(status); res.end() }
        if (req.method !== 'GET') return reject(405)
        if (req.headers.host !== `127.0.0.1:${this.port}`) return reject(403)
        if (!req.url?.startsWith('/') || req.url.startsWith('//') || req.url.length > 2048) return reject(400)
        let url: URL
        try { url = new URL(req.url, `http://127.0.0.1:${this.port}`) } catch { return reject(400) }
        const supplied = Buffer.from(url.searchParams.get('token') ?? '')
        const token = Buffer.from(this.token)
        if (supplied.length !== token.length || !timingSafeEqual(supplied, token)) return reject(403)
        if (url.pathname === '/') {
          res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'")
          res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
          res.setHeader('Referrer-Policy', 'no-referrer'); res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(createAvatarOutputPage()); return
        }
        if (url.pathname !== '/video' && url.pathname !== '/events') return reject(404)
        const id = url.searchParams.get('viewer') ?? ''
        if (!/^[a-zA-Z0-9-]{1,64}$/.test(id)) return reject(400)
        let viewer = this.viewers.get(id)
        if (!viewer && this.viewers.size >= 4) return reject(429)
        if (!viewer) { viewer = { touched: this.now() }; this.viewers.set(id, viewer) }
        const kind = url.pathname === '/video' ? 'video' : 'events'
        if (viewer[kind]) return reject(409)
        viewer[kind] = res; viewer.touched = this.now()
        res.on('close', () => { if (viewer![kind] === res) { viewer![kind] = undefined; viewer!.touched = this.now() } })
        res.setHeader('Content-Type', kind === 'video' ? 'multipart/x-mixed-replace; boundary=nebframe' : 'text/event-stream')
        res.flushHeaders()
        if (kind === 'video' && this.frame) this.writeFrame(res, this.frame)
        if (kind === 'events') this.writeState(res, true)
      })
      this.server = server
      await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(this.port, '127.0.0.1', () => { server.removeListener('error', reject); resolve() }) })
      this.port = (server.address() as { port: number }).port; this.save(); this.available = true; this.error = undefined
      this.timer = setInterval(() => this.tick(), 250); this.timer.unref()
    } catch {
      this.error = 'Uscita OBS non disponibile: controlla la porta locale 17890 e la configurazione.'
      this.available = false
      await this.close()
    }
  }
  getStatus(): AvatarOutputStatus { return { enabled: this.enabled, available: this.available, viewers: [...this.viewers.values()].filter((v) => v.video || v.events).length, ...(this.error ? { error: this.error } : {}) } }
  getUrl(): string { if (!this.available) throw new Error(this.error ?? 'Uscita OBS non disponibile.'); return `http://127.0.0.1:${this.port}/?token=${this.token}` }
  setEnabled(enabled: boolean): AvatarOutputStatus {
    this.saveEnabled(enabled); return this.getStatus()
  }
  private saveEnabled(enabled: boolean): void {
    this.enabled = enabled; if (!enabled) this.reset(); this.save(); this.broadcastState()
  }
  beginGeneration(): string { this.reset(); this.generation = randomUUID(); return this.generation }
  clear(generation: string): void { if (generation === this.generation) this.reset() }
  publish(frame: AvatarOutputFrame): boolean {
    if (!this.available || !this.enabled || !this.generation || frame.generation !== this.generation) return false
    const bytes = frame.jpeg
    if (!(bytes instanceof Uint8Array) || bytes.byteLength < 4 || bytes.byteLength > 256 * 1024 || bytes[0] !== 255 || bytes[1] !== 216 || bytes[bytes.length - 2] !== 255 || bytes[bytes.length - 1] !== 217) return false
    const now = this.now()
    if (now <= this.lastFrame) return false
    // Bound a rolling second instead of discarding frames for small timer jitter.
    this.frameTimes = this.frameTimes.filter((timestamp) => now - timestamp < 1000)
    if (this.frameTimes.length >= AVATAR_OUTPUT_MAX_FPS) return false
    this.frameTimes.push(now)
    this.frame = Buffer.from(bytes); this.lastFrame = now
    for (const viewer of this.viewers.values()) if (viewer.video) this.writeFrame(viewer.video, this.frame)
    this.broadcastState(true); return true
  }
  private writeFrame(res: ServerResponse, frame: Buffer): void {
    if (res.destroyed || res.writableEnded) return
    if (res.writableLength > 256 * 1024) { res.destroy(); return }
    if (res.writableNeedDrain) return
    res.write(Buffer.concat([Buffer.from(`--nebframe\r\nContent-Type: image/jpeg\r\nContent-Length: ${frame.length}\r\n\r\n`), frame, Buffer.from('\r\n')]))
  }
  private writeState(res: ServerResponse, includeFrame = false): void {
    if (res.destroyed || res.writableEnded) return
    if (res.writableLength > 512 * 1024) { res.destroy(); return }
    if (!res.writableNeedDrain) res.write(`data: ${JSON.stringify({ active: this.enabled && Boolean(this.frame), timestamp: this.frame ? this.lastFrame : null, ...(includeFrame && this.frame ? { jpeg: this.frame.toString('base64') } : {}) })}\n\n`)
  }
  private broadcastState(includeFrame = false): void { for (const viewer of this.viewers.values()) if (viewer.events) this.writeState(viewer.events, includeFrame) }
  private reset(): void {
    this.generation = ''; this.frame = null; this.lastFrame = -Infinity; this.frameTimes = []
    for (const viewer of this.viewers.values()) viewer.video?.end()
    this.broadcastState()
  }
  private tick(): void {
    if (this.frame && this.now() - this.lastFrame > 3000) this.reset()
    for (const [id, viewer] of this.viewers) if (!viewer.video && !viewer.events && this.now() - viewer.touched > 3000) this.viewers.delete(id)
    this.broadcastState()
  }
  async close(): Promise<void> {
    this.available = false; this.reset()
    if (this.timer) clearInterval(this.timer); this.timer = null
    for (const viewer of this.viewers.values()) { viewer.events?.destroy(); viewer.video?.destroy() }
    this.viewers.clear()
    const server = this.server; this.server = null
    if (server) await new Promise<void>((resolve) => { server.close(() => resolve()); server.closeAllConnections() })
  }
}
