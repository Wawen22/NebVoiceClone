import { expect, it } from 'vitest'
import { LiveStartGate } from './startGate'

function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((done) => { resolve = done }); return { promise, resolve } }

it('owns the entire save-before-start transaction and prevents committing after Stop', async () => {
  const gate = new LiveStartGate(), save = deferred<string>(), committed: string[] = []
  let signal!: AbortSignal
  const result = gate.run(async (ownedSignal) => { signal = ownedSignal; return await save.promise }, (config) => { committed.push(config) })
  expect(gate.pending).toBe(true)
  gate.cancel(); save.resolve('saved profile')
  expect(await result).toBe(false)
  expect(signal.aborted).toBe(true)
  expect(committed).toEqual([])
  expect(gate.pending).toBe(false)
})

it('cannot double-start and an obsolete save cannot clear a newer pending start', async () => {
  const gate = new LiveStartGate(), old = deferred<string>(), current = deferred<string>(), committed: string[] = []
  const a = gate.run(async () => old.promise, (value) => { committed.push(value) })
  expect(await gate.run(async () => 'duplicate', (value) => { committed.push(value) })).toBe(false)
  gate.cancel()
  const b = gate.run(async () => current.promise, (value) => { committed.push(value) })
  old.resolve('obsolete'); expect(await a).toBe(false); expect(gate.pending).toBe(true)
  current.resolve('current'); expect(await b).toBe(true)
  expect(committed).toEqual(['current']); expect(gate.pending).toBe(false)
})
