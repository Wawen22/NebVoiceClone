import { test } from 'node:test'
import assert from 'node:assert/strict'
import { configureAvatarObs } from './configure-obs.mjs'

test('creates only dedicated avatar source and leaves global OBS state alone', async () => {
  const calls = []
  const request = async (type, data = {}) => {
    calls.push({ type, data })
    if (type === 'GetSceneList') return { scenes: [{ sceneName: 'Scene' }, { sceneName: 'NEB Avatar' }] }
    if (type === 'GetSceneItemList') return { sceneItems: [{ sourceName: 'NEB Avatar - finestra', sceneItemId: 7 }] }
    if (type === 'GetInputList') return { inputs: [{ inputName: 'VivoX300', inputKind: 'browser_source' }, { inputName: 'NEB Avatar - finestra', inputKind: 'window_capture' }] }
    if (type === 'GetInputSettings') return { inputKind: 'window_capture', inputSettings: { window: '' } }
    if (type === 'CreateInput') return { sceneItemId: 8 }
    if (type === 'GetVideoSettings') return { baseWidth: 1920, baseHeight: 1080 }
    return {}
  }
  await configureAvatarObs({ request }, 'http://127.0.0.1:17890/?token=' + 'a'.repeat(64))
  const create = calls.find((call) => call.type === 'CreateInput')
  assert.equal(create.data.inputKind, 'browser_source'); assert.equal(create.data.inputSettings.shutdown, false); assert.equal(create.data.inputSettings.restart_when_active, false)
  assert.equal(create.data.inputSettings.width, 1280); assert.equal(create.data.inputSettings.height, 720)
  assert.equal(calls.find((call) => call.type === 'RemoveInput').data.inputName, 'NEB Avatar - finestra')
  assert(!calls.some((call) => /Stream|Record|VirtualCam|CurrentProgram|SetVideo|Audio|Profile/.test(call.type)))
})
test('refuses unrelated sources inside the dedicated scene', async () => {
  const calls = []
  const request = async (type) => { calls.push(type); if (type === 'GetSceneList') return { scenes: [{ sceneName: 'NEB Avatar' }] }; if (type === 'GetSceneItemList') return { sceneItems: [{ sourceName: 'private-camera', sceneItemId: 1 }] }; return { inputs: [] } }
  await assert.rejects(configureAvatarObs({ request }, 'http://127.0.0.1:17890/?token=' + 'a'.repeat(64)), /non riconosciut/)
  assert(!calls.some((type) => /Create|Remove|Set/.test(type)))
})
