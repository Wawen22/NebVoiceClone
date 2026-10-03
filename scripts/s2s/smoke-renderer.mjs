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
let page
try {
  page = await browser.newPage({ viewport: { width: 1260, height: 850 } })
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.addInitScript(() => {
    const target = { tabId: 1, windowId: 2, documentId: 'fixture-1', url: 'https://fixture.invalid/s2s', title: 'Synthetic S2S' }
    const listeners = new Set()
    const insertionListeners = new Set()
    let capture = { state: 'active', captureId: 'capture-1', target, message: 'Fixture audio active' }
    let sequence = 0, voiceFrames = 0
    const insertion = { supported: true, connected: true, stopAvailable: true, phase: 'ready', target, confirmed: 0, total: 0, message: 'Fixture connected' }
    const fixture = window.fixture = { spoken: [], played: [], filePlays: [], audioEvents: [], speechCodes: {}, adaptationRequests: [], adaptations: 0, holdAdapt: false, release: null, providerUnavailable: false, modelRequests: [], holdModel: false, releaseModel: null, holdVoice: false, releaseVoice: null, holdUserVoice: false, releaseUserVoice: null,
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
    window.AudioContext = AudioContext
    window.neb = {
      getAppInfo: async () => ({ electron: 'fixture', node: 'fixture', platform: 'win32', geminiConfigured: true }),
      getSettings: async () => ({ ...settings }), updateSettings: async (patch) => ({ ...Object.assign(settings, patch) }),
      getGeminiKeyStatus: async () => ({ activeSource: 'environment', environmentConfigured: true, projectConfigured: false, environmentLabel: 'Fixture', projectLabel: 'Fixture', savedLabel: null, secureStorageAvailable: false }),
      checkGemini: async () => ({ ready: true, message: 'Gemini connected' }),
      getOutlierData: async () => ({ schemaVersion: 1, projects: [{ id: 's2s', name: 'S2S', notes: '', integration: 's2s', archived: false }], charactersPerMinute: 600 }),
      getInsertionStatus: async () => insertion,
      getOutlierSetup: async () => ({ installed: true, extensionId: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', extensionPath: 'fixture' }),
      onInsertionStatus: (listener) => { insertionListeners.add(listener); return () => insertionListeners.delete(listener) }, onConversationRequested: noopSubscription, onStopRequested: noopSubscription,
      setZoomFactor: () => {}, getZoomFactor: () => 1,
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
        if (request.voice.voiceId === 'Kore' && fixture.holdUserVoice) await new Promise((resolve) => { fixture.releaseUserVoice = resolve })
        if (request.voice.voiceId === 'Puck' && fixture.holdVoice) await new Promise((resolve) => { fixture.releaseVoice = resolve })
        const code = 2000 + fixture.spoken.length
        fixture.speechCodes[code] = { text: request.text, voice: request.voice.voiceId }
        const pcm = new Uint8Array(request.voice.voiceId === 'Puck' ? 96000 : 14400)
        { const view = new DataView(pcm.buffer); for (let i = 0; i < pcm.length / 2; i++) view.setInt16(i * 2, code, true) }
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
  await page.locator('.console-audio-settings > summary').waitFor({ timeout: 5000 })
  assert.equal(await page.locator('.console-audio-settings').getAttribute('open'), null)
  const artifacts = path.resolve('.superpowers/s2s-smoke')
  await mkdir(artifacts, { recursive: true })
  await page.screenshot({ path: path.join(artifacts, 'console-clean.png') })
  assert(await page.locator('.console-composer textarea').evaluate((element) => element.clientWidth > 700))
  await page.locator('.console-audio-settings > summary').click()
  await page.getByLabel('Voce', { exact: true }).selectOption('Puck')
  await page.waitForFunction(() => document.querySelector('.console-audio-value strong')?.textContent === 'Puck')
  await page.getByLabel('Voce', { exact: true }).selectOption('Kore')
  await page.waitForFunction(() => document.querySelector('.console-audio-value strong')?.textContent === 'Kore')
  await page.getByLabel('Dispositivo di uscita', { exact: true }).selectOption('headphones')
  await page.locator('.console-routing-hint').waitFor()
  assert.equal(await page.locator('.console-audio-value strong').nth(1).textContent(), 'Headphones Realtek (fixture)')
  await page.getByLabel('Dispositivo di uscita', { exact: true }).selectOption('cable')
  await page.waitForFunction(() => !document.querySelector('.console-routing-hint'))
  await page.getByLabel('Volume di uscita', { exact: true }).focus()
  await page.getByLabel('Volume di uscita', { exact: true }).press('ArrowLeft')
  await page.waitForFunction(() => document.querySelector('.console-audio-volume')?.textContent.includes('80%'))
  await page.getByLabel('Volume di uscita', { exact: true }).press('ArrowRight')
  await page.waitForFunction(() => document.querySelector('.console-audio-volume')?.textContent.includes('85%'))
  await page.locator('.console-model-details > summary').click()
  await page.getByLabel('Modello', { exact: true }).selectOption('gemini-3.8-flash-lite-tts')
  assert.equal(await page.getByLabel('Modello', { exact: true }).inputValue(), 'gemini-3.8-flash-lite-tts')
  await page.getByLabel('Modello', { exact: true }).selectOption('gemini-3.8-flash-tts')
  await page.locator('.console-model-details > summary').click()
  await page.locator('.support-details > summary').click()
  await page.getByText('Test WAV locale', { exact: true }).waitFor()
  assert(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1), 'Audio setup must scroll inside Console without moving the app frame')
  await page.screenshot({ path: path.join(artifacts, 'console-audio-settings.png') })
  await page.locator('.support-details > summary').click()
  await page.locator('.console-audio-settings > summary').click()
  await page.getByRole('button', { name: 'Outlier', exact: true }).click()
  await page.getByRole('button', { name: 'Voce & Battute', exact: true }).click()
  if (await page.getByRole('button', { name: 'Nascondi barra progetti', exact: true }).count()) await page.getByRole('button', { name: 'Nascondi barra progetti', exact: true }).click()
  await page.screenshot({ path: path.join(artifacts, 'outlier-console-clean.png') })
  assert(await page.locator('.console-composer textarea').evaluate((element) => element.clientWidth > 650))
  await page.getByRole('button', { name: 'Console', exact: true }).click()
  await page.setViewportSize({ width: 540, height: 620 })
  assert(await page.locator('.console-clean').evaluate((element) => element.scrollWidth <= element.clientWidth))
  await page.locator('.console-audio-settings > summary').click()
  await page.getByLabel('Voce', { exact: true }).waitFor()
  await page.screenshot({ path: path.join(artifacts, 'console-clean-compact.png') })
  await page.locator('.console-audio-settings > summary').click()
  await page.setViewportSize({ width: 1260, height: 850 })
  await page.getByRole('button', { name: /Battute pronte/i }).click()
  const addLine = async (text) => {
    if (await page.getByRole('button', { name: 'Torna alle battute', exact: true }).count()) await page.getByRole('button', { name: 'Torna alle battute', exact: true }).click()
    await page.getByRole('button', { name: 'Nuova battuta', exact: true }).click()
    await page.locator('#ready-text').fill(text)
    await page.getByRole('button', { name: 'Salva battuta', exact: true }).click()
  }
  // Dedicated script import and editing pages must keep only the relevant controls.
  const acceptNextDialog = () => page.once('dialog', (dialog) => dialog.accept())
  const rejectNextDialog = () => page.once('dialog', (dialog) => dialog.dismiss())
  const importScript = async (text, replace = false) => {
    await page.getByRole('button', { name: 'Importa script', exact: true }).click()
    assert.equal(await page.locator('.ready-toolbar, .ready-tabs, .ready-list').count(), 0)
    assert.equal(await page.getByRole('button', { name: 'Automatico', exact: true }).count(), 0)
    assert(await page.getByRole('button', { name: /^Importa battute/ }).isDisabled())
    await page.locator('#ready-import-text').fill(text)
    if (replace) await page.getByLabel('Sostituisci i modelli importati', { exact: true }).check()
    await page.getByRole('button', { name: /^Importa battute/ }).click()
  }
  await page.screenshot({ path: path.join(artifacts, 'ready-lines-empty.png') })
  await page.getByRole('button', { name: 'Importa script', exact: true }).click()
  await page.locator('#ready-import-text').fill('--- MODEL A ---\nTurn 1 (User): Vorrei preparare una lezione sul ciclo dell’acqua. Da dove inizio?\nTurn 2 (Model A): Questa risposta non deve essere importata.\nTurn 3 (User): Ho solo carta e pennarelli: quale attività posso proporre?\n--- MODEL B ---\nTurn 1 (User): Mi aiuti con una lezione di scienze?')
  assert.equal(await page.locator('.ready-import-preview li').count(), 3)
  assert.equal(await page.locator('.ready-import-preview').filter({ hasText: 'Questa risposta' }).count(), 0)
  await page.screenshot({ path: path.join(artifacts, 'ready-import-clean.png') })
  await page.setViewportSize({ width: 540, height: 620 })
  assert(await page.locator('.ready-dialog').evaluate((element) => element.scrollWidth <= element.clientWidth))
  assert(await page.getByRole('button', { name: /^Importa battute/ }).evaluate((element) => { const rect = element.getBoundingClientRect(); return rect.bottom <= innerHeight && rect.top >= 0 }))
  await page.screenshot({ path: path.join(artifacts, 'ready-import-compact.png') })
  rejectNextDialog()
  await page.getByRole('button', { name: 'Torna alle battute', exact: true }).click()
  assert((await page.locator('#ready-import-text').inputValue()).includes('ciclo dell’acqua'))
  await page.getByRole('button', { name: /^Importa battute/ }).click()
  await page.setViewportSize({ width: 1260, height: 850 })
  await page.screenshot({ path: path.join(artifacts, 'ready-lines-clean.png') })
  assert.equal(await page.locator('.ready-item').count(), 2)
  await page.getByRole('button', { name: 'Modifica battuta 1', exact: true }).click()
  assert.equal(await page.locator('.ready-toolbar, .ready-list').count(), 0)
  await page.locator('#ready-text').fill('Una modifica da scartare.')
  rejectNextDialog()
  await page.getByRole('button', { name: 'Annulla', exact: true }).click()
  assert.equal(await page.locator('#ready-text').inputValue(), 'Una modifica da scartare.')
  acceptNextDialog()
  await page.getByRole('button', { name: 'Annulla', exact: true }).click()
  assert((await page.locator('.ready-copy p').first().textContent()).includes('ciclo dell’acqua'))
  await page.getByLabel('Battuta 1 fatta', { exact: true }).check()
  assert.equal(await page.locator('.ready-item.next').count(), 1)
  await page.getByRole('button', { name: 'Altre azioni battuta 2', exact: true }).click()
  await page.getByRole('button', { name: 'Sposta battuta 2 su', exact: true }).click()
  assert((await page.locator('.ready-copy p').first().textContent()).includes('carta e pennarelli'))
  await page.getByRole('button', { name: 'Altre azioni battuta 1', exact: true }).click()
  await page.getByRole('button', { name: 'Elimina battuta 1', exact: true }).click()
  assert.equal(await page.locator('.ready-item').count(), 1)
  await page.getByRole('button', { name: 'Annulla eliminazione', exact: true }).click()
  assert.equal(await page.locator('.ready-item').count(), 2)
  await importScript('--- MODEL A ---\n' + Array.from({ length: 24 }, (_, index) => `Turn ${index + 1} (User): Battuta di controllo ${index + 1}.`).join('\n'), true)
  await page.getByRole('button', { name: 'Modifica battuta 20', exact: true }).scrollIntoViewIfNeeded()
  const listScrollBefore = await page.locator('.ready-list').evaluate((element) => element.scrollTop)
  await page.getByRole('button', { name: 'Modifica battuta 20', exact: true }).click()
  await page.locator('#ready-text').fill('Battuta venti modificata.')
  await page.getByRole('button', { name: 'Salva battuta', exact: true }).click()
  await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Espandi o riduci testo battuta 20')
  assert.equal(await page.locator('.ready-list').evaluate((element) => element.scrollTop), listScrollBefore)
  await page.getByRole('button', { name: 'Modifica battuta 20', exact: true }).click()
  await page.getByRole('button', { name: 'Annulla', exact: true }).click()
  await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Espandi o riduci testo battuta 20')
  assert.equal(await page.locator('.ready-list').evaluate((element) => element.scrollTop), listScrollBefore)
  await importScript('--- MODEL A ---\nTurn 1 (User): Descrivi la soluzione.\nTurn 2 (User): Quali limiti ha?', true)
  await page.getByRole('tab', { name: /MODEL B/ }).click()
  assert.equal(await page.locator('.ready-item').count(), 1, 'Replacing A must preserve B')
  await page.locator('.ready-options > summary').click()
  acceptNextDialog()
  await page.getByRole('button', { name: 'Elimina tutte (B)', exact: true }).press('Enter')
  await page.waitForFunction(() => document.activeElement?.matches('.ready-options > summary'))
  await page.getByRole('tab', { name: /MODEL A/ }).click()
  await page.setViewportSize({ width: 540, height: 620 })
  await page.screenshot({ path: path.join(artifacts, 'ready-lines-compact.png') })
  assert(await page.locator('.ready-list').evaluate((element) => element.scrollWidth <= element.clientWidth))
  await page.locator('.ready-options > summary').focus()
  await page.locator('.ready-options > summary').press('Enter')
  assert.equal(await page.locator('.ready-options').getAttribute('open'), '')
  await page.getByLabel('Apri automaticamente la prossima', { exact: true }).focus()
  await page.getByLabel('Apri automaticamente la prossima', { exact: true }).press('Escape')
  assert(await page.locator('.ready-options > summary').evaluate((element) => document.activeElement === element))
  assert.equal(await page.locator('.ready-options').getAttribute('open'), null)
  assert(await page.locator('.ready-dialog').isVisible())
  await page.setViewportSize({ width: 1260, height: 850 })
  await page.getByRole('button', { name: 'Automatico', exact: true }).click()
  await page.getByRole('tab', { name: 'Configurazione', exact: true }).waitFor({ timeout: 5000 })
  assert.equal(await page.getByRole('tab', { name: 'Configurazione', exact: true }).getAttribute('aria-selected'), 'true')
  assert.equal(await page.locator('.s2s-transcript').count(), 0)
  const openAutomatic = async (source = 'outlier') => {
    if (await page.getByRole('button', { name: 'Automatico', exact: true }).count()) await page.getByRole('button', { name: 'Automatico', exact: true }).click()
    await page.getByRole('tab', { name: 'Configurazione', exact: true }).click()
    await page.getByRole('button', { name: source === 'outlier' ? 'Outlier / Edge' : 'Simulazione', exact: true }).click()
  }
  await openAutomatic()
  const start = page.getByRole('button', { name: /Avvia MODEL A/ })
  await page.getByLabel('What to do / Scenario', { exact: true }).fill('Contesto conservato dopo un errore di avvio.')
  await page.evaluate(() => { window.fixture.providerUnavailable = true })
  await start.click()
  await page.getByRole('region', { name: 'Conversazione automatica S2S' }).getByRole('alert').filter({ hasText: 'Configura OPENROUTER_API_KEY' }).waitFor()
  assert.equal(await page.getByRole('tab', { name: 'Configurazione', exact: true }).getAttribute('aria-selected'), 'true')
  assert.equal(await page.getByLabel('What to do / Scenario', { exact: true }).inputValue(), 'Contesto conservato dopo un errore di avvio.')
  await page.evaluate(() => { window.fixture.providerUnavailable = false })
  await start.click()
  assert.equal(await page.getByRole('tab', { name: 'Conversazione', exact: true }).getAttribute('aria-selected'), 'true')
  assert.equal(await page.getByRole('tab', { name: 'Configurazione', exact: true }).count(), 0)
  assert.equal(await page.locator('.s2s-history, .s2s-current-turn').count(), 0)
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
  await page.screenshot({ path: path.join(artifacts, 'automatic-player.png') })
  await page.getByRole('tab', { name: 'Script', exact: true }).click()
  assert.equal(await page.locator('.s2s-transcript').count(), 0)
  assert.equal(await page.locator('.s2s-turns li').count(), 2)
  await page.getByRole('tab', { name: 'Dettagli', exact: true }).click()
  await page.getByText('Tempi, costi e decisioni', { exact: true }).waitFor()
  assert.equal(await page.getByRole('button', { name: 'Esporta cronologia', exact: true }).count(), 1)
  await page.getByRole('tab', { name: 'Dettagli', exact: true }).press('Home')
  assert.equal(await page.getByRole('tab', { name: 'Conversazione', exact: true }).getAttribute('aria-selected'), 'true')
  await page.setViewportSize({ width: 540, height: 620 })
  await page.waitForTimeout(100)
  assert(await page.locator('.s2s-transcript').evaluate((element) => element.scrollHeight > element.clientHeight))
  await page.locator('.s2s-transcript').evaluate((element) => { element.scrollTop = 35 })
  await page.getByRole('button', { name: 'Vai all’ultimo messaggio', exact: true }).waitFor()
  await page.getByRole('tab', { name: 'Script', exact: true }).click()
  await page.getByRole('tab', { name: 'Conversazione', exact: true }).click()
  assert.equal(await page.locator('.s2s-transcript').evaluate((element) => element.scrollTop), 35)
  await page.getByRole('button', { name: 'Vai all’ultimo messaggio', exact: true }).click()
  assert(await page.locator('.s2s-transcript').evaluate((element) => element.scrollHeight - element.scrollTop - element.clientHeight < 2))
  assert(await page.locator('.s2s-dialog').evaluate((element) => element.scrollWidth <= element.clientWidth))
  await page.screenshot({ path: path.join(artifacts, 'automatic-player-compact.png') })
  await page.setViewportSize({ width: 1260, height: 850 })

  await page.setViewportSize({ width: 540, height: 620 })
  await page.locator('.s2s-transcript').evaluate((element) => { element.scrollTop = 0 })
  await page.getByRole('button', { name: 'Vai all’ultimo messaggio', exact: true }).waitFor()
  await addLine('Fammi un esempio concreto.')
  await page.evaluate(() => { window.fixture.holdAdapt = true })
  await openAutomatic(); await start.click()
  assert.equal(await page.getByRole('button', { name: 'Vai all’ultimo messaggio', exact: true }).count(), 0)
  await page.setViewportSize({ width: 1260, height: 850 })
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
  await page.getByLabel('Tipo di scenario', { exact: true }).fill('Knowledge & Learning · IQ-focused')
  await page.getByLabel('Skills tested', { exact: true }).fill('Guida pedagogica, metodo socratico')
  await page.getByLabel('What to do / Scenario', { exact: true }).fill('Aiutami a capire una soluzione, guidandomi con domande.')
  const callsBeforeFast = await page.evaluate(() => window.fixture.spoken.length)
  await simulate.click()
  await page.getByText('Prossima battuta pronta', { exact: true }).waitFor()
  assert.equal(await page.evaluate(() => window.fixture.played.filter((text) => text === 'E quali limiti ha?').length), 1)
  assert.equal(await page.evaluate(() => window.fixture.spoken.length), callsBeforeFast + 3)
  await page.waitForFunction(() => Number(document.querySelector('canvas[aria-label="Onde audio MODEL A"]')?.dataset.level) > 0)
  await page.screenshot({ path: path.join(artifacts, 'anticipation-player.png') })
  await page.getByText('Conversazione completata · risposta finale ascoltata.', { exact: false }).waitFor()
  assert.equal(await page.evaluate(() => window.fixture.modelRequests.length), 2)
  assert.equal(await page.evaluate(() => window.fixture.spoken.length), callsBeforeFast + 4)
  const fastRequests = await page.evaluate(() => window.fixture.adaptationRequests.filter((request) => request.transcript))
  assert.equal(fastRequests.length, 2)
  assert(fastRequests.every((request) => !request.audioPcm && request.taskContext.skillsTested.includes('socratico')))
  assert((await page.evaluate(() => window.fixture.modelRequests)).every((request) => request.taskContext.scenarioType.includes('IQ-focused')))
  const audioEvents = await page.evaluate(() => window.fixture.audioEvents)
  const adaptedStart = audioEvents.findLast((event) => event.event === 'start' && event.text === 'E quali limiti ha?')
  const modelEnd = audioEvents.findLast((event) => event.event === 'end' && event.voice === 'Puck' && event.at < adaptedStart.at)
  assert(modelEnd && adaptedStart.at - modelEnd.at >= 290, 'NEB must wait for actual MODEL end and quiet guard')
  assert(adaptedStart.at - modelEnd.at < 1500, 'Ready audio should avoid Qwen/TTS waits after MODEL end')
  await page.getByRole('tab', { name: 'Configurazione', exact: true }).click()
  // Reproduce the real stall: generated text exists but Gemini's first audio takes >30s.
  await page.getByLabel('Prepara battuta e voce mentre MODEL A parla', { exact: true }).uncheck()
  await page.evaluate(() => { window.fixture.holdVoice = true; window.fixture.releaseVoice = null })
  await simulate.click()
  await page.waitForFunction(() => window.fixture.releaseVoice !== null)
  await page.getByText('Preparo la voce di MODEL A…', { exact: true }).first().waitFor()
  const requestsBeforeVoicePause = await page.evaluate(() => window.fixture.modelRequests.length)
  await page.waitForTimeout(31000)
  assert.equal(await page.getByRole('button', { name: 'Pausa', exact: true }).count(), 1)
  assert.equal(await page.getByRole('button', { name: 'Riprendi simulazione', exact: true }).count(), 0)
  await page.screenshot({ path: path.join(artifacts, 'slow-model-voice.png') })
  await page.getByRole('button', { name: 'Pausa', exact: true }).click()
  await page.evaluate(() => { window.fixture.holdVoice = false; window.fixture.releaseVoice() })
  await page.getByRole('button', { name: 'Riprendi simulazione', exact: true }).click()
  await page.getByText('Conversazione completata · risposta finale ascoltata.', { exact: false }).waitFor()
  assert.equal(await page.evaluate(() => window.fixture.modelRequests.length), requestsBeforeVoicePause + 1)
  assert((await page.evaluate(() => window.fixture.adaptationRequests)).some((request) => request.audioPcm && request.taskContext.skillsTested.includes('socratico')))
  await page.getByRole('tab', { name: 'Configurazione', exact: true }).click()
  await page.getByLabel('Prepara battuta e voce mentre MODEL A parla', { exact: true }).check()
  await page.getByRole('button', { name: 'Torna alle battute', exact: true }).click()
  assert.equal(await page.getByRole('tab', { name: /MODEL A/ }).getByText('4 / 6 completate').count(), 1)
  await openAutomatic('simulation')
  await page.evaluate(() => { window.fixture.holdAdapt = true; window.fixture.release = null })
  await simulate.click()
  await page.waitForFunction(() => window.fixture.release !== null)
  await page.getByText('Adatto la prossima battuta alla risposta…', { exact: true }).waitFor()
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
  await page.getByRole('tab', { name: 'Configurazione', exact: true }).click()
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
  await page.getByRole('button', { name: 'Chiudi battute pronte', exact: true }).click()
  await page.getByLabel('Testo da pronunciare', { exact: true }).fill('Questa è una prova della Console semplificata.')
  await page.evaluate(() => { window.fixture.holdUserVoice = true })
  await page.locator('.console-composer .primary').click()
  await page.waitForFunction(() => window.fixture.releaseUserVoice !== null)
  await page.locator('.console-audio-settings > summary').click()
  assert(await page.getByLabel('Voce', { exact: true }).isDisabled())
  assert(await page.getByLabel('Dispositivo di uscita', { exact: true }).isDisabled())
  assert(await page.getByLabel('Volume di uscita', { exact: true }).isDisabled())
  await page.evaluate(() => { window.fixture.holdUserVoice = false; window.fixture.releaseUserVoice() })
  await page.waitForFunction(() => !document.querySelector('#console-voice')?.disabled)
  await page.locator('.console-audio-settings > summary').click()
  assert.equal(await page.evaluate(() => window.fixture.spoken.at(-1)), 'Questa è una prova della Console semplificata.')
  assert.equal(await page.getByLabel('Testo da pronunciare', { exact: true }).inputValue(), 'Questa è una prova della Console semplificata.')
  const playedBeforeReplay = await page.evaluate(() => window.fixture.filePlays.length)
  const callsBeforeReplay = await page.evaluate(() => window.fixture.spoken.length)
  await page.locator('.console-composer').getByRole('button', { name: /Riascolta/ }).click()
  await page.waitForFunction((before) => window.fixture.filePlays.length > before, playedBeforeReplay)
  assert.equal(await page.evaluate(() => window.fixture.spoken.length), callsBeforeReplay)
  assert.equal(await page.evaluate(() => window.fixture.filePlays.at(-1).sinkId), 'cable')
  await page.locator('.console-composer').getByRole('button', { name: /Stop/ }).click()
  assert.deepEqual(errors, [])
  await page.screenshot({ path: path.join(artifacts, 'renderer.png') })
  console.log('PASS: dedicated Ready Lines import/editor views, append/replace preserving other model, discard confirmation, move/delete/undo, long-list scroll and focus restoration, options keyboard focus and compact layouts; focused Console and Outlier editor, collapsible audio settings, voice/model/output/keyboard volume updates, routing hint and local WAV controls, manual speech preserves exact text, busy audio settings lock and replay/Stop, compact viewport; uncluttered player views and keyboard navigation, startup failure restores preserved configuration, reading position across tabs, follow reset on new session, compact viewport without horizontal overflow; MODEL first audio delayed 31s stays active, explicit voice preparation status, pause/resume reuses generated MODEL text, audio-only simulation adaptation; anticipatory text adaptation and silent PCM preparation, cached NEB playback after MODEL end, task context forwarding; dedicated automatic modal, transcript, actual PCM waves, adaptation comparison, minimize/reopen; renderer S2S and Console simulation with synthetic audio/IPC; adaptation, final reply, script lock, late replies after Stop, destination-bound resume, simulation without Edge, original script preserved; no AI calls.')
} catch (error) {
  await page?.screenshot({ path: path.resolve('.superpowers/s2s-smoke/player-failure.png') })
  if (page && await page.locator('.s2s-player').count()) console.error(await page.locator('.s2s-player').innerText({ timeout: 1000 }))
  throw error
} finally { await browser.close(); server.close() }
