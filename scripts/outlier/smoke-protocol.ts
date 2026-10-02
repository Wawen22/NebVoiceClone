import { spawn } from 'node:child_process'
import { writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import assert from 'node:assert/strict'
import { NativeBridge, encodeFrame } from '../../src/main/outlier/bridge'

async function main(): Promise<void> {
  let receiveAudio!: (packet: unknown) => void
  const audio = new Promise<unknown>((resolve) => { receiveAudio = resolve })
  const bridge = new NativeBridge(() => undefined, () => undefined, () => undefined, receiveAudio)
  const id = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
  bridge.setExtensionId(id)
  await bridge.listen()
  const directory = resolve('.superpowers/outlier-test/outlier-host')
  await writeFile(join(directory, 'connection.json'), JSON.stringify({ origin: 'chrome-extension://' + id + '/', pipeName: bridge.pipeName, token: bridge.token }))
  const host = spawn(join(directory, 'NEBOutlierHost.exe'), ['chrome-extension://' + id + '/'], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] })
  try {
    for (let attempt = 0; attempt < 100 && !bridge.hostProcessId; attempt++) await new Promise((ready) => setTimeout(ready, 20))
    assert.ok(bridge.hostProcessId, 'authenticated native handshake')
    const packet = { kind: 's2sAudio', type: 'pcm', captureId: 'smoke', sequence: 0, pcm: Buffer.alloc(3200).toString('base64') }
    host.stdin.write(encodeFrame(packet))
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      assert.deepEqual(await Promise.race([audio, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Audio forwarding timed out')), 3000) })]), packet)
    } finally { clearTimeout(timer) }
    await assert.rejects(bridge.request('native', 'probe', { expected: '' }))
    await assert.rejects(bridge.request('native', 'type', { text: 'x', expected: '', lease: { hwnd: '1', controlId: 'invalid' } }))
    console.log('PASS: Windows host, authenticated full-duplex transport, PCM forwarding, unassociated probe/type denied; no keyboard input.')
  } finally { bridge.close(); host.stdin.end(); host.kill() }
}
main().catch((error) => { console.error(error); process.exitCode = 1 })
