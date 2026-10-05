import { afterEach, expect, it, vi } from 'vitest'
import { FishTtsProvider } from './fish'
import { DEFAULT_SETTINGS, type SynthesisRequest } from '../../shared/contracts'
import { voiceInput } from '../../shared/fishVoiceFixtures'
const id='12345678-1234-4123-8123-123456789abc'
const request:SynthesisRequest={providerId:'fish-openrouter',modelId:DEFAULT_SETTINGS.fishModel,text:'Hello',voice:{mode:'reference',voiceId:id}}
const options=(fetchImpl:typeof fetch)=>({fetchImpl, resolveApiKey:async()=>'fixture', readReference:async()=>voiceInput(), readSettings:async()=>({...DEFAULT_SETTINGS,fishVoice:{id,displayName:'Test',createdAt:'2026-10-05T00:00:00Z'}})})
afterEach(()=>vi.useRealTimers())
it('emits PCM before completion, uses the exact Free model/reference, and never exposes the key', async()=>{
  let end!:()=>void, body:Record<string,unknown>={}
  const provider=new FishTtsProvider(options(async(_url,init)=>{
    body=JSON.parse(String(init?.body))
    return new Response(new ReadableStream({start(c){c.enqueue(new Uint8Array(1000));end=()=>c.close()}}),{headers:{'content-type':'audio/pcm;rate=44100;channels=1'}})
  }))
  let chunks=0
  const pending=provider.synthesizeStream(request,new AbortController().signal,()=>chunks++)
  await vi.waitFor(()=>expect(chunks).toBeGreaterThan(0))
  expect(body.model).toBe(DEFAULT_SETTINGS.fishModel); expect(body.input_references).toHaveLength(2)
  end(); expect((await pending).generationMs).toBeGreaterThanOrEqual(0)
})
it('rejects malformed metadata, JSON, headers masquerading as PCM and HTTP failures without raw bodies',async()=>{
  for(const response of [new Response('private secret',{status:429}), new Response('{}',{headers:{'content-type':'application/json'}}), new Response(new Uint8Array(10),{headers:{'content-type':'audio/pcm'}}),new Response('RIFFprivate',{headers:{'content-type':'audio/pcm;rate=44100;channels=1'}})]){
    const provider=new FishTtsProvider(options(async()=>response))
    await expect(provider.synthesizeStream(request,new AbortController().signal,()=>{})).rejects.toThrow(/Fish/)
  }
})
it('stops reading and prevents late callbacks on abort, including already aborted requests',async()=>{
  const abort=new AbortController(); let controller!:ReadableStreamDefaultController<Uint8Array>,count=0,cancelled=false
  const provider=new FishTtsProvider(options(async()=>new Response(new ReadableStream({start(c){controller=c;c.enqueue(new Uint8Array(1000))},cancel(){cancelled=true}}),{headers:{'content-type':'audio/pcm;rate=44100;channels=1'}})))
  const pending=provider.synthesizeStream(request,abort.signal,()=>count++)
  const rejected=expect(pending).rejects.toThrow(/cancel|annull/i)
  await vi.waitFor(()=>expect(count).toBeGreaterThan(0)); abort.abort(); await rejected
  expect(cancelled).toBe(true); const before=count
  expect(()=>controller.enqueue(new Uint8Array(1000))).toThrow(); expect(count).toBe(before)
  const fetchImpl=vi.fn(); const already=new AbortController();already.abort()
  await expect(new FishTtsProvider(options(fetchImpl)).synthesizeStream(request,already.signal,()=>{})).rejects.toThrow()
  expect(fetchImpl).not.toHaveBeenCalled()
})
it('bounds first PCM timeout and cancels fetch',async()=>{
  vi.useFakeTimers(); let signal:AbortSignal|undefined
  const provider=new FishTtsProvider(options(async(_url,init)=>{signal=init?.signal as AbortSignal;return new Response(new ReadableStream(),{headers:{'content-type':'audio/pcm;rate=44100;channels=1'}})}))
  const pending=provider.synthesizeStream(request,new AbortController().signal,()=>{})
  const rejected=expect(pending).rejects.toThrow(/timeout/)
  await vi.advanceTimersByTimeAsync(15001); await rejected;expect(signal?.aborted).toBe(true)
})
it('rejects empty, odd, oversized and over-duration responses and sanitizes network errors',async()=>{
  for(const bytes of [new Uint8Array(),new Uint8Array(5),new Uint8Array(32*1024*1024+1),new Uint8Array(44100*2*120+2)]) {
    const provider=new FishTtsProvider(options(async()=>new Response(bytes,{headers:{'content-type':'audio/pcm;rate=44100;channels=1'}})))
    await expect(provider.synthesizeStream(request,new AbortController().signal,()=>{})).rejects.toThrow(/Fish/)
  }
  const provider=new FishTtsProvider(options(async()=>{throw Error('secret reference transcript')}))
  await expect(provider.synthesizeStream(request,new AbortController().signal,()=>{})).rejects.toThrow('Fish: generazione non riuscita. Verifica connessione e riferimento vocale.')
})
