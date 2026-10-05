import type { AppSettings, ProviderStatus, StreamedAudioResult, SynthesizedAudio, SynthesisRequest, TtsProvider, VoiceReference } from '../../shared/contracts'
import { parseSpeechRequest } from '../../shared/speechRequest'
import { Pcm24kStream } from './pcmStream'
import { estimateFishCost } from '../../shared/speechMetrics'

interface FishOptions {
  fetchImpl?: typeof fetch
  resolveApiKey(): Promise<string>
  readReference(id: string): Promise<{sourceAudio: Uint8Array; transcript: string}>
  readSettings(): Promise<AppSettings>
}
function sourceRate(contentType: string): number {
  const parts=contentType.toLowerCase().split(';').map(s=>s.trim())
  const rate=Number(parts.find(s=>/^rate=\d+$/.test(s))?.slice(5))
  if(parts.length!==3 || parts[0]!=='audio/pcm' || !parts.includes('channels=1') || ![8000,16000,24000,32000,44100,48000].includes(rate)) throw new Error('Fish: formato audio inatteso (PCM16 mono con rate esplicito richiesto).')
  return rate
}
export class FishTtsProvider implements TtsProvider {
  readonly id='fish-openrouter'
  readonly displayName='Fish via OpenRouter'
  constructor(private readonly options: FishOptions) {}
  async validateConfiguration(): Promise<ProviderStatus> {
    try {
      if(!(await this.options.resolveApiKey()).trim()) return {ready:false,message:'Chiave OpenRouter non configurata.'}
      const record=(await this.options.readSettings()).fishVoice
      if(!record) return {ready:false,message:'Importa un riferimento vocale Fish.'}
      await this.options.readReference(record.id)
      return {ready:true,message:'Fish pronto'}
    } catch {return {ready:false,message:'Riferimento Fish cifrato non disponibile. Importalo di nuovo.'}}
  }
  async listVoices(): Promise<VoiceReference[]> {
    const record=(await this.options.readSettings()).fishVoice
    return record ? [{mode:'reference',voiceId:record.id}] : []
  }
  async synthesizeStream(value:SynthesisRequest, signal:AbortSignal, onChunk:(bytes:Uint8Array)=>void):Promise<StreamedAudioResult> {
    const request=parseSpeechRequest(value)
    if(request.providerId!==this.id || request.voice.mode!=='reference') throw new Error('Fish: richiesta non valida.')
    signal.throwIfAborted()
    const started=performance.now(), controller=new AbortController()
    let reader:ReadableStreamDefaultReader<Uint8Array>|undefined, timedOut=false
    const abort=():void=>{controller.abort();void reader?.cancel().catch(()=>undefined)}
    const timeout=():void=>{timedOut=true;abort()}
    signal.addEventListener('abort',abort,{once:true})
    const initial=setTimeout(timeout,15000), total=setTimeout(timeout,120000)
    let count=0, output=0, first=true
    try {
      const key=(await this.options.resolveApiKey()).trim()
      if(!key) throw new Error('Fish: chiave OpenRouter assente.')
      const record=(await this.options.readSettings()).fishVoice
      if(record?.id!==request.voice.voiceId) throw new Error('Fish: riferimento vocale non disponibile.')
      const reference=await this.options.readReference(record.id)
      controller.signal.throwIfAborted()
      const response=await (this.options.fetchImpl ?? fetch)('https://openrouter.ai/api/v1/audio/speech',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({model:request.modelId,input:request.text,response_format:'pcm',input_references:[{type:'input_audio',input_audio:{data:`data:audio/wav;base64,${Buffer.from(reference.sourceAudio).toString('base64')}`}},{type:'text',text:reference.transcript}]})})
      if(!response.ok) {void response.body?.cancel().catch(()=>undefined);throw new Error(`Fish: HTTP ${response.status}. Nessun cambio automatico di modello.`)}
      if(!response.body) throw new Error('Fish: risposta audio vuota.')
      reader=response.body.getReader()
      const rate=sourceRate(response.headers.get('content-type') ?? ''), pcm=new Pcm24kStream(rate)
      let prefix=new Uint8Array()
      const emit=(chunk:Uint8Array):void=>{
        controller.signal.throwIfAborted()
        if(!chunk.length) return
        output+=chunk.length
        if(output>24000*2*120) throw new Error('Fish: audio oltre 120 secondi.')
        clearTimeout(initial);onChunk(chunk)
      }
      while(true) {
        const {value:bytes,done}=await reader.read()
        controller.signal.throwIfAborted()
        if(done) break
        if(!bytes?.length) continue
        count+=bytes.length
        if(count>32*1024*1024 || count>rate*2*120) throw new Error('Fish: audio oltre il limite consentito.')
        let input=bytes
        if(first) {
          const joined=new Uint8Array(prefix.length+bytes.length);joined.set(prefix);joined.set(bytes,prefix.length)
          if(joined.length<4) {prefix=joined;continue}
          const tag=Buffer.from(joined.subarray(0,4)).toString('latin1')
          if(tag==='RIFF' || tag==='OggS' || tag.startsWith('ID3')) throw new Error('Fish: contenuto audio inatteso.')
          first=false;input=joined
        }
        emit(pcm.push(input))
      }
      if(first || !count) throw new Error('Fish: risposta audio vuota.')
      emit(pcm.finish())
      if(!output) throw new Error('Fish: risposta audio vuota.')
      return {generationMs:Math.round(performance.now()-started),ttsEstimatedCostUsd:estimateFishCost(request.modelId,request.text,null)}
    } catch(error) {
      if(timedOut) throw new Error('Fish: timeout della generazione.')
      if(signal.aborted) throw new Error('Fish: generazione annullata.')
      const safe=error instanceof Error && /^Fish: (HTTP \d{3}\. Nessun cambio automatico di modello\.|chiave OpenRouter assente\.|riferimento vocale non disponibile\.|formato audio inatteso \(PCM16 mono con rate esplicito richiesto\)\.|risposta audio vuota\.|contenuto audio inatteso\.|audio oltre (120 secondi|il limite consentito)\.|campione PCM incompleto\.)$/.test(error.message)
      throw new Error(safe ? (error as Error).message : 'Fish: generazione non riuscita. Verifica connessione e riferimento vocale.')
    } finally {
      clearTimeout(initial);clearTimeout(total);signal.removeEventListener('abort',abort);controller.abort()
      try {await reader?.cancel()} catch { /* The transport may already be closed. */ }
      reader?.releaseLock()
    }
  }
  async synthesize(request:SynthesisRequest,signal:AbortSignal):Promise<SynthesizedAudio> {
    const chunks:Uint8Array[]=[]
    const result=await this.synthesizeStream(request,signal,b=>chunks.push(b))
    const pcm=Buffer.concat(chunks), header=Buffer.alloc(44)
    header.write('RIFF');header.writeUInt32LE(pcm.length+36,4);header.write('WAVEfmt ',8);header.writeUInt32LE(16,16)
    header.writeUInt16LE(1,20);header.writeUInt16LE(1,22);header.writeUInt32LE(24000,24);header.writeUInt32LE(48000,28);header.writeUInt16LE(2,32);header.writeUInt16LE(16,34);header.write('data',36);header.writeUInt32LE(pcm.length,40)
    return {...result,data:Uint8Array.from(Buffer.concat([header,pcm])),mimeType:'audio/wav',durationSeconds:pcm.length/48000}
  }
}
