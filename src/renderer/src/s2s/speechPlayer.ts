import type { DesktopApi, SynthesisRequest } from '../../../shared/contracts'
import type { AudioEngine } from '../audio/AudioEngine'

export async function streamS2SSpeech(
  api: Pick<DesktopApi, 'synthesizeStream' | 'stopGeneration'>,
  engine: Pick<AudioEngine, 'beginStream' | 'appendPcm' | 'finishStream' | 'onEnded' | 'stop'>,
  request: SynthesisRequest, deviceId: string, signal: AbortSignal, onStarted: () => boolean
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
  const work = async (): Promise<void> => {
    await engine.beginStream(deviceId)
    if (signal.aborted) { engine.stop(); signal.throwIfAborted() }
    let first = true
    let chunkError: unknown = null
    generating = true
    await api.synthesizeStream(request, (pcm) => {
      if (signal.aborted || chunkError) return
      try {
        if (first) {
          if (!onStarted()) throw new Error('Outlier ha ripreso a parlare: audio annullato.')
          first = false
        }
        engine.appendPcm(pcm)
      } catch (error) { chunkError = error; engine.stop(); cancelGeneration() }
    })
    signal.throwIfAborted()
    if (chunkError) throw chunkError
    engine.finishStream()
    await playback
  }
  try { await Promise.race([work(), aborted]) }
  catch (error) { cancelGeneration(); throw error }
  finally { signal.removeEventListener('abort', abort); engine.onEnded(() => undefined); engine.stop() }
}
