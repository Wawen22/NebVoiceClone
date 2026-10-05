import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import { createHash, randomUUID, randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

export async function connectObs() {
  const config = JSON.parse(await readFile(path.join(process.env.APPDATA, 'obs-studio/plugin_config/obs-websocket/config.json'), 'utf8'))
  if (!config.server_enabled || !config.auth_required) throw new Error('Abilita OBS WebSocket con autenticazione.')
  const socket = new WebSocket(`ws://127.0.0.1:${config.server_port}`, 'obswebsocket.json'), pending = new Map()
  let resolveReady, rejectReady
  const ready = new Promise((resolve, reject) => { resolveReady = resolve; rejectReady = reject })
  const timer = setTimeout(() => rejectReady(new Error('Timeout autenticazione OBS.')), 10000)
  const digest = (text) => createHash('sha256').update(text).digest('base64')
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(String(data))
    if (message.op === 0) {
      const identify = { rpcVersion: 1, eventSubscriptions: 0 }
      if (message.d.authentication) identify.authentication = digest(digest(config.server_password + message.d.authentication.salt) + message.d.authentication.challenge)
      socket.send(JSON.stringify({ op: 1, d: identify }))
    } else if (message.op === 2) { clearTimeout(timer); resolveReady() }
    else if (message.op === 7) {
      const item = pending.get(message.d.requestId); if (!item) return
      pending.delete(message.d.requestId); clearTimeout(item.timer)
      if (message.d.requestStatus.result) item.resolve(message.d.responseData ?? {})
      else item.reject(new Error(`OBS ${message.d.requestType}: codice ${message.d.requestStatus.code}`))
    }
  })
  socket.addEventListener('error', () => rejectReady(new Error('Connessione OBS fallita.')))
  socket.addEventListener('close', () => { clearTimeout(timer); rejectReady(new Error('OBS scollegato.')); for (const item of pending.values()) { clearTimeout(item.timer); item.reject(new Error('OBS scollegato.')) }; pending.clear() })
  try { await ready } catch (error) { socket.close(); throw error }
  return {
    request: (requestType, requestData = {}) => new Promise((resolve, reject) => {
      const requestId = randomUUID(), timer = setTimeout(() => { pending.delete(requestId); reject(new Error(`Timeout OBS ${requestType}`)) }, 10000)
      pending.set(requestId, { resolve, reject, timer }); socket.send(JSON.stringify({ op: 6, d: { requestType, requestId, requestData } }))
    }), close: () => socket.close()
  }
}

export async function configureAvatarObs(obs, url) {
  const parsed = new URL(url)
  if (parsed.protocol !== 'http:' || parsed.hostname !== '127.0.0.1' || !/^[a-f0-9]{64}$/.test(parsed.searchParams.get('token') ?? '')) throw new Error('URL locale avatar non valido.')
  const sceneName = 'NEB Avatar', inputName = 'NEB Avatar - video locale'
  const scenes = (await obs.request('GetSceneList')).scenes
  const exists = scenes.some((scene) => scene.sceneName === sceneName)
  const items = exists ? (await obs.request('GetSceneItemList', { sceneName })).sceneItems : []
  if (items.some((item) => item.sourceName !== inputName && item.sourceName !== 'NEB Avatar - finestra')) throw new Error('Sorgente non riconosciuta nella scena NEB Avatar; nessuna modifica.')
  const inputs = (await obs.request('GetInputList')).inputs
  const existing = inputs.find((input) => input.inputName === inputName)
  if (existing) {
    const settings = await obs.request('GetInputSettings', { inputName })
    let previous
    try { previous = new URL(settings.inputSettings.url) } catch {}
    if (existing.inputKind !== 'browser_source' || previous?.hostname !== '127.0.0.1' || previous?.port !== parsed.port || previous?.pathname !== '/') throw new Error('Sorgente NEB esistente non riconosciuta; nessuna modifica.')
  }
  const oldItem = items.find((item) => item.sourceName === 'NEB Avatar - finestra')
  const old = oldItem ? inputs.find((input) => input.inputName === oldItem.sourceName) : undefined
  if (old) {
    const settings = await obs.request('GetInputSettings', { inputName: old.inputName })
    if (old.inputKind !== 'window_capture' || settings.inputSettings.window) throw new Error('La cattura finestra esistente non e vuota; nessuna modifica.')
  }
  if (!exists) await obs.request('CreateScene', { sceneName })
  const inputSettings = { url, is_local_file: false, width: 1280, height: 720, shutdown: false, restart_when_active: false, reroute_audio: false }
  let sceneItemId = items.find((item) => item.sourceName === inputName)?.sceneItemId
  if (existing) {
    await obs.request('SetInputSettings', { inputName, inputSettings, overlay: true })
    if (sceneItemId === undefined) sceneItemId = (await obs.request('CreateSceneItem', { sceneName, sourceName: inputName, sceneItemEnabled: true })).sceneItemId
  } else sceneItemId = (await obs.request('CreateInput', { sceneName, inputName, inputKind: 'browser_source', inputSettings, sceneItemEnabled: true })).sceneItemId
  const video = await obs.request('GetVideoSettings')
  await obs.request('SetSceneItemTransform', { sceneName, sceneItemId, sceneItemTransform: { positionX: 0, positionY: 0, rotation: 0, boundsType: 'OBS_BOUNDS_SCALE_INNER', boundsWidth: video.baseWidth, boundsHeight: video.baseHeight, boundsAlignment: 0, alignment: 5, cropLeft: 0, cropRight: 0, cropTop: 0, cropBottom: 0 } })
  await obs.request('SetSceneItemEnabled', { sceneName, sceneItemId, sceneItemEnabled: true })
  await obs.request('SetSceneItemLocked', { sceneName, sceneItemId, sceneItemLocked: true })
  if (old && oldItem) await obs.request('RemoveSceneItem', { sceneName, sceneItemId: oldItem.sceneItemId })
  return { sceneName, inputName }
}

export async function readOutputUrl(configPath, initialize = false) {
  if (initialize) {
    await mkdir(path.dirname(configPath), { recursive: true })
    try { await writeFile(configPath, JSON.stringify({ port: 17890, token: randomBytes(32).toString('hex'), enabled: false }), { flag: 'wx', mode: 0o600 }) } catch (error) { if (error.code !== 'EEXIST') throw error }
  }
  const config = JSON.parse(await readFile(configPath, 'utf8'))
  if (!/^[a-f0-9]{64}$/.test(config.token) || !Number.isInteger(config.port) || config.port < 1 || config.port > 65535) throw new Error('Configurazione uscita OBS non valida.')
  return `http://127.0.0.1:${config.port}/?token=${config.token}`
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const configPath = process.argv.find((arg) => arg.startsWith('--config='))?.slice(9) ?? path.join(process.env.APPDATA, 'neb-voice-console/avatar-output.json')
  const url = await readOutputUrl(configPath, process.argv.includes('--initialize-config'))
  const backup = path.resolve('.superpowers/avatar/obs-backup/Untitled-before-neb.json')
  await mkdir(path.dirname(backup), { recursive: true })
  try { await copyFile(path.join(process.env.APPDATA, 'obs-studio/basic/scenes/Untitled.json'), backup, constants.COPYFILE_EXCL) } catch (error) { if (error.code !== 'EEXIST') throw error }
  const obs = await connectObs()
  try { console.log(JSON.stringify(await configureAvatarObs(obs, url))) } finally { obs.close() }
}
