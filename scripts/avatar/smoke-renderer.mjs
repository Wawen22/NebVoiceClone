// Run from Windows. --cloud uses a few seconds of Simli minutes and local probe.wav.
import { createRequire } from 'node:module'
import { createServer } from 'node:http'
import { readFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import assert from 'node:assert/strict'
import { loadEnvFile } from 'node:process'
const cloud = process.argv.includes('--cloud')
const require = createRequire('C:/Users/r.nebili/.codex/worktrees/outlier-s2s/NebVoiceGenerator/.superpowers/outlier-smoke/package.json')
const { chromium } = require('playwright')
if (cloud) loadEnvFile(path.resolve('.env.local'))
const root = path.resolve('out/renderer')
const server = createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, 'http://localhost').pathname
    if (pathname === '/session') {
      assert(cloud)
      const headers = { 'x-simli-api-key': process.env.SIMLI_API_KEY, 'Content-Type': 'application/json' }
      const tokenResponse = await fetch('https://api.simli.ai/compose/token', { method: 'POST', headers, body: JSON.stringify({ faceId: '1c6aa65c-d858-4721-a4d9-bda9fde03141', apiVersion: 'v2', handleSilence: true, maxSessionLength: 120, maxIdleTime: 30, audioInputFormat: 'pcm16' }), signal: AbortSignal.timeout(15000) })
      if (!tokenResponse.ok) throw new Error(`Simli token HTTP ${tokenResponse.status}`)
      const token = await tokenResponse.json()
      const iceResponse = await fetch('https://api.simli.ai/compose/ice', { headers, signal: AbortSignal.timeout(15000) })
      if (!iceResponse.ok) throw new Error(`Simli ICE HTTP ${iceResponse.status}`)
      const iceServers = await iceResponse.json()
      res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ sessionToken: token.session_token, iceServers })); return
    }
    if (pathname === '/probe.wav') {
      const audio = await readFile(path.resolve('.superpowers/avatar/probe.wav'))
      res.writeHead(200, { 'Content-Type': 'audio/wav' }); res.end(audio); return
    }
    const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : decodeURIComponent(pathname)))
    if (!file.startsWith(root + path.sep)) throw new Error('Invalid path')
    const body = await readFile(file)
    res.writeHead(200, { 'Content-Type': file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html' }); res.end(body)
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: error instanceof Error && error.message.startsWith('Simli ') ? error.message : 'Probe request failed' }))
  }
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] })
try {
  const page = await browser.newPage({ viewport: { width: 1260, height: 850 } })
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message.replace(/session_token=[^ &]+/g, 'session_token=REDACTED')))
  await page.addInitScript(({ cloud }) => {
    const f = window.fixture = { localPlays: 0, chunks: 0, stops: 0, sessions: 0, peers: [], sockets: [], holdVoice: false, release: null, spoken: [], audioFrames: 0 }
    const originalStart = AudioBufferSourceNode.prototype.start
    AudioBufferSourceNode.prototype.start = function (...args) { if (!(this.context instanceof OfflineAudioContext)) f.localPlays++; return originalStart.apply(this, args) }
    const RealPC = window.RTCPeerConnection
    if (cloud) window.RTCPeerConnection = class extends RealPC { constructor(config) { super(config); f.peers.push(this) } }
    else {
      const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 240
      const ctx = canvas.getContext('2d'); ctx.fillStyle = '#22a688'; ctx.fillRect(0, 0, 320, 240)
      const videoStream = canvas.captureStream(25)
      window.RTCPeerConnection = class extends EventTarget {
        iceGatheringState = 'complete'; localDescription = { sdp: 'fixture', type: 'offer' }
        addTransceiver() {}
        async createOffer() { return this.localDescription }
        async setLocalDescription() {}
        async setRemoteDescription() {
          const context = new AudioContext(), audioStream = context.createMediaStreamDestination().stream
          for (const [kind, stream] of [['video', videoStream], ['audio', audioStream]]) {
            const event = new Event('track'); Object.assign(event, { track: { kind }, streams: [stream] }); this.dispatchEvent(event)
          }
        }
        close() { f.stops++ }
      }
      window.WebSocket = class {
        static OPEN = 1; readyState = 1; onopen = null; onmessage = null; onerror = null
        constructor() { f.sockets.push(this); setTimeout(() => this.onopen?.(), 20) }
        addEventListener() {}
        send(data) {
          if (typeof data === 'string' && data.includes('sdp')) setTimeout(() => this.onmessage?.({ data: '{"sdp":"fixture","type":"answer"}' }), 10)
          if (data instanceof Uint8Array) { f.chunks++; setTimeout(() => this.onmessage?.({ data: 'SPEAK' }), 20); setTimeout(() => this.onmessage?.({ data: 'SILENT' }), 250) }
        }
        close() { this.readyState = 3 }
      }
    }
    const profile = { replicatedVoice: null, selectedVoiceId: 'Kore' }
    const settings = { schemaVersion: 1, providerId: 'gemini', geminiModel: 'gemini-3.8-flash-tts', geminiKeySource: 'environment', geminiVoiceId: 'Kore', replicatedVoice: null, voiceProfiles: { environment: profile, project: profile, saved: profile }, outputDeviceId: cloud ? 'default' : 'cable', outputVolume: cloud ? 0.05 : 0, monitorDeviceId: '', saveScriptHistory: false }
    Object.defineProperty(navigator.mediaDevices, 'enumerateDevices', { value: async () => [{ kind: 'audiooutput', deviceId: cloud ? 'default' : 'cable', label: cloud ? 'Default Windows output' : 'CABLE Input (fixture)' }] })
    if (!cloud) HTMLMediaElement.prototype.setSinkId = async function () {}
    const noop = () => () => {}, target = { tabId: 1, windowId: 2, documentId: 'fixture', url: 'https://fixture.invalid', title: 'Fixture' }
    const capture = { state: 'active', captureId: 'fixture', target, message: 'Connected' }
    const listeners = new Set()
    setInterval(() => { for (const listener of listeners) listener({ type: 'pcm', captureId: 'fixture', pcm: new Uint8Array(3200) }) }, 100)
    window.neb = {
      getAvatarStatus: async () => ({ configured: true }),
      createAvatarSession: async () => { f.sessions++; if (!cloud) return { sessionToken: 'fixture', iceServers: [{ urls: 'stun:fixture.invalid' }] }; const res = await fetch('/session'); const data = await res.json(); if (!res.ok) throw new Error(data.error); return data },
      getAppInfo: async () => ({ platform: 'win32', electron: 'fixture', node: 'fixture' }),
      getSettings: async () => settings, updateSettings: async (patch) => Object.assign(settings, patch),
      checkGemini: async () => ({ ready: true, message: 'Fixture' }),
      getGeminiKeyStatus: async () => ({ activeSource: 'environment', environmentConfigured: true, projectConfigured: false, savedLabel: null, secureStorageAvailable: false }),
      getOutlierData: async () => ({ schemaVersion: 1, projects: [], charactersPerMinute: 600 }),
      getInsertionStatus: async () => ({ supported: true, connected: true, stopAvailable: true, target, phase: 'ready' }),
      getOutlierSetup: async () => ({ installed: true, extensionId: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', extensionPath: 'fixture' }),
      onInsertionStatus: noop, onStopRequested: noop, onConversationRequested: noop, setZoomFactor() {}, getZoomFactor: () => 1,
      getLiveConfig: async () => ({ schemaVersion: 1, background: '', persona: '', selectedProfileId: 'test', profiles: [{ id: 'test', name: 'Test', context: '', language: 'auto', tone: 'professional' }] }),
      saveLiveConfig: async (config) => config, getS2SProviderStatus: async () => ({ ready: true, model: 'fixture' }),
      getS2SAudioStatus: async () => capture, onS2SAudio: (listener) => { listeners.add(listener); return () => listeners.delete(listener) },
      generateLiveTurn: async () => ({ action: 'speak', transcript: '', text: 'Ciao, sono NEB.', reason: 'Opening', costUsd: 0, qwenMs: 1 }), cancelLiveTurn: async () => {},
      stopGeneration: async () => { f.stops++ }, stopInsertion: async () => {},
      synthesizeStream: async (request, onChunk) => {
        f.spoken.push(request.text)
        if (f.holdVoice) await new Promise((resolve) => { f.release = resolve })
        let pcm
        if (cloud) {
          const context = new AudioContext(), buffer = await context.decodeAudioData(await (await fetch('/probe.wav')).arrayBuffer())
          const offline = new OfflineAudioContext(1, Math.ceil(buffer.duration * 24000), 24000), source = offline.createBufferSource(); source.buffer = buffer; source.connect(offline.destination); source.start()
          const converted = await offline.startRendering(), samples = converted.getChannelData(0)
          pcm = new Uint8Array(samples.length * 2); const view = new DataView(pcm.buffer)
          samples.forEach((sample, i) => view.setInt16(i * 2, Math.max(-32768, Math.min(32767, Math.round(sample * 32767))), true)); await context.close()
        } else pcm = new Uint8Array(7200)
        onChunk(pcm); return { generationMs: 1 }
      }
    }
  }, { cloud })
  await page.goto(`http://127.0.0.1:${server.address().port}`)
  await page.getByRole('checkbox', { name: 'Attiva avatar' }).check()
  assert.equal(await page.evaluate(() => fixture.sessions), 0)
  await page.getByRole('button', { name: 'Test voce avatar' }).click()
  await page.waitForFunction(() => (fixture.spoken.length && document.querySelector('.console-composer .notice')?.textContent.includes('Riproduzione terminata')) || document.querySelector('.notice.error'), null, { timeout: 25000 }).catch(async (error) => {
    console.log(JSON.stringify({ errors, diagnostic: await page.evaluate(() => ({ avatar: document.querySelector('.avatar-status')?.textContent, notices: [...document.querySelectorAll('.notice')].map((element) => element.textContent), sessions: fixture.sessions, spoken: fixture.spoken.length, localPlays: fixture.localPlays })) }))
    throw error
  })
  assert.equal(await page.locator('.notice.error').count(), 0, await page.locator('.notice').allTextContents())
  await page.waitForFunction(() => document.querySelector('.avatar-status')?.textContent.includes('Avatar pronto'), null, { timeout: 15000 })
  const status = await page.locator('.avatar-status').textContent()
  assert(status.includes('Avatar pronto'), `Avatar did not complete: ${status}`)
  assert.equal(await page.evaluate(() => fixture.localPlays), 0, 'Duplicate local audio playback')
  const video = await page.locator('video[aria-label="Anteprima avatar"]').evaluate((element) => ({ width: element.videoWidth, height: element.videoHeight, frames: element.getVideoPlaybackQuality().totalVideoFrames }))
  assert(video.width > 0 && video.frames > 0, 'No video frames received')
  if (cloud) {
    const stats = await page.evaluate(async () => {
      const results = []
      for (const peer of fixture.peers) for (const report of (await peer.getStats()).values()) if (report.type === 'inbound-rtp') results.push({ kind: report.kind, bytesReceived: report.bytesReceived, framesDecoded: report.framesDecoded, totalAudioEnergy: report.totalAudioEnergy })
      return results
    })
    assert(stats.some((item) => item.kind === 'audio' && item.bytesReceived > 0), 'No incoming audio')
    console.log(JSON.stringify({ cloud: true, video, stats }))
  } else {
    await page.evaluate(() => fixture.sockets[0].onclose?.())
    await page.waitForFunction(() => document.querySelector('.avatar-status')?.textContent.includes('connessione chiusa'))
    await page.getByRole('button', { name: /^Riascolta/ }).click()
    await page.waitForFunction(() => fixture.chunks >= 2)
    await page.getByRole('button', { name: 'Scollega avatar' }).click()
    await page.waitForFunction(() => document.querySelector('.avatar-status')?.textContent.includes('non collegato'))
    await page.getByRole('button', { name: 'NEB Live', exact: true }).click()
    assert.equal(await page.getByRole('checkbox', { name: 'Attiva avatar' }).isChecked(), true)
    await page.getByRole('button', { name: 'Configura', exact: true }).click()
    await page.locator('#neb-live-opening').selectOption('opening')
    await page.getByRole('button', { name: 'Chiudi configurazione' }).click()
    await page.getByRole('button', { name: 'Avvia conversazione' }).click()
    await page.waitForFunction(() => fixture.chunks >= 3 && document.querySelector('.neb-live-session-status')?.textContent.includes('Ascolto'))
    assert.equal(await page.evaluate(() => fixture.localPlays), 0)
    await page.getByRole('button', { name: 'Stop', exact: true }).click()
    await page.waitForFunction(() => document.querySelector('.avatar-status')?.textContent.includes('non collegato'))
    console.log(JSON.stringify({ cloud: false, video, stats: await page.evaluate(() => ({ chunks: fixture.chunks, localPlays: fixture.localPlays, sessions: fixture.sessions })) }))
  }
  await mkdir('.superpowers/avatar', { recursive: true })
  await page.screenshot({ path: `.superpowers/avatar/${cloud ? 'cloud' : 'synthetic'}-desktop.png` })
  if (!cloud) {
    await page.setViewportSize({ width: 980, height: 680 }); await page.screenshot({ path: '.superpowers/avatar/synthetic-compact.png' })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
  }
  if (await page.getByRole('button', { name: 'Scollega avatar' }).isEnabled()) await page.getByRole('button', { name: 'Scollega avatar' }).click()
  assert.deepEqual(errors, [], 'Browser errors')
} finally { await browser.close(); await new Promise((resolve) => server.close(resolve)) }
