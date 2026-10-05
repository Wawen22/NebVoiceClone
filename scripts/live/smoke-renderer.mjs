/* global fixture */
// NEB Live browser smoke: synthetic PCM, IPC and TTS; no keys or provider calls.
import { createRequire } from 'node:module'
import { createServer } from 'node:http'
import { readFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import assert from 'node:assert/strict'

const require = createRequire(path.resolve('.superpowers/outlier-smoke/package.json'))
const { chromium } = require('playwright')
const root = path.resolve('out/renderer')
const fishMode = process.env.NEB_FISH_SMOKE === '1'
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
    const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname))
    if (!file.startsWith(root + path.sep)) throw new Error('Invalid path')
    const mime = file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html'
    const body = await readFile(file)
    res.writeHead(200, { 'Content-Type': mime }); res.end(body)
  } catch { res.writeHead(404); res.end() }
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const browser = await chromium.launch({ channel: 'msedge', headless: true })
let page
try {
  page = await browser.newPage({ viewport: { width: 1260, height: 850 } })
  await page.route('**/assets/client-*.js', (route) => route.fulfill({ contentType: 'text/javascript', body: `
export const LogLevel={CRITICAL:0};
export class SimliClient {
  constructor(_token,video){this.video=video;this.events=new Map();this.timers=[];window.fixture.avatarError=()=>this.events.get('error')?.();}
  on(name,callback){this.events.set(name,callback);}
  async start(){
    window.fixture.avatarStarts++;
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=512;
    const ctx=canvas.getContext('2d');let n=0;
    this.draw=setInterval(()=>{ctx.fillStyle=n++%2?'#467c86':'#76b297';ctx.fillRect(0,0,512,512);},40);
    this.video.srcObject=canvas.captureStream(25);
  }
  sendAudioData(){this.timers.push(setTimeout(()=>this.events.get('speaking')?.(),50),setTimeout(()=>this.events.get('silent')?.(),800));}
  ClearBuffer(){this.timers.forEach(clearTimeout);this.timers=[];}
  async stop(){window.fixture.avatarStops++;this.ClearBuffer();clearInterval(this.draw);this.video.srcObject=null;}
}` }))
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.addInitScript((fishMode) => {
    const target = { tabId: 1, windowId: 2, documentId: 'fixture-1', url: 'https://fixture.invalid/s2s', title: 'Synthetic S2S' }
    const listeners = new Set()
    const insertionListeners = new Set()
    let capture = { state: 'active', captureId: 'capture-1', target, message: 'Fixture audio active' }
    let sequence = 0, voiceFrames = 0
    const insertion = { supported: true, connected: true, stopAvailable: true, phase: 'ready', target, confirmed: 0, total: 0, message: 'Fixture connected' }
    const fixture = window.fixture = { avatarStarts: 0, avatarStops: 0, avatarLimits: [], spoken: [], played: [], filePlays: [], audioEvents: [], speechCodes: {}, holdPcm: false, adaptationRequests: [], adaptations: 0, holdAdapt: false, release: null, providerUnavailable: false, modelRequests: [], holdModel: false, releaseModel: null, holdVoice: false, releaseVoice: null, holdUserVoice: false, releaseUserVoice: null,
      disconnect: () => {
        capture = { state: 'inactive', captureId: null, target: null, message: 'Edge fixture disconnected' }
        for (const listener of listeners) listener({ type: 'status', status: capture })
        Object.assign(insertion, { connected: false, phase: 'idle', target: null })
        for (const listener of insertionListeners) listener(insertion)
      },
      voice: (frames = 3) => { voiceFrames = frames },
      replaceCapture: () => {
        capture = { ...capture, captureId: 'capture-2', target: { ...target, tabId: 99, documentId: 'fixture-2' } }
        for (const listener of listeners) listener({ type: 'status', status: capture })
      }
    }
    const profile = { replicatedVoice: null, selectedVoiceId: 'Kore' }
    const settings = { schemaVersion: 1, providerId: fishMode ? 'fish-openrouter' : 'gemini', fishModel:'fish-audio/s2.1-pro-free:free', fishVoice:null, geminiModel: 'gemini-3.8-flash-tts', geminiKeySource: 'environment', geminiVoiceId: 'Kore', replicatedVoice: null,
      voiceProfiles: { environment: profile, project: profile, saved: profile }, outputDeviceId: 'cable', outputVolume: 0.85, monitorDeviceId: '', saveScriptHistory: false }
    const noopSubscription = () => () => {}
    Object.defineProperty(navigator.mediaDevices, 'enumerateDevices', { value: async () => [{ kind: 'audiooutput', deviceId: 'cable', label: 'CABLE Input (fixture)' }, { kind: 'audiooutput', deviceId: 'headphones', label: 'Headphones Realtek (fixture)' }] })
    class Audio {
      volume = 1; currentTime = 0; sinkId = 'default'; src = ''; srcObject = null
      async setSinkId(id) { this.sinkId = id }
      async play() { if (this.src && !this.srcObject) fixture.filePlays.push({ sinkId: this.sinkId, volume: this.volume }) }
      pause() {}
      load() {}
      removeAttribute() {}
    }
    class AudioContext {
      currentTime = 0
      createMediaStreamDestination() { return { stream: {} } }
      createBuffer(_channels, length) { const data = new Float32Array(length); return { data, duration: length / 24000, getChannelData: () => data } }
      createBufferSource() { let timer; return { buffer: null, onended: null, connect() {}, start(at) { const speech = fixture.speechCodes[Math.round(this.buffer.data[0] * 32768)]; fixture.played.push(speech.text); fixture.audioEvents.push({ ...speech, event: 'start', at: performance.now() }); timer = setTimeout(() => { fixture.audioEvents.push({ ...speech, event: 'end', at: performance.now() }); this.onended?.() }, (at + this.buffer.duration) * 1000) }, stop() { clearTimeout(timer); this.onended?.() } } }
      async resume() {}
      async close() {}
    }
    window.Audio = Audio
    HTMLMediaElement.prototype.setSinkId = async () => {}
    const playMedia = HTMLMediaElement.prototype.play
    HTMLMediaElement.prototype.play = function () { return this instanceof HTMLAudioElement ? Promise.resolve() : playMedia.call(this) }
    window.AudioContext = AudioContext
    window.neb = {
      getAvatarStatus: async () => ({ configured: true }),
      createAvatarSession: async (_face, limits) => { fixture.avatarLimits.push(limits); return { sessionToken: 'fixture', iceServers: [] } },
      getAppInfo: async () => ({ electron: 'fixture', node: 'fixture', platform: 'win32', geminiConfigured: true }),
      getSettings: async () => ({ ...settings }), updateSettings: async (patch) => ({ ...Object.assign(settings, patch) }),
      getGeminiKeyStatus: async () => ({ activeSource: 'environment', environmentConfigured: true, projectConfigured: false, environmentLabel: 'Fixture', projectLabel: 'Fixture', savedLabel: null, secureStorageAvailable: false }),
      checkGemini: async () => ({ ready: !fishMode, message: fishMode ? 'Gemini unavailable (fixture)' : 'Gemini connected' }),
      getSpeechProviderStatus: async (id) => ({ready:id==='fish-openrouter' ? Boolean(settings.fishVoice) : !fishMode,message:'Fixture speech ready'}),
      setSpeechSessionLock: async () => {},
      importFishVoice: async () => ({...Object.assign(settings,{fishVoice:{id:'12345678-1234-4123-8123-123456789abc',displayName:'Synthetic Fish',createdAt:'2026-10-05T00:00:00Z'}})}),
      removeFishVoice: async () => ({...Object.assign(settings,{fishVoice:null})}),
      getOutlierData: async () => ({ schemaVersion: 1, projects: [{ id: 's2s', name: 'S2S', notes: '', integration: 's2s', archived: false }], charactersPerMinute: 600 }),
      getInsertionStatus: async () => insertion,
      getOutlierSetup: async () => ({ installed: true, extensionId: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', extensionPath: 'fixture' }),
      onInsertionStatus: (listener) => { insertionListeners.add(listener); return () => insertionListeners.delete(listener) }, onConversationRequested: noopSubscription, onStopRequested: noopSubscription,
      setZoomFactor: () => {}, getZoomFactor: () => 1,
      getLiveConfig: async () => ({ schemaVersion: 1, background: 'Esperienza documentata in sviluppo full-stack.', persona: 'Diretto e naturale.', selectedProfileId: 'full-stack', profiles: [{ id: 'full-stack', name: 'Colloquio full-stack', context: 'Colloquio tecnico', language: 'auto', tone: 'professional' }] }),
      saveLiveConfig: async (config) => config,
      cancelLiveTurn: async () => {},
      generateLiveTurn: async () => ({ action: 'speak', transcript: 'Come affronti il debugging?', text: 'Partirei dal problema concreto.', reason: 'Domanda conclusa', costUsd: 0.002, qwenMs: 80 }),
      getS2SProviderStatus: async () => ({ ready: !fixture.providerUnavailable, model: 'qwen/qwen3.8-omni-flash' }),
      getS2SAudioStatus: async () => capture,
      onS2SAudio: (listener) => { listeners.add(listener); return () => listeners.delete(listener) },
      adaptS2STurn: async (request) => {
        fixture.adaptations++; fixture.adaptationRequests.push(request)
        const result = { action: request.nextLine ? 'speak' : 'complete', transcript: request.transcript ?? 'La soluzione è economica.', liveState: 'Il modello propone una soluzione economica per la classe.', nextText: request.nextLine ? 'E quali limiti ha?' : '', reason: 'Risposta conclusa', qwenMs: 80, costUsd: 0.002 }
        if (fixture.holdAdapt) return new Promise((resolve) => { fixture.release = () => resolve(result) })
        return result
      },
      cancelS2SAdaptation: async () => {}, stopS2SAudioCapture: async () => {}, stopGeneration: async () => {}, stopInsertion: async () => {},
      generateS2SSimulationReply: async (request) => {
        fixture.modelRequests.push(request)
        const result = { text: `La soluzione è economica e puoi provarla con una classe. Risposta ${fixture.modelRequests.length}.`, modelMs: 30, costUsd: 0.001 }
        if (fixture.holdModel) return new Promise((resolve) => { fixture.releaseModel = () => resolve(result) })
        return result
      },
      cancelS2SSimulationReply: async () => {},
      synthesizeStream: async (request, onChunk) => {
        fixture.spoken.push(request.text)
        fixture.speechRequests ??= []; fixture.speechRequests.push(request)
        if (fixture.holdLiveVoice) await new Promise((resolve) => { fixture.releaseLiveVoice = resolve })
        if (request.voice.voiceId === 'Kore' && fixture.holdUserVoice) await new Promise((resolve) => { fixture.releaseUserVoice = resolve })
        if (request.voice.voiceId === 'Puck' && fixture.holdVoice) await new Promise((resolve) => { fixture.releaseVoice = resolve })
        const code = 2000 + fixture.spoken.length
        fixture.speechCodes[code] = { text: request.text, voice: request.voice.voiceId }
        const pcm = new Uint8Array(request.voice.voiceId === 'Puck' ? 96000 : fixture.liveSpeechLong ? 240000 : 14400)
        { const view = new DataView(pcm.buffer); for (let i = 0; i < pcm.length / 2; i++) view.setInt16(i * 2, code, true) }
        onChunk(pcm); return { generationMs: 10 }
      }
    }
    setInterval(() => {
      if (fixture.holdPcm) return
      const pcm = new Uint8Array(3200)
      if (voiceFrames > 0) { voiceFrames--; const view = new DataView(pcm.buffer); for (let i = 0; i < 1600; i++) view.setInt16(i * 2, 2000, true) }
      for (const listener of listeners) listener({ type: 'pcm', captureId: capture.captureId, sequence: sequence++, pcm })
    }, 100)
    const api = window.neb
    const getConfig = api.getLiveConfig
    let config
    fixture.liveRequests = []; fixture.saved = []; fixture.cancelled = []; fixture.holdLive = false; fixture.liveRelease = null; fixture.holdSave = false; fixture.saveRelease = null; fixture.liveCost = 0.002; fixture.liveFailure = ''; fixture.liveWait = false
    api.getLiveConfig = async () => structuredClone(config ?? await getConfig())
    api.saveLiveConfig = async (value) => { if (fixture.holdSave) await new Promise((resolve) => { fixture.saveRelease = resolve }); config = structuredClone(value); fixture.saved.push(config); return config }
    api.generateLiveTurn = async (request) => {
      fixture.liveRequests.push(request)
      const reply = fixture.liveIncomplete ? { action: 'wait', transcript: '', text: '', reason: 'Decisione incompleta dopo la correzione', costUsd: null, knownCostUsd: 0.004, repairAttempted: true, retryable: true, qwenMs: 50 }
        : fixture.liveFailure ? { action: 'pause', transcript: '', text: '', reason: fixture.liveFailure, costUsd: fixture.liveCost, qwenMs: 50 }
        : fixture.liveWait && !request.endOfTurn ? { action: 'wait', transcript: 'Come affronti il debugging?', text: '', reason: 'Intervento incompleto', costUsd: fixture.liveCost, qwenMs: 50 }
        : { action: 'speak', transcript: request.opening ? '' : 'Come affronti il debugging?', text: request.opening ? 'Ciao, sono Neb. Piacere di conoscerti.' : 'Partirei dal problema concreto e cercherei la causa.', reason: 'Turno completo', costUsd: fixture.liveCost, qwenMs: 50 }
      if (request.visualOnly && reply.action === 'speak') { reply.transcript = ''; reply.text = 'Il ciclo accede a un elemento oltre la fine dell’array.' }
      if (fixture.holdLive) return new Promise((resolve) => { fixture.liveRelease = () => resolve(reply) })
      return reply
    }
    api.cancelLiveTurn = async (id) => fixture.cancelled.push(id)
    const materialImage = { name: 'Screenshot.png', dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4//8/AAX+Av4N70a4AAAAAElFTkSuQmCC' }
    fixture.materialImage = materialImage
    fixture.holdClipboard = false; fixture.clipboardRelease = null; fixture.captureCalls = 0
    api.getLiveCaptureSources = async () => [{ id: 'window:5:0', name: 'Coding interview (fixture)', thumbnail: materialImage.dataUrl }]
    api.captureLiveSource = async () => { fixture.captureCalls++; return { ...materialImage, name: 'Coding interview (fixture)' } }
    api.readLiveClipboardImage = async () => { if (fixture.holdClipboard) await new Promise((resolve) => { fixture.clipboardRelease = resolve }); return { ...materialImage, name: 'Screenshot dagli appunti' } }
    api.importLiveImage = async (_data, name) => ({ ...materialImage, name })
  }, fishMode)
  await page.goto(`http://127.0.0.1:${server.address().port}`)
  if (fishMode) {
    await page.getByRole('button',{name:'Impostazioni',exact:true}).click()
    const sample=Buffer.alloc(44+24000*2*5)
    sample.write('RIFF');sample.writeUInt32LE(sample.length-8,4);sample.write('WAVEfmt ',8);sample.writeUInt32LE(16,16);sample.writeUInt16LE(1,20);sample.writeUInt16LE(1,22);sample.writeUInt32LE(24000,24);sample.writeUInt32LE(48000,28);sample.writeUInt16LE(2,32);sample.writeUInt16LE(16,34);sample.write('data',36);sample.writeUInt32LE(sample.length-44,40)
    await page.getByLabel('Campione Fish WAV').setInputFiles({name:'synthetic.wav',mimeType:'audio/wav',buffer:sample})
    await page.getByLabel('Trascrizione esatta del campione').fill('Synthetic reference transcript')
    await page.getByRole('checkbox',{name:/Autorizzo l'invio/}).check()
    await page.getByRole('button',{name:'Salva riferimento Fish',exact:true}).click()
    await page.getByText('Riferimento Fish salvato cifrato.',{exact:true}).waitFor()
    const artifacts=path.resolve('.superpowers/fish-smoke');await mkdir(artifacts,{recursive:true})
    await page.screenshot({path:path.join(artifacts,'fish-settings-desktop.png'),fullPage:true})
    await page.setViewportSize({width:980,height:720})
    await page.screenshot({path:path.join(artifacts,'fish-settings-compact.png'),fullPage:true})
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Fish settings fit the compact window')
    await page.setViewportSize({width:1260,height:850})
    await page.getByRole('button',{name:'Console',exact:true}).click()
    await page.getByRole('textbox',{name:'Testo da pronunciare'}).fill('Synthetic Fish Console test')
    await page.getByRole('button',{name:/^Pronuncia/}).click()
    await page.waitForFunction(()=>fixture.speechRequests?.length>0)
    assert.equal(await page.evaluate(()=>fixture.speechRequests.at(-1).providerId),'fish-openrouter')
    await page.waitForFunction(()=>document.querySelector('.console-composer button')?.textContent.includes('Pronuncia'))
    await page.getByRole('button',{name:/^Riascolta/}).click()
    await page.getByRole('button',{name:/^Stop/}).click()
  }
  await page.getByRole('button', { name: 'NEB Live', exact: true }).click()
  const artifacts = path.resolve('.superpowers/live-smoke')
  await mkdir(artifacts, { recursive: true })
  const start = page.getByRole('button', { name: 'Avvia conversazione', exact: true })
  await start.waitFor()
  await page.waitForFunction(() => { const button = document.querySelector('.neb-live-start'); return button && !button.disabled })
  assert.equal(await page.locator('#neb-live-configuration').count(), 0, 'configuration starts collapsed')
  await page.screenshot({ path: path.join(artifacts, 'neb-live-empty.png') })
  await page.getByRole('button', { name: 'Configura', exact: true }).click()
  await page.getByRole('tab', { name: 'Profilo', exact: true }).focus()
  await page.keyboard.press('ArrowRight')
  assert.equal(await page.getByRole('tab', { name: 'Audio', exact: true }).getAttribute('aria-selected'), 'true')
  await page.keyboard.press('ArrowLeft')
  await page.locator('#neb-live-context').fill('Intervista sulle mie competenze AI e full-stack')
  await page.getByRole('button', { name: 'Aggiungi profilo', exact: true }).click()
  await page.locator('#neb-live-name').fill('Intervista personale')
  await page.locator('#neb-live-context').fill('Domande tecniche e approfondimenti')
  await page.locator('#neb-live-language').selectOption('en')
  assert.equal(await page.locator('#neb-live-pace').inputValue(), '1500', 'rapid pace is the initial Live default')
  await page.locator('#neb-live-pace').selectOption('2500')
  assert.equal(await page.locator('#neb-live-pace').inputValue(), '2500', 'natural pace remains selectable')
  await page.locator('#neb-live-pace').selectOption('1500')
  await page.getByRole('tab', { name: 'Dettagli', exact: true }).click()
  await page.locator('#neb-live-duration').fill('45')
  await page.locator('#neb-live-turn-limit').fill('100')
  await page.locator('#neb-live-budget').fill('1.5')
  await page.getByRole('tab', { name: 'Profilo', exact: true }).click()
  await page.evaluate(() => { fixture.holdSave = true })
  await start.click()
  await page.waitForFunction(() => fixture.saveRelease !== null)
  await page.getByRole('button', { name: 'Nuova conversazione', exact: true }).click()
  await page.evaluate(() => { fixture.saveRelease(); fixture.holdSave = false; fixture.saveRelease = null })
  await page.waitForFunction(() => { const button = document.querySelector('.neb-live-start'); return button && !button.disabled })
  assert.equal(await page.evaluate(() => fixture.liveRequests.length), 0, 'New conversation during profile save must cancel pending start')
  await start.click()
  await page.waitForFunction(() => document.querySelector('.neb-live-state')?.textContent.includes('In ascolto'))
  assert.equal(await page.evaluate(() => fixture.liveRequests.length), 0, 'listen-first must not invent an opening')
  assert.equal(await page.locator('#neb-live-name').isDisabled(), true)
  assert.equal(await page.locator('#neb-live-duration').isDisabled(), true)
  assert(await page.locator('.neb-live-session-meta').innerText().then((text) => text.includes('/ 100 turni')))
  await page.evaluate(() => { fixture.holdLiveVoice = true; fixture.voice(5) })
  await page.waitForFunction(() => fixture.releaseLiveVoice !== undefined)
  assert.equal(await page.locator('.neb-live-turn-interlocutor').count(), 1, 'remote transcript is visible while the voice has not started')
  assert.equal(await page.locator('.neb-live-turn-neb').count(), 0, 'NEB text is not presented as already spoken during preparation')
  assert.equal(await page.evaluate(() => fixture.speechRequests.at(-1).language), 'en')
  if(fishMode) assert.equal(await page.evaluate(()=>fixture.speechRequests.at(-1).modelId),'fish-audio/s2.1-pro-free:free')
  else assert(await page.evaluate(() => fixture.speechRequests.at(-1).style.includes('English only')))
  await page.evaluate(() => { fixture.holdLiveVoice = false; fixture.releaseLiveVoice() })
  await page.waitForFunction(() => document.querySelector('.neb-live-turn-neb')?.textContent.includes('Partirei dal problema concreto'), { timeout: 10000 })
  assert.equal(await page.evaluate(() => fixture.liveRequests[0].profile.name), 'Intervista personale')
  assert.equal(await page.evaluate(() => fixture.liveRequests[0].profile.context), 'Domande tecniche e approfondimenti')
  assert.equal(await page.evaluate(() => fixture.saved.at(-1).selectedProfileId), await page.locator('#neb-live-profile').inputValue())
  assert.deepEqual(await page.evaluate(() => fixture.saved.at(-1).limits), { durationMinutes: 45, maxTurns: 100, maxCostUsd: 1.5 })
  await page.getByRole('button', { name: 'Chiudi configurazione', exact: true }).click()
  await page.waitForFunction(() => document.querySelector('.neb-live-state')?.textContent.includes('In ascolto'))
  assert(await page.locator('.neb-live').evaluate((node) => node.scrollHeight <= node.clientHeight + 1), 'desktop uses transcript scrolling, not a second page scrollbar')
  await page.screenshot({ path: path.join(artifacts, 'neb-live.png') })
  await page.getByRole('button', { name: 'Prendi controllo', exact: true }).click()
  await page.getByText('Hai il controllo.', { exact: false }).waitFor()
  await page.getByRole('button', { name: 'Configura', exact: true }).click()
  await page.getByRole('tab', { name: 'Dettagli', exact: true }).click()
  assert.equal(await page.locator('#neb-live-turn-limit').isDisabled(), false)
  const historyBeforeExtension = await page.locator('.neb-live-turn').count()
  await page.locator('#neb-live-turn-limit').fill('120')
  assert.equal(await page.getByRole('button', { name: 'Riprendi ascolto', exact: true }).isDisabled(), true, 'save changed limits before resuming')
  await page.getByRole('button', { name: 'Salva limiti', exact: true }).click()
  await page.waitForFunction(() => document.querySelector('.neb-live-session-meta')?.textContent.includes('/ 120 turni'))
  assert.equal(await page.locator('.neb-live-turn').count(), historyBeforeExtension, 'extending limits keeps the transcript')
  assert.equal(await page.evaluate(() => fixture.saved.at(-1).limits.maxTurns), 120)
  await page.getByRole('button', { name: 'Chiudi configurazione', exact: true }).click()
  await page.getByRole('button', { name: 'Console', exact: true }).click()
  assert.equal(await page.locator('.console-composer button').filter({ hasText: 'Genero' }).isDisabled(), true)
  await page.getByRole('button', { name: 'Impostazioni', exact: true }).click()
  assert(await page.locator('.settings-session-lock[disabled]').count())
  await page.getByRole('button', { name: 'NEB Live', exact: true }).click()
  await page.getByRole('button', { name: 'Riprendi ascolto', exact: true }).click()
  await page.waitForFunction(() => document.querySelector('.neb-live-state')?.textContent.includes('In ascolto'))
  await page.getByRole('button', { name: 'Stop', exact: true }).click()
  const selectedProfile = await page.locator('#neb-live-profile').inputValue()
  await page.getByRole('button', { name: 'Nuova conversazione', exact: true }).click()
  assert.equal(await page.locator('.neb-live-turn').count(), 0)
  assert.equal(await page.locator('#neb-live-profile').inputValue(), selectedProfile)
  await page.waitForFunction(() => { const button = document.querySelector('.neb-live-start'); return button && !button.disabled })
  await page.getByRole('button', { name: 'Configura', exact: true }).click()
  await page.getByRole('tab', { name: 'Profilo', exact: true }).click()
  await page.locator('#neb-live-opening').selectOption('opening')
  await page.evaluate(() => { fixture.holdLive = true })
  const spoken = await page.evaluate(() => fixture.spoken.length)
  await start.click()
  await page.waitForFunction(() => fixture.liveRelease !== null)
  await page.getByRole('button', { name: 'Stop', exact: true }).click()
  await page.evaluate(() => { fixture.liveRelease(); fixture.holdLive = false; fixture.liveRelease = null })
  await page.waitForFunction(() => document.querySelector('.neb-live-state')?.textContent.includes('Fermato'))
  assert.equal(await page.evaluate(() => fixture.spoken.length), spoken, 'late reasoning must not speak after Stop')
  assert(await page.evaluate(() => fixture.cancelled.length > 0))
  await page.evaluate(() => { fixture.holdLive = true })
  await start.click()
  await page.waitForFunction(() => fixture.liveRelease !== null)
  await page.getByRole('button', { name: 'Nuova conversazione', exact: true }).click()
  await page.evaluate(() => { fixture.liveRelease(); fixture.holdLive = false; fixture.liveRelease = null })
  await page.waitForFunction(() => document.querySelector('.neb-live-state')?.textContent.includes('Pronto'))
  assert.equal(await page.evaluate(() => fixture.spoken.length), spoken, 'late reasoning must not speak after New conversation')
  assert.equal(await page.locator('.neb-live-turn').count(), 0)
  assert(await page.locator('.neb-live-session-meta').innerText().then((text) => text.includes('$0.0000')))
  await page.evaluate(() => { fixture.liveCost = null })
  await start.click()
  await page.waitForFunction(() => document.querySelector('.neb-live-turn-neb')?.textContent.includes('Ciao, sono Neb'), { timeout: 10000 })
  await page.locator('.neb-live-session-footer').getByText('Costo OpenRouter parziale:', { exact: false }).waitFor()
  await page.waitForFunction(() => document.querySelector('.neb-live-state')?.textContent.includes('In ascolto'))
  await page.getByRole('button', { name: 'Pausa', exact: true }).click()
  await page.getByRole('button', { name: 'Riprendi ascolto', exact: true }).click()
  await page.waitForFunction(() => document.querySelector('.neb-live-state')?.textContent.includes('In ascolto'))
  await page.keyboard.press('Escape')
  await start.waitFor()
  await page.evaluate(() => { fixture.liveFailure = 'Qwen timeout (35 secondi).' })
  await start.click()
  await page.waitForFunction(() => document.querySelector('.neb-live-state')?.textContent.includes('In pausa'))
  assert.equal(await page.locator('.neb-live-session-status').innerText(), 'Qwen timeout (35 secondi).', 'missing cost must not hide the provider error')
  await page.evaluate(() => { fixture.liveFailure = ''; fixture.liveCost = 0.002 })
  await page.getByRole('button', { name: 'Riprendi ascolto', exact: true }).click()
  await page.waitForFunction(() => document.querySelector('.neb-live-state')?.textContent.includes('In ascolto'))
  await page.evaluate(() => fixture.voice(5))
  await page.waitForFunction(() => document.querySelector('.neb-live-turn-neb')?.textContent.includes('Partirei dal problema concreto'), { timeout: 10000 })
  await page.keyboard.press('Escape')
  await start.waitFor()
  await start.click()
  await page.waitForFunction(() => document.querySelector('.neb-live-state')?.textContent.includes('In ascolto'), { timeout: 10000 })
  await page.evaluate(() => { fixture.holdPcm = true; fixture.replaceCapture() })
  await page.waitForFunction(() => document.querySelector('.neb-live-state')?.textContent.includes('In pausa'))
  assert.equal(await page.getByRole('button', { name: 'Riprendi ascolto', exact: true }).isDisabled(), true, 'a new capture must receive PCM before Resume is enabled')
  await page.evaluate(() => { fixture.holdPcm = false })
  await page.getByRole('button', { name: 'Riprendi ascolto', exact: true }).click()
  await page.getByText('Scheda cambiata:', { exact: false }).waitFor()
  await page.getByRole('button', { name: 'Stop', exact: true }).click()
  await page.screenshot({ path: path.join(artifacts, 'neb-live-config.png') })
  await page.locator('#neb-live-opening').selectOption('listen')
  await page.evaluate(() => { fixture.liveWait = true })
  await start.click()
  assert.equal(await page.getByRole('button', { name: 'Rispondi ora', exact: true }).isDisabled(), true, 'manual response requires a captured question')
  await page.evaluate(() => fixture.voice(8))
  await page.getByText('Intervento incompleto · ascolto;', { exact: false }).waitFor()
  const waitedRequest = await page.evaluate(() => fixture.liveRequests.at(-1))
  await page.waitForFunction(() => document.querySelector('.neb-live-turn-neb')?.textContent.includes('Partirei dal problema concreto'), { timeout: 15000 })
  const recheckedRequest = await page.evaluate(() => fixture.liveRequests.at(-1))
  assert.equal(recheckedRequest.endOfTurn, true, 'continued silence rechecks wait without new speech')
  assert.equal(recheckedRequest.audioPcm.length, waitedRequest.audioPcm.length, 'recheck keeps the full question without accumulating extra silence')
  await page.waitForFunction(() => document.querySelector('.neb-live-state')?.textContent.includes('In ascolto'))
  await page.evaluate(() => fixture.voice(8))
  await page.getByText('Intervento incompleto · ascolto;', { exact: false }).waitFor()
  const requestsBeforeManual = await page.evaluate(() => fixture.liveRequests.length)
  await page.getByRole('button', { name: 'Rispondi ora', exact: true }).click()
  await page.waitForFunction(() => document.querySelectorAll('.neb-live-turn-neb').length === 2)
  assert.equal(await page.evaluate(() => fixture.liveRequests.length), requestsBeforeManual + 1)
  assert.equal(await page.evaluate(() => fixture.liveRequests.at(-1).endOfTurn), true)
  await page.waitForFunction(() => document.querySelector('.neb-live-state')?.textContent.includes('In ascolto'))
  await page.evaluate(() => { fixture.liveWait = false; fixture.liveFailure = 'Errore Qwen sintetico: domanda conservata'; fixture.voice(8) })
  await page.waitForFunction(() => document.querySelector('.neb-live-state')?.textContent.includes('In pausa'))
  const failedAudioLength = await page.evaluate(() => fixture.liveRequests.at(-1).audioPcm.length)
  await page.evaluate(() => { fixture.liveFailure = '' })
  await page.getByRole('button', { name: 'Riprendi ascolto', exact: true }).click()
  await page.getByRole('button', { name: 'Rispondi ora', exact: true }).click()
  await page.waitForFunction(() => document.querySelectorAll('.neb-live-turn-neb').length === 3)
  assert.equal(await page.evaluate(() => fixture.liveRequests.at(-1).audioPcm.length), failedAudioLength, 'manual retry after provider failure retains the unanswered audio')
  await page.waitForFunction(() => document.querySelector('.neb-live-state')?.textContent.includes('In ascolto'))
  await page.evaluate(() => { fixture.liveIncomplete = true; fixture.voice(8) })
  await page.waitForFunction(() => document.querySelector('.neb-live-status-copy')?.textContent.includes('domanda conservata') || document.querySelector('.neb-live')?.textContent.includes('Qwen non ha completato'))
  assert.equal(await page.getByRole('button', { name: 'Riprendi ascolto', exact: true }).count(), 0, 'incomplete model output must not pause the conversation')
  assert.equal(await page.getByRole('button', { name: 'Rispondi ora', exact: true }).isEnabled(), true)
  const incompleteAudio = await page.evaluate(() => fixture.liveRequests.at(-1).audioPcm.length)
  await page.evaluate(() => { fixture.liveIncomplete = false })
  await page.getByRole('button', { name: 'Rispondi ora', exact: true }).click()
  await page.waitForFunction(() => document.querySelectorAll('.neb-live-turn-neb').length === 4)
  assert.equal(await page.evaluate(() => fixture.liveRequests.at(-1).audioPcm.length), incompleteAudio)
  await page.waitForFunction(() => document.querySelector('.neb-live-state')?.textContent.includes('In ascolto'))
  await page.evaluate(() => { fixture.liveIncomplete = true; fixture.voice(8) })
  await page.waitForFunction(() => document.querySelector('.neb-live')?.textContent.includes('riprovo automaticamente'))
  const autoRecoveryAudio = await page.evaluate(() => fixture.liveRequests.at(-1).audioPcm.length)
  await page.evaluate(() => { fixture.liveIncomplete = false })
  await page.waitForFunction(() => document.querySelectorAll('.neb-live-turn-neb').length === 5)
  assert.equal(await page.evaluate(() => fixture.liveRequests.at(-1).endOfTurn), true)
  assert.equal(await page.evaluate(() => fixture.liveRequests.at(-1).audioPcm.length), autoRecoveryAudio, 'automatic recovery must reuse the question without user intervention')
  await page.getByRole('button', { name: 'Stop', exact: true }).click()
  await page.getByRole('button', { name: 'Chiudi configurazione', exact: true }).click()
  await page.getByRole('button', { name: 'Nuova conversazione', exact: true }).click()
  await page.getByRole('button', { name: 'Cattura finestra', exact: true }).click()
  await page.getByRole('button', { name: 'Coding interview (fixture)', exact: true }).click()
  await page.waitForFunction(() => document.querySelectorAll('.neb-live-material-chip').length === 1)
  await page.evaluate(() => { fixture.holdLive = true; fixture.liveSpeechLong = true; fixture.liveRelease = null })
  await start.click(); await page.evaluate(() => fixture.voice(8))
  await page.waitForFunction(() => fixture.liveRelease !== null)
  const beforeMaterialUpdate = await page.evaluate(() => { fixture.staleRelease = fixture.liveRelease; return fixture.liveRequests.length })
  await page.getByRole('button', { name: 'Snippet', exact: true }).click()
  await page.locator('#neb-live-code').fill('for (let i = 0; i <= items.length; i++) total += items[i].price;')
  await page.getByRole('button', { name: 'Aggiungi snippet', exact: true }).click()
  await page.waitForFunction((previous) => fixture.liveRequests.length > previous, beforeMaterialUpdate)
  assert.equal(await page.evaluate(() => fixture.liveRequests.at(-1).materials.length), 2, 'a pending answer receives the new screenshot and code')
  await page.evaluate(() => { fixture.holdLive = false; fixture.staleRelease(); fixture.liveRelease(); fixture.liveRelease = null })
  await page.waitForFunction(() => document.querySelector('.neb-live-state')?.textContent.includes('NEB sta parlando'))
  const cancellationsBeforeClipboard = await page.evaluate(() => fixture.cancelled.length)
  await page.getByRole('button', { name: 'Incolla screenshot', exact: true }).click()
  await page.waitForFunction(() => document.querySelectorAll('.neb-live-material-chip').length === 3)
  assert.equal(await page.evaluate(() => fixture.cancelled.length), cancellationsBeforeClipboard, 'adding a screenshot must not interrupt active speech')
  assert.equal(await page.getByRole('button', { name: 'Carica immagine', exact: true }).isDisabled(), true, 'material count remains bounded')
  await page.getByRole('button', { name: 'Rimuovi Snippet di codice', exact: true }).click()
  const fixturePng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4//8/AAX+Av4N70a4AAAAAElFTkSuQmCC', 'base64')
  await page.getByLabel('Carica screenshot PNG o JPEG').setInputFiles({ name: 'uploaded-code.png', mimeType: 'image/png', buffer: fixturePng })
  await page.waitForFunction(() => document.querySelectorAll('.neb-live-material-chip').length === 3)
  await page.getByRole('button', { name: 'Rimuovi Coding interview (fixture)', exact: true }).click()
  await page.evaluate(() => {
    const data = new DataTransfer()
    const base64 = fixture.materialImage.dataUrl.split(',')[1]
    data.items.add(new File([Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))], 'pasted-code.png', { type: 'image/png' }))
    document.querySelector('.neb-live').dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }))
  })
  await page.waitForFunction(() => document.querySelectorAll('.neb-live-material-chip').length === 3)
  await page.waitForFunction(() => document.querySelector('.neb-live-state')?.textContent.includes('In ascolto'))
  await page.getByRole('button', { name: 'Rispondi ora', exact: true }).click()
  await page.waitForFunction(() => document.querySelectorAll('.neb-live-turn-neb').length === 2)
  assert.equal(await page.evaluate(() => fixture.liveRequests.at(-1).visualOnly), true)
  assert.equal(await page.locator('.neb-live-turn-interlocutor').count(), 1, 'visual-only analysis must not invent another interviewer question')
  await page.getByRole('button', { name: 'Nuova conversazione', exact: true }).click()
  await page.evaluate(() => { fixture.holdClipboard = true; fixture.clipboardRelease = null })
  await page.getByRole('button', { name: 'Incolla screenshot', exact: true }).click()
  await page.waitForFunction(() => fixture.clipboardRelease !== null)
  await page.getByRole('button', { name: 'Nuova conversazione', exact: true }).click()
  await page.evaluate(() => { fixture.clipboardRelease(); fixture.holdClipboard = false; fixture.liveSpeechLong = false })
  await page.getByRole('button', { name: 'Cattura finestra', exact: true }).waitFor({ state: 'visible' })
  await page.waitForFunction(() => !document.querySelector('.neb-live-material-actions button').disabled)
  assert.equal(await page.locator('.neb-live-material-chip').count(), 0, 'a late image cannot repopulate a new conversation')
  await page.getByRole('button', { name: 'Cattura finestra', exact: true }).click()
  await page.waitForFunction(() => document.querySelectorAll('.neb-live-material-chip').length === 1)
  assert.equal(await page.evaluate(() => fixture.captureCalls), 2, 'the selected window supports subsequent one-click capture')
  assert.equal(await page.getByRole('region', { name: 'Scegli la finestra da acquisire' }).count(), 0)
  await page.screenshot({ path: path.join(artifacts, 'neb-live-materials.png') })
  await page.getByRole('button', { name: 'Nuova conversazione', exact: true }).click()
  await page.setViewportSize({ width: 620, height: 740 })
  assert(await page.locator('.neb-live').evaluate((node) => node.scrollWidth <= node.clientWidth + 1), 'Live must fit compact windows')
  assert(await start.evaluate((node) => { const rect = node.getBoundingClientRect(); return rect.top >= 0 && rect.bottom <= innerHeight }), 'session controls stay visible in compact windows')
  await page.screenshot({ path: path.join(artifacts, 'neb-live-compact.png') })
  await page.getByRole('button', { name: 'Configura', exact: true }).click()
  assert(await page.getByRole('button', { name: 'Chiudi configurazione', exact: true }).evaluate((node) => { const rect = node.getBoundingClientRect(); return rect.top >= 0 && rect.bottom <= innerHeight }))
  await page.getByRole('button', { name: 'Chiudi configurazione', exact: true }).click()
  await page.setViewportSize({ width: 1260, height: 850 })
  await page.getByRole('checkbox', { name: 'Attiva avatar' }).check()
  await start.click()
  await page.waitForFunction(() => document.querySelector('.neb-live-state')?.textContent.includes('In ascolto') && document.querySelector('.avatar-status')?.textContent.includes('Avatar pronto'))
  const liveStarts = await page.evaluate(() => fixture.avatarStarts)
  assert.equal(liveStarts, 1, 'Live connects before listening')
  assert((await page.evaluate(() => fixture.avatarLimits.at(-1).maxIdleTime)) > 120)
  for (let turn = 0; turn < 2; turn++) {
    const previous = await page.locator('.neb-live-turn-neb').count()
    await page.evaluate(() => fixture.voice(3))
    await page.waitForFunction((count) => document.querySelectorAll('.neb-live-turn-neb').length > count, previous)
    await page.waitForFunction(() => document.querySelector('.neb-live-state')?.textContent.includes('In ascolto'))
    assert.equal(await page.evaluate(() => fixture.avatarStarts), liveStarts, 'reply cleanup must not reconnect Simli')
    assert.equal(await page.evaluate(() => fixture.avatarStops), 0, 'reply cleanup keeps the avatar connected')
    assert((await page.locator('.avatar-status').innerText()).includes('Avatar pronto'))
  }
  const video = page.locator('video[aria-label="Anteprima avatar"]')
  const beforeIdle = await video.evaluate((node) => node.getVideoPlaybackQuality().totalVideoFrames)
  await new Promise((resolve) => setTimeout(resolve, 2200))
  assert((await video.evaluate((node) => node.getVideoPlaybackQuality().totalVideoFrames)) > beforeIdle, 'idle avatar stays in motion')
  await page.getByRole('button', { name: 'Pausa', exact: true }).click()
  await page.waitForFunction(() => document.querySelector('.neb-live-state')?.textContent.includes('In pausa'))
  assert.equal(await video.evaluate((node) => node.srcObject), null)
  await page.getByRole('button', { name: 'Riprendi ascolto', exact: true }).click()
  await page.waitForFunction(() => document.querySelector('.neb-live-state')?.textContent.includes('In ascolto') && document.querySelector('.avatar-status')?.textContent.includes('Avatar pronto'))
  assert.equal(await page.evaluate(() => fixture.avatarStarts), 2)
  await page.evaluate(() => fixture.avatarError())
  await page.waitForFunction(() => document.querySelector('.neb-live-state')?.textContent.includes('In pausa'))
  assert((await page.locator('.neb-live-session-status').innerText()).includes('Avatar disconnesso'))
  await page.getByRole('button', { name: 'Stop', exact: true }).click()
  assert.equal(await video.evaluate((node) => node.srcObject), null)
  if(fishMode) {
    await page.getByRole('button',{name:'Impostazioni',exact:true}).click()
    page.once('dialog',dialog=>dialog.accept())
    await page.getByRole('button',{name:'Rimuovi riferimento',exact:true}).click()
    await page.getByText('Riferimento locale rimosso.',{exact:true}).waitFor()
    await page.getByRole('button',{name:'Console',exact:true}).click()
    assert(await page.getByRole('button',{name:/^Pronuncia/}).isDisabled(),'missing Fish reference disables speech with no Gemini fallback')
  }
  assert.deepEqual(errors, [])
  console.log(`${fishMode ? 'Fish' : 'Gemini'} NEB Live renderer smoke passed: materials, reasoning and playback, profiles, limits, recovery, locks, compact controls; synthetic avatar preconnect, two replies without reconnect, idle video, pause/resume, disconnect handling and Stop.`)
} catch (error) {
  if (page) {
    console.error(await page.locator('body').innerText())
    const diagnostics = path.resolve('.superpowers/live-smoke'); await mkdir(diagnostics, { recursive: true })
    await page.screenshot({ path: path.join(diagnostics, 'failure.png') })
  }
  throw error
} finally {
  await page?.close(); await browser.close(); await new Promise((resolve) => server.close(resolve))
}
