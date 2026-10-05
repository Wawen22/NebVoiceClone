import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import assert from 'node:assert/strict'

export function assertAvatarCameraTarget(target, humanConfirmed = false) {
  if (humanConfirmed === true) return
  if (target?.type2 !== 1 || target.scene !== 'NEB Avatar') throw new Error('Imposta webcam virtuale OBS: Scena -> NEB Avatar, non Programma.')
}

export async function verifyAvatarCamera(browser, obs, humanConfirmed = false) {
  const collection = JSON.parse(await readFile(path.join(process.env.APPDATA, 'obs-studio/basic/scenes/Untitled.json'), 'utf8'))
  // OBS may retain the live dialog selection without saving its scene file yet.
  assertAvatarCameraTarget(collection['virtual-camera'], humanConfirmed)
  assert.equal((await obs.request('GetVirtualCamStatus')).outputActive, false, 'Ferma la webcam virtuale prima del test locale.')
  const original = (await obs.request('GetCurrentProgramScene')).currentProgramSceneName
  const blankScene = 'NEB test ' + randomUUID(), context = await browser.newContext()
  let cameraStarted = false, blankCreated = false
  const server = createServer((req, res) => {
    if (req.method !== 'GET' || req.url !== '/') { res.writeHead(404); res.end(); return }
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('Permissions-Policy', 'camera=(self), microphone=()')
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; media-src blob:; base-uri 'none'")
    res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><title>NEB camera test</title><video muted autoplay playsinline style="width:100%"></video>')
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  try {
    const origin = `http://127.0.0.1:${server.address().port}`
    await context.grantPermissions(['camera'], { origin })
    const page = await context.newPage(); await page.goto(origin)
    await obs.request('StartVirtualCam'); cameraStarted = true
    const settings = await page.evaluate(async () => {
      const device = (await navigator.mediaDevices.enumerateDevices()).find((device) => device.kind === 'videoinput' && device.label === 'OBS Virtual Camera')
      if (!device) throw new Error('OBS Virtual Camera non trovata; nessun fallback alla webcam fisica.')
      const stream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: device.deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })
      window.cameraStream = stream; const video = document.querySelector('video'); video.srcObject = stream; await video.play()
      return { ...stream.getVideoTracks()[0].getSettings(), audioTracks: stream.getAudioTracks().length }
    })
    assert.equal(settings.audioTracks, 0)
    await page.waitForFunction(() => document.querySelector('video').getVideoPlaybackQuality().totalVideoFrames > 10)
    await obs.request('CreateScene', { sceneName: blankScene }); blankCreated = true
    await obs.request('SetCurrentProgramScene', { sceneName: blankScene })
    const initialFrames = await page.locator('video').evaluate((video) => video.getVideoPlaybackQuality().totalVideoFrames)
    await new Promise((resolve) => setTimeout(resolve, 2000))
    const pixels = await page.evaluate(() => {
      const video = document.querySelector('video'), canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 72
      const ctx = canvas.getContext('2d'); ctx.drawImage(video, 0, 0, 128, 72)
      const bytes = ctx.getImageData(0, 0, 128, 72).data; let sum = 0, squared = 0, count = 0
      for (let i = 0; i < bytes.length; i++) if (i % 4 !== 3) { sum += bytes[i]; squared += bytes[i] ** 2; count++ }
      return { deviation: Math.sqrt(squared / count - (sum / count) ** 2), frames: video.getVideoPlaybackQuality().totalVideoFrames, width: video.videoWidth, height: video.videoHeight }
    })
    assert(pixels.frames - initialFrames >= 20, 'Camera video not advancing')
    assert(pixels.deviation > 10, 'Camera followed blank Program scene or avatar is not visible')
    return { width: pixels.width, height: pixels.height, decodedFrames: pixels.frames - initialFrames, pinnedSceneVerified: true, audioTracks: 0 }
  } finally {
    await context.close()
    try { if (cameraStarted) await obs.request('StopVirtualCam'); await obs.request('SetCurrentProgramScene', { sceneName: original }); if (blankCreated) await obs.request('RemoveScene', { sceneName: blankScene }) }
    finally { await new Promise((resolve) => { server.close(resolve); server.closeAllConnections() }) }
  }
}
