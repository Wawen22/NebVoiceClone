import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { LiveConfigStore } from './configStore'
import { DEFAULT_LIVE_CONFIG } from '../../shared/live'

const directories: string[] = []
afterEach(async () => { await Promise.all(directories.splice(0).map((path) => rm(path, { recursive: true, force: true }))) })
async function path(): Promise<string> { const dir = await mkdtemp(join(tmpdir(), 'neb-live-')); directories.push(dir); return join(dir, 'live.json') }

it('starts with isolated defaults and serializes atomic configuration writes without conversation data', async () => {
  const file = await path()
  const store = new LiveConfigStore(file)
  const first = await store.read()
  first.profiles[0].name = 'Changed'
  expect((await store.read()).profiles[0].name).not.toBe('Changed')
  await Promise.all([store.save({ ...DEFAULT_LIVE_CONFIG, background: 'First' }), store.save({ ...DEFAULT_LIVE_CONFIG, background: 'Last', history: ['private'] })])
  expect((await store.read()).background).toBe('Last')
  expect(await readFile(file, 'utf8')).not.toContain('private')
})

it('preserves malformed user configuration and refuses to overwrite it', async () => {
  const file = await path(); await writeFile(file, '{broken')
  const store = new LiveConfigStore(file)
  await expect(store.read()).rejects.toThrow()
  await expect(store.save(DEFAULT_LIVE_CONFIG)).rejects.toThrow()
  expect(await readFile(file, 'utf8')).toBe('{broken')
})
