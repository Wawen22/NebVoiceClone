// Local smoke only: browser side is driven through a test adapter. No task is submitted.
import { createRequire } from 'node:module'
import { createServer } from 'node:http'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { spawn } from 'node:child_process'
import assert from 'node:assert/strict'
import { NativeBridge, FrameDecoder, encodeFrame } from '../../src/main/outlier/bridge'
import { InsertionController } from '../../src/main/outlier/insertionController'

async function main(): Promise<void> {
  const require = createRequire(resolve('.superpowers/outlier-smoke/package.json'))
  const { chromium } = require('playwright')
  const html = process.env.NEB_S2S_DEMO ? await readFile(process.env.NEB_S2S_DEMO, 'utf8') : '<!doctype html><html><head><meta charset="utf-8"><title>NEB S2S test locale</title></head><body><h1>Rationale test locale</h1><textarea data-track="comment:notes" style="width:700px;height:250px"></textarea><input id="other"><button>Submit (non premuto)</button></body></html>'
  const server = createServer((req, res) => { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(req.url === '/' ? html : '') })
  await new Promise<void>((ready) => server.listen(0, '127.0.0.1', ready))
  const address = server.address() as { port: number }
  const url = 'http://127.0.0.1:' + address.port + '/'
  const browser = await chromium.launch({ channel: 'msedge', headless: false })
  // Only this isolated local adapter injects its shim as a page script; real content scripts use the extension context.
  const context = await browser.newContext({ bypassCSP: true })
  await context.route('**/*', (route: { request: () => { url: () => string }; continue: () => Promise<void>; abort: () => Promise<void> }) => route.request().url().startsWith(url) ? route.continue() : route.abort())
  const page = await context.newPage()
  await page.goto(url)
  await page.evaluate(() => {
    const root = window as unknown as { chrome: unknown; testListener: unknown; testPastes: number; testSubmits: number }
    root.chrome = { runtime: { onMessage: { addListener: (fn: unknown) => { root.testListener = fn } }, sendMessage: async () => undefined } }
    root.testPastes = 0; root.testSubmits = 0
    document.addEventListener('paste', () => { root.testPastes++ })
    document.addEventListener('submit', (event) => { event.preventDefault(); root.testSubmits++ })
  })
  await page.addScriptTag({ path: resolve('browser-extension/content.js') })
  const target = { tabId: 1, windowId: 1, documentId: '', url, title: await page.title() }
  const inspect = await page.evaluate(() => {
    let result: unknown
    const listener = (window as unknown as { testListener: (m: unknown, sender: unknown, reply: (r: unknown) => void) => void }).testListener
    listener({ action: 'inspect' }, {}, (r) => { result = r })
    return result
  })
  target.documentId = inspect.documentId
  // The bridge callbacks run only after listen/association, below the controller assignment.
  // eslint-disable-next-line prefer-const
  let controller!: InsertionController
  const bridge = new NativeBridge((next) => controller.associate(next), () => controller.disconnect(), (message) => controller.invalidate(message))
  controller = new InsertionController(bridge, true, () => undefined, async () => { await new Promise((ready) => setTimeout(ready, 10)) })
  controller.setStopAvailable(true)
  await bridge.listen()
  const id = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
  bridge.setExtensionId(id)
  const hostPath = resolve('.superpowers/outlier-test/outlier-host')
  await writeFile(join(hostPath, 'connection.json'), JSON.stringify({ origin: 'chrome-extension://' + id + '/', pipeName: bridge.pipeName, token: bridge.token }))
  const host = spawn(join(hostPath, 'NEBOutlierHost.exe'), ['chrome-extension://' + id + '/'], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] })
  const decoder = new FrameDecoder()
  host.stderr.on('data', (chunk: Buffer) => console.error('Native host:', chunk.toString()))
  host.on('exit', (code) => console.log('Native host exit:', code))
  host.stdout.on('data', (chunk: Buffer) => {
    for (const raw of decoder.push(chunk)) {
      const message = raw as { kind: string; action: string; requestId: string; payload: { expected: string } }
      if (message.kind !== 'browser') continue
      void (async () => {
        try {
          if (message.action === 'prepare') await page.locator('textarea[data-track="comment:notes"]').click()
          const value = await page.evaluate((command: { action: string; expected: string; documentId: string; url: string }) => {
            let result: unknown
            const listener = (window as unknown as { testListener: (m: unknown, sender: unknown, reply: (r: unknown) => void) => void }).testListener
            listener(command, {}, (r) => { result = r })
            return result
          }, { action: message.action, expected: message.payload.expected, documentId: target.documentId, url })
          if (message.action === 'prepare') await new Promise((ready) => setTimeout(ready, 250))
          host.stdin.write(encodeFrame(value.error ? { kind: 'reply', requestId: message.requestId, error: value.error } : { kind: 'reply', requestId: message.requestId, result: { ...value, target } }))
        } catch (error) { host.stdin.write(encodeFrame({ kind: 'reply', requestId: message.requestId, error: String(error) })) }
      })()
    }
  })
  try {
    await page.bringToFront()
    await page.locator('textarea[data-track="comment:notes"]').click()
    console.log('Tra 8 secondi parte la prova. Porta manualmente in primo piano la finestra Edge della fixture e lasciala attiva.')
    await new Promise((ready) => setTimeout(ready, 8000))
    host.stdin.write(encodeFrame({ kind: 'associated', target }))
    console.log('Smoke association sent; native stdin writable:', host.stdin.writable)
    for (let attempt = 0; attempt < 200 && !controller.status.connected; attempt++) await new Promise((ready) => setTimeout(ready, 50))
    assert.equal(controller.status.connected, true, 'native host handshake')
    const text = 'È già pronto: l’apostrofo, 😀 e un paragrafo.\n' + 'Rationale scritto personalmente. '.repeat(3)
    const result = await controller.start({ projectId: 's2s', text, charactersPerMinute: 600 })
    console.log('Native insertion:', result.phase, result.message)
    assert.equal(result.phase, 'completed')
    assert.equal(await page.locator('textarea[data-track="comment:notes"]').inputValue(), text)
    assert.equal(await page.evaluate(() => (window as unknown as { testPastes: number }).testPastes), 0)
    assert.equal(await page.evaluate(() => (window as unknown as { testSubmits: number }).testSubmits), 0)
    await controller.start({ projectId: 's2s', text, charactersPerMinute: 600 })
    assert.equal(controller.status.phase, 'error', 'nonempty destination rejected')
    await page.screenshot({ path: resolve('.superpowers/outlier-smoke/native-result.png') })
    console.log('PASS: Windows host framing, actual Edge typing, exact accents/emoji/newline, no paste/submit, nonempty rejection.')
  } finally { bridge.close(); host.stdin.end(); host.kill(); await browser.close(); server.close() }
}
main().catch((error) => { console.error(error); process.exitCode = 1 })
