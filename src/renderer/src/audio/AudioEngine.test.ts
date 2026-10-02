import { afterEach, describe, expect, it, vi } from 'vitest'
import { BrowserAudioEngine } from './AudioEngine'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('BrowserAudioEngine', () => {
  it('signals completion only after the final streamed chunk and never after stop', async () => {
    const sources: { onended: (() => void) | null; stop: () => void }[] = []
    class FakeAudio {
      volume = 1
      currentTime = 0
      sinkId = 'default'
      src = ''
      srcObject: unknown = null
      async play(): Promise<void> {}
      load(): void {}
      pause(): void {}
      removeAttribute(): void {}
      async setSinkId(id: string): Promise<void> { this.sinkId = id }
    }
    class FakeAudioContext {
      currentTime = 0
      createMediaStreamDestination(): { stream: object } { return { stream: {} } }
      createBuffer(_channels: number, length: number): { getChannelData: () => Float32Array; duration: number } {
        return { getChannelData: () => new Float32Array(length), duration: length / 24000 }
      }
      createBufferSource(): object {
        const source = { buffer: null, onended: null as (() => void) | null, connect(): void {}, start(): void {}, stop(): void { this.onended?.() } }
        sources.push(source)
        return source
      }
      async resume(): Promise<void> {}
      async close(): Promise<void> {}
    }
    vi.stubGlobal('Audio', FakeAudio)
    vi.stubGlobal('AudioContext', FakeAudioContext)
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const engine = new BrowserAudioEngine()
    const ended = vi.fn()
    engine.onEnded(ended)
    await engine.beginStream('default')
    engine.appendPcm(Uint8Array.of(0, 0))
    engine.appendPcm(Uint8Array.of(0, 0))
    engine.finishStream()
    expect(ended).not.toHaveBeenCalled()
    sources[0].onended?.()
    expect(ended).not.toHaveBeenCalled()
    sources[1].onended?.()
    expect(ended).toHaveBeenCalledOnce()
    await engine.beginStream('default')
    engine.appendPcm(Uint8Array.of(0, 0))
    engine.finishStream()
    engine.stop()
    expect(ended).toHaveBeenCalledOnce()
    await engine.beginStream('default')
    engine.appendPcm(Uint8Array.of(0, 0))
    sources[3].onended?.()
    engine.finishStream()
    engine.stop()
    await Promise.resolve()
    expect(ended).toHaveBeenCalledOnce()
    engine.dispose()
  })

  it('keeps the previous clip replayable when a new stream fails to start', async () => {
    const elements: FakeAudio[] = []
    let failStream = true
    class FakeAudio {
      volume = 1
      currentTime = 0
      duration = 1
      sinkId = 'default'
      src = ''
      srcObject: unknown = null
      onloadedmetadata: (() => void) | null = null
      onerror: (() => void) | null = null
      onended: (() => void) | null = null
      play = vi.fn(async () => {
        if (this === elements[1] && failStream) throw new Error('Stream playback failed')
      })

      constructor() { elements.push(this) }
      load(): void { queueMicrotask(() => this.onloadedmetadata?.()) }
      pause(): void {}
      removeAttribute(): void { this.src = '' }
      async setSinkId(deviceId: string): Promise<void> { this.sinkId = deviceId }
    }
    class FakeAudioContext {
      currentTime = 0
      createMediaStreamDestination(): { stream: object } { return { stream: {} } }
      async resume(): Promise<void> {}
      async close(): Promise<void> {}
    }
    vi.stubGlobal('Audio', FakeAudio)
    vi.stubGlobal('AudioContext', FakeAudioContext)
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:previous')
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

    const engine = new BrowserAudioEngine()
    await engine.loadBytes(Uint8Array.of(0, 0), 'audio/wav')
    await expect(engine.beginStream('default')).rejects.toThrow('Stream playback failed')
    await engine.replay('default')

    expect(elements[0].play).toHaveBeenCalledOnce()
    expect(revoke).not.toHaveBeenCalled()
    failStream = false
    await engine.beginStream('default')
    engine.stop()
    await engine.replay('default')
    expect(elements[0].play).toHaveBeenCalledTimes(2)
    expect(revoke).not.toHaveBeenCalled()
    engine.dispose()
    expect(revoke).toHaveBeenCalledWith('blob:previous')
  })
})
