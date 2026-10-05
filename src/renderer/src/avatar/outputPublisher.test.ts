import { afterEach, describe, expect, it, vi } from 'vitest'
import { AvatarOutputPublisher } from './outputPublisher'
import type { AvatarOutputApi, AvatarOutputFrame } from '../../../shared/avatarOutput'

describe('avatar output publisher', () => {
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })
  function fixture(width = 1920, height = 1080) {
    vi.useFakeTimers()
    const frames: AvatarOutputFrame[] = [], cleared: string[] = [], draws: number[][] = [], encodes: unknown[][] = []
    let enabled = true, viewers = 1, held = false, rejectNext = false, pending: ((blob: Blob | null) => void) | null = null, generations = 0
    const canvas = { width: 0, height: 0, getContext: () => ({ drawImage: (_video: unknown, ...values: number[]) => draws.push(values) }), toBlob: (callback: (blob: Blob | null) => void, ...args: unknown[]) => { encodes.push(args); if (held) pending = callback; else callback(new Blob([new Uint8Array([255, 216, 255, 217])])) } }
    vi.stubGlobal('document', { createElement: () => canvas })
    const api: AvatarOutputApi = { getAvatarOutputStatus: async () => ({ enabled, available: true, viewers }), setAvatarOutputEnabled: async (value) => { enabled = value; return { enabled, available: true, viewers } }, getAvatarOutputUrl: async () => '', beginAvatarOutput: async () => String(++generations), publishAvatarOutputFrame: async (frame) => { frames.push(frame); if (rejectNext) { rejectNext = false; return false }; return true }, clearAvatarOutput: async (generation) => { cleared.push(generation) } }
    const video = { videoWidth: width, videoHeight: height, readyState: 4 } as HTMLVideoElement
    const publisher = new AvatarOutputPublisher(api, video)
    return { publisher, video, frames, cleared, draws, encodes, canvas, rejectNext: () => { rejectNext = true }, disable: () => { enabled = false }, noViewers: () => { viewers = 0 }, hold: () => { held = true }, release: () => pending?.(new Blob([new Uint8Array([255, 216, 255, 217])])) }
  }
  it('bounds dimensions, JPEG quality and frame rate without upsampling', async () => {
    const f = fixture(); f.publisher.start(); f.publisher.setActive(true); await vi.advanceTimersByTimeAsync(1000)
    expect(f.frames.length).toBeGreaterThanOrEqual(10); expect(f.frames.length).toBeLessThanOrEqual(15); expect(f.canvas.width).toBe(640); expect(f.canvas.height).toBe(360); expect(f.encodes[0]).toEqual(['image/jpeg', 0.85]); f.publisher.dispose()
    const small = fixture(512, 512); small.publisher.start(); small.publisher.setActive(true); await vi.advanceTimersByTimeAsync(200); expect(small.canvas.width).toBe(512); expect(small.canvas.height).toBe(512); small.publisher.dispose()
  })
  it('does not encode without viewers or while output is disabled', async () => {
    const f = fixture(); f.noViewers(); f.publisher.start(); f.publisher.setActive(true); await vi.advanceTimersByTimeAsync(1000); expect(f.encodes).toHaveLength(0); f.publisher.dispose()
    const off = fixture(); off.disable(); off.publisher.start(); off.publisher.setActive(true); await vi.advanceTimersByTimeAsync(1000); expect(off.encodes).toHaveLength(0); off.publisher.dispose()
  })
  it('drops asynchronous encoding after Stop and clears its generation', async () => {
    const f = fixture(); f.hold(); f.publisher.start(); f.publisher.setActive(true); await vi.advanceTimersByTimeAsync(1000)
    expect(f.encodes).toHaveLength(1); f.publisher.setActive(false); f.release(); await vi.advanceTimersByTimeAsync(100)
    expect(f.frames).toHaveLength(0); expect(f.cleared).toContain('1'); f.publisher.dispose()
  })
  it('does not reset the viewer for a single rate-limited frame', async () => {
    const f = fixture(); f.publisher.start(); f.publisher.setActive(true); await vi.advanceTimersByTimeAsync(200); f.rejectNext(); await vi.advanceTimersByTimeAsync(400); expect(f.cleared).toHaveLength(0); expect(new Set(f.frames.map((frame) => frame.generation)).size).toBe(1); f.publisher.dispose()
  })
  it('cancels pending encoding on dispose and output disable', async () => {
    for (const dispose of [false, true]) { const f = fixture(); f.hold(); f.publisher.start(); f.publisher.setActive(true); await vi.advanceTimersByTimeAsync(200); if (dispose) f.publisher.dispose(); else { f.disable(); await vi.advanceTimersByTimeAsync(500) }; f.release(); await vi.advanceTimersByTimeAsync(100); expect(f.frames).toHaveLength(0); expect(f.cleared).toContain('1'); f.publisher.dispose() }
  })
  it('does not keep a frozen decoded frame alive indefinitely', async () => {
    const f = fixture(); let decoded = 1
    f.video.getVideoPlaybackQuality = () => ({ totalVideoFrames: decoded } as VideoPlaybackQuality)
    f.publisher.start(); f.publisher.setActive(true); await vi.advanceTimersByTimeAsync(4000); expect(f.frames).toHaveLength(1)
    decoded++; await vi.advanceTimersByTimeAsync(200); expect(f.frames).toHaveLength(2); f.publisher.dispose()
  })
})
