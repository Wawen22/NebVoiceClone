import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, rm, truncate } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const script = fileURLToPath(new URL('./timing-report.mjs', import.meta.url))
const run = (...args) => spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' })
const exported = log => ({ schemaVersion: 1, mode: 'neb-live', exportedAt: '2026-10-06T12:00:00Z', snapshot: { log, transcript: [{ text: 'PRIVATE TRANSCRIPT' }] } })
const response = (id, durationMs, providerId = 'gemini', modelId = 'model-a') => [
  { kind: 'turn-response', atMs: 100, responseId: id, durationMs, breakdown: { beforeQwenMs: durationMs - 900, qwenMs: 400, beforeVoiceMs: 300, voiceStartMs: 200 } },
  { kind: 'voice-first-chunk', atMs: 101, responseId: id, durationMs: 100, providerId, modelId }
]

async function withFiles(files, body) {
  const directory = await mkdtemp(join(tmpdir(), 'neb-timing-report-'))
  try {
    const paths = []
    for (const [name, data] of Object.entries(files)) {
      const path = join(directory, name)
      await writeFile(path, typeof data === 'string' ? data : JSON.stringify(data))
      paths.push(path)
    }
    await body(paths)
  } finally { await rm(directory, { recursive: true, force: true }) }
}

test('reports independent sessions and provider/model groups without exposing transcripts', async () => {
  await withFiles({ 'rapid.json': exported([...response('same', 1000), ...response('b', 3000), ...response('c', 2000, 'fish-openrouter', 'fish'), ...response('d', 4000, 'gemini', 'model-b')]), 'natural.json': exported(response('same', 5000)) }, async paths => {
    const result = run('--json', ...paths)
    assert.equal(result.status, 0, result.stderr)
    const report = JSON.parse(result.stdout)
    assert.equal(report.sessions.length, 2)
    const group = report.sessions[0].groups[0]
    assert.equal(group.count, 2)
    assert.deepEqual(group.total, { count: 2, medianMs: 2000, p95Ms: 3000, maxMs: 3000 })
    assert.deepEqual(group.stages.beforeQwenMs, { count: 2, medianMs: 1100, p95Ms: 2100, maxMs: 2100 })
    assert.equal(group.firstChunk.medianMs, 100)
    assert.equal(group.generation.medianMs, null)
    assert.equal(report.sessions[0].groups.length, 3)
    assert.equal(report.sessions[1].groups[0].total.medianMs, 5000)
    assert.ok(!result.stdout.includes('PRIVATE TRANSCRIPT'))
    assert.ok(!result.stdout.includes(join(paths[0], '..')))
    const text = run(...paths)
    assert.equal(text.status, 0, text.stderr)
    assert.match(text.stdout, /rapid\.json/)
    assert.match(text.stdout, /P95/)
    assert.match(text.stdout, /Non disponibile/)
    assert.ok(!text.stdout.includes('PRIVATE TRANSCRIPT'))
  })
})

test('keeps legacy and missing measurements unknown and ignores failed attempts', async () => {
  const logs = [{ kind: 'turn-response', atMs: 1, durationMs: 0 }, { kind: 'turn-response', atMs: 2, durationMs: -1 }, { kind: 'voice-generation', atMs: 3, responseId: 'failed', durationMs: 9999, providerId: 'gemini' }]
  await withFiles({ 'old.json': exported(logs), 'empty.json': exported([]) }, async paths => {
    const result = run('--json', ...paths)
    assert.equal(result.status, 0, result.stderr)
    const [old, empty] = JSON.parse(result.stdout).sessions
    assert.equal(old.groups[0].total.medianMs, 0)
    assert.equal(old.groups[0].providerId, null)
    assert.equal(old.groups[0].stages.qwenMs.count, 0)
    assert.equal(old.groups[0].firstChunk.medianMs, null)
    assert.equal(empty.groups.length, 0)
  })
})

test('does not invent stage measurements from incomplete or inconsistent JSON', async () => {
  const [partial] = response('partial', 2000)
  partial.breakdown = { beforeQwenMs: 2000 }
  const [inconsistent] = response('bad', 3000)
  inconsistent.breakdown.qwenMs = 9999
  await withFiles({ 'partial.json': exported([partial, inconsistent]) }, async paths => {
    const result = run('--json', ...paths)
    assert.equal(result.status, 0, result.stderr)
    const group = JSON.parse(result.stdout).sessions[0].groups[0]
    assert.equal(group.count, 2)
    assert.equal(group.stages.beforeQwenMs.count, 0)
  })
})

test('rejects invalid exports and duplicate files without partial output or private contents', async () => {
  await withFiles({ 'valid.json': exported([]), 'invalid.json': '{PRIVATE BAD JSON', 'wrong-mode.json': { ...exported([]), mode: 'other' }, 'wrong-log.json': exported([null]), 'future.json': { ...exported([]), schemaVersion: 99 } }, async paths => {
    for (const path of paths.slice(1)) {
      const result = run('--json', paths[0], path)
      assert.equal(result.status, 1)
      assert.equal(result.stdout, '')
      assert.ok(!result.stderr.includes('PRIVATE'))
    }
    assert.equal(run(paths[0], paths[0]).status, 1)
    assert.equal(run(join(paths[0], '..', 'absent.json')).status, 1)
  })
})

test('prints help and rejects unknown options or missing input', () => {
  assert.equal(run('--help').status, 0)
  assert.equal(run().status, 1)
  assert.equal(run('--unknown').status, 1)
})

test('uses the nearest-rank P95 across more than twenty turns', async () => {
  await withFiles({ 'many.json': exported(Array.from({ length: 21 }, (_, index) => response(String(index), (index + 1) * 1000)).flat()) }, async paths => {
    const result = run('--json', ...paths)
    assert.equal(result.status, 0, result.stderr)
    const total = JSON.parse(result.stdout).sessions[0].groups[0].total
    assert.deepEqual(total, { count: 21, medianMs: 11000, p95Ms: 20000, maxMs: 21000 })
  })
})

test('rejects oversized files and directories before parsing', async () => {
  await withFiles({ 'large.json': '' }, async paths => {
    await truncate(paths[0], 16 * 1024 * 1024 + 1)
    for (const path of [paths[0], join(paths[0], '..')]) {
      const result = run(path)
      assert.equal(result.status, 1)
      assert.equal(result.stdout, '')
    }
  })
})
