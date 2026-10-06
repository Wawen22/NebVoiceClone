// Windows renderer acceptance: synthetic IPC and audio, no cloud requests.
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
    res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html')
    res.end(await readFile(file))
  } catch { res.writeHead(404); res.end() }
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
let browser
try {
  browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage({ viewport: { width: 1260, height: 850 } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort())
  await page.addInitScript(() => {
    const target = { tabId: 1, windowId: 2, documentId: 'fixture', url: 'https://fixture.invalid', title: 'Conversazione di prova' }
    const audioListeners = new Set(), insertionListeners = new Set()
    let capture = { state: 'active', captureId: 'capture', target, message: 'Audio di prova' }
    let insertion = { supported: true, connected: true, stopAvailable: true, phase: 'ready', target, projectId: null, confirmed: 0, total: 0, message: 'Collegato' }
    const profile = { replicatedVoice: null, selectedVoiceId: 'Kore' }
    const settings = { schemaVersion: 1, providerId: 'fish-openrouter', fishModel: 'fish-audio/s2.1-pro-free:free', fishVoice: { id: '12345678-1234-4123-8123-123456789abc', displayName: 'Voce Fish personale', createdAt: '2026-10-06T00:00:00Z' },
      geminiModel: 'gemini-3.8-flash-tts', geminiKeySource: 'environment', geminiVoiceId: 'Kore', replicatedVoice: null, voiceProfiles: { environment: profile, project: profile, saved: profile }, outputDeviceId: 'cable', outputVolume: 0.85, monitorDeviceId: '', saveScriptHistory: false }
    const fixture = window.fixture = {
      failServices: false, noDevices: false, voiceCalls: 0, geminiReady: false, holdSpeech: false, releaseSpeech: null,
      disconnect() {
        capture = { ...capture, state: 'inactive', captureId: null, target: null }
        insertion = { ...insertion, connected: false, target: null }
        for (const listener of audioListeners) listener({ type: 'status', status: capture })
        for (const listener of insertionListeners) listener(insertion)
      },
      reconnect() {
        capture = { state: 'active', captureId: 'new-capture', target, message: 'Audio di prova' }
        insertion = { ...insertion, connected: true, target }
        for (const listener of audioListeners) listener({ type: 'status', status: capture })
        for (const listener of insertionListeners) listener(insertion)
      }
    }
    Object.defineProperty(navigator.mediaDevices, 'enumerateDevices', { value: async () => fixture.noDevices ? [] : [{ kind: 'audiooutput', deviceId: 'cable', label: 'CABLE Input (fixture)' }, { kind: 'audiooutput', deviceId: 'headphones', label: 'Cuffie (fixture)' }] })
    const subscribe = listeners => listener => { listeners.add(listener); return () => listeners.delete(listener) }
    const noopSubscription = () => () => {}
    const unavailable = async () => { throw new Error('Servizio sintetico non disponibile') }
    window.neb = {
      getAppInfo: async () => ({ electron: 'fixture', node: 'fixture', platform: 'win32', geminiConfigured: false }),
      getSettings: async () => ({ ...settings }), updateSettings: async patch => ({ ...Object.assign(settings, patch) }),
      getGeminiKeyStatus: async () => ({ activeSource: 'environment', environmentConfigured: false, projectConfigured: false, savedLabel: null, secureStorageAvailable: false }),
      checkGemini: async () => ({ ready: fixture.geminiReady, message: fixture.geminiReady ? 'Gemini connected' : 'Gemini non configurato' }),
      getSpeechProviderStatus: async id => {
        const result = { ready: id === 'fish-openrouter' || fixture.geminiReady, message: id === 'fish-openrouter' ? 'Fish pronto' : fixture.geminiReady ? 'Gemini connected' : 'Gemini non configurato' }
        if (id === 'gemini' && fixture.holdSpeech) return new Promise(resolve => { fixture.releaseSpeech = () => { fixture.holdSpeech = false; resolve(result) } })
        return result
      },
      getOutlierData: async () => ({ schemaVersion: 1, projects: [], charactersPerMinute: 600 }),
      getInsertionStatus: async () => insertion,
      getOutlierSetup: async () => ({ installed: true, extensionId: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', extensionPath: 'fixture' }),
      onInsertionStatus: subscribe(insertionListeners), onConversationRequested: noopSubscription, onStopRequested: noopSubscription,
      setZoomFactor() {}, getZoomFactor: () => 1,
      getLiveConfig: async () => ({ schemaVersion: 1, background: '', persona: '', selectedProfileId: 'test', profiles: [{ id: 'test', name: 'Prova', context: '', language: 'auto', tone: 'conversational' }] }),
      saveLiveConfig: async config => config,
      getS2SProviderStatus: async () => fixture.failServices ? unavailable() : ({ ready: true, model: 'qwen/fixture' }),
      getS2SAudioStatus: async () => capture, onS2SAudio: subscribe(audioListeners),
      getAvatarStatus: async () => fixture.failServices ? unavailable() : ({ configured: false }),
      getAvatarOutputStatus: async () => fixture.failServices ? unavailable() : ({ enabled: true, available: true, viewers: 1 }),
      clearAvatarOutput: async () => {}, stopGeneration: async () => {}, stopInsertion: async () => {}, cancelLiveTurn: async () => {},
      setSpeechSessionLock: async () => {},
      synthesize: async () => { fixture.voiceCalls++; throw new Error('Generation forbidden in diagnostics') },
      synthesizeStream: async () => { fixture.voiceCalls++; throw new Error('Generation forbidden in diagnostics') },
      createAvatarSession: async () => { throw new Error('Avatar connection forbidden in diagnostics') }
    }
    setInterval(() => {
      if (capture.state !== 'active') return
      for (const listener of audioListeners) listener({ type: 'pcm', captureId: capture.captureId, pcm: new Uint8Array(3200), sequence: 1 })
    }, 100)
  })
  await page.goto(`http://127.0.0.1:${server.address().port}`)
  const diagnostics = page.locator('.session-diagnostics')
  const openDiagnostics = () => page.getByRole('button', { name: 'Diagnostica', exact: true }).click()
  const summary = diagnostics.locator('.diagnostics-summary')
  const check = id => diagnostics.locator('.diagnostics-check').filter({ has: page.getByText(id, { exact: true }) })
  await openDiagnostics()
  await summary.getByText('Controlli automatici superati', { exact: true }).waitFor()
  assert.match(await diagnostics.locator('.diagnostics-selection').innerText(), /Voce Fish personale/)
  assert.doesNotMatch(await diagnostics.locator('.diagnostics-selection').innerText(), /gemini-3.8/)
  await check('Microfono nel sito').getByText('Da verificare', { exact: true }).waitFor()
  assert.match(await check('Uscita video locale').innerText(), /Verifica separatamente OBS Virtual Camera/)
  await page.evaluate(() => window.fixture.disconnect())
  await summary.getByText('Preparazione da completare', { exact: true }).waitFor()
  await check('Scheda collegata').getByText('Da risolvere', { exact: true }).waitFor()
  await diagnostics.getByRole('button', { name: 'Console', exact: true }).click()
  await summary.getByText('Controlli automatici superati', { exact: true }).waitFor()
  await diagnostics.getByRole('button', { name: 'NEB Live', exact: true }).click()
  await page.evaluate(() => window.fixture.reconnect())
  await summary.getByText('Controlli automatici superati', { exact: true }).waitFor()
  await check('Uscita audio').getByRole('button', { name: 'Voce e audio', exact: true }).click()
  assert.equal(await page.locator('.console-audio-settings').evaluate(element => element.open), true)
  await openDiagnostics()
  await check('Scheda collegata').getByRole('button', { name: 'Configura browser', exact: true }).click()
  await page.getByRole('heading', { name: 'Browser e voce', exact: true }).waitFor()
  await page.getByRole('button', { name: 'Verifica sessione', exact: true }).click()
  await page.evaluate(() => { window.fixture.noDevices = true })
  await diagnostics.getByRole('button', { name: 'Ricontrolla', exact: true }).click()
  await check('Uscita audio').getByText('Da risolvere', { exact: true }).waitFor()
  await page.evaluate(() => { window.fixture.noDevices = false; window.fixture.failServices = true })
  await diagnostics.getByRole('button', { name: 'Ricontrolla', exact: true }).click()
  await diagnostics.getByRole('alert').waitFor()
  await check('Qwen · OpenRouter').getByText('Da risolvere', { exact: true }).waitFor()
  await page.evaluate(() => { window.fixture.failServices = false })
  await diagnostics.getByRole('button', { name: 'Ricontrolla', exact: true }).click()
  await summary.getByText('Controlli automatici superati', { exact: true }).waitFor()
  await page.setViewportSize({ width: 980, height: 680 })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false, 'no horizontal overflow at minimum window size')
  await mkdir('.superpowers/diagnostics', { recursive: true })
  await page.screenshot({ path: '.superpowers/diagnostics/preparation.png', fullPage: true })
  await page.getByRole('button', { name: 'Impostazioni', exact: true }).click()
  await page.getByLabel('Provider vocale').selectOption('gemini')
  await openDiagnostics()
  await page.evaluate(() => { window.fixture.holdSpeech = true })
  await diagnostics.getByRole('button', { name: 'Ricontrolla', exact: true }).click()
  await page.waitForFunction(() => window.fixture.releaseSpeech !== null)
  await page.getByRole('button', { name: 'Impostazioni', exact: true }).click()
  await page.evaluate(() => { window.fixture.geminiReady = true })
  await page.getByRole('button', { name: 'Ricontrolla connessione', exact: true }).click()
  await page.locator('.topbar .connection.ready').waitFor()
  await page.evaluate(async () => { window.fixture.releaseSpeech(); await new Promise(resolve => setTimeout(resolve, 200)) })
  assert.equal(await page.locator('.topbar .connection.ready').count(), 1, 'a superseded provider refresh must not overwrite a newer Gemini check')
  assert.equal(await page.evaluate(() => window.fixture.voiceCalls), 0)
  assert.deepEqual(errors, [])
  console.log('Diagnostics smoke passed: Fish, live capture recovery, navigation, unavailable devices/services, responsive layout; no speech or cloud requests.')
} finally {
  if (browser) await browser.close()
  await new Promise(resolve => server.close(resolve))
}
