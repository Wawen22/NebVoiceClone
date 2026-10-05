// Windows-only acceptance: real Electron window minimization, local-only viewer.
import { createRequire } from 'node:module'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { cpus } from 'node:os'
import assert from 'node:assert/strict'
import { connectObs, configureAvatarObs, readOutputUrl } from './configure-obs.mjs'
import { verifyAvatarCamera } from './smoke-camera.mjs'
const require = createRequire(path.resolve('.superpowers/outlier-smoke/package.json'))
const { _electron, chromium } = require('playwright')
const cloud = process.argv.includes('--cloud')
const passiveObs = process.argv.includes('--obs-passive')
const useObs = process.argv.includes('--obs') || passiveObs
const useCamera = process.argv.includes('--camera')
assert(!useCamera || useObs, '--camera requires --obs')
const { ELECTRON_RUN_AS_NODE: ignored, ...env } = process.env
const app = await _electron.launch({ executablePath: path.join(process.env.LOCALAPPDATA, 'NEBVoiceConsole/dev/node_modules/electron/dist/electron.exe'), args: [path.resolve('out/main/index.js')], cwd: process.cwd(), env: { ...env, NEB_INSTANCE: 'avatar-output-smoke' } })
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-proxy-server'] })
const artifacts = path.resolve('.superpowers/avatar/output')
await mkdir(artifacts, { recursive: true })
let obs, originalScene, productionUrl, programChanged = false, sourceConfigured = false
try {
  const page = await app.firstWindow()
  if (!cloud) {
    await app.evaluate(({ ipcMain }) => { ipcMain.removeHandler('avatar:session'); ipcMain.handle('avatar:session', () => ({ sessionToken: 'fixture', iceServers: [{ urls: 'stun:fixture.invalid' }] })) })
    await page.addInitScript((large) => {
      const canvas = document.createElement('canvas'); canvas.width = large ? 1024 : 512; canvas.height = canvas.width
      const ctx = canvas.getContext('2d')
      if (large) ctx.scale(2, 2)
      const draw = () => {
        const now = Date.now(); ctx.fillStyle = `hsl(${Math.floor(now / 100) % 360} 70% 45%)`; ctx.fillRect(0, 0, 512, 512)
        for (let bit = 0; bit < 48; bit++) { ctx.fillStyle = Math.floor(now / 2 ** bit) % 2 ? '#fff' : '#000'; ctx.fillRect((bit % 16) * 20, Math.floor(bit / 16) * 20, 20, 20) }
      }
      draw(); setInterval(draw, 40)
      const stream = canvas.captureStream(25)
      window.RTCPeerConnection = class extends EventTarget {
        iceGatheringState = 'complete'; localDescription = { sdp: 'fixture', type: 'offer' }
        addTransceiver() {} async createOffer() { return this.localDescription } async setLocalDescription() {}
        async setRemoteDescription() {
          const context = new AudioContext(), audio = context.createMediaStreamDestination().stream
          for (const [kind, media] of [['video', stream], ['audio', audio]]) { const event = new Event('track'); Object.assign(event, { track: { kind }, streams: [media] }); this.dispatchEvent(event) }
        }
        close() {}
      }
      window.WebSocket = class {
        static OPEN = 1; readyState = 1
        constructor() { setTimeout(() => this.onopen?.(), 20) }
        addEventListener() {}
        send(data) { if (typeof data === 'string' && data.includes('sdp')) setTimeout(() => this.onmessage?.({ data: '{"sdp":"fixture","type":"answer"}' }), 10) }
        close() { this.readyState = 3 }
      }
    }, process.argv.includes('--large-fixture'))
    await page.reload()
  }
  await page.getByRole('checkbox', { name: 'Attiva avatar' }).check()
  await page.getByRole('checkbox', { name: 'Uscita OBS' }).check()
  const url = await page.evaluate(() => window.neb.getAvatarOutputUrl()) // Never print the local token.
  if (useObs) {
    obs = await connectObs()
    assert.equal((await obs.request('GetStreamStatus')).outputActive, false, 'Refusing OBS test during streaming')
    assert.equal((await obs.request('GetRecordStatus')).outputActive, false, 'Refusing OBS test during recording')
    const cameraActive = (await obs.request('GetVirtualCamStatus')).outputActive
    productionUrl = await readOutputUrl(path.join(process.env.APPDATA, 'neb-voice-console/avatar-output.json'))
    originalScene = (await obs.request('GetCurrentProgramScene')).currentProgramSceneName
    if (cameraActive) {
      assert(passiveObs && !useCamera, 'Close active virtual camera before test')
      const collection = JSON.parse(await readFile(path.join(process.env.APPDATA, 'obs-studio/basic/scenes/Untitled.json'), 'utf8'))
      assert.equal(collection['virtual-camera']?.type2, 3, 'Passive test requires camera pinned to unchanged Program')
      const items = (await obs.request('GetSceneItemList', { sceneName: originalScene })).sceneItems
      assert(items.every((item) => item.inputKind && item.sourceName !== 'NEB Avatar - video locale'), 'Passive test refuses nested scenes or avatar in Program')
    }
    await configureAvatarObs(obs, url)
    sourceConfigured = true
    if (!passiveObs) { await obs.request('SetCurrentProgramScene', { sceneName: 'NEB Avatar' }); programChanged = true }
  }
  const viewer = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  const network = []
  viewer.on('console', (message) => { if (message.type() === 'error') network.push({ error: message.text().replace(/http[^\s"']+/g, '[local-url]') }) })
  viewer.on('response', (response) => { if (response.url().startsWith('http')) network.push({ path: new URL(response.url()).pathname, status: response.status() }) })
  viewer.on('requestfailed', (request) => { if (request.url().startsWith('http')) network.push({ path: new URL(request.url()).pathname, failure: request.failure()?.errorText }) })
  await viewer.goto(url)
  await viewer.evaluate(() => {
    window.measure = { timestamps: [], signatures: [], loads: [], visible: false }
    document.querySelector('img').addEventListener('load', () => window.measure.loads.push(Date.now()))
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 512; const ctx = canvas.getContext('2d')
    setInterval(() => {
      const image = document.querySelector('img'); const visible = getComputedStyle(image).visibility === 'visible' && image.naturalWidth > 0
      window.measure.visible = visible
      if (!visible) return
      try {
        ctx.drawImage(image, 0, 0, 512, 512); let timestamp = 0
        for (let bit = 0; bit < 48; bit++) if (ctx.getImageData((bit % 16) * 20 + 10, Math.floor(bit / 16) * 20 + 10, 1, 1).data[0] > 127) timestamp += 2 ** bit
        const pixels = ctx.getImageData(200, 200, 24, 24).data; let signature = 0; for (let i = 0; i < pixels.length; i++) signature = (signature * 31 + pixels[i]) >>> 0
        window.measure.signatures.push(signature); window.measure.timestamps.push({ source: timestamp, received: Date.now() })
      } catch {}
    }, 20)
  })
  await page.getByRole('button', { name: 'Collega avatar', exact: true }).click()
  await page.waitForFunction(() => document.querySelector('.avatar-status')?.textContent.includes('Avatar pronto'), null, { timeout: 30000 })
  if (cloud) {
    const wav = await readFile('.superpowers/avatar/probe.wav')
    const pcm = await page.evaluate(async (base64) => {
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)), context = new AudioContext()
      const decoded = await context.decodeAudioData(bytes.buffer), offline = new OfflineAudioContext(1, Math.ceil(decoded.duration * 24000), 24000)
      const source = offline.createBufferSource(); source.buffer = decoded; source.connect(offline.destination); source.start()
      const converted = await offline.startRendering(), samples = converted.getChannelData(0), pcm = new Uint8Array(samples.length * 2), view = new DataView(pcm.buffer)
      samples.forEach((sample, i) => view.setInt16(i * 2, Math.round(Math.max(-1, Math.min(1, sample)) * 32767), true)); await context.close(); return Array.from(pcm)
    }, wav.toString('base64'))
    await app.evaluate(({ ipcMain }, samples) => {
      ipcMain.removeHandler('speech:synthesizeStream')
      ipcMain.handle('speech:synthesizeStream', (event, _request, streamId) => { for (let repeat = 0; repeat < 2; repeat++) event.sender.send('speech:chunk', streamId, new Uint8Array(samples)); return { generationMs: 1 } })
    }, pcm)
    await page.getByRole('button', { name: 'Test voce avatar', exact: true }).click()
    await page.waitForFunction(() => document.querySelector('.avatar-status')?.textContent.includes('NEB sta parlando'), null, { timeout: 30000 })
  }
  await viewer.waitForFunction(() => window.measure.visible, null, { timeout: 15000 }).catch(async (error) => {
    console.log(JSON.stringify({ network: network.slice(-20), status: await page.evaluate(() => window.neb.getAvatarOutputStatus()), video: await page.locator('video[aria-label="Anteprima avatar"]').evaluate((v) => ({ readyState: v.readyState, width: v.videoWidth, frames: v.getVideoPlaybackQuality().totalVideoFrames })), viewer: await viewer.evaluate(() => ({ visible: window.measure.visible, naturalWidth: document.querySelector('img').naturalWidth, visibility: getComputedStyle(document.querySelector('img')).visibility })) })); throw error
  })
  let firstObs
  if (obs) { await new Promise((resolve) => setTimeout(resolve, 1500)); firstObs = (await obs.request('GetSourceScreenshot', { sourceName: 'NEB Avatar', imageFormat: 'png', imageWidth: 1280, imageHeight: 720 })).imageData }
  await viewer.evaluate(() => { window.measure.timestamps = []; window.measure.signatures = []; window.measure.loads = [] })
  const beforeFrames = await page.locator('video[aria-label="Anteprima avatar"]').evaluate((video) => video.getVideoPlaybackQuality().totalVideoFrames)
  const cpuBefore = await app.evaluate(({ app }) => app.getAppMetrics().map(({ pid, cpu }) => ({ pid, seconds: cpu.cumulativeCPUUsage })))
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].minimize())
  assert(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isMinimized()))
  await new Promise((resolve) => setTimeout(resolve, 20500))
  const afterFrames = await page.locator('video[aria-label="Anteprima avatar"]').evaluate((video) => video.getVideoPlaybackQuality().totalVideoFrames)
  const measurements = await viewer.evaluate(() => window.measure)
  assert(afterFrames - beforeFrames >= 200, `Decoded frames during minimization: ${afterFrames - beforeFrames}`)
  const unique = new Set(measurements.signatures).size; assert(unique >= 10, `Frozen output: ${unique} distinct signatures`)
  const deltas = measurements.timestamps.filter((sample, i, list) => !i || sample.source !== list[i - 1].source)
  const latency = deltas.map((sample) => sample.received - sample.source).sort((a, b) => a - b)
  const cpuAfter = await app.evaluate(({ app }) => app.getAppMetrics().map(({ pid, cpu }) => ({ pid, seconds: cpu.cumulativeCPUUsage })))
  const cpuSeconds = cpuAfter.reduce((total, value) => total + Math.max(0, value.seconds - (cpuBefore.find((item) => item.pid === value.pid)?.seconds ?? value.seconds)), 0)
  const dimensions = await viewer.locator('img').evaluate((image) => ({ width: image.naturalWidth, height: image.naturalHeight }))
  const result = { cloud, outputDimensions: dimensions, minimizedSeconds: 20.5, decodedFrames: afterFrames - beforeFrames, distinctSignatures: unique, outputFps: measurements.loads.length / 20.5, ...(cloud ? {} : { p95LocalDelayMs: latency[Math.floor(latency.length * 0.95)] }), averageAppCpuPercentAllCores: cpuSeconds / 20.5 * 100 / cpus().length }
  if (obs) {
    const screenshot = (await obs.request('GetSourceScreenshot', { sourceName: 'NEB Avatar', imageFormat: 'png', imageWidth: 1280, imageHeight: 720 })).imageData
    assert.notEqual(screenshot, firstObs, 'OBS avatar image is frozen or blank')
    await writeFile(path.join(artifacts, cloud ? 'obs-cloud.png' : 'obs-synthetic.png'), Buffer.from(screenshot.split(',')[1], 'base64'))
    result.obsChangingFrames = true
    if (useCamera) result.camera = await verifyAvatarCamera(browser, obs, process.argv.includes('--camera-target-confirmed'))
    if (programChanged) await obs.request('SetCurrentProgramScene', { sceneName: originalScene })
  }
  if (!cloud) {
    const large = process.argv.includes('--large-fixture')
    console.log(JSON.stringify({ benchmark: result }))
    assert(result.outputFps >= (large ? 16 : 20), `Output FPS ${result.outputFps}`)
    assert(result.p95LocalDelayMs < 250, `Delay ${result.p95LocalDelayMs}`)
    assert.equal(dimensions.width, large ? 720 : 512)
  }
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].restore())
  const coveredBefore = await page.locator('video[aria-label="Anteprima avatar"]').evaluate((video) => video.getVideoPlaybackQuality().totalVideoFrames)
  await app.evaluate(async ({ BrowserWindow }) => { const main = BrowserWindow.getAllWindows()[0]; global.outputCover = new BrowserWindow({ ...main.getBounds(), title: 'NEB output test', alwaysOnTop: true, webPreferences: { sandbox: true, nodeIntegration: false } }); await global.outputCover.loadURL('data:text/html,<body style="background:%23101416">') })
  await new Promise((resolve) => setTimeout(resolve, 2000))
  const coveredAfter = await page.locator('video[aria-label="Anteprima avatar"]').evaluate((video) => video.getVideoPlaybackQuality().totalVideoFrames)
  await app.evaluate(() => { global.outputCover.close(); global.outputCover = null })
  assert(coveredAfter - coveredBefore >= 20, 'Video stopped with covered window'); result.coveredDecodedFrames = coveredAfter - coveredBefore
  const videoIdentity = await page.locator('video[aria-label="Anteprima avatar"]').evaluate((video) => { window.originalOutputVideo = video; return true }); assert(videoIdentity)
  await page.getByRole('button', { name: 'Espandi avatar', exact: true }).click(); await page.keyboard.press('Escape')
  assert(await page.evaluate(() => window.originalOutputVideo === document.querySelector('video[aria-label="Anteprima avatar"]')))
  await viewer.screenshot({ path: path.join(artifacts, cloud ? 'cloud-output.png' : 'synthetic-output.png') })
  await page.getByRole('button', { name: 'Scollega avatar', exact: true }).click()
  await viewer.waitForFunction(() => !window.measure.visible, null, { timeout: 3500 })
  await writeFile(path.join(artifacts, cloud ? 'cloud-result.json' : 'synthetic-result.json'), JSON.stringify(result, null, 2))
  console.log(JSON.stringify(result))
} finally {
  try { if (obs) { try { if (programChanged) await obs.request('SetCurrentProgramScene', { sceneName: originalScene }); if (sourceConfigured && productionUrl) await configureAvatarObs(obs, productionUrl) } finally { obs.close() } } }
  finally { await browser.close(); await app.close() }
}
