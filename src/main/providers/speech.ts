import type { ProviderId, SynthesisRequest, SynthesizedAudio, StreamedAudioResult } from '../../shared/contracts'
import type { GeminiTtsProvider } from './gemini'
import type { FishTtsProvider } from './fish'
import { parseSpeechRequest } from '../../shared/speechRequest'

export class SpeechProviderRouter {
  constructor(private readonly gemini:GeminiTtsProvider,private readonly fish:FishTtsProvider) {}
  private provider(id:ProviderId) {
    if(id==='gemini') return this.gemini
    if(id==='fish-openrouter') return this.fish
    throw new Error('Provider vocale non disponibile.')
  }
  validateConfiguration(id:ProviderId) {return this.provider(id).validateConfiguration()}
  synthesize(request:SynthesisRequest,signal:AbortSignal):Promise<SynthesizedAudio> {const valid=parseSpeechRequest(request);return this.provider(valid.providerId).synthesize(valid,signal)}
  synthesizeStream(request:SynthesisRequest,signal:AbortSignal,onChunk:(chunk:Uint8Array)=>void):Promise<StreamedAudioResult> {const valid=parseSpeechRequest(request);return this.provider(valid.providerId).synthesizeStream(valid,signal,onChunk)}
}
