import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { expect, it } from 'vitest'
import { ProjectStore } from './projectStore'
import { defaultOutlierData } from '../../shared/outlier'

it('keeps a corrupt project archive intact when a save is requested', async () => {
  const path = join(await mkdtemp(join(tmpdir(), 'neb-outlier-')), 'outlier.json')
  await writeFile(path, '{broken')
  const store = new ProjectStore(path)
  await expect(store.read()).rejects.toThrow('progetti')
  await expect(store.save(defaultOutlierData())).rejects.toThrow('progetti')
  expect(await readFile(path, 'utf8')).toBe('{broken')
})
it('serializes writes and restores archived project metadata', async () => {
  const path = join(await mkdtemp(join(tmpdir(), 'neb-outlier-')), 'outlier.json')
  const store = new ProjectStore(path)
  const first = defaultOutlierData()
  const second = { ...first, charactersPerMinute: 300, projects: [{ ...first.projects[0], archived: true }] }
  await Promise.all([store.save(first), store.save(second)])
  expect(await store.read()).toEqual(second)
})
