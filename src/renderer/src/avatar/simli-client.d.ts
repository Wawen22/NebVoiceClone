declare module 'simli-client' {
  export const LogLevel: { CRITICAL: number }
  export class SimliClient {
    constructor(token: string, video: HTMLVideoElement, audio: HTMLAudioElement, iceServers: RTCIceServer[], logLevel: number, transport: 'p2p')
    start(): Promise<void>
    stop(): Promise<void>
    on(event: 'speaking' | 'silent' | 'error' | 'startup_error' | 'stop', callback: () => void): void
    sendAudioData(data: Uint8Array): void
    ClearBuffer(): void
  }
}
