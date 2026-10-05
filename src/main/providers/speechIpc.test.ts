import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type { WebContents } from 'electron'
import type { WindowPresentationController } from '../windowPresentation'
import { DEFAULT_SETTINGS } from '../../shared/contracts'
import { voiceInput } from '../../shared/fishVoiceFixtures'
const state=vi.hoisted(()=>({dir:'',handlers:new Map<string,(...args:unknown[])=>unknown>()}))
vi.mock('electron',()=>({app:{getPath:()=>state.dir},BrowserWindow:{},dialog:{},desktopCapturer:{},clipboard:{},nativeImage:{},ipcMain:{handle:(channel:string,handler:(...args:unknown[])=>unknown)=>state.handlers.set(channel,handler)},safeStorage:{isAsyncEncryptionAvailable:async()=>true,getSelectedStorageBackend:()=> 'gnome_libsecret',encryptStringAsync:async(t:string)=>Buffer.from(t).map(b=>b^123),decryptStringAsync:async(b:Buffer)=>({result:b.map(x=>x^123).toString(),shouldReEncrypt:false})}}))
import { registerIpc } from '../ipc/registerIpc'
import { FishTtsProvider } from './fish'
import * as keyStore from '../config/geminiKeyStore'
import * as settingsStore from '../config/settingsStore'
import { dialog } from 'electron'
const frame={} as Electron.WebFrameMain
const sender={mainFrame:frame,isDestroyed:()=>false,send:vi.fn()} as unknown as WebContents
const event={sender,senderFrame:frame}
const invoke=(channel:string,...args:unknown[])=>state.handlers.get(channel)!(...args)
beforeEach(async()=>{state.dir=await mkdtemp(join(tmpdir(),'neb-speech-ipc-'));state.handlers.clear();registerIpc(()=>sender,{} as WindowPresentationController);vi.stubEnv('OPENROUTER_API_KEY','fixture')})
afterEach(async()=>{vi.restoreAllMocks();vi.unstubAllEnvs();await rm(state.dir,{recursive:true,force:true})})
it('rejects untrusted windows and child frames on Fish operations',async()=>{
  for(const channel of ['fishVoice:import','fishVoice:remove','speech:providerStatus','speech:sessionLock']) for(const untrusted of [{sender:{},senderFrame:frame},{sender,senderFrame:{}}]) await expect(Promise.resolve().then(()=>invoke(channel,untrusted,voiceInput()))).rejects.toThrow('Untrusted')
})
it('imports and removes references without TTS and blocks mutations throughout a Live session',async()=>{
  const tts=vi.spyOn(FishTtsProvider.prototype,'synthesizeStream')
  const saved=await invoke('fishVoice:import',event,voiceInput()) as typeof DEFAULT_SETTINGS
  expect(saved.fishVoice?.displayName).toBe('Test');expect(tts).not.toHaveBeenCalled()
  expect(await invoke('speech:providerStatus',event,'fish-openrouter')).toMatchObject({ready:true})
  invoke('speech:sessionLock',event,true,'live-1')
  await expect(Promise.resolve().then(()=>invoke('fishVoice:remove',event))).rejects.toThrow(/operazione/)
  await expect(Promise.resolve().then(()=>invoke('settings:update',event,{providerId:'fish-openrouter'}))).rejects.toThrow(/operazione/)
  invoke('speech:sessionLock',event,false,'old-session')
  await expect(Promise.resolve().then(()=>invoke('fishVoice:remove',event))).rejects.toThrow(/operazione/)
  invoke('speech:sessionLock',event,false,'live-1')
  await invoke('fishVoice:remove',event)
  expect(await invoke('speech:providerStatus',event,'fish-openrouter')).toMatchObject({ready:false})
})
it('old completion cannot free the replacement slot and late chunks are suppressed',async()=>{
  const saved=await invoke('fishVoice:import',event,voiceInput()) as typeof DEFAULT_SETTINGS
  const request={providerId:'fish-openrouter',modelId:saved.fishModel,text:'Hello',voice:{mode:'reference',voiceId:saved.fishVoice!.id}}
  const releases:(()=>void)[]=[],callbacks:((b:Uint8Array)=>void)[]=[]
  vi.spyOn(FishTtsProvider.prototype,'synthesizeStream').mockImplementation(async(_r,_s,onChunk)=>{callbacks.push(onChunk);await new Promise<void>(resolve=>releases.push(resolve));return {generationMs:1}})
  const old=invoke('speech:synthesizeStream',event,request,1)
  await vi.waitFor(()=>expect(releases).toHaveLength(1))
  invoke('speech:stop',event)
  const current=invoke('speech:synthesizeStream',event,request,2)
  await vi.waitFor(()=>expect(releases).toHaveLength(2))
  callbacks[0](new Uint8Array(2));expect(sender.send).not.toHaveBeenCalled()
  releases[0]();await old
  await expect(invoke('speech:synthesizeStream',event,request,3)).rejects.toThrow(/progress/)
  callbacks[1](new Uint8Array(2));expect(sender.send).toHaveBeenCalledWith('speech:chunk',2,expect.any(Uint8Array))
  releases[1]();await current
})
it.each(['geminiKey:save','geminiKey:select','geminiKey:remove','voiceProfile:import'])('reserves mutations across awaits in %s',async(channel)=>{
  let release!:()=>void
  const held=async()=>{await new Promise<void>(resolve=>{release=resolve});throw Error('fixture finished')}
  if(channel==='geminiKey:save') vi.spyOn(keyStore,'saveGeminiKey').mockImplementation(held)
  else if(channel==='voiceProfile:import') {
    const electron=await import('electron')
    Object.assign(electron.BrowserWindow,{fromWebContents:()=>undefined})
    Object.assign(dialog,{showOpenDialog:held})
  } else vi.spyOn(settingsStore,'setGeminiKeySource').mockImplementation(held)
  const mutation=invoke(channel,event,channel==='geminiKey:select' ? 'environment' : {}) as Promise<unknown>
  const rejected=expect(mutation).rejects.toThrow('fixture finished')
  await vi.waitFor(()=>expect(release).toBeTypeOf('function'))
  expect(()=>invoke('speech:sessionLock',event,true,'live')).toThrow(/operazione/)
  await expect(invoke('settings:update',event,{providerId:'gemini'})).rejects.toThrow(/operazione/)
  await expect(invoke('speech:synthesizeStream',event,{providerId:'gemini',modelId:DEFAULT_SETTINGS.geminiModel,text:'Hello',voice:{mode:'prebuilt',voiceId:'Kore'}},1)).rejects.toThrow(/operazione/)
  release();await rejected
  await expect(invoke('settings:update',event,{providerId:'gemini'})).resolves.toMatchObject({providerId:'gemini'})
})
