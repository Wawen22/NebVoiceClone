import { spawn } from 'node:child_process'
import { writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import assert from 'node:assert/strict'
import { NativeBridge } from '../../src/main/outlier/bridge'

async function main(): Promise<void> {
  const bridge = new NativeBridge(() => undefined, () => undefined, () => undefined)
  const id = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
  bridge.setExtensionId(id)
  await bridge.listen()
  const directory = resolve('.superpowers/outlier-test/outlier-host')
  await writeFile(join(directory, 'connection.json'), JSON.stringify({ origin: 'chrome-extension://' + id + '/', pipeName: bridge.pipeName, token: bridge.token }))
  const host = spawn(join(directory, 'NEBOutlierHost.exe'), ['chrome-extension://' + id + '/'], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] })
  try {
    for (let attempt = 0; attempt < 100 && !bridge.hostProcessId; attempt++) await new Promise((ready) => setTimeout(ready, 20))
    assert.ok(bridge.hostProcessId, 'authenticated native handshake')
    await assert.rejects(bridge.request('native', 'probe', { expected: '' }))
    await assert.rejects(bridge.request('native', 'type', { text: 'x', expected: '', lease: { hwnd: '1', controlId: 'invalid' } }))
    console.log('PASS: Windows host, authenticated full-duplex transport, unassociated probe/type denied; no keyboard input.')
  } finally { bridge.close(); host.stdin.end(); host.kill() }
}
main().catch((error) => { console.error(error); process.exitCode = 1 })
