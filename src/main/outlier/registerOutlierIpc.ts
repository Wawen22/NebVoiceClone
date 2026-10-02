import { app, ipcMain, shell, type WebContents } from 'electron'
import { join, resolve } from 'node:path'
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { ProjectStore } from './projectStore'
import { NativeBridge } from './bridge'
import { InsertionController } from './insertionController'
import { AudioCaptureRelay } from './audioCapture'
import { insertionLocked, parseInsertionRequest, type OutlierSetup } from '../../shared/outlier'

const execute = promisify(execFile)
export function registerOutlierIpc(getWebContents: () => WebContents | undefined): { controller: InsertionController; close: () => void; initialize: () => Promise<void> } {
  const supported = process.platform === 'win32'
  const root = app.isPackaged ? app.getAppPath() : resolve(__dirname, '../..')
  const extensionPath = join(root, 'browser-extension')
  const hostDirectory = join(app.getPath('userData'), 'outlier-host')
  const configPath = join(hostDirectory, 'connection.json')
  const store = new ProjectStore(join(app.getPath('userData'), 'outlier-projects.json'))
  const audio = new AudioCaptureRelay((event) => {
    const web = getWebContents()
    if (web && !web.isDestroyed()) web.send('s2s:audio', event)
  })
  const bridge = new NativeBridge((target) => {
    if (audio.status.state === 'active') audio.disconnect('Scheda associata nuovamente: riavvia l’ascolto.')
    controller.associate(target)
  }, () => { audio.disconnect('Collegamento Edge interrotto.'); controller.disconnect() }, (message, reason) => {
    if (reason !== 'focus') audio.disconnect('Scheda o destinazione cambiata.')
    controller.invalidate(message, reason)
  }, (packet) => audio.receive(packet, controller.status.target))
  const controller = new InsertionController(bridge, supported, (status) => {
    const web = getWebContents()
    if (web && !web.isDestroyed()) web.send('outlier:status', status)
  }, undefined, async (request, signal) => {
    const project = (await store.read()).projects.find((entry) => entry.id === request.projectId)
    signal.throwIfAborted()
    if (!project || project.archived || project.integration !== 's2s') throw new Error('Seleziona un progetto S2S attivo.')
    if (bridge.hostProcessId) {
      try { await execute(join(hostDirectory, 'NEBOutlierHost.exe'), ['--grant', String(bridge.hostProcessId)], { windowsHide: true, timeout: 2000, signal }) }
      catch { /* Activation still verifies foreground; an aborted grant never starts typing. */ }
    }
    signal.throwIfAborted()
  })
  function trust(sender: WebContents, frame: Electron.WebFrameMain | null): void {
    if (sender !== getWebContents() || frame !== sender.mainFrame) throw new Error('Untrusted window.')
  }
  let installing = false
  const setup = async (): Promise<OutlierSetup> => {
    let extensionId: string | null = null
    try {
      const config = JSON.parse(await readFile(configPath, 'utf8'))
      const match = typeof config.origin === 'string' && /^chrome-extension:\/\/([a-p]{32})\/$/.exec(config.origin)
      if (match) extensionId = match[1]
    } catch { /* No registration has been configured yet. */ }
    return { extensionPath, extensionId, installed: Boolean(extensionId && existsSync(join(hostDirectory, 'NEBOutlierHost.exe'))) }
  }
  async function writeConnection(id: string): Promise<void> {
    bridge.setExtensionId(id)
    await mkdir(hostDirectory, { recursive: true })
    const temporary = configPath + '.tmp'
    await writeFile(temporary, JSON.stringify({ origin: 'chrome-extension://' + id + '/', pipeName: bridge.pipeName, token: bridge.token }), { mode: 0o600 })
    await rename(temporary, configPath)
  }
  ipcMain.handle('outlier:get', (event) => { trust(event.sender, event.senderFrame); return store.read() })
  ipcMain.handle('outlier:save', (event, value: unknown) => {
    trust(event.sender, event.senderFrame)
    if (insertionLocked(controller.status) || installing) throw new Error('Ferma l’inserimento prima di modificare i progetti.')
    return store.save(value)
  })
  ipcMain.handle('outlier:getStatus', (event) => { trust(event.sender, event.senderFrame); return controller.status })
  ipcMain.handle('s2s:audioStatus', (event) => { trust(event.sender, event.senderFrame); return audio.status })
  ipcMain.handle('s2s:stopAudio', async (event) => {
    trust(event.sender, event.senderFrame)
    audio.disconnect('Ascolto fermato da NEB.')
    try { await bridge.request('browser', 'audio-stop', {}) } catch { /* A disconnected extension cannot send more audio. */ }
  })
  ipcMain.handle('outlier:start', async (event, value: unknown) => {
    trust(event.sender, event.senderFrame)
    if (installing) throw new Error('Attendi la configurazione del collegamento.')
    const request = parseInsertionRequest(value)
    return controller.start(request)
  })
  ipcMain.handle('outlier:pause', (event) => { trust(event.sender, event.senderFrame); return controller.pause() })
  ipcMain.handle('outlier:resume', (event, value?: unknown) => {
    trust(event.sender, event.senderFrame)
    const request = value ? parseInsertionRequest(value) : undefined
    return controller.resume(request)
  })
  ipcMain.handle('outlier:stop', (event) => { trust(event.sender, event.senderFrame); return controller.stop() })
  ipcMain.handle('outlier:setup', (event) => { trust(event.sender, event.senderFrame); return setup() })
  ipcMain.handle('outlier:openExtension', async (event) => {
    trust(event.sender, event.senderFrame)
    const error = await shell.openPath(extensionPath)
    if (error) throw new Error(error)
  })
  ipcMain.handle('outlier:install', async (event, id: unknown) => {
    trust(event.sender, event.senderFrame)
    if (!supported || typeof id !== 'string' || !/^[a-p]{32}$/.test(id)) throw new Error('Inserisci l’ID completo dell’estensione Edge (32 lettere a–p).')
    if (installing || insertionLocked(controller.status)) throw new Error('Ferma l’inserimento prima di configurare il collegamento.')
    installing = true
    try {
      bridge.setExtensionId(id)
      await execute('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', join(root, 'scripts', 'outlier', 'setup-host.ps1'), '-ExtensionId', id, '-DataDirectory', app.getPath('userData')], { windowsHide: true, timeout: 60_000 })
      await writeConnection(id)
      return setup()
    } catch {
      throw new Error('Configurazione Windows non riuscita. Verifica che NEB possa compilare l’host e che non sia già in esecuzione; poi riprova.')
    } finally { installing = false }
  })
  return {
    controller,
    close: () => { controller.stop(); audio.disconnect('NEB chiuso.'); bridge.close() },
    initialize: async () => {
      if (!supported) return
      await bridge.listen()
      const current = await setup()
      if (current.installed && current.extensionId) await writeConnection(current.extensionId)
    }
  }
}
