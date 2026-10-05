import type { DesktopApi, SynthesisRequest, StreamedAudioResult } from '../../../shared/contracts'
import type { AudioEngine } from '../audio/AudioEngine'

export async function streamS2SSpeech(
  api: Pick<DesktopApi, 'synthesizeStream' | 'stopGeneration'>,
  engine: Pick<AudioEngine, 'beginStream' | 'appendPcm' | 'finishStream' | 'onEnded' | 'stop' | 'onStarted' | 'onError'>,
  request: SynthesisRequest, deviceId: string, signal: AbortSignal, onStarted: () => boolean, options: { drainOnError?: boolean; onFirstChunk?: () => void; onGenerated?: (result: StreamedAudioResult) => void } = {}
): Promise<void> {
  signal.throwIfAborted()
  let generating = false, cancelled = false
  const cancelGeneration = (): void => {
    if (generating && !cancelled) { cancelled = true; void api.stopGeneration().catch(() => undefined) }
  }
  let rejectAbort!: (error: unknown) => void
  const aborted = new Promise<never>((_resolve, reject) => { rejectAbort = reject })
  const abort = (): void => { engine.stop(); cancelGeneration(); rejectAbort(new Error('Riproduzione S2S interrotta.')) }
  signal.addEventListener('abort', abort, { once: true })
  let resolvePlayback!: () => void
  const playback = new Promise<void>((resolve) => { resolvePlayback = resolve })
  engine.onEnded(resolvePlayback)
  let rejectPlayback!: (error: Error) => void
  const playbackFailed = new Promise<never>((_resolve, reject) => { rejectPlayback = reject })
  engine.onError?.((error) => { cancelGeneration(); rejectPlayback(error) })
  const work = async (): Promise<void> => {
    await engine.beginStream(deviceId)
    if (signal.aborted) { engine.stop(); signal.throwIfAborted() }
    let first = true, receivedAudio = false
    const start = (): boolean => {
      if (signal.aborted) return false
      if (first) { if (!onStarted()) return false; first = false }
      return true
    }
    engine.onStarted?.(start)
    let chunkError: unknown = null
    generating = true
    try { const result = await api.synthesizeStream(request, (pcm) => {
      if (signal.aborted || chunkError) return
      try {
        if (first && !engine.onStarted && !start()) throw new Error('Outlier ha ripreso a parlare: audio annullato.')
        engine.appendPcm(pcm)
        if (!receivedAudio) options.onFirstChunk?.()
        receivedAudio = true
      } catch (error) { chunkError = error; engine.stop(); cancelGeneration() }
    }); if (!signal.aborted && !chunkError) options.onGenerated?.(result) } catch (error) {
      // Live preserves queued speech on a provider failure. Explicit Stop always cancels immediately.
      if (options.drainOnError && receivedAudio && !chunkError && !signal.aborted) {
        engine.finishStream(); await playback
      }
      throw error
    }
    signal.throwIfAborted()
    if (chunkError) throw chunkError
    engine.finishStream()
    await playback
  }
  try { await Promise.race([work(), aborted, playbackFailed]) }
  catch (error) { cancelGeneration(); throw error }
  finally { signal.removeEventListener('abort', abort); engine.onEnded(() => undefined); engine.onError?.(() => undefined); engine.onStarted?.(() => false); engine.stop() }
}
