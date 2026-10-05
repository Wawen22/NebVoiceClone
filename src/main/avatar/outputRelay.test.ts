import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { request } from 'node:http'
import { AvatarOutputRelay } from './outputRelay'

describe('local avatar relay', () => {
  let dir: string, relay: AvatarOutputRelay, now: number
  const jpeg = new Uint8Array([255, 216, 255, 224, 1, 2, 255, 217])
  beforeEach(async () => { dir = await mkdtemp(join(tmpdir(), 'neb-output-')); now = 1000; relay = new AvatarOutputRelay({ userData: dir, port: 0, now: () => now }); await relay.start() })
  afterEach(async () => { await relay.close(); await rm(dir, { recursive: true, force: true }) })
  it('starts disabled and exposes only loopback and a stable 32-byte token', async () => {
    expect(relay.getStatus()).toEqual({ enabled: false, available: true, viewers: 0 })
    const url = new URL(relay.getUrl()); expect(url.hostname).toBe('127.0.0.1'); expect(url.searchParams.get('token')).toMatch(/^[a-f0-9]{64}$/)
    await relay.close(); const second = new AvatarOutputRelay({ userData: dir, port: Number(url.port) }); await second.start()
    expect(second.getUrl()).toBe(url.href); await second.close()
  })
  it('persists output enablement without a cloud session', async () => {
    relay.setEnabled(true); await relay.close(); const second = new AvatarOutputRelay({ userData: dir, port: 0 }); await second.start(); expect(second.getStatus().enabled).toBe(true); await second.close()
  })
  it('serves only authorized GET routes with restrictive policy', async () => {
    const response = await fetch(relay.getUrl()); expect(response.status).toBe(200); expect(response.headers.get('content-security-policy')).toContain("default-src 'none'"); expect(response.headers.get('permissions-policy')).toContain('camera=()')
    expect(await response.text()).toContain('object-fit:contain')
    expect((await fetch(relay.getUrl(), { method: 'POST' })).status).toBe(405)
    const bad = new URL(relay.getUrl()); bad.searchParams.set('token', 'wrong'); expect((await fetch(bad)).status).toBe(403)
    const unknown = new URL(relay.getUrl()); unknown.pathname = '/private'; expect((await fetch(unknown)).status).toBe(404)
    const status = await new Promise<number>((resolve) => { const req = request(relay.getUrl(), { headers: { Host: 'attacker.example' } }, (res) => { res.resume(); resolve(res.statusCode!) }); req.end() }); expect(status).toBe(403)
  })
  it('rejects malformed HTTP request targets without crashing the server', async () => {
    const url = new URL(relay.getUrl())
    const status = await new Promise<number>((resolve) => {
      const req = request({ hostname: url.hostname, port: url.port, path: '//[', headers: { Host: url.host } }, (response) => { response.resume(); resolve(response.statusCode!) })
      req.on('error', () => resolve(0)); req.setTimeout(500, () => req.destroy()); req.end()
    })
    expect(status).toBe(400); expect((await fetch(relay.getUrl())).status).toBe(200)
  })
  it('rejects stale, disabled, oversized and non-JPEG frames and rate limits', () => {
    const old = relay.beginGeneration(); expect(relay.publish({ generation: old, jpeg })).toBe(false)
    relay.setEnabled(true); const current = relay.beginGeneration()
    expect(relay.publish({ generation: old, jpeg })).toBe(false)
    expect(relay.publish({ generation: current, jpeg: new Uint8Array(256 * 1024 + 1) })).toBe(false)
    expect(relay.publish({ generation: current, jpeg: new Uint8Array([1, 2, 3]) })).toBe(false)
    expect(relay.publish({ generation: current, jpeg })).toBe(true)
    expect(relay.publish({ generation: current, jpeg })).toBe(false)
    now += 67; expect(relay.publish({ generation: current, jpeg })).toBe(true)
    relay.clear(current); now += 67; expect(relay.publish({ generation: current, jpeg })).toBe(false)
    const next = relay.beginGeneration(); relay.setEnabled(false); expect(relay.publish({ generation: next, jpeg })).toBe(false)
  })
  it('does not silently change an occupied port', async () => {
    const occupied = new AvatarOutputRelay({ userData: join(dir, 'other'), port: Number(new URL(relay.getUrl()).port) }); await occupied.start()
    expect(occupied.getStatus().available).toBe(false); expect(occupied.getStatus().error).toContain('17890') // User-facing guidance names the default port.
    await occupied.close()
  })
  it('caps four viewers and expires video after three seconds', async () => {
    relay.setEnabled(true); const connections: AbortController[] = []
    try {
      for (let i = 0; i < 4; i++) { const controller = new AbortController(); connections.push(controller); const url = new URL(relay.getUrl()); url.pathname = '/video'; url.searchParams.set('viewer', String(i)); expect((await fetch(url, { signal: controller.signal })).status).toBe(200) }
      expect(relay.getStatus().viewers).toBe(4)
      const fifth = new URL(relay.getUrl()); fifth.pathname = '/events'; fifth.searchParams.set('viewer', 'fifth'); expect((await fetch(fifth)).status).toBe(429)
      const generation = relay.beginGeneration(); expect(relay.publish({ generation, jpeg })).toBe(true)
      now += 3001; await new Promise((resolve) => setTimeout(resolve, 300)); expect(relay.publish({ generation, jpeg })).toBe(false)
    } finally { connections.forEach((controller) => controller.abort()) }
  })
  it('delivers a bounded JPEG in the working event transport and clears it on Stop', async () => {
    relay.setEnabled(true); const controller = new AbortController(), url = new URL(relay.getUrl()); url.pathname = '/events'; url.searchParams.set('viewer', 'event-test')
    try {
      const response = await fetch(url, { signal: controller.signal }), reader = response.body!.getReader()
      await reader.read(); const generation = relay.beginGeneration(); relay.publish({ generation, jpeg })
      let text = ''; for (let i = 0; i < 4 && !text.includes('jpeg'); i++) text += new TextDecoder().decode((await reader.read()).value)
      expect(text).toContain(`"jpeg":"${Buffer.from(jpeg).toString('base64')}"`)
      relay.clear(generation); expect(new TextDecoder().decode((await reader.read()).value)).toContain('"active":false')
    } finally { controller.abort() }
  })
  it('drops a paused network consumer without blocking another viewer', async () => {
    relay.setEnabled(true)
    const slowUrl = new URL(relay.getUrl()); slowUrl.pathname = '/events'; slowUrl.searchParams.set('viewer', 'slow')
    const slow = await new Promise<import('node:http').IncomingMessage>((resolve) => { request(slowUrl, (response) => { response.pause(); resolve(response) }).end() })
    const controller = new AbortController(), goodUrl = new URL(relay.getUrl()); goodUrl.pathname = '/events'; goodUrl.searchParams.set('viewer', 'good')
    try {
      const good = (await fetch(goodUrl, { signal: controller.signal })).body!.getReader(); await good.read()
      const large = new Uint8Array(256 * 1024); large[0] = 255; large[1] = 216; large[large.length - 2] = 255; large[large.length - 1] = 217
      const generation = relay.beginGeneration()
      for (let i = 0; i < 40; i++) { now += 70; relay.publish({ generation, jpeg: large }); await good.read(); await new Promise((resolve) => setImmediate(resolve)) }
      expect(relay.getStatus().viewers).toBeLessThanOrEqual(2)
      now += 70; relay.publish({ generation, jpeg }); const received = new TextDecoder().decode((await good.read()).value); expect(received.length).toBeGreaterThan(0)
    } finally { slow.destroy(); controller.abort() }
  })
})
