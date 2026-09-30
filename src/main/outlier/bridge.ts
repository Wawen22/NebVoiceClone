import { createServer, type Server, type Socket } from 'node:net'
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { object, parseTarget, type BrowserTarget } from '../../shared/outlier'
import type { InsertionDriver } from './insertionController'

const MAX_FRAME = 1024 * 1024
export function encodeFrame(value: unknown): Buffer {
  const data = Buffer.from(JSON.stringify(value), 'utf8')
  if (data.length > MAX_FRAME) throw new Error('Messaggio troppo grande.')
  const header = Buffer.alloc(4); header.writeUInt32LE(data.length)
  return Buffer.concat([header, data])
}
export class FrameDecoder {
  private buffer = Buffer.alloc(0)
  push(chunk: Buffer): unknown[] {
    this.buffer = Buffer.concat([this.buffer, chunk])
    const messages: unknown[] = []
    while (this.buffer.length >= 4) {
      const length = this.buffer.readUInt32LE(0)
      if (!length || length > MAX_FRAME) throw new Error('Frame non valido.')
      if (this.buffer.length < length + 4) break
      messages.push(JSON.parse(this.buffer.subarray(4, length + 4).toString('utf8')))
      this.buffer = this.buffer.subarray(length + 4)
    }
    if (this.buffer.length > MAX_FRAME + 4) throw new Error('Frame non valido.')
    return messages
  }
}
export class NativeBridge implements InsertionDriver {
  readonly pipeName = 'neb-outlier-' + randomUUID()
  readonly token = randomBytes(32).toString('hex')
  private server: Server | null = null
  private socket: Socket | null = null
  private origin: string | null = null
  hostProcessId: number | null = null
  private readonly pending = new Map<string, { resolve: (value: unknown) => void; reject: (error: Error) => void }>()
  constructor(
    private readonly associated: (target: BrowserTarget) => void,
    private readonly disconnected: () => void,
    private readonly invalidated: (message: string, reason: string) => void
  ) {}
  setExtensionId(id: string): void {
    if (!/^[a-p]{32}$/.test(id)) throw new Error('ID estensione Edge non valido.')
    this.origin = 'chrome-extension://' + id + '/'
    this.socket?.destroy()
  }
  async listen(): Promise<void> {
    if (this.server) return
    this.server = createServer((socket) => {
      const decoder = new FrameDecoder()
      let authenticated = false
      const timer = setTimeout(() => { if (!authenticated) socket.destroy() }, 3000)
      socket.on('data', (chunk) => {
        try {
          for (const raw of decoder.push(chunk)) {
            const message = object(raw)
            if (!authenticated) {
              const credential = Buffer.from(typeof message.token === 'string' ? message.token : '')
              if (message.kind !== 'hello' || message.version !== 1 || message.origin !== this.origin || credential.length !== this.token.length || !timingSafeEqual(credential, Buffer.from(this.token)) || this.socket) throw new Error('Collegamento non autorizzato.')
              authenticated = true; clearTimeout(timer); this.socket = socket
              this.hostProcessId = Number.isSafeInteger(message.processId) && Number(message.processId) > 0 ? Number(message.processId) : null
              continue
            }
            if (message.kind === 'associated') this.associated(parseTarget(message.target))
            else if (message.kind === 'invalidated') this.invalidated('Scheda, focus o campo cambiato. Verifica il testo parziale.', message.reason === 'focus' ? 'focus' : 'destination')
            else if (message.kind === 'reply' && typeof message.requestId === 'string') {
              const pending = this.pending.get(message.requestId)
              if (pending) {
                if (typeof message.error === 'string') pending.reject(new Error(message.error.slice(0, 500)))
                else pending.resolve(message.result)
              }
            }
          }
        } catch { socket.destroy() }
      })
      socket.on('error', () => socket.destroy())
      socket.on('close', () => {
        clearTimeout(timer)
        if (this.socket !== socket) return
        this.socket = null
        this.hostProcessId = null
        for (const pending of this.pending.values()) pending.reject(new Error('Collegamento Edge interrotto.'))
        this.pending.clear()
        this.disconnected()
      })
    })
    await new Promise<void>((resolve, reject) => {
      this.server!.once('error', reject)
      this.server!.listen('\\\\.\\pipe\\' + this.pipeName, () => { this.server!.removeListener('error', reject); resolve() })
    })
  }
  request(route: 'browser' | 'native', action: string, payload: Record<string, unknown>, signal?: AbortSignal): Promise<unknown> {
    if (!this.socket || this.socket.destroyed || signal?.aborted) return Promise.reject(new Error('Collegamento non disponibile o operazione interrotta.'))
    const requestId = randomUUID()
    const socket = this.socket
    return new Promise((resolve, reject) => {
      const cleanup = (): void => { clearTimeout(timer); signal?.removeEventListener('abort', abort); this.pending.delete(requestId) }
      const fail = (error: Error): void => { cleanup(); reject(error) }
      const abort = (): void => {
        // Closing the transport also makes the host discard queued native commands.
        socket.destroy()
        fail(new Error('Inserimento interrotto.'))
      }
      const timer = setTimeout(() => { socket.destroy(); fail(new Error('Timeout della verifica. Controlla il campo.')) }, 3000)
      this.pending.set(requestId, { resolve: (value) => { cleanup(); resolve(value) }, reject: fail })
      signal?.addEventListener('abort', abort, { once: true })
      socket.write(encodeFrame({ kind: route, action, requestId, payload, deadline: Date.now() + 2000 }), (error) => { if (error) fail(error) })
    })
  }
  close(): void { this.socket?.destroy(); this.server?.close(); this.server = null }
}
