import type { DesktopApi, SynthesisRequest } from '../../../shared/contracts'

type SpeechApi = Pick<DesktopApi, 'synthesizeStream' | 'stopGeneration'>
/** Generates PCM only. No AudioEngine is created until the controller authorizes playback. */
export class SilentSpeechPreparation {
  private current: { text: string; abort: AbortController; signal: AbortSignal; promise: Promise<{ chunks: Uint8Array[]; generationMs: number }> } | null = null
  constructor(private readonly api: SpeechApi) {}
  prepare(request: SynthesisRequest, signal: AbortSignal, after: Promise<void>): Promise<void> {
    this.clear()
    const abort = new AbortController()
    const combined = AbortSignal.any([signal, abort.signal])
    const promise = (async () => {
      let generating = false, cancelled = false
      const stop = (): void => { if (generating && !cancelled) { cancelled = true; void this.api.stopGeneration().catch(() => undefined) } }
      combined.addEventListener('abort', stop, { once: true })
      try {
        await after
        combined.throwIfAborted()
        const chunks: Uint8Array[] = []
        let bytes = 0, chunkError: Error | null = null
        generating = true
        const result = await this.api.synthesizeStream(request, (pcm) => {
          if (combined.aborted || chunkError) return
          if (!pcm.length || pcm.length % 2 || bytes + pcm.length > 5_760_000) { chunkError = new Error('Audio NEB preparato non valido o oltre 120 secondi.'); stop(); return }
          bytes += pcm.length; chunks.push(Uint8Array.from(pcm))
        })
        generating = false
        combined.throwIfAborted()
        if (chunkError) throw chunkError
        if (!bytes) throw new Error('Gemini non ha prodotto audio per la battuta preparata.')
        return { chunks, generationMs: result.generationMs }
      } finally { combined.removeEventListener('abort', stop) }
    })()
    this.current = { text: request.text, abort, signal: combined, promise }
    return promise.then(() => undefined)
  }
  playbackApi(text: string): SpeechApi | null {
    const prepared = this.current
    if (!prepared || prepared.text !== text || prepared.signal.aborted) return null
    return {
      synthesizeStream: async (_request, onChunk) => {
        const result = await prepared.promise
        prepared.signal.throwIfAborted()
        if (this.current === prepared) this.current = null
        result.chunks.forEach(onChunk)
        return { generationMs: result.generationMs }
      },
      stopGeneration: async () => { prepared.abort.abort() }
    }
  }
  clear(): void { this.current?.abort.abort(); this.current = null }
}
