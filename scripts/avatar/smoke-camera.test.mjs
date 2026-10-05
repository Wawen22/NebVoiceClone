import { test } from 'node:test'
import assert from 'node:assert/strict'
import { assertAvatarCameraTarget } from './smoke-camera.mjs'
test('explicit human confirmation accepts an unsaved OBS target but not a truthy substitute', () => {
  assert.doesNotThrow(() => assertAvatarCameraTarget({ type2: 3 }, true))
  assert.throws(() => assertAvatarCameraTarget({ type2: 3 }, 'true'))
})
test('camera acceptance refuses Program or another scene before opening a device', () => {
  assert.throws(() => assertAvatarCameraTarget({ type2: 3 }), /NEB Avatar/)
  assert.throws(() => assertAvatarCameraTarget({ type2: 1, scene: 'Scene' }), /NEB Avatar/)
  assert.doesNotThrow(() => assertAvatarCameraTarget({ type2: 1, scene: 'NEB Avatar' }))
})
