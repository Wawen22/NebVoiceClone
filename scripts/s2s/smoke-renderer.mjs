// Windows renderer smoke: isolated Edge headless, synthetic IPC/audio, no AI calls.
import { createRequire } from 'node:module'
import { createServer } from 'node:http'
import { readFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import assert from 'node:assert/strict'

const require = createRequire(path.resolve('.superpowers/outlier-smoke/package.json'))
const { chromium } = require('playwright')
const root = path.resolve('out/renderer')
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
try {
  const page = await browser.newPage({ viewport: { width: 1260, height: 850 } })
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.addInitScript(() => {
    const target = { tabId: 1, windowId: 2, documentId: 'fixture-1', url: 'https://fixture.invalid/s2s', title: 'Synthetic S2S' }
    const listeners = new Set()
    const insertionListeners = new Set()
    let capture = { state: 'active', captureId: 'capture-1', target, message: 'Fixture audio active' }
    let sequence = 0, voiceFrames = 0
    const insertion = { supported: true, connected: true, stopAvailable: true, phase: 'ready', target, confirmed: 0, total: 0, message: 'Fixture connected' }
    const fixture = window.fixture = { spoken: [], adaptations: 0, holdAdapt: false, release: null, modelRequests: [], holdModel: false, releaseModel: null,
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
    const settings = { schemaVersion: 1, providerId: 'gemini', geminiModel: 'gemini-3.8-flash-tts', geminiKeySource: 'environment', geminiVoiceId: 'Kore', replicatedVoice: null,
      voiceProfiles: { environment: profile, project: profile, saved: profile }, outputDeviceId: 'cable', outputVolume: 0.85, monitorDeviceId: '', saveScriptHistory: false }
    const noopSubscription = () => () => {}
    Object.defineProperty(navigator.mediaDevices, 'enumerateDevices', { value: async () => [{ kind: 'audiooutput', deviceId: 'cable', label: 'CABLE Input (fixture)' }, { kind: 'audiooutput', deviceId: 'headphones', label: 'Headphones Realtek (fixture)' }] })
    class Audio {
      volume = 1; currentTime = 0; sinkId = 'default'; src = ''; srcObject = null
      async setSinkId(id) { this.sinkId = id }
      async play() {}
      pause() {}
      load() {}
      removeAttribute() {}
    }
    class AudioContext {
      currentTime = 0
      createMediaStreamDestination() { return { stream: {} } }
      createBuffer(_channels, length) { return { duration: length / 24000, getChannelData: () => new Float32Array(length) } }
      createBufferSource() { let timer; return { buffer: null, onended: null, connect() {}, start() { timer = setTimeout(() => this.onended?.(), this.buffer.duration * 1000) }, stop() { clearTimeout(timer); this.onended?.() } } }
      async resume() {}
      async close() {}
    }
    window.Audio = Audio
    window.AudioContext = AudioContext
    window.neb = {
      getAppInfo: async () => ({ electron: 'fixture', node: 'fixture', platform: 'win32', geminiConfigured: true }),
      getSettings: async () => settings, updateSettings: async (patch) => Object.assign(settings, patch),
      getGeminiKeyStatus: async () => ({ activeSource: 'environment', environmentConfigured: true, projectConfigured: false, environmentLabel: 'Fixture', projectLabel: 'Fixture', savedLabel: null, secureStorageAvailable: false }),
      checkGemini: async () => ({ ready: true, message: 'Gemini connected' }),
      getOutlierData: async () => ({ schemaVersion: 1, projects: [{ id: 's2s', name: 'S2S', notes: '', integration: 's2s', archived: false }], charactersPerMinute: 600 }),
      getInsertionStatus: async () => insertion,
      getOutlierSetup: async () => ({ installed: true, extensionId: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', extensionPath: 'fixture' }),
      onInsertionStatus: (listener) => { insertionListeners.add(listener); return () => insertionListeners.delete(listener) }, onConversationRequested: noopSubscription, onStopRequested: noopSubscription,
      setZoomFactor: () => {}, getZoomFactor: () => 1,
      getS2SProviderStatus: async () => ({ ready: true, model: 'qwen/qwen3.8-omni-flash' }),
      getS2SAudioStatus: async () => capture,
      onS2SAudio: (listener) => { listeners.add(listener); return () => listeners.delete(listener) },
      adaptS2STurn: async (request) => {
        fixture.adaptations++
        const result = { action: request.nextLine ? 'speak' : 'complete', transcript: 'La soluzione è economica.', nextText: request.nextLine ? 'E quali limiti ha?' : '', reason: 'Risposta conclusa', qwenMs: 80, costUsd: 0.002 }
        if (fixture.holdAdapt) return new Promise((resolve) => { fixture.release = () => resolve(result) })
        return result
      },
      cancelS2SAdaptation: async () => {}, stopS2SAudioCapture: async () => {}, stopGeneration: async () => {}, stopInsertion: async () => {},
      generateS2SSimulationReply: async (request) => {
        fixture.modelRequests.push(request)
        const result = { text: 'La soluzione è economica e puoi provarla con una classe.', modelMs: 30, costUsd: 0.001 }
        if (fixture.holdModel) return new Promise((resolve) => { fixture.releaseModel = () => resolve(result) })
        return result
      },
      cancelS2SSimulationReply: async () => {},
      synthesizeStream: async (request, onChunk) => {
        fixture.spoken.push(request.text)
        const pcm = new Uint8Array(request.voice.voiceId === 'Puck' ? 24000 : 14400)
        { const view = new DataView(pcm.buffer); for (let i = 0; i < pcm.length / 2; i++) view.setInt16(i * 2, 2000, true) }
        onChunk(pcm); return { generationMs: 10 }
      }
    }
    setInterval(() => {
      const pcm = new Uint8Array(3200)
      if (voiceFrames > 0) { voiceFrames--; const view = new DataView(pcm.buffer); for (let i = 0; i < 1600; i++) view.setInt16(i * 2, 2000, true) }
      for (const listener of listeners) listener({ type: 'pcm', captureId: capture.captureId, sequence: sequence++, pcm })
    }, 100)
  })
  await page.goto(`http://127.0.0.1:${server.address().port}`)
  await page.getByRole('button', { name: /Battute pronte/i }).click()
  const addLine = async (text) => {
    if (await page.getByRole('button', { name: 'Torna alle battute', exact: true }).count()) await page.getByRole('button', { name: 'Torna alle battute', exact: true }).click()
    await page.getByRole('button', { name: 'Nuova battuta', exact: true }).click()
    await page.locator('#ready-text').fill(text)
    await page.getByRole('button', { name: 'Salva battuta', exact: true }).click()
  }
  await addLine('Descrivi la soluzione.'); await addLine('Quali limiti ha?')
  await page.getByRole('button', { name: 'Automatico', exact: true }).click()
  const openAutomatic = async (source = 'outlier') => {
    if (await page.getByRole('button', { name: 'Automatico', exact: true }).count()) await page.getByRole('button', { name: 'Automatico', exact: true }).click()
    await page.getByRole('button', { name: source === 'outlier' ? 'Outlier / Edge' : 'Simulazione', exact: true }).click()
  }
  await openAutomatic()
  const start = page.getByRole('button', { name: /Avvia MODEL A/ })
  await start.click()
  await page.waitForFunction(() => Number(document.querySelector('canvas[aria-label="Onde audio NEB"]')?.dataset.level) > 0)
  await page.getByText('Attendo la risposta di Outlier.', { exact: false }).first().waitFor()
  assert.equal(await page.getByRole('tab', { name: /MODEL B/ }).count(), 0)
  assert.equal(await page.getByRole('button', { name: 'Nuova battuta', exact: true }).count(), 0)
  await page.evaluate(() => window.fixture.voice())
  await page.waitForFunction(() => Number(document.querySelector('canvas[aria-label="Onde audio MODEL A"]')?.dataset.level) > 0)
  await page.waitForFunction(() => window.fixture.spoken.length === 2)
  assert.deepEqual(await page.evaluate(() => window.fixture.spoken), ['Descrivi la soluzione.', 'E quali limiti ha?'])
  await page.getByText('Ascolto la risposta finale di Outlier.', { exact: false }).first().waitFor()
  await page.evaluate(() => window.fixture.voice())
  await page.getByText('Conversazione completata · risposta finale ascoltata.', { exact: false }).waitFor()
  assert.equal(await page.evaluate(() => window.fixture.spoken.length), 2)
  assert.deepEqual(await page.locator('.s2s-message.neb > p').allTextContents(), ['Descrivi la soluzione.', 'E quali limiti ha?'])
  assert.equal(await page.locator('.s2s-message.model').count(), 2)
  assert.equal(await page.getByText('2/2 battute completate', { exact: true }).count(), 1)
  const artifacts = path.resolve('.superpowers/s2s-smoke')
  await mkdir(artifacts, { recursive: true })
  await page.screenshot({ path: path.join(artifacts, 'automatic-player.png') })

  await addLine('Fammi un esempio concreto.')
  await page.evaluate(() => { window.fixture.holdAdapt = true })
  await openAutomatic(); await start.click()
  await page.getByText('Ascolto la risposta finale di Outlier.', { exact: false }).first().waitFor()
  await page.evaluate(() => window.fixture.voice())
  await page.waitForFunction(() => window.fixture.release !== null)
  await page.getByRole('button', { name: 'Stop automatico', exact: true }).click()
  await page.evaluate(() => window.fixture.release())
  await page.waitForTimeout(500)
  assert.equal(await page.evaluate(() => window.fixture.spoken.length), 3)

  await addLine('Un ultimo chiarimento.')
  await page.evaluate(() => { window.fixture.holdAdapt = false })
  await openAutomatic(); await start.click()
  await page.getByText('Ascolto la risposta finale di Outlier.', { exact: false }).first().waitFor()
  await page.evaluate(() => window.fixture.replaceCapture())
  await page.getByRole('button', { name: 'Riprendi ascolto', exact: true }).waitFor()
  // A replacement stream must deliver at least 500 ms before a resume attempt.
  await page.waitForTimeout(700)
  await page.getByRole('button', { name: 'Riprendi ascolto', exact: true }).click()
  await page.getByRole('region', { name: 'Conversazione automatica S2S' }).getByRole('alert').filter({ hasText: 'Scheda o task cambiata: premi Stop e avvia una nuova sessione.' }).waitFor()
  await page.getByRole('button', { name: 'Stop automatico', exact: true }).click()
  await page.evaluate(() => window.fixture.disconnect())
  await addLine('Vorrei preparare una lezione. Da dove parto?')
  await addLine('Quali limiti devo considerare?')
  await openAutomatic('simulation')
  const simulate = page.getByRole('button', { name: 'Simulazione MODEL A', exact: true })
  await simulate.click()
  await page.getByText('Conversazione completata · risposta finale ascoltata.', { exact: false }).waitFor()
  assert.equal(await page.evaluate(() => window.fixture.modelRequests.length), 2)
  await page.getByRole('button', { name: 'Torna alle battute', exact: true }).click()
  assert.equal(await page.getByRole('tab', { name: /MODEL A/ }).getByText('4 / 6 completate').count(), 1)
  await openAutomatic('simulation')
  await page.evaluate(() => { window.fixture.holdAdapt = true; window.fixture.release = null })
  await simulate.click()
  await page.waitForFunction(() => window.fixture.release !== null)
  const modelBeforePause = await page.evaluate(() => window.fixture.modelRequests.length)
  await page.getByRole('button', { name: 'Riduci', exact: true }).click()
  await page.getByRole('button', { name: /Apri player/ }).click()
  assert.equal(await page.getByRole('dialog', { name: 'Conversazione automatica', exact: true }).count(), 1)
  await page.getByRole('button', { name: 'Pausa', exact: true }).click()
  await page.evaluate(() => { window.fixture.holdAdapt = false; window.fixture.release() })
  await page.getByRole('button', { name: 'Riprendi simulazione', exact: true }).click()
  await page.getByText('Conversazione completata · risposta finale ascoltata.', { exact: false }).waitFor()
  assert.equal(await page.evaluate(() => window.fixture.modelRequests.length), modelBeforePause + 1)
  await page.evaluate(() => { window.fixture.holdModel = true })
  await simulate.click()
  await page.waitForFunction(() => window.fixture.releaseModel !== null)
  const spokenBeforeStop = await page.evaluate(() => window.fixture.spoken.length)
  await page.getByRole('button', { name: 'Stop automatico', exact: true }).click()
  await page.evaluate(() => window.fixture.releaseModel())
  await page.waitForTimeout(500)
  assert.equal(await page.evaluate(() => window.fixture.spoken.length), spokenBeforeStop)
  await page.keyboard.press('Escape')
  assert.equal(await page.getByRole('dialog', { name: 'Conversazione automatica', exact: true }).count(), 0)
  await page.getByRole('button', { name: /Battute pronte/i }).click()
  assert.equal(await page.getByRole('tab', { name: /MODEL A/ }).getByText('4 / 6 completate').count(), 1)
  assert.deepEqual(errors, [])
  await page.screenshot({ path: path.join(artifacts, 'renderer.png') })
  console.log('PASS: dedicated automatic modal, transcript, actual PCM waves, adaptation comparison, minimize/reopen; renderer S2S and Console simulation with synthetic audio/IPC; adaptation, final reply, script lock, late replies after Stop, destination-bound resume, simulation without Edge, original script preserved; no AI calls.')
} finally { await browser.close(); server.close() }
